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
  arrangeUnseen,
  buildScoredPool,
  type Candidate,
  fetchCandidatesByIds,
  MAX_QUARTET_ATTEMPTS,
  selectQuartet,
  toGauntletFilm,
  utcDateString,
} from '../_shared/gauntletCore.ts'
import type {
  DailyGauntlet,
  GauntletContext,
  GauntletFilm,
  GauntletProgress,
  OklchColor,
  PendingWatchFeedback,
} from '../../../types/gauntlet.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ─── Sabitler ────────────────────────────────────────────────────────────────

const ALGORITHM_VERSION = 'v0-random-diverse'

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

interface GenerateRequest {
  context?: unknown
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
 */
function slotTypesFor(signalCount: number): DailyGauntlet['slotTypes'] {
  if (signalCount === 0) return ['global', 'global', 'global', 'global']
  return ['global', 'personal', 'personal', 'discovery']
}

// ─── Response kurulumu ───────────────────────────────────────────────────────

async function fetchFilmsByIds(
  service: SupabaseClient,
  ids: string[],
): Promise<GauntletFilm[]> {
  const { data, error } = await service
    .from('films')
    .select('id,title,year,runtime,poster_url,dominant_color')
    .in('id', ids)

  if (error) throw new Error(`film getirme başarısız: ${error.message}`)

  const rows = (data ?? []) as {
    id: string
    title: string
    year: number
    runtime: number
    poster_url: string
    dominant_color: OklchColor | null
  }[]
  const byId = new Map(rows.map((r) => [r.id, r]))

  // Sıra daily_gauntlets.film_ids'ten gelir — idempotent çağrıda AYNI sıra.
  const films: GauntletFilm[] = []
  for (const id of ids) {
    const r = byId.get(id)
    if (!r) throw new Error(`gauntlet filmi bulunamadı: ${id}`)
    const film: GauntletFilm = {
      id: r.id,
      title: r.title,
      year: r.year,
      runtime: r.runtime,
      posterUrl: r.poster_url,
    }
    // toGauntletFilm ile AYNI kural (C.2b): renk yoksa alan hiç eklenmez.
    // İki yolun ıraksaması, günün ilk çağrısında renkli / ikinci çağrısında
    // renksiz gauntlet demek olurdu.
    if (r.dominant_color) film.dominantColor = r.dominant_color
    films.push(film)
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
 * FK yok (gauntlet_id watch_feedback'te serbest UUID) → PostgREST embed
 * kurulamaz, iki adımlı çözüm fetchExclusions'daki Promise.all deseniyle
 * aynı ruhta: aday satırları çek, feedback'i olanları çıkar.
 */
async function findPendingWatchFeedbackCandidate(
  service: SupabaseClient,
  appUserId: string,
  todayDate: string,
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
  const pending = rows.find((r) => !answered.has(r.id))
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
): Promise<PendingWatchFeedback | null> {
  const candidate = await findPendingWatchFeedbackCandidate(service, appUserId, todayDate)
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

async function generateQuartet(
  service: SupabaseClient,
  appUserId: string,
  context: GauntletContext,
): Promise<GeneratedQuartet> {
  // ── ADIM 1 + ADIM 2 (+ süre yayılımı eşikleri) ─────────────────────────────
  const scored = await buildScoredPool(service, appUserId, context, 'gauntlet')
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

  try {
    const date = utcDateString()
    const pendingWatchFeedback = await resolvePendingWatchFeedback(service, appUserId, date)

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
      const response: DailyGauntlet = {
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

    const generated = await generateQuartet(service, appUserId, context)
    const slotTypes = slotTypesFor(signalCount)

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
        algorithm_version: ALGORITHM_VERSION,
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
        const response: DailyGauntlet = {
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

    const response: DailyGauntlet = {
      gauntletId: insert.data.id,
      date,
      context,
      // v0'da bağlam istemciden gelir; tahmin motoru C fazında bunu true yapar.
      contextPredicted: false,
      films,
      slotTypes,
      userConfidence,
      refreshesRemaining: REFRESHES_PER_DAY_FREE,
      algorithmVersion: ALGORITHM_VERSION,
      progress,
      ...(pendingWatchFeedback ? { pendingWatchFeedback } : {}),
    }
    return jsonResponse(response)
  } catch (err) {
    logError('gauntlet_generation_failed', err, { user_id: appUserId, context })
    await sentryCapture({
      message: 'generate-gauntlet: günün gauntlet üretimi başarısız',
      level: 'fatal',
      tags: { function: 'generate-gauntlet', algorithm_version: ALGORITHM_VERSION },
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
