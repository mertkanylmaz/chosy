/**
 * Edge Function: rerank-films
 * match_films_v3 sonuclarini LLM ile yeniden siralar.
 *
 * Vektor uzayinin yakalayamadigi tematik/kavramsal anlami LLM re-ranking ile
 * doldurur. "thailand trip" -> Wall-E degil The Beach/Hangover 2 gelir.
 *
 * Deploy: supabase functions deploy rerank-films
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { checkRateLimit, RateLimitError, rateLimitResponse } from '../_shared/rateLimit.ts'

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
}

// ── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a film recommendation re-ranker. Given a user's mood/intent description and a list of candidate films, select and rank the most relevant films.

Rules:
- Understand the user's INTENT, not just emotion. "thailand trip" means films about travel, Thailand, Southeast Asia, adventure, vacation — NOT just "happy adventure films"
- "exam results came back great" means films about academic achievement, youth, coming-of-age, school success — NOT just "happy films"
- Eliminate films with ZERO thematic connection to the user's intent
- Among thematically relevant films, prefer higher original similarity scores (they capture emotional tone better)
- If no films are thematically connected, fall back to the best emotional matches (don't return empty)
- Return ONLY a JSON array of film IDs in ranked order, nothing else
- Accept both English and Turkish input equally

Return format (ONLY valid JSON, no explanation):
["id1", "id2", ..., "idN"]`

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

  // ── Rate limit ────────────────────────────────────────────────────────────
  try {
    await checkRateLimit(req, 'rerank-films')
  } catch (err) {
    if (err instanceof RateLimitError) {
      return rateLimitResponse(err, CORS_HEADERS)
    }
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

  const moodText = body.mood_text.slice(0, 500)
  const count = Math.min(Math.max(body.count ?? 10, 1), 30)
  const candidates = body.candidates.slice(0, 50) // max 50 candidates

  // ── Build compact film list for LLM ───────────────────────────────────────
  const filmList = candidates
    .map((c, i) => {
      const overview = (c.overview ?? '').slice(0, 150)
      const genres = (c.genres ?? []).join(', ')
      return `${i + 1}. [${c.id}] "${c.title}" (${c.year ?? '?'}) | ${genres} | ${overview}`
    })
    .join('\n')

  const userMessage = `User mood: "${moodText}"

Select the ${count} most relevant films from these candidates. Return their IDs in ranked order.

Candidate films:
${filmList}`

  // ── Claude Haiku call ─────────────────────────────────────────────────────
  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
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

    // Validate: only keep IDs that exist in candidates
    const candidateIdSet = new Set(candidates.map((c) => c.id))
    const rerankedIds = parsed
      .filter((id: unknown) => typeof id === 'string' && candidateIdSet.has(id))
      .slice(0, count)

    return new Response(
      JSON.stringify({
        reranked_ids: rerankedIds,
        original_count: candidates.length,
        reranked_count: rerankedIds.length,
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
