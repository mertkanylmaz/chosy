/**
 * Edge Function: generate-gauntlet — günün 4 filmi (B.3, v0)
 *
 * Katman 3. Algoritmanın TAMAMI `_shared/gauntletCore.ts` içinde, tam izole.
 * İstemci "neden bu 4 film" bilgisini ASLA almaz — response
 * `types/gauntlet.ts`'teki kilitli `DailyGauntlet` şeklidir, skor/percentile/
 * aday havuzu dışarı sızmaz.
 *
 * v0'da kişiselleştirme YOK: bağlam filtresi + tanınırlık puanı + çeşitlilik
 * kuralları + ağırlıklı rastgele seçim. Kişiselleştirme veri biriktikçe
 * eklenecek bir ÇARPAN (PRODUCT_OS §6.10).
 *
 * Boru hattı (PRODUCT_OS §6.3):
 *   [1] SERT FİLTRE  → bağlama göre aday havuzu      ┐ buildScoredPool()
 *   [2] PUANLAMA     → tanınırlık, yüzdelik          ┘
 *   [3] ÇEŞİTLİLİK   → 4 film — asıl iş              → selectQuartet()
 *   [4] SLOT         → global / personal / discovery
 *   [5] SIRA KARIŞTIRMA                              → arrangeUnseen()
 *
 * ── E-19'da ne değişti (19 Eyl 2026, CTO onaylı) ────────────────────────────
 * İKİ üretim dalı var. Ayrımı `launch_date`'e göre hesaplanan `day_number`
 * yapar; 1-100 aralığındaysa editoryal, değilse (yayın öncesi ya da takvim
 * bitti) yukarıdaki algoritmik boru hattı.
 *
 *   DAL A — editoryal → generateEditorialQuartet()  · boru hattı yalnız izlenen
 *                                                     film varsa yedek için çalışır
 *   DAL B — algoritmik → generateQuartet()          · yukarıdaki 5 adım
 *
 * Dallanmanın DEĞMEDİĞİ yerler: idempotency, cached serve, deriveProgress,
 * INSERT şekli, response şekli. İkisi de `GeneratedQuartet` döndürür.
 *
 * ── E-21'de ne değişti (27 Eyl 2026, CTO onaylı) ────────────────────────────
 * İstek `cycle: 'previous'` taşırsa ve kullanıcının sıfır kişisel satırı varsa
 * gauntlet ÖNCEKİ döngünün anahtarıyla (`_shared/previousCycle.ts`) üretilir,
 * satır `cycle='previous'` (migration 118) işaretlenir. Uygun değilse 409
 * `PREVIOUS_CYCLE_NOT_ELIGIBLE` / `PREVIOUS_CYCLE_OUT_OF_WINDOW`. Alan yoksa
 * akış birebir eskisi. Idempotency / üretim / 23505 yolu iki durumda ORTAK.
 *
 * ── B.4'te ne değişti ────────────────────────────────────────────────────────
 * Boru hattı fonksiyonları `_shared/gauntletCore.ts`'e TAŞINDI (mantık aynen
 * korundu, davranış değişmedi). Sebep: submit-choice'un `neither`/`seen`
 * dalları tur harcamadan yeni aday seçmek için AYNI mantığı çağırmak zorunda.
 * Bu dosya `Deno.serve` içerdiği için import edilemez — import anında ikinci
 * bir sunucu kurardı. Mantığı kopyalamak ise ıraksayan iki algoritma üretirdi:
 * eşik/cooldown değişikliği iki yerde yapılmazsa üretim ile yenileme farklı
 * havuz görürdü.
 *
 * ── Bu dosyanın YAZMADIĞI şey ────────────────────────────────────────────────
 * `duel_impressions` B.4'ün (submit-choice) işidir: "her seçim →
 * choice_events + duel_impressions". Burada yalnızca OKUNUR (ADIM 1 çift
 * filtresi). Üretim anında yazmak, gösterilmemiş çiftleri gösterilmiş
 * saymak olurdu.
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
  editorialDayNumber,
  editorialSlotTypes,
  fetchEditorialQuartet,
  fetchLaunchDate,
  applyWatchedReplacements,
  fetchWatchedAmong,
} from '../_shared/editorialCalendar.ts'
import {
  arrangeUnseen,
  buildScoredPool,
  type Candidate,
  fetchCandidatesByIds,
  MAX_QUARTET_ATTEMPTS,
  pickReplacements,
  type ScoredPool,
  selectQuartet,
  toGauntletFilm,
} from '../_shared/gauntletCore.ts'
import {
  chosenBeforeCycleStart,
  cycleDate,
  cycleStartAt,
  isValidTimeZone,
  nextCycleAt,
} from '../_shared/cycleDate.ts'
import { decidePreviousCycle, resolvePreviousCycle } from '../_shared/previousCycle.ts'
import type {
  DailyGauntlet,
  GauntletContext,
  GauntletFilm,
  GauntletProgress,
  PendingWatchFeedback,
} from '../../../types/gauntlet.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Sabitler ────────────────────────────────────────────────────────────────

const ALGORITHM_VERSION = 'v0-random-diverse'

/**
 * Editoryal dalın versiyon etiketi (E-19).
 *
 * AYRI bir sabit olması zorunlu: `algorithm_version` her `choice_events` ve
 * `daily_gauntlets` satırına yazılır ve amacı "bu sinyal hangi üretim yolundan
 * geldi" sorusunu sonradan cevaplayabilmektir (chosy-conventions §6). İki yol
 * aynı etiketi taşısaydı, ilk 100 günün verisi algoritmik dönemden ayırt
 * edilemezdi ve §6'nın "algoritma değiştiğinde geçmiş yeniden hesaplanabilmeli"
 * garantisi çökerdi.
 */
const EDITORIAL_ALGORITHM_VERSION = 'v1-editorial-calendar'

/**
 * Yenileme hakkı: Free 2/gün · Pro sınırsız (PRODUCT_OS §"Yenileme hakkı").
 * Entitlement kontrolü ve harcanan hakkın düşülmesi B.4'ün işi — burada
 * yalnızca gün başı Free tabanı raporlanır.
 */
const REFRESHES_PER_DAY_FREE = 2

/**
 * Tam güven için gereken ham sinyal sayısı: 6 gün × 3 tur (PRODUCT_OS §6.6,
 * "6 günde temel profil oturur"). userConfidence bu orandan türetilir.
 */
const SIGNALS_FOR_FULL_CONFIDENCE = 18

// ─── Tipler ──────────────────────────────────────────────────────────────────

/**
 * Yanıt = kilitli `DailyGauntlet` + EKLEMELİ `next_cycle_at` (bir sonraki yerel
 * 18:00, ISO 8601 UTC). `types/gauntlet.ts` DEĞİŞMEZ: eski istemciler alanı
 * görmezden gelir, yeni istemci sayacı bundan kurar.
 */
type GauntletResponse = DailyGauntlet & { next_cycle_at: string }

interface GenerateRequest {
  context?: unknown
  /**
   * Kullanıcının IANA saat dilimi (örn. "Europe/Istanbul"). F1'den beri
   * ZORUNLU: gün anahtarı (`date` = cycle tarihi) sunucuda bu alandan
   * hesaplanır. Yok ya da geçersizse 400 `TZ_REQUIRED` — sessiz UTC yok.
   *
   * Geçerli ve `users.timezone`'dan farklıysa kolona yazılır (M2 Faz 2a
   * write-through, davranış korunur).
   */
  timezone?: unknown
  /**
   * E-21 — önceki döngü niyet bayrağı (`GauntletCycle`). Yalnız `'previous'`
   * kabul edilir; alan yoksa davranış E-21 öncesiyle birebir aynıdır. İstemci
   * TARİH göndermez — anahtar `timezone`'dan sunucuda hesaplanır.
   */
  cycle?: unknown
}

// ─── Girdi doğrulama ─────────────────────────────────────────────────────────

const COMPANIONS = ['alone', 'partner', 'friends', 'family']
const DURATIONS = ['short', 'medium', 'any']
const ENERGIES = ['drained', 'normal', 'open']

/**
 * `GauntletContext` şekil doğrulaması. `types/gauntlet.ts` dış paket
 * kullanmama kuralını izler — literal kontrolü, Zod yok.
 */
function isValidContext(v: unknown): v is GauntletContext {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (
    typeof c.companion === 'string' && COMPANIONS.includes(c.companion) &&
    typeof c.duration === 'string' && DURATIONS.includes(c.duration) &&
    typeof c.energy === 'string' && ENERGIES.includes(c.energy)
  )
}

// ─── Write-through saat dilimi ───────────────────────────────────────────────

/**
 * İstemcinin bildirdiği IANA saat dilimini `users.timezone`'a yazar.
 *
 * ── Neden burada ────────────────────────────────────────────────────────────
 * M2 Faz 1 ölçümü (18 Ağu 2026, 237 satır): kullanıcıların 229'unda bu kolon
 * kolon DEFAULT'u olan 'UTC' değerindeydi. Sebep, kolonun tek yazıcısının
 * `save_push_token` RPC'si olması ve o yolun yalnızca push izni verilmiş
 * kullanıcıda çalışması (`pushNotifications.ts` — push token yoksa erken
 * return). Yani timezone, push iznine rehin düşmüştü.
 *
 * generate-gauntlet ritüelin HER GÜN çağrılan tek noktasıdır; buraya bağlanan
 * write-through, push izninden bağımsız olarak kolonu doldurur.
 *
 * ── Neden ritüeli düşürmez ──────────────────────────────────────────────────
 * Saat dilimi yazımı YAN ETKİDİR, gauntlet'in ön koşulu değil. Yazma hatası
 * kullanıcının o akşamki ritüelini engellememeli. Ama sessizce de geçilmez
 * (CLAUDE.md kural 1): hata log'a ve Sentry'ye düşer.
 */
async function persistTimezone(
  service: SupabaseClient,
  appUserId: string,
  timezone: string,
): Promise<void> {
  const current = await service
    .from('users')
    .select('timezone')
    .eq('id', appUserId)
    .maybeSingle()

  if (current.error) {
    logError('gauntlet_tz_read_failed', current.error, { user_id: appUserId })
    await sentryCapture({
      message: 'generate-gauntlet: users.timezone okunamadı',
      level: 'warning',
      tags: { function: 'generate-gauntlet' },
      extra: { user_id: appUserId, error: current.error.message },
    })
    return
  }

  const stored = (current.data as { timezone: string | null } | null)?.timezone ?? null

  // Değişmediyse yazma: gereksiz UPDATE `users.updated_at` trigger'ını
  // tetikler ve her gauntlet çağrısını sahte bir "profil değişti" olayına
  // çevirirdi.
  if (stored === timezone) return

  const update = await service
    .from('users')
    .update({ timezone })
    .eq('id', appUserId)

  if (update.error) {
    logError('gauntlet_tz_write_failed', update.error, { user_id: appUserId })
    await sentryCapture({
      message: 'generate-gauntlet: users.timezone yazılamadı',
      level: 'warning',
      tags: { function: 'generate-gauntlet' },
      extra: { user_id: appUserId, error: update.error.message },
    })
    return
  }

  // `from` alanı seyahat/DST teşhisi için: Faz 2b'de gün sınırı kaymasının
  // streak'i bozup bozmadığı bu iz üzerinden incelenecek.
  logInfo('gauntlet_tz_updated', { user_id: appUserId, from: stored, to: timezone })
}

// ─── ADIM 4 — SLOT ───────────────────────────────────────────────────────────

/**
 * v0'da `personal` ve `discovery` aynı mantıktır, yalnızca etikettir —
 * kişiselleştirme yok. Sinyalsiz kullanıcıda dördü de `global` etiketlenir.
 *
 * ⚠️ Global slotun gerçek kaynağı (`scope = 'global'` günlük satır) artık
 * ÜRETİLİYOR: `generate-global-slot` + migration 075 cron'u (7 Ağu 2026).
 * Ama bu dosya onu HENÜZ OKUMUYOR — dört film hâlâ aynı kişisel boru hattından
 * gelir, `global` burada yalnızca bir ETİKETTİR. Üretici hazır, tüketici değil;
 * slotların gerçek kaynaklara bağlanması C fazının işi.
 *
 * ⚠️ E-19: bu fonksiyon YALNIZCA algoritmik dalda çağrılır. Editoryal günde
 * dört slot da `'editorial'`dir (`editorialSlotTypes()`) ve `signalCount`
 * alakasızdır — seçim kullanıcı sinyalinden değil takvimden gelir.
 */
function slotTypesFor(signalCount: number): DailyGauntlet['slotTypes'] {
  if (signalCount === 0) return ['global', 'global', 'global', 'global']
  return ['global', 'personal', 'personal', 'discovery']
}

// ─── Response kurulumu ───────────────────────────────────────────────────────

/**
 * Kaydedilmiş gauntlet'in filmlerini `GauntletFilm[]` olarak çözer.
 *
 * ⚠️ M3 Faz 2 — bu fonksiyon KENDİ sorgusunu ve KENDİ dönüşümünü yapıyordu ve
 * `posterUrl` alanına `films.poster_url`'ü HAM haliyle koyuyordu. Yeni-üretim
 * yolu ise `toGauntletFilm` üzerinden `toW500PosterUrl` normalizasyonunu
 * uyguluyordu. Sonuç, günün ilk çağrısında w500 / ikinci çağrısında ham değer
 * dönen iki ıraksak yoldu.
 *
 * M3 Faz 1 ölçümü (18 Ağu 2026): düello-uygun havuzun 1.859/1.859'u
 * `poster_url`'ü `/t/p/original/` olarak saklıyor. Ölçülen fark aynı poster
 * için 1223KB'a karşı 57KB — her cached gauntlet yüklemesinde 4 film × 21 kat
 * fazla veri. Ayrıca `seed-database.ts` kaynaklı ham `poster_path` satırları
 * (`/abc.jpg`) geçerli bir URI bile değildir; bu yoldan geçtiklerinde istemci
 * sessizce kırık görsel gösterirdi.
 *
 * Düzeltme, ikinci bir normalizasyon kopyası yazmak DEĞİL: çözümleme artık
 * `fetchCandidatesByIds` + `toGauntletFilm` çiftine devredilir — yeni-üretim
 * yolunun ve `resolvePendingWatchFeedback`in kullandığı AYNI iki fonksiyon.
 * Böylece poster biçimi tek yerde tanımlı kalır ve yollar tekrar ıraksayamaz.
 *
 * `fetchCandidatesByIds` düello-uygunluk kapısını bilinçli olarak UYGULAMAZ
 * (gerekçe orada yazılı): geçmiş bir gauntlet'in filmi bugünkü havuz
 * filtrelerine takılsa bile çözülebilir kalmalıdır.
 */
async function fetchFilmsByIds(
  service: SupabaseClient,
  ids: string[],
): Promise<GauntletFilm[]> {
  const byId = await fetchCandidatesByIds(service, ids)

  // Sıra daily_gauntlets.film_ids'ten gelir — idempotent çağrıda AYNI sıra.
  const films: GauntletFilm[] = []
  for (const id of ids) {
    const c = byId.get(id)
    if (!c) {
      // Film verisinde DELETE yasak (CLAUDE.md #4). Eksik satır ya da
      // normalize edilemeyen `poster_url` veri bütünlüğü anomalisidir —
      // sessizce atlanmaz, dış catch üzerinden Sentry'ye fatal düşer.
      throw new Error(`gauntlet filmi çözümlenemedi: ${id}`)
    }
    films.push(toGauntletFilm(c))
  }
  return films
}

async function countSignals(
  service: SupabaseClient,
  appUserId: string,
): Promise<number> {
  const { count, error } = await service
    .from('choice_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', appUserId)

  if (error) throw new Error(`sinyal sayımı başarısız: ${error.message}`)
  return count ?? 0
}

// ─── Pending watch feedback (C.4) ────────────────────────────────────────────

/**
 * "Dün izledin mi?" adayı — bu kullanıcının BUGÜNDEN ÖNCEKİ en son tarihli
 * champion'a ulaşmış gauntlet'i, henüz watch_feedback satırı yoksa.
 *
 * F2.2 ek kriter: şampiyon MEVCUT cycle başlamadan ÖNCE seçilmiş olmalı
 * (`chosenBeforeCycleStart`). Önceki cycle'ın oyunu 18:00'i geçip 18:03'te
 * biterse 18:05'te gelen yükleme o filmi "dün" diye sormaz.
 * Seçim anı: `daily_gauntlets`'ta tamamlanma zamanı kolonu YOK (`generated_at`
 * satırın ÜRETİM anıdır) — şampiyonu işaretleyen `choice_events` satırının
 * (`round = 3`, `outcome = 'choice'`) `created_at`'i kullanılır; o satır
 * `record_choice_event` ile `champion_film_id` ile AYNI transaction'da yazılır.
 * FK yok (gauntlet_id watch_feedback'te serbest UUID) → PostgREST embed
 * kurulamaz, iki adımlı çözüm fetchExclusions'daki Promise.all deseniyle
 * aynı ruhta: aday satırları çek, feedback'i olanları çıkar.
 */
async function findPendingWatchFeedbackCandidate(
  service: SupabaseClient,
  appUserId: string,
  todayDate: string,
  /** Mevcut cycle'ın başlangıç anı (ISO UTC) — `cycleStartAt(tz, cycleDate)`. */
  cycleStartIso: string,
): Promise<{ gauntletId: string; filmId: string } | null> {
  const { data, error } = await service
    .from('daily_gauntlets')
    .select('id,champion_film_id')
    .eq('user_id', appUserId)
    .eq('scope', 'personal')
    .not('champion_film_id', 'is', null)
    .lt('date', todayDate)
    .order('date', { ascending: false })
    .limit(30) // birkaç günlük olası backlog için tampon — sınırsız değil

  if (error) {
    throw new Error(`pendingWatchFeedback aday sorgusu başarısız: ${error.message}`)
  }
  const rows = (data ?? []) as { id: string; champion_film_id: string }[]
  if (rows.length === 0) return null

  const gauntletIds = rows.map((r) => r.id)
  const { data: fbRows, error: fbError } = await service
    .from('watch_feedback')
    .select('gauntlet_id')
    .in('gauntlet_id', gauntletIds)

  if (fbError) {
    throw new Error(`pendingWatchFeedback feedback sorgusu başarısız: ${fbError.message}`)
  }
  const answered = new Set((fbRows ?? []).map((r) => r.gauntlet_id as string))

  const { data: evRows, error: evError } = await service
    .from('choice_events')
    .select('gauntlet_id,created_at')
    .in('gauntlet_id', gauntletIds)
    .eq('round', 3)
    .eq('outcome', 'choice')
  if (evError) {
    throw new Error(`pendingWatchFeedback şampiyon zamanı sorgusu başarısız: ${evError.message}`)
  }
  const chosenAt = new Map<string, string>(
    ((evRows ?? []) as { gauntlet_id: string; created_at: string }[]).map(
      (r) => [r.gauntlet_id, r.created_at],
    ),
  )

  const pending = rows.find((r) => {
    if (answered.has(r.id)) return false
    const at = chosenAt.get(r.id)
    if (at === undefined) {
      // Şampiyonlu ama seçim olayı yok: veri anomalisi (atomik RPC'den beri
      // oluşmaz). Zaman kapısı doğrulanamaz; eski davranış (`date < bugün`)
      // korunur — soru kaybolmaz. Sessiz değil, iz bırakır.
      logInfo('pending_feedback_champion_event_missing', {
        user_id: appUserId,
        gauntlet_id: r.id,
      })
      return true
    }
    return chosenBeforeCycleStart(at, cycleStartIso)
  })
  return pending ? { gauntletId: pending.id, filmId: pending.champion_film_id } : null
}

/**
 * Adayı `PendingWatchFeedback`e çözer — dominantColor dahil, gauntletCore'un
 * mevcut toGauntletFilm/fetchCandidatesByIds deseniyle (LightBleed bu ekranda
 * da temalanabilsin diye bedava tutarlılık).
 */
async function resolvePendingWatchFeedback(
  service: SupabaseClient,
  appUserId: string,
  todayDate: string,
  cycleStartIso: string,
): Promise<PendingWatchFeedback | null> {
  const candidate = await findPendingWatchFeedbackCandidate(
    service,
    appUserId,
    todayDate,
    cycleStartIso,
  )
  if (!candidate) return null

  const filmsById = await fetchCandidatesByIds(service, [candidate.filmId])
  const c = filmsById.get(candidate.filmId)
  if (!c) {
    // Film verisinde DELETE yasak (CLAUDE.md #4) — bu olmamalı. Olursa veri
    // bütünlüğü anomalisi, sessizce atlanmaz.
    throw new Error(
      `pendingWatchFeedback: şampiyon film bulunamadı: ${candidate.filmId}`,
    )
  }
  return { gauntletId: candidate.gauntletId, film: toGauntletFilm(c) }
}

// ─── Progress türetimi (C.2-0) ───────────────────────────────────────────────

interface AdvancingEvent {
  round: number
  outcome: 'choice' | 'timeout'
  winner: string | null
  film_a: string
  film_b: string
}

/**
 * `types/gauntlet.ts`'teki invariant'ın çalışma zamanı karşılığı. Zod YOK —
 * B.2 kararı (4_OS: "B.2'de Zod eklenmedi") ve sözleşme dosyasının kendi
 * "dış paket yok" kuralı korunur. İhlal üretim hatasıdır: sessizce
 * düzeltilmez, throw → dış catch → Sentry fatal + gerçek hata.
 */
function assertProgressInvariant(p: GauntletProgress): void {
  const fail = (reason: string): never => {
    throw new Error(`GauntletProgress invariant ihlali: ${reason}`)
  }
  if (p.status === 'in_progress') {
    if (!p.defender || !p.challenger) fail('in_progress: defender/challenger boş')
    if (p.champion !== null) fail('in_progress: champion dolu olamaz')
  } else if (p.status === 'champion') {
    if (p.defender !== null || p.challenger !== null) {
      fail('champion: defender/challenger null olmalı')
    }
    if (!p.champion) fail('champion: champion boş')
    if (p.completedRounds !== 3) fail('champion: completedRounds 3 olmalı')
  } else if (!p.exhaustedReason) {
    fail('exhausted: exhaustedReason zorunlu')
  }
}

/**
 * "Bu gauntlet'ta nerede kaldın" — `choice_events` + `film_ids`'in GÜNCEL
 * halinden deterministik türetilir (CTO kararı 14.08.2026). Yeniden aday
 * seçimi YOK: submit-choice yenilemede filmleri AYNI index'e yazdığı için
 * (submit-choice DAL 2) tur çiftlerinin pozisyonları sabittir:
 *
 *   Tur r çifti = { savunma slotu dIdx, meydan okuyucu slotu r }  (0-tabanlı
 *   dizi, 1-tabanlı tur) · dIdx(1) = 0 · dIdx(r+1) = kazanan meydan
 *   okuyucuysa r, savunansa dIdx(r) · timeout'ta dIdx DEĞİŞMEZ — konvansiyon:
 *   winner null kalır, skorlamaya girmez, yalnız ekran sürekliliği sağlar.
 *
 * Kazananın hangi slotta olduğu KAYBEDENİN pozisyonundan bulunur: kaybeden
 * elendiği andan sonra bir daha değiştirilmez, bugünkü film_ids'te hâlâ aynı
 * index'tedir. Kazanan ise sonraki turda `seen` ile değiştirilmiş olabilir —
 * id ile `indexOf` bu yüzden güvenilmezdir.
 *
 * `champion_film_id` yalnızca DOĞRULAMA için okunur; completedRounds'un
 * kaynağı choice_events'tir. submit-choice'ın kalıcı iz bırakmayan
 * `no_candidates` exhaustion'ı buraya YANSITILMAZ — yalnız DB'ye yazılmış
 * duruma göre türetilir.
 */
async function deriveProgress(
  service: SupabaseClient,
  row: { id: string; film_ids: string[]; champion_film_id: string | null },
  films: GauntletFilm[],
): Promise<GauntletProgress> {
  const { data, error } = await service
    .from('choice_events')
    .select('round,outcome,winner,film_a,film_b')
    .eq('gauntlet_id', row.id)
    .in('outcome', ['choice', 'timeout'])
    .order('round', { ascending: true })

  if (error) {
    throw new Error(
      `progress türetimi: choice_events sorgusu başarısız: ${error.message}`,
    )
  }

  const events = (data ?? []) as AdvancingEvent[]
  const completedRounds = events.length

  // 072'nin partial UNIQUE index'i tur başına tek ilerleten olay garanti
  // eder; taşma/boşluk veri anomalisidir ve sessizce düzeltilmez.
  if (completedRounds > 3) {
    throw new Error(
      `progress türetimi: ${completedRounds} ilerleten olay (beklenen ≤3), ` +
        `gauntlet ${row.id}`,
    )
  }
  events.forEach((e, i) => {
    if (e.round !== i + 1) {
      throw new Error(
        `progress türetimi: tur dizisi boşluklu ` +
          `(${events.map((x) => x.round).join(',')}), gauntlet ${row.id}`,
      )
    }
  })

  let dIdx = 0
  for (const e of events) {
    if (e.outcome === 'timeout') continue
    if (!e.winner) {
      throw new Error(
        `progress türetimi: outcome='choice' ama winner null, ` +
          `tur ${e.round}, gauntlet ${row.id}`,
      )
    }
    const loser = e.winner === e.film_a ? e.film_b : e.film_a
    if (row.film_ids[e.round] === loser) {
      // Kaybeden meydan okuyucu slotunda → kazanan savunandı, dIdx sabit.
    } else if (row.film_ids[dIdx] === loser) {
      dIdx = e.round
    } else {
      throw new Error(
        `progress türetimi: tur ${e.round} kaybedeni film_ids'te beklenen ` +
          `slotlarda değil, gauntlet ${row.id}`,
      )
    }
  }

  if (completedRounds === 3) {
    const last = events[2]
    if (last.outcome === 'timeout') {
      return {
        completedRounds: 3,
        status: 'exhausted',
        exhaustedReason: 'timeout_no_winner',
        defender: null,
        challenger: null,
        champion: null,
      }
    }
    if (!row.champion_film_id || row.champion_film_id !== last.winner) {
      throw new Error(
        `progress türetimi: champion_film_id (${row.champion_film_id}) ` +
          `3. tur kazananıyla (${last.winner}) uyuşmuyor, gauntlet ${row.id}`,
      )
    }
    const champion = films.find((f) => f.id === row.champion_film_id)
    if (!champion) {
      throw new Error(
        `progress türetimi: şampiyon film_ids dışında: ` +
          `${row.champion_film_id}, gauntlet ${row.id}`,
      )
    }
    return {
      completedRounds: 3,
      status: 'champion',
      defender: null,
      challenger: null,
      champion,
    }
  }

  // Sıradaki tur = completedRounds + 1 → meydan okuyucu slotu aynı index.
  const defender = films[dIdx]
  const challenger = films[completedRounds + 1]
  if (!defender || !challenger) {
    throw new Error(
      `progress türetimi: slot çözümlenemedi (dIdx=${dIdx}, ` +
        `tur=${completedRounds + 1}), gauntlet ${row.id}`,
    )
  }
  return {
    completedRounds: completedRounds as 0 | 1 | 2,
    status: 'in_progress',
    defender,
    challenger,
    champion: null,
  }
}

// ─── Üretim ──────────────────────────────────────────────────────────────────

interface GeneratedQuartet {
  films: Candidate[]
  relaxed: boolean
  relaxations: string[]
  poolSize: number
}

/**
 * ── DAL A: EDİTORYAL (E-19, ilk 100 gün) ────────────────────────────────────
 *
 * Editoryal filmlerin KENDİSİ boru hattından geçmez. Sebep adım adım:
 *   [1] SERT FİLTRE   → film zaten seçilmiş; havuz kurmak yeniden seçmek olurdu
 *   [2] PUANLAMA      → tanınırlık yüzdeliği seçimi etkilemiyor, anlamsız iş
 *   [3] ÇEŞİTLİLİK    → çeşitlilik kararını CTO elle verdi
 *   [4] SLOT          → dördü de 'editorial' (çağıran yazar)
 *   [5] SIRA KARIŞTIR → sıra bracket'in KENDİSİ, karıştırmak kurguyu bozar
 *
 * Doğrudan sonucu: editoryal filmlere `CONTEXT_MAX_RUNTIME` süre tavanı
 * uygulanmaz. Bu bir atlama değil, Bible §E-19'un kararıdır ("editoryal seçki
 * bağlam filtresinden geçmiyor"). Ölçülmüş örnek: Gün 2 (`epic`) dörtlüsünün
 * runtime'ları 181/206/175/207 dk — `short` (110) ya da `medium` (150)
 * bağlamında havuz yolundan HİÇBİRİ gelmezdi. `buildScoredPool` yalnız izlenen
 * bir editoryal filmin YEDEĞİ için çağrılır (aşağıda); yedek normal havuzdan
 * geldiği için süre tavanı ona uygulanır.
 *
 * `context` yine de `daily_gauntlets.context`'e yazılır: kullanıcının o akşamki
 * beyanı gerçek bir sinyaldir ve `choice_events` üzerinden profile akar.
 *
 * İzlenen film yoksa `relaxed: false` ve `poolSize: films.length` — gevşetme
 * merdiveni yok, "havuz" da yok. Uydurma bir metrik yazmak yerine dörtlünün
 * kendisi raporlanır.
 *
 * ── İZLENEN FİLM ÇIKARILIR (Karar 2a, 2 Eki 2026) ──────────────────────────
 * Editoryal dörtlü artık bir BAŞLANGIÇ dörtlüsüdür, kilitli bir bracket
 * değil: yenileme / `neither` / `seen` normal boru hattından çalışır
 * (`submit-choice` DAL 2). Bu yüzden algoritmik daldaki "izlenen film asla
 * gelmez" kuralı (`fetchExclusions` → `watched`) burada da uygulanır.
 * Kullanıcının `watchlist.watched_at` ile izlediği editoryal film, AYNI
 * pozisyonda normal havuzdan seçilen bir filmle değiştirilir — sıra bracket'in
 * kendisi olduğu için yerine koyma pozisyonu korur. Seçim `pickReplacements`
 * ile, kalan editoryal filmler `retained` olarak verilerek yapılır (yenileme
 * yoluyla aynı kural merdiveni).
 *
 * Yalnız `watched` uygulanır; 21 günlük "gösterildi" ve 45 günlük
 * "reddedildi" cooldown'ları editoryal filmlerin KENDİSİNE uygulanmaz —
 * editoryal seçki o günün ortak zeminidir, cooldown kişisel bir tercihtir.
 *
 * `slot_types` dördü için de 'editorial' kalır ve `algorithm_version`
 * değişmez: gauntlet'in KAYNAĞI editoryal gündür. Yerine koyma `relaxations`
 * içinde `editorial_watched_replaced` olarak loglanır.
 *
 * Yedek bulunamazsa (havuz yetersiz ya da `pickReplacements` null) HATA
 * FIRLATILMAZ: izlenen editoryal film TUTULUR, her biri Sentry'ye
 * `step=editorial_watched_no_replacement` ile yazılır ve gauntlet üretilir
 * (CTO, 2 Eki 2026 — gauntlet'siz gün izlenmiş filmden kötü).
 *
 * Eski karar (19 Eyl 2026, DUR-4 — kişisel dışlama yok, yenileme kilitli)
 * Karar 2a ile kaldırıldı.
 */
async function generateEditorialQuartet(
  service: SupabaseClient,
  appUserId: string,
  context: GauntletContext,
  dayNumber: number,
  cycleToday: string,
): Promise<GeneratedQuartet> {
  const editorial = await fetchEditorialQuartet(service, dayNumber)
  const watched = await fetchWatchedAmong(
    service,
    appUserId,
    editorial.map((f) => f.id),
  )
  if (watched.size === 0) {
    return { films: editorial, relaxed: false, relaxations: [], poolSize: editorial.length }
  }

  const retained = editorial.filter((f) => !watched.has(f.id))
  // Havuz yetersizliği (`buildScoredPool` throw) da "yedek yok" sayılır —
  // editoryal gauntlet bu yüzden ÜRETİLMEZ olmamalı (CTO, 2 Eki 2026).
  let scored: ScoredPool | null = null
  let poolError: string | null = null
  try {
    scored = await buildScoredPool(service, appUserId, context, 'gauntlet_editorial', {
      today: cycleToday,
    })
  } catch (err) {
    poolError = err instanceof Error ? err.message : String(err)
  }
  const picked = scored
    ? pickReplacements(scored.pool, scored.exclusions, {
      blockedIds: new Set(editorial.map((f) => f.id)),
      retained,
      count: watched.size,
    })
    : null

  const { films, replaced } = await applyWatchedReplacements(
    editorial,
    watched,
    picked ? picked.films : null,
    async (filmId) => {
      // Yedek yok: izlenen editoryal film TUTULUR, sessiz değil — Sentry.
      logError(
        'gauntlet_editorial_watched_no_replacement',
        new Error('izlenen editoryal film için yedek bulunamadı'),
        { user_id: appUserId, film_id: filmId, editorial_day_number: dayNumber },
      )
      await sentryCapture({
        message: 'generate-gauntlet: izlenen editoryal film için yedek bulunamadı',
        level: 'error',
        tags: { function: 'generate-gauntlet', step: 'editorial_watched_no_replacement' },
        extra: {
          film_id: filmId,
          user_id: appUserId,
          editorial_day_number: dayNumber,
          pool_size: scored?.pool.length ?? null,
          pool_error: poolError,
        },
      })
    },
  )
  if (!replaced || !scored || !picked) {
    return { films, relaxed: false, relaxations: ['editorial_watched_kept'], poolSize: editorial.length }
  }

  const relaxations = [...scored.relaxations, ...picked.relaxations]
  logInfo('gauntlet_editorial_watched_replaced', {
    user_id: appUserId,
    editorial_day_number: dayNumber,
    replaced_film_ids: [...watched],
    replacement_film_ids: picked.films.map((f) => f.id),
    relaxations,
  })
  return {
    films,
    relaxed: relaxations.length > 0,
    relaxations: [...relaxations, 'editorial_watched_replaced'],
    poolSize: scored.pool.length,
  }
}

/** ── DAL B: ALGORİTMİK (v0) — 100 gün bitince ve takvim öncesinde ─────────── */
async function generateQuartet(
  service: SupabaseClient,
  appUserId: string,
  context: GauntletContext,
  cycleToday: string,
): Promise<GeneratedQuartet> {
  // ── ADIM 1 + ADIM 2 (+ süre yayılımı eşikleri) ─────────────────────────────
  const scored = await buildScoredPool(service, appUserId, context, 'gauntlet', { today: cycleToday })
  const relaxations = [...scored.relaxations]

  // ── ADIM 3 + ADIM 5 — çeşitlilik seçimi ve çift kontrolü ──────────────────
  let chosen: Candidate[] | null = null
  for (let attempt = 0; attempt < MAX_QUARTET_ATTEMPTS; attempt++) {
    const result = selectQuartet(scored.pool, scored.spread)
    if (!result) continue
    for (const label of result.relaxations) {
      if (!relaxations.includes(label)) relaxations.push(label)
    }

    const arranged = arrangeUnseen(result.films, scored.exclusions.shownPairs)
    if (!arranged.allPairingsSeen) {
      chosen = arranged.films
      break
    }
    if (attempt === MAX_QUARTET_ATTEMPTS - 1) {
      // 5 denemede de her eşleştirme görülmüş: dörtlü kabul edilir, tekrar
      // gösterim loglanır. Boş dönmek yasak.
      relaxations.push('duplicate_pair')
      logInfo('gauntlet_relax_duplicate_pair', {
        user_id: appUserId,
        attempts: MAX_QUARTET_ATTEMPTS,
        film_ids: arranged.films.map((f) => f.id),
      })
      chosen = arranged.films
    }
  }

  if (!chosen) {
    throw new Error(
      `çeşitlilik kuralları ${MAX_QUARTET_ATTEMPTS} denemede karşılanamadı — ` +
        `havuz ${scored.pool.length}, bağlam ${JSON.stringify(context)}`,
    )
  }

  return {
    films: chosen,
    relaxed: relaxations.length > 0,
    relaxations,
    poolSize: scored.pool.length,
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST bekleniyor', 405)
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
      logError('gauntlet_auth_failed', err)
      return errorResponse('UNAUTHORIZED', 'Oturum doğrulanamadı', 401)
    }
    logError('gauntlet_auth_error', err)
    await sentryCapture({
      message: 'generate-gauntlet: kimlik çözümleme hatası',
      level: 'error',
      tags: { function: 'generate-gauntlet' },
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
    return errorResponse('AUTH_ERROR', 'Kimlik doğrulama başarısız', 500)
  }

  let body: GenerateRequest
  try {
    body = (await req.json()) as GenerateRequest
  } catch (err) {
    logError('gauntlet_bad_json', err, { user_id: appUserId })
    return errorResponse('INVALID_INPUT', 'Geçersiz JSON gövdesi', 400)
  }

  if (!isValidContext(body.context)) {
    return errorResponse(
      'INVALID_INPUT',
      'context zorunlu: { companion, duration, energy }',
      400,
    )
  }
  const context: GauntletContext = body.context

  if (body.cycle !== undefined && body.cycle !== 'previous') {
    return errorResponse('INVALID_INPUT', "cycle yalnız 'previous' olabilir", 400)
  }
  const wantsPrevious = body.cycle === 'previous'

  // ── F1: saat dilimi ZORUNLU ────────────────────────────────────────────────
  // Gün anahtarı (cycle tarihi) kullanıcının yerel 18:00 sınırına bağlıdır ve
  // sunucuda hesaplanır. Tahmini/UTC bir dilimle yanlış günün satırını
  // yazmak 18:00 idempotency'sini bozar — bu yüzden açık ret, sessiz geri
  // dönüş YOK. Ret görünür kalır (log + Sentry warning): eski/bozuk bir
  // istemci tz göndermiyorsa bunu saha izinden görmek gerekir.
  if (!isValidTimeZone(body.timezone)) {
    logError('gauntlet_tz_required', new Error('Geçerli IANA saat dilimi yok'), {
      user_id: appUserId,
      received: typeof body.timezone === 'string' ? body.timezone : typeof body.timezone,
    })
    await sentryCapture({
      message: 'generate-gauntlet: TZ_REQUIRED — saat dilimi yok ya da geçersiz',
      level: 'warning',
      tags: { function: 'generate-gauntlet', error_code: 'TZ_REQUIRED' },
      extra: {
        user_id: appUserId,
        received: typeof body.timezone === 'string' ? body.timezone : typeof body.timezone,
      },
    })
    return errorResponse(
      'TZ_REQUIRED',
      'Geçerli bir IANA saat dilimi (timezone) zorunlu',
      400,
    )
  }
  const tz: string = body.timezone

  // M2 Faz 2a write-through: yalnız geçerli ve farklıysa yazar (persistTimezone).
  await persistTimezone(service, appUserId, tz)

  // Tek anlık: cycle tarihi, E-21 anahtarı ve next_cycle_at AYNI `now`'dan
  // hesaplanır — istek ortasında 18:00'i geçen bir çağrı tutarsız olmasın.
  const now = new Date()
  const nextCycle = nextCycleAt(tz, now)

  let cycle: 'current' | 'previous' = 'current'

  try {
    // F1: gün anahtarı = cycle tarihi (en son geçilmiş yerel 18:00'in yerel
    // takvim tarihi). `DailyGauntlet.date` ve `daily_gauntlets.date` bu değerdir.
    const cycleToday = cycleDate(tz, now)
    let date = cycleToday

    // ── E-21: önceki döngü ────────────────────────────────────────────────────
    // Karar verildikten sonra aşağıdaki idempotency / üretim / 23505 yolu
    // AYNEN kullanılır; tek fark `date` = önceki döngü anahtarı ve INSERT'te
    // `cycle: 'previous'`. İkinci bir kod yolu açılmaz.
    // Previous isteğine ASLA current gauntlet dönmez (istemci yanıt şeklinden
    // döngüyü ayıramaz): ya kendi önceki döngü satırı ya açık ret.
    if (wantsPrevious) {
      const resolved = resolvePreviousCycle(now, tz)
      const personal = await service
        .from('daily_gauntlets')
        .select('id,date,cycle')
        .eq('user_id', appUserId)
        .eq('scope', 'personal')
        .order('date', { ascending: true })
        .limit(2)
      if (personal.error) {
        throw new Error(`kişisel satır sorgusu başarısız: ${personal.error.message}`)
      }
      const rows = (personal.data ?? []) as { id: string; date: string; cycle: string }[]
      const launchDate = await fetchLaunchDate(service)
      const decision = decidePreviousCycle(rows, resolved, launchDate)
      if (decision.kind === 'reject') {
        logInfo('previous_cycle_rejected', {
          user_id: appUserId,
          code: decision.code,
          reason: decision.reason,
          key: resolved.key,
          next_key: resolved.nextKey,
          personal_rows: rows.length,
          timezone: tz,
        })
        return errorResponse(
          decision.code,
          decision.code === 'PREVIOUS_CYCLE_NOT_ELIGIBLE'
            ? 'Önceki döngü yalnız ilk açılışta verilir'
            : 'Önceki döngü şu an sunulamaz',
          409,
        )
      }
      date = resolved.key
      cycle = 'previous'
      logInfo('previous_cycle_accepted', {
        user_id: appUserId,
        decision: decision.kind,
        key: resolved.key,
        timezone: tz,
      })
    }

    const pendingWatchFeedback = await resolvePendingWatchFeedback(
      service,
      appUserId,
      cycleToday,
      cycleStartAt(tz, cycleToday),
    )

    // ── Idempotency: aynı kullanıcı + gün ikinci çağrıda YENİ üretim yapmaz ──
    const existing = await service
      .from('daily_gauntlets')
      .select(
        'id,film_ids,slot_types,context,relaxed,algorithm_version,champion_film_id',
      )
      .eq('user_id', appUserId)
      .eq('scope', 'personal')
      .eq('date', date)
      .maybeSingle()

    if (existing.error) {
      throw new Error(`mevcut gauntlet sorgusu başarısız: ${existing.error.message}`)
    }

    const signalCount = await countSignals(service, appUserId)
    const userConfidence = Math.min(1, signalCount / SIGNALS_FOR_FULL_CONFIDENCE)

    if (existing.data) {
      const row = existing.data as {
        id: string
        film_ids: string[]
        slot_types: string[]
        context: GauntletContext | null
        algorithm_version: string
        champion_film_id: string | null
      }
      const films = await fetchFilmsByIds(service, row.film_ids)
      const progress = await deriveProgress(service, row, films)
      assertProgressInvariant(progress)
      const response: GauntletResponse = {
        next_cycle_at: nextCycle,
        gauntletId: row.id,
        date,
        context: row.context ?? context,
        contextPredicted: false,
        films,
        slotTypes: row.slot_types as DailyGauntlet['slotTypes'],
        userConfidence,
        refreshesRemaining: REFRESHES_PER_DAY_FREE,
        algorithmVersion: row.algorithm_version,
        progress,
        ...(pendingWatchFeedback ? { pendingWatchFeedback } : {}),
      }
      logInfo('gauntlet_served_cached', {
        user_id: appUserId,
        gauntlet_id: row.id,
        completed_rounds: progress.completedRounds,
        progress_status: progress.status,
      })
      return jsonResponse(response)
    }

    // ── DALLANMA (E-19) ──────────────────────────────────────────────────────
    // `launch_date` YALNIZCA yeni üretim yolunda okunur. Cached serve yukarıda
    // zaten döndü ve o yol satırın KENDİ `algorithm_version`'ını kullanır —
    // takvim penceresi sonradan kaysa bile dün üretilmiş bir gauntlet yeniden
    // etiketlenmez.
    const dayNumber = editorialDayNumber(date, await fetchLaunchDate(service))
    const isEditorialDay = dayNumber !== null

    const generated = isEditorialDay
      ? await generateEditorialQuartet(service, appUserId, context, dayNumber, date)
      : await generateQuartet(service, appUserId, context, date)
    const slotTypes = isEditorialDay ? editorialSlotTypes() : slotTypesFor(signalCount)
    const algorithmVersion = isEditorialDay
      ? EDITORIAL_ALGORITHM_VERSION
      : ALGORITHM_VERSION

    const insert = await service
      .from('daily_gauntlets')
      .insert({
        user_id: appUserId,
        scope: 'personal',
        date,
        film_ids: generated.films.map((f) => f.id),
        slot_types: slotTypes,
        context,
        relaxed: generated.relaxed,
        algorithm_version: algorithmVersion,
        // Current yolda kolon YAZILMAZ — DB default'u 'current' (118).
        ...(cycle === 'previous' ? { cycle } : {}),
      })
      .select('id')
      .single()

    if (insert.error) {
      // 23505: aynı anda ikinci istek satırı açtı. Yarış idempotency kısıtının
      // amaçladığı sonuçtur — yutulmuyor, loglanıp mevcut satır okunuyor.
      if (insert.error.code === '23505') {
        logInfo('gauntlet_insert_race', { user_id: appUserId, date })
        const retry = await service
          .from('daily_gauntlets')
          .select(
            'id,film_ids,slot_types,context,algorithm_version,champion_film_id',
          )
          .eq('user_id', appUserId)
          .eq('scope', 'personal')
          .eq('date', date)
          .single()
        if (retry.error || !retry.data) {
          throw new Error(
            `idempotency yarışı çözülemedi: ${retry.error?.message ?? 'satır yok'}`,
          )
        }
        const row = retry.data as {
          id: string
          film_ids: string[]
          slot_types: string[]
          context: GauntletContext | null
          algorithm_version: string
          champion_film_id: string | null
        }
        const films = await fetchFilmsByIds(service, row.film_ids)
        // Yarışı kazanan istekle aynı yol: satır az önce açılmış olsa da
        // progress TÜRETİLİR — istemcide ikinci bir kod yolu doğmasın.
        const progress = await deriveProgress(service, row, films)
        assertProgressInvariant(progress)
        const response: GauntletResponse = {
          next_cycle_at: nextCycle,
          gauntletId: row.id,
          date,
          context: row.context ?? context,
          contextPredicted: false,
          films,
          slotTypes: row.slot_types as DailyGauntlet['slotTypes'],
          userConfidence,
          refreshesRemaining: REFRESHES_PER_DAY_FREE,
          algorithmVersion: row.algorithm_version,
          progress,
          ...(pendingWatchFeedback ? { pendingWatchFeedback } : {}),
        }
        return jsonResponse(response)
      }
      throw new Error(`gauntlet kaydı başarısız: ${insert.error.message}`)
    }

    // Algoritma iç bilgisi YALNIZ logda — response'a asla girmez.
    logInfo('gauntlet_generated', {
      user_id: appUserId,
      gauntlet_id: insert.data.id,
      pool_size: generated.poolSize,
      relaxed: generated.relaxed,
      relaxations: generated.relaxations,
      context,
      film_ids: generated.films.map((f) => f.id),
      // Hangi dalın ürettiği teşhis için zorunlu: editoryal günde "havuz 4"
      // normaldir, algoritmik günde alarm sebebidir.
      algorithm_version: algorithmVersion,
      editorial_day_number: dayNumber,
      cycle,
      date,
    })

    const films = generated.films.map(toGauntletFilm)
    // Yeni gauntlet'ta da progress döner — istemcinin iki ayrı kod yolu olmaz.
    const progress: GauntletProgress = {
      completedRounds: 0,
      status: 'in_progress',
      defender: films[0],
      challenger: films[1],
      champion: null,
    }
    assertProgressInvariant(progress)

    const response: GauntletResponse = {
      next_cycle_at: nextCycle,
      gauntletId: insert.data.id,
      date,
      context,
      // v0'da bağlam istemciden gelir; tahmin motoru C fazında bunu true yapar.
      contextPredicted: false,
      films,
      slotTypes,
      userConfidence,
      refreshesRemaining: REFRESHES_PER_DAY_FREE,
      algorithmVersion,
      progress,
      ...(pendingWatchFeedback ? { pendingWatchFeedback } : {}),
    }
    return jsonResponse(response)
  } catch (err) {
    logError('gauntlet_generation_failed', err, { user_id: appUserId, context, cycle: wantsPrevious ? 'previous' : 'current' })
    await sentryCapture({
      message: 'generate-gauntlet: günün gauntlet üretimi başarısız',
      level: 'fatal',
      tags: {
        function: 'generate-gauntlet',
        algorithm_version: ALGORITHM_VERSION,
        // E-21: önceki döngü üretim hatası ayrı süzülebilsin (3g).
        cycle: wantsPrevious ? 'previous' : 'current',
      },
      extra: {
        user_id: appUserId,
        context,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return errorResponse(
      'GAUNTLET_GENERATION_FAILED',
      'Günün filmleri hazırlanamadı',
      503,
    )
  }
})
