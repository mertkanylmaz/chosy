/**
 * Edge Function: rerank-films
 * match_films_v3 sonuclarini LLM ile yeniden siralar.
 *
 * Vektor uzayinin yakalayamadigi tematik/kavramsal anlami LLM re-ranking ile
 * doldurur. "thailand trip" -> Wall-E degil The Beach/Hangover 2 gelir.
 *
 * LLM'e film UUID'si verilmez/istenmez: adaylar 1..N numarali listelenir, model
 * yalniz sirali numara dizisi dondurur ([3, 12, 1, ...]); numaralar burada
 * aday id'lerine cevrilir. Cikti ~25 token (UUID ile ~220), girdi de kisalir.
 * HTTP yaniti degismedi: { reranked_ids (UUID), original_count, reranked_count }.
 *
 * Deploy: supabase functions deploy rerank-films
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
import { requireUser, unauthorizedResponse } from '../_shared/auth.ts'
import {
  checkDailyLimit,
  DailyLimitError,
  lookupDailyLimit,
  rerankDailyLimitResponse,
} from '../_shared/dailyLimit.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import { REASON_THINKING, RERANK_PICK_MODEL, RERANK_REASON_MODEL } from '../_shared/models.ts'
import { guardReasons } from '../_shared/reasonGuard.ts'
import {
  REASON_MAX_CANDIDATES,
  REASON_OVERVIEW_MAX,
  REASON_SYSTEM_PROMPT,
  dailyCounterKey,
  enforceNoDigits,
  enforceReasonLength,
} from '../_shared/rerankReason.ts'

// ── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Types ────────────────────────────────────────────────────────────────────

interface CandidateFilm {
  id: string
  title: string
  /** Opsiyonel: gerekce denetiminde (reasonGuard) basliktan gelen yanlis sizinti eslesmesini onler. */
  original_title?: string | null
  overview: string | null
  genres: string[] | null
  year: number | null
  /** Dakika; yoksa aday satirinda gosterilmez. */
  runtime?: number | null
  similarity: number
}

interface RerankRequest {
  mood_text: string
  candidates: CandidateFilm[]
  count?: number
  /** true: her secilen film icin tek cumle gerekce de doner (MOOD-VEC-2c). Yoksa yanit degismez. */
  reason?: boolean
  /** parse'taki genres_exclude: dortlu secimde (reason:false) bu turlerden film secilmez. */
  genres_exclude?: string[]
}

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a film recommendation re-ranker. Given a user's mood/intent description and a list of candidate films, select and rank the most relevant films.

Rules:
- Understand the user's INTENT, not just emotion. "thailand trip" means films about travel, Thailand, Southeast Asia, adventure, vacation — NOT just "happy adventure films"
- "exam results came back great" means films about academic achievement, youth, coming-of-age, school success — NOT just "happy films"
- Eliminate films with ZERO thematic connection to the user's intent
- Respect explicit constraints: if the mood says "not intense", "not scary", "nothing heavy" or similar, never select a film that violates it (judge by genres, runtime and overview). If an "Excluded genres" line is given, never select a film that has any of those genres
- Among thematically relevant films, prefer higher original similarity scores (they capture emotional tone better)
- If no films are thematically connected, fall back to the best emotional matches (don't return empty)
- Return ONLY a JSON array of the candidate NUMBERS (the integer before each film) in ranked order, nothing else
- Never return titles, reasons or explanations
- Accept both English and Turkish input equally

Return format (ONLY valid JSON, no explanation):
[3, 12, 1, ...]`

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Kimlik ────────────────────────────────────────────────────────────────
  // `verify_jwt` varsayılanı bu fonksiyonu koruyor GÖRÜNÜYORDU, ama o kontrol
  // anon key'in kendisini geçerli JWT sayar — ve anon key uygulama binary'sinde
  // gömülüdür. Yani gerçek kimlik kontrolü buydu, burada yapılıyor.
  const auth = await requireUser(req)
  if (!auth.ok) {
    return unauthorizedResponse(auth, CORS_HEADERS)
  }

  // ── Rate limit ────────────────────────────────────────────────────────────
  try {
    await checkRateLimit(auth.authUserId, 'rerank-films')
  } catch (err) {
    return rateLimitResponse(err, CORS_HEADERS)
  }

  // ── API key guard ─────────────────────────────────────────────────────────
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('[rerank-films] ANTHROPIC_API_KEY is not set')
    return new Response(
      JSON.stringify({ error: 'Server configuration error', code: 'CONFIG_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: RerankRequest
  try {
    body = await req.json()
    if (!body.mood_text || typeof body.mood_text !== 'string' || body.mood_text.trim().length === 0) {
      throw new Error('missing mood_text')
    }
    if (!Array.isArray(body.candidates) || body.candidates.length === 0) {
      throw new Error('missing or empty candidates')
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'mood_text and candidates[] are required', code: 'INVALID_INPUT' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const withReason = body.reason === true

  // ── Günlük limit (MONEY-1C) ───────────────────────────────────────────────
  // Geçersiz gövde sayacı yakmasın diye doğrulamadan SONRA. Free 15 / premium +
  // legacy_mood_access 60, UTC gün. Gerekçe çağrısı (reason:true) AYRI sayaç
  // ('rerank-films-reasons-daily', aynı limitler); id-rerank mevcut sayacı kullanır. Aşılırsa 429 RERANK_DAILY_LIMIT — istemci
  // bunu `http_error` sayıp RPC sırasıyla devam eder (deck gelmeye devam eder).
  // Sayaç/tier okunamazsa FAIL-CLOSED (503), rateLimit.ts ile aynı.
  try {
    const maxPerDay = await lookupDailyLimit(auth.appUserId)
    await checkDailyLimit(auth.authUserId, dailyCounterKey(withReason), maxPerDay)
  } catch (err) {
    if (err instanceof DailyLimitError) {
      return await rerankDailyLimitResponse(err, auth.authUserId, CORS_HEADERS)
    }
    return rateLimitResponse(err, CORS_HEADERS)
  }

  const moodText = body.mood_text.slice(0, 500)
  const count = Math.min(Math.max(body.count ?? 10, 1), 30)
  const candidates = body.candidates.slice(0, 50) // max 50 candidates
  // reason yolu: v4 donus sirasiyla (kanal onceligi c>v>a) ilk 20 aday; digerleri LLM'e gitmez.
  const pool = withReason ? candidates.slice(0, REASON_MAX_CANDIDATES) : candidates
  const overviewMax = withReason ? REASON_OVERVIEW_MAX : 150

  // ── Build compact film list for LLM ───────────────────────────────────────
  const filmList = pool
    .map((c, i) => {
      const overview = (c.overview ?? '').slice(0, overviewMax)
      const genres = (c.genres ?? []).join(', ')
      const runtime = typeof c.runtime === 'number' && c.runtime > 0 ? ` | ${Math.round(c.runtime)} min` : ''
      return `${i + 1}. "${c.title}" (${c.year ?? '?'})${runtime} | ${genres} | ${overview}`
    })
    .join('\n')

  const excluded = !withReason && Array.isArray(body.genres_exclude)
    ? body.genres_exclude.filter((g) => typeof g === 'string' && g.trim().length > 0).slice(0, 10).map((g) => g.trim().slice(0, 40))
    : []
  const excludedLine = excluded.length > 0 ? `\nExcluded genres (never select a film with any of these): ${excluded.join(', ')}\n` : ''

  const userMessage = `User mood: "${moodText}"
${excludedLine}
Select the ${count} most relevant films from these candidates. Return their numbers in ranked order.

Candidate films:
${filmList}`

  // ── Claude call ───────────────────────────────────────────────────────────
  // id-rerank: Haiku 4.5; gerekce (TR + EN): Haiku 5.5 (thinking kapali) — _shared/models.ts. Basarisiz olursa asagidaki catch
  // gerekcesiz v4 sirasini doner (istemci satir cizmez).
  try {
    const client = new Anthropic({ apiKey })

    const generate = async (model: string): Promise<unknown[]> => {
      const message = await client.messages.create({
        model,
        // ${count} numara ~ 3 token/numara + koseli parantez payi.
        // reason: ~15 TR kelime ≈ 40 token + {"n","r"} sarmali ≈ 10 → 50/film.
        max_tokens: withReason ? 96 + count * 50 : 64 + count * 4,
        system: withReason ? REASON_SYSTEM_PROMPT : SYSTEM_PROMPT,
        // Haiku 5.5 varsayilanda dusunur ve max_tokens'i tuketip bos metin doner: gerekce yolunda kapali.
        ...(withReason ? { thinking: REASON_THINKING } : {}),
        messages: [{ role: 'user', content: userMessage }],
      })
      const rawText = message.content.find((b) => b.type === 'text')?.text ?? ''
      if (withReason && rawText.trim().length === 0) {
        // Bos metin: gerekce '' (UI satir cizmez), sessiz degil — Sentry uyarisi.
        await sentryCapture({
          message: `rerank-films ${model} bos metin dondu (stop_reason=${message.stop_reason ?? '?'})`,
          level: 'warning',
          tags: { function: 'rerank-films', error_code: 'REASON_EMPTY_TEXT' },
          fingerprint: ['rerank-films', 'REASON_EMPTY_TEXT'],
        })
        return []
      }
      // Parse JSON array from response (handle markdown code blocks)
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
      const out = JSON.parse(jsonMatch ? jsonMatch[1] : rawText.trim())
      if (!Array.isArray(out)) throw new Error('LLM returned non-array')
      return out
    }

    const usedModel = withReason ? RERANK_REASON_MODEL : RERANK_PICK_MODEL
    const parsed = await generate(usedModel)

    // Numaralari (1..N) aday id'lerine cevir; aralik disi / tekrar eden / sayi
    // olmayan girdiler atilir. Yalniz aday listesindeki id'ler donebilir.
    const seen = new Set<number>()
    const rerankedIds: string[] = []
    const reasons: Record<string, string> = {}
    for (const item of parsed as unknown[]) {
      const n = withReason && item !== null && typeof item === 'object'
        ? (item as { n?: unknown }).n
        : item
      const idx = typeof n === 'number' ? n : typeof n === 'string' ? Number(n) : NaN
      if (!Number.isInteger(idx) || idx < 1 || idx > pool.length || seen.has(idx)) continue
      seen.add(idx)
      rerankedIds.push(pool[idx - 1].id)
      if (withReason) {
        const r = (item as { r?: unknown } | null)?.r
        if (typeof r === 'string' && r.trim().length > 0) {
          reasons[pool[idx - 1].id] = r.trim().slice(0, 200)
        }
      }
      if (rerankedIds.length >= count) break
    }

    // Turkce gerekcede bilinen Ingilizce sizinti / bozuk bicim varsa gerekce bos doner (UI gerekcesiz gosterir).
    const titlesById: Record<string, string[]> = {}
    for (const c of pool) {
      titlesById[c.id] = [c.title, c.original_title ?? ''].filter((t) => typeof t === 'string' && t.length > 0)
    }
    const guarded = withReason ? guardReasons(reasons, moodText, titlesById) : null
    if (guarded && guarded.dropped.length > 0) {
      console.warn(`[rerank-films] REASON_DROPPED: ${guarded.dropped.length}/${Object.keys(reasons).length} gerekce TR sizinti denetiminde bosaltildi`)
    }
    // Uzunluk korumasi: >16 kelime '' olur (reasons_dropped artar); <=16 kabul. reasonGuard aynen kalir.
    const lengthPass = guarded ? enforceReasonLength(guarded.reasons) : null
    if (lengthPass && lengthPass.dropped.length > 0) {
      console.warn(`[rerank-films] REASON_TOO_LONG: ${lengthPass.dropped.length} gerekce 16 kelimeyi astigi icin bosaltildi`)
    }
    // Olgusal iddia korumasi: gerekcede rakam (sure, yil, sayi) varsa '' olur.
    const lengthChecked = lengthPass ? enforceNoDigits(lengthPass.reasons) : null
    if (lengthChecked && lengthChecked.dropped.length > 0) {
      console.warn(`[rerank-films] REASON_HAS_DIGIT: ${lengthChecked.dropped.length} gerekce rakam icerdigi icin bosaltildi`)
    }

    return new Response(
      JSON.stringify({
        reranked_ids: rerankedIds,
        original_count: pool.length,
        reranked_count: rerankedIds.length,
        ...(guarded && lengthChecked
          ? {
            reasons: lengthChecked.reasons,
            reasons_dropped: guarded.dropped.length + (lengthPass?.dropped.length ?? 0) + lengthChecked.dropped.length,
            reason_model: usedModel,
          }
          : {}),
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[rerank-films] Error:', msg)

    // Graceful degradation: return original order (first N IDs)
    const fallbackIds = pool.slice(0, count).map((c) => c.id)

    return new Response(
      JSON.stringify({
        reranked_ids: fallbackIds,
        original_count: pool.length,
        reranked_count: fallbackIds.length,
        fallback: true,
        error_detail: msg,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
