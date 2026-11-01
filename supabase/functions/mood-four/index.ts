/**
 * Edge Function: mood-four (Mood Gauntlet, Faz 2-3)
 *
 * Dörtlü hattının sunucu tarafı: v4 RPC (gevşetme basamaklarıyla) + id-rerank TEK istekte.
 * Amaç hız: istemci ↔ us-west-1 gidiş-dönüşlerini ve DB'ye (us-west-1) uzak RPC'yi kaldırmak.
 * Fonksiyon DB ile aynı bölgede çalıştırılır (istemci `x-region` + `forceFunctionRegion`).
 *
 * Eski yollar (istemcide doğrudan RPC, rerank-films) AYNEN kalır; istemci bu fonksiyon hata
 * verirse eski 2 çağrılı yola düşer.
 *
 * Gövde: { mood_text, query_vector, exclude_ids, search_keywords, genres_exclude,
 *          reference_titles, suggested_titles, attempts[], match_count, rerank_candidates }
 *   - query_vector İSTEMCİDE üretilir (services/vectorEncoder tek kaynağı).
 *   - attempts: istemcideki buildV4Attempts çıktısı (basamak başına min_similarity, min_rating,
 *     genres_include, max_runtime). Sunucu basamak mantığı KOPYALAMAZ.
 * Yanıt: { pool, attempt_index, reranked_ids|null, rerank_skipped?, timings }
 *   - reranked_ids null → istemci havuz sırasıyla ilk 4'ü alır (eski rerank hata yolu ile aynı).
 *
 * Kimlik: requireUser. Rate limit: 10/dk. Günlük sayaç: rerank-films id yolu ile AYNI
 * ('rerank-films-daily'); aşılırsa/okunamazsa havuz yine döner (rerank_skipped), kullanıcı bloklanmaz.
 * Hata: Sentry + kodlu yanıt.
 *
 * Deploy: supabase functions deploy mood-four
 */
import Anthropic from 'npm:@anthropic-ai/sdk'
import { requireUser, unauthorizedResponse } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
import { checkDailyLimit, DailyLimitError, lookupDailyLimit } from '../_shared/dailyLimit.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import { RERANK_PICK_MODEL } from '../_shared/models.ts'
import { dailyCounterKey } from '../_shared/rerankReason.ts'
import {
  buildPickUserMessage,
  cleanExcludedGenres,
  numbersToIds,
  parseModelArray,
  PICK_SYSTEM_PROMPT,
  type PickCandidate,
} from '../_shared/rerankPick.ts'
import { buildRpcArgs, parseMoodFourRequest, uniqueRows } from '../_shared/moodFour.ts'
import { errorResponse, getUserClient, handleCors, jsonResponse } from '../_shared/gameUtils.ts'

const FN = 'mood-four'
const FOUR = 4
const PICK_OVERVIEW_MAX = 150
const PICK_TIMEOUT_MS = 7_000

interface PoolRow extends PickCandidate {
  similarity: number
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST bekleniyor', 405)

  const auth = await requireUser(req)
  if (!auth.ok) return unauthorizedResponse(auth, {})

  try {
    await checkRateLimit(auth.authUserId, FN)
  } catch (err) {
    return rateLimitResponse(err, {})
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return errorResponse('INVALID_INPUT', 'Geçersiz JSON gövdesi', 400)
  }
  const parsed = parseMoodFourRequest(raw)
  if (!parsed.ok) return errorResponse('INVALID_INPUT', `Geçersiz alan: ${parsed.reason}`, 400)
  const body = parsed.value

  // ── 1) v4 RPC + gevşetme basamakları ───────────────────────────────────────
  const tV4 = Date.now()
  const userClient = getUserClient(req)
  let pool: PoolRow[] = []
  let attemptIndex = 0
  try {
    for (let i = 0; i < body.attempts.length; i++) {
      attemptIndex = i
      const { data, error } = await userClient.rpc('match_films_v4', buildRpcArgs(body, body.attempts[i]))
      if (error) throw new Error(`match_films_v4: ${error.message}`)
      pool = uniqueRows((data ?? []) as PoolRow[])
      if (pool.length >= FOUR) break
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await sentryCapture({
      message: `mood-four v4 basarisiz: ${msg}`,
      level: 'error',
      tags: { function: FN, error_code: 'MOOD_FOUR_V4_FAILED' },
      extra: { user_id: auth.authUserId },
    })
    return errorResponse('V4_FAILED', 'Aday aramasi basarisiz', 502)
  }
  const v4Ms = Date.now() - tV4

  // Yeterli aday yok: rerank anlamsız; istemci "insufficient" akışına gider.
  if (pool.length < FOUR) {
    return jsonResponse({
      pool,
      attempt_index: attemptIndex,
      reranked_ids: null,
      rerank_skipped: 'insufficient',
      timings: { v4_ms: v4Ms, pick_ms: 0 },
    })
  }

  // ── 2) id-rerank (reason:false, count:4) ───────────────────────────────────
  let rerankedIds: string[] | null = null
  let skipped: string | null = null
  const tPick = Date.now()
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    await sentryCapture({
      message: 'mood-four ANTHROPIC_API_KEY yok',
      level: 'error',
      tags: { function: FN, error_code: 'CONFIG_ERROR' },
    })
    skipped = 'config'
  } else {
    try {
      const maxPerDay = await lookupDailyLimit(auth.appUserId)
      await checkDailyLimit(auth.authUserId, dailyCounterKey(false), maxPerDay)
    } catch (err) {
      // Limit aşıldı ya da sayaç okunamadı (checkDailyLimit zaten Sentry'ye yazdı): rerank atlanır,
      // havuz sırasıyla dörtlü yine döner — kullanıcı bloklanmaz.
      skipped = err instanceof DailyLimitError ? 'daily_limit' : 'limit_unavailable'
    }
    if (skipped === null) {
      const candidates = pool.slice(0, body.rerank_candidates)
      try {
        const client = new Anthropic({ apiKey })
        const message = await client.messages.create(
          {
            model: RERANK_PICK_MODEL,
            max_tokens: 64 + FOUR * 4,
            system: PICK_SYSTEM_PROMPT,
            messages: [{
              role: 'user',
              content: buildPickUserMessage({
                moodText: body.mood_text,
                pool: candidates,
                count: FOUR,
                overviewMax: PICK_OVERVIEW_MAX,
                excludedGenres: cleanExcludedGenres(body.genres_exclude),
              }),
            }],
          },
          { timeout: PICK_TIMEOUT_MS },
        )
        const rawText = message.content.find((b) => b.type === 'text')?.text ?? ''
        const ids = numbersToIds(parseModelArray(rawText), candidates, FOUR)
        if (ids.length > 0) rerankedIds = ids
        else skipped = 'empty'
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[mood-four] rerank hatasi:', msg)
        await sentryCapture({
          message: `mood-four rerank basarisiz (havuz sirasi kullanilir): ${msg}`,
          level: 'warning',
          tags: { function: FN, error_code: 'MOOD_FOUR_RERANK_FAILED' },
          fingerprint: [FN, 'MOOD_FOUR_RERANK_FAILED'],
        })
        skipped = 'error'
      }
    }
  }

  return jsonResponse({
    pool,
    attempt_index: attemptIndex,
    reranked_ids: rerankedIds,
    ...(skipped ? { rerank_skipped: skipped } : {}),
    timings: { v4_ms: v4Ms, pick_ms: Date.now() - tPick },
  })
})
