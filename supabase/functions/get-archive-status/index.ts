/**
 * Edge Function: get-archive-status — kaçırılan gün envanteri (K-46, R-C)
 *
 * K-46: "Tek paywall tetikleyicisi: 2. kaçırılan gün → arşiv. İlk kaçırma
 * ücretsiz telafi." Bu fonksiyon o tetikleyicinin OKUMA tarafıdır: kullanıcının
 * son penceresindeki günleri tamamlanmış/kaçırılmış olarak sınıflandırır ve
 * kaçırılan günler için gösterilebilir içeriği (o günün global seçkisi) döner.
 *
 * ── Neden sunucuda ───────────────────────────────────────────────────────────
 * "İstemci asla durum türetmez" ilkesi (types/gauntlet.ts B.4 notu) burada da
 * geçerli. Kaçırılan gün hesabı bir tarih aralığı üretip mevcut satırlarla
 * SET FARKI almayı gerektirir: olmayan satır hiçbir WHERE koşuluna girmez, yani
 * "eksik gün" sorguyla değil, üretilen takvimle bulunur. Bu mantık istemcide
 * yaşasaydı iki farklı istemci sürümü iki farklı missedCount üretebilirdi.
 *
 * ── Kaçırılan gün tanımı (CTO kararı, 31 Ağu 2026) ───────────────────────────
 * Tek koşul: `champion_film_id IS NULL`. Satırın var olup olmaması fark etmez —
 * hiç açmamak da, açıp yarıda bırakmak da ritüeli tamamlamamaktır. Satır YOKSA
 * da champion yoktur, yani iki durum aynı kuralla kapanır.
 *
 * ── Anchor ───────────────────────────────────────────────────────────────────
 * Sayım `users.created_at`'ten değil, kullanıcının İLK personal gauntlet
 * satırından başlar. Hesap açıp uygulamayı hiç açmamış günleri "kaçırdı"
 * saymak yanlış olurdu (R-A'da auth gate kalkıyor, iki an daha da ayrışacak).
 *
 * ── Pencere: 7 gün ───────────────────────────────────────────────────────────
 * Arşiv en fazla 7 gün geriye gider. Daha eskisi sessizce gizlenmez, `too_old`
 * olarak işaretlenip istemcide açık mesajla kapatılır (K-43: sessiz boşluk yok).
 *
 * ── Bilinen sınırlama: gün anahtarı UTC ──────────────────────────────────────
 * `utcDateString()` kullanılıyor, kullanıcı-yerel gün değil. UTC+3'te gece
 * yarısından hemen sonra açan kullanıcı için sınıflandırma ±1 gün kayabilir.
 * CTO kararı (31 Ağu 2026): M2 Faz 2b beklenmeden UTC ile kurulur, kayma bilinen
 * sınırlama olarak taşınır. `daily_gauntlets.date` zaten UTC yazıldığı için bu
 * fonksiyon tabloyla TUTARLIDIR; düzeltme M2'de iki taraf birden yapılır.
 *
 * ── Kapsam dışı ──────────────────────────────────────────────────────────────
 * Kaçırılan gün için KİŞİSEL gauntlet geriye dönük üretilmez — `generate-gauntlet`
 * tarih parametresi almaz ve kilitli sözleşme bu turda açılmaz. Gösterilen
 * içerik o günün `scope='global'` satırıdır: gerçek ama kişiselleştirilmemiş.
 * İstemci kopyası bunu dürüstçe söyler ("o günün seçkisi"), kişiselleştirme
 * vaadi vermez.
 *
 * Bu fonksiyon HİÇBİR ŞEY YAZMAZ. Salt okuma.
 *
 * Deploy: supabase functions deploy get-archive-status
 * (verify_jwt varsayılan `true` kalır — istemci JWT'siyle çağrılır, config.toml'a
 *  eklenmez; oradaki liste yalnız `--no-verify-jwt` ile deploy edilenleri sayar.)
 */

import {
  AuthError,
  errorResponse,
  getServiceClient,
  getUserClient,
  handleCors,
  jsonResponse,
  logError,
  logInfo,
  requireAuthUser,
  resolveAppUser,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import {
  fetchCandidatesByIds,
  toGauntletFilm,
  utcDateString,
} from '../_shared/gauntletCore.ts'
import type { GauntletFilm } from '../../../types/gauntlet.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Sabitler ────────────────────────────────────────────────────────────────

/** Arşivin geriye gidebileceği en fazla gün sayısı (CTO kararı, 31 Ağu 2026). */
const ARCHIVE_WINDOW_DAYS = 7

/**
 * K-46 eşiği: bu kadar kaçırılan günden İTİBAREN arşiv paywall'ı tetiklenir.
 * İlk kaçırma ücretsiz telafidir, yani eşik 2'dir — 1 değil.
 */
const PAYWALL_THRESHOLD = 2

/**
 * Katılım şartı (CTO kararı, 31 Ağu 2026 — Parça 2a düzeltmesi).
 *
 * K-46'nın niyeti "zaten meşgul olan ama arada iki gün kaçıran kullanıcıya
 * telafi teklif etmek"tir; "haftalardır kaybolmuş kullanıcıyı geri döndüğü anda
 * satışla karşılamak" DEĞİL. Yalnız `missedCount >= 2` koşulu ikincisini üretir:
 * canlı veri simülasyonunda (31 Ağu 2026) personal satırı olan 6 kullanıcının
 * 6'sı da 7/7 kaçırmış görünüp `archiveEligible: true` dönüyordu — yani ara
 * veren HERKES, dönüş anında ritüel yerine paywall görecekti. G-9 ("14 günde
 * kayıp <%20") ve E-10'un freemium gerekçesi doğrudan buna aykırı.
 *
 * Şart: pencerede EN AZ bu kadar tamamlanmış gün olmalı. Dolaylı bir "grace
 * day" hilesi değil, niyetin kendisi — telafi ancak katılan kullanıcıya
 * teklif edilir.
 */
const MIN_COMPLETED_FOR_ELIGIBILITY = 1

// ─── Tipler ──────────────────────────────────────────────────────────────────

type DayStatus = 'completed' | 'missed' | 'too_old'

interface ArchiveDay {
  /** YYYY-MM-DD (UTC gün anahtarı). */
  date: string
  status: DayStatus
  /**
   * Yalnızca `status === 'missed'` ve o güne ait global seçki bulunduğunda
   * dolu. Bulunamadıysa alan HİÇ EKLENMEZ — `null` göndermek "içerik var ama
   * boş" gibi okunur; istemci yokluğu açık `unavailable` dalı olarak ele alır.
   */
  globalFilms?: GauntletFilm[]
  /** Global seçki bulunamadığında true. `globalFilms` ile birlikte gelmez. */
  unavailable?: boolean
}

interface ArchiveStatus {
  missedCount: number
  /** Penceredeki tamamlanmış gün sayısı — katılım şartının ölçüsü. */
  completedCount: number
  archiveEligible: boolean
  /** Anchor'dan önceki günler hiç sayılmaz; bu alan anchor'ın kendisidir. */
  anchorDate: string | null
  days: ArchiveDay[]
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

/**
 * Kullanıcının İLK personal gauntlet tarihi. Satır hiç yoksa null döner —
 * kullanıcı ritüele hiç girmemiştir, hiçbir günü "kaçırmış" sayılmaz.
 */
async function findAnchorDate(
  service: SupabaseClient,
  appUserId: string,
): Promise<string | null> {
  const { data, error } = await service
    .from('daily_gauntlets')
    .select('date')
    .eq('user_id', appUserId)
    .eq('scope', 'personal')
    .order('date', { ascending: true })
    .limit(1)

  if (error) throw new Error(`anchor sorgusu başarısız: ${error.message}`)
  const rows = (data ?? []) as { date: string }[]
  return rows[0]?.date ?? null
}

/** [from, to] arası kapalı aralıktaki UTC gün anahtarları, artan sırada. */
function dateRange(from: string, to: string): string[] {
  const out: string[] = []
  const cur = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cur.getTime() <= end.getTime()) {
    out.push(cur.toISOString().slice(0, 10))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

/**
 * Penceredeki personal satırlar: tarih → champion var mı.
 * Satırı OLMAYAN gün bu map'te hiç görünmez; çağıran yokluğu `missed` sayar.
 */
async function fetchPersonalDays(
  service: SupabaseClient,
  appUserId: string,
  from: string,
  to: string,
): Promise<Map<string, boolean>> {
  const { data, error } = await service
    .from('daily_gauntlets')
    .select('date,champion_film_id')
    .eq('user_id', appUserId)
    .eq('scope', 'personal')
    .gte('date', from)
    .lte('date', to)

  if (error) throw new Error(`personal gün sorgusu başarısız: ${error.message}`)
  const map = new Map<string, boolean>()
  for (const row of (data ?? []) as { date: string; champion_film_id: string | null }[]) {
    map.set(row.date, row.champion_film_id !== null)
  }
  return map
}

/**
 * Kaçırılan tarihlerin global seçkileri: tarih → 4 film.
 * Global slot cron'u 7 Ağu 2026'da kuruldu; ondan eski tarihlerde satır YOKTUR
 * ve bu bir hata değildir — çağıran o günü `unavailable` işaretler.
 */
async function fetchGlobalSelections(
  service: SupabaseClient,
  dates: string[],
): Promise<Map<string, GauntletFilm[]>> {
  const out = new Map<string, GauntletFilm[]>()
  if (dates.length === 0) return out

  const { data, error } = await service
    .from('daily_gauntlets')
    .select('date,film_ids')
    .eq('scope', 'global')
    .in('date', dates)

  if (error) throw new Error(`global seçki sorgusu başarısız: ${error.message}`)
  const rows = (data ?? []) as { date: string; film_ids: string[] }[]
  if (rows.length === 0) return out

  // Tek film sorgusu — tarih başına ayrı çağrı N+1 üretirdi.
  const allIds = [...new Set(rows.flatMap((r) => r.film_ids ?? []))]
  const byId = await fetchCandidatesByIds(service, allIds)

  for (const row of rows) {
    const films: GauntletFilm[] = []
    for (const id of row.film_ids ?? []) {
      const c = byId.get(id)
      // Film arşivlenmiş/silinmişse atlanır. Eksik kadroyu 4'e tamamlamıyoruz:
      // o günün seçkisi neyse odur, uydurma yapılmaz.
      if (c) films.push(toGauntletFilm(c))
    }
    if (films.length > 0) out.set(row.date, films)
  }
  return out
}

// ─── Çekirdek ────────────────────────────────────────────────────────────────

async function buildArchiveStatus(
  service: SupabaseClient,
  appUserId: string,
): Promise<ArchiveStatus> {
  const anchor = await findAnchorDate(service, appUserId)
  if (!anchor) {
    // Ritüele hiç girmemiş kullanıcı: kaçırılan gün kavramı tanımsız.
    return {
      missedCount: 0,
      completedCount: 0,
      archiveEligible: false,
      anchorDate: null,
      days: [],
    }
  }

  // Pencere dünde biter — bugün henüz kaçırılmış sayılamaz (18:00 kapısı da
  // bugünün hükmünü gün bitmeden vermeyi engeller).
  const yesterday = utcDateString(-1)
  const windowStart = utcDateString(-ARCHIVE_WINDOW_DAYS)

  // Anchor pencereden eskiyse pencere kazanır; yeniyse anchor kazanır.
  const from = anchor > windowStart ? anchor : windowStart

  if (from > yesterday) {
    // Kullanıcı bugün katıldı: değerlendirilecek geçmiş gün yok.
    return {
      missedCount: 0,
      completedCount: 0,
      archiveEligible: false,
      anchorDate: anchor,
      days: [],
    }
  }

  const dates = dateRange(from, yesterday)
  const personal = await fetchPersonalDays(service, appUserId, from, yesterday)

  const days: ArchiveDay[] = dates.map((date) => ({
    date,
    // Tek kural: champion yoksa kaçırılmıştır. Satır yoksa da champion yoktur.
    status: personal.get(date) === true ? 'completed' : 'missed',
  }))

  // Anchor pencereden eskiyse, pencere dışında kalan geçmiş VARDIR ama
  // gösterilmez. Bunu sessizce yutmuyoruz: istemci açık mesaj gösterebilsin
  // diye tek bir `too_old` işareti eklenir (gün gün listelemek, kullanıcının
  // hiç göremeyeceği bir takvimi şişirmek olurdu).
  if (anchor < windowStart) {
    days.unshift({ date: anchor, status: 'too_old' })
  }

  const missedDates = days.filter((d) => d.status === 'missed').map((d) => d.date)
  const globals = await fetchGlobalSelections(service, missedDates)

  for (const day of days) {
    if (day.status !== 'missed') continue
    const films = globals.get(day.date)
    if (films) day.globalFilms = films
    else day.unavailable = true
  }

  const missedCount = missedDates.length
  const completedCount = days.filter((d) => d.status === 'completed').length
  return {
    missedCount,
    completedCount,
    archiveEligible:
      missedCount >= PAYWALL_THRESHOLD &&
      completedCount >= MIN_COMPLETED_FOR_ELIGIBILITY,
    anchorDate: anchor,
    days,
  }
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST' && req.method !== 'GET') {
    return errorResponse('METHOD_NOT_ALLOWED', 'GET veya POST bekleniyor', 405)
  }

  let appUserId: string
  const service = getServiceClient()

  try {
    const userClient = getUserClient(req)
    const { authUid } = await requireAuthUser(userClient)
    const appUser = await resolveAppUser(service, authUid)
    appUserId = appUser.id
  } catch (err) {
    if (err instanceof AuthError) {
      logError('archive_auth_failed', err)
      return errorResponse('UNAUTHORIZED', 'Oturum doğrulanamadı', 401)
    }
    logError('archive_auth_error', err)
    await sentryCapture({
      message: 'get-archive-status: kimlik çözümleme hatası',
      level: 'error',
      tags: { function: 'get-archive-status' },
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
    return errorResponse('AUTH_ERROR', 'Kimlik doğrulama başarısız', 500)
  }

  try {
    const status = await buildArchiveStatus(service, appUserId)
    logInfo('archive_status_built', {
      user_id: appUserId,
      missed_count: status.missedCount,
      completed_count: status.completedCount,
      eligible: status.archiveEligible,
      day_count: status.days.length,
    })
    return jsonResponse(status)
  } catch (err) {
    logError('archive_status_failed', err, { user_id: appUserId })
    await sentryCapture({
      message: 'get-archive-status: durum üretilemedi',
      level: 'error',
      tags: { function: 'get-archive-status' },
      extra: {
        user_id: appUserId,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return errorResponse('ARCHIVE_STATUS_FAILED', 'Arşiv durumu alınamadı', 500)
  }
})
