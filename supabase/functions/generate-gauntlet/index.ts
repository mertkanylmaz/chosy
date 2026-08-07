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
  MAX_QUARTET_ATTEMPTS,
  selectQuartet,
  toGauntletFilm,
  utcDateString,
} from '../_shared/gauntletCore.ts'
import type {
  DailyGauntlet,
  GauntletContext,
  GauntletFilm,
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
    .select('id,title,year,runtime,poster_url')
    .in('id', ids)

  if (error) throw new Error(`film getirme başarısız: ${error.message}`)

  const rows = (data ?? []) as {
    id: string
    title: string
    year: number
    runtime: number
    poster_url: string
  }[]
  const byId = new Map(rows.map((r) => [r.id, r]))

  // Sıra daily_gauntlets.film_ids'ten gelir — idempotent çağrıda AYNI sıra.
  const films: GauntletFilm[] = []
  for (const id of ids) {
    const r = byId.get(id)
    if (!r) throw new Error(`gauntlet filmi bulunamadı: ${id}`)
    films.push({
      id: r.id,
      title: r.title,
      year: r.year,
      runtime: r.runtime,
      posterUrl: r.poster_url,
    })
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

    // ── Idempotency: aynı kullanıcı + gün ikinci çağrıda YENİ üretim yapmaz ──
    const existing = await service
      .from('daily_gauntlets')
      .select('id,film_ids,slot_types,context,relaxed,algorithm_version')
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
      }
      const response: DailyGauntlet = {
        gauntletId: row.id,
        date,
        context: row.context ?? context,
        contextPredicted: false,
        films: await fetchFilmsByIds(service, row.film_ids),
        slotTypes: row.slot_types as DailyGauntlet['slotTypes'],
        userConfidence,
        refreshesRemaining: REFRESHES_PER_DAY_FREE,
        algorithmVersion: row.algorithm_version,
      }
      logInfo('gauntlet_served_cached', { user_id: appUserId, gauntlet_id: row.id })
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
          .select('id,film_ids,slot_types,context,algorithm_version')
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
        }
        const response: DailyGauntlet = {
          gauntletId: row.id,
          date,
          context: row.context ?? context,
          contextPredicted: false,
          films: await fetchFilmsByIds(service, row.film_ids),
          slotTypes: row.slot_types as DailyGauntlet['slotTypes'],
          userConfidence,
          refreshesRemaining: REFRESHES_PER_DAY_FREE,
          algorithmVersion: row.algorithm_version,
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

    const response: DailyGauntlet = {
      gauntletId: insert.data.id,
      date,
      context,
      // v0'da bağlam istemciden gelir; tahmin motoru C fazında bunu true yapar.
      contextPredicted: false,
      films: generated.films.map(toGauntletFilm),
      slotTypes,
      userConfidence,
      refreshesRemaining: REFRESHES_PER_DAY_FREE,
      algorithmVersion: ALGORITHM_VERSION,
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
