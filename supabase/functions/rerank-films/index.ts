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
  overview: string | null
  genres: string[] | null
  year: number | null
  similarity: number
}

interface RerankRequest {
  mood_text: string
  candidates: CandidateFilm[]
  count?: number
  /** true: her secilen film icin tek cumle gerekce de doner (MOOD-VEC-2c). Yoksa yanit degismez. */
  reason?: boolean
}

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a film recommendation re-ranker. Given a user's mood/intent description and a list of candidate films, select and rank the most relevant films.

Rules:
- Understand the user's INTENT, not just emotion. "thailand trip" means films about travel, Thailand, Southeast Asia, adventure, vacation — NOT just "happy adventure films"
- "exam results came back great" means films about academic achievement, youth, coming-of-age, school success — NOT just "happy films"
- Eliminate films with ZERO thematic connection to the user's intent
- Among thematically relevant films, prefer higher original similarity scores (they capture emotional tone better)
- If no films are thematically connected, fall back to the best emotional matches (don't return empty)
- Return ONLY a JSON array of the candidate NUMBERS (the integer before each film) in ranked order, nothing else
- Never return titles, reasons or explanations
- Accept both English and Turkish input equally

Return format (ONLY valid JSON, no explanation):
[3, 12, 1, ...]`

const REASON_SYSTEM_PROMPT = `You are a film recommendation re-ranker. Given a user's mood/intent description and a list of candidate films, select and rank the most relevant films, and give each a one-sentence reason.

Rules:
- Understand the user's INTENT, not just emotion. Eliminate films with ZERO thematic connection to it
- Among relevant films, prefer higher original similarity scores
- If no films are thematically connected, fall back to the best emotional matches (don't return empty)
- Each reason: ONE short sentence (max 18 words) saying why this film fits THIS mood. Write it in the same language as the user's mood text (Turkish mood text → Turkish reason, otherwise English)
- Use only facts visible in the candidate line; never invent plot details
- "n" is the integer before the film in the candidate list

Return ONLY valid JSON, no explanation:
[{"n": 3, "r": "reason"}, {"n": 12, "r": "reason"}]`

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

  // ── Günlük limit (MONEY-1C) ───────────────────────────────────────────────
  // Geçersiz gövde sayacı yakmasın diye doğrulamadan SONRA. Free 15 / premium +
  // legacy_mood_access 60, UTC gün. Aşılırsa 429 RERANK_DAILY_LIMIT — istemci
  // bunu `http_error` sayıp RPC sırasıyla devam eder (deck gelmeye devam eder).
  // Sayaç/tier okunamazsa FAIL-CLOSED (503), rateLimit.ts ile aynı.
  try {
    const maxPerDay = await lookupDailyLimit(auth.appUserId)
    await checkDailyLimit(auth.authUserId, 'rerank-films-daily', maxPerDay)
  } catch (err) {
    if (err instanceof DailyLimitError) {
      return await rerankDailyLimitResponse(err, auth.authUserId, CORS_HEADERS)
    }
    return rateLimitResponse(err, CORS_HEADERS)
  }

  const moodText = body.mood_text.slice(0, 500)
  const count = Math.min(Math.max(body.count ?? 10, 1), 30)
  const withReason = body.reason === true
  const candidates = body.candidates.slice(0, 50) // max 50 candidates

  // ── Build compact film list for LLM ───────────────────────────────────────
  const filmList = candidates
    .map((c, i) => {
      const overview = (c.overview ?? '').slice(0, 150)
      const genres = (c.genres ?? []).join(', ')
      return `${i + 1}. "${c.title}" (${c.year ?? '?'}) | ${genres} | ${overview}`
    })
    .join('\n')

  const userMessage = `User mood: "${moodText}"

Select the ${count} most relevant films from these candidates. Return their numbers in ranked order.

Candidate films:
${filmList}`

  // ── Claude Haiku call ─────────────────────────────────────────────────────
  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      // ${count} numara ~ 3 token/numara + koseli parantez payi
      max_tokens: withReason ? 128 + count * 60 : 64 + count * 4,
      system: withReason ? REASON_SYSTEM_PROMPT : SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const rawText = message.content.find((b) => b.type === 'text')?.text ?? ''

    // Parse JSON array from response (handle markdown code blocks)
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    const jsonString = jsonMatch ? jsonMatch[1] : rawText.trim()

    const parsed = JSON.parse(jsonString)

    if (!Array.isArray(parsed)) {
      throw new Error('LLM returned non-array')
    }

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
      if (!Number.isInteger(idx) || idx < 1 || idx > candidates.length || seen.has(idx)) continue
      seen.add(idx)
      rerankedIds.push(candidates[idx - 1].id)
      if (withReason) {
        const r = (item as { r?: unknown } | null)?.r
        if (typeof r === 'string' && r.trim().length > 0) {
          reasons[candidates[idx - 1].id] = r.trim().slice(0, 200)
        }
      }
      if (rerankedIds.length >= count) break
    }

    return new Response(
      JSON.stringify({
        reranked_ids: rerankedIds,
        original_count: candidates.length,
        reranked_count: rerankedIds.length,
        ...(withReason ? { reasons } : {}),
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[rerank-films] Error:', msg)

    // Graceful degradation: return original order (first N IDs)
    const fallbackIds = candidates.slice(0, count).map((c) => c.id)

    return new Response(
      JSON.stringify({
        reranked_ids: fallbackIds,
        original_count: candidates.length,
        reranked_count: fallbackIds.length,
        fallback: true,
        error_detail: msg,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
