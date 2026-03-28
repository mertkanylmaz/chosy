/**
 * Edge Function: explain-match
 * Kullanıcının mood profili ile film profillerini karşılaştırarak
 * her film için kişiselleştirilmiş eşleşme açıklaması üretir.
 *
 * Batch: feed'deki 10 film için tek Claude request.
 * Deploy: supabase functions deploy explain-match --no-verify-jwt
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import Anthropic from 'npm:@anthropic-ai/sdk'
import { checkRateLimit, RateLimitError, rateLimitResponse } from '../_shared/rateLimit.ts'

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are MoodFlix Match Explainer. Given a user's mood profile and a list of film profiles, write a brief explanation for why each film matches this user's current mood.

For each film, write 1-2 sentences under 30 words total. Be specific about emotions and themes. Never mention the film title. Never include spoilers. Be conversational, not clinical.

Examples:
- "Your reflective mood pairs perfectly with this film's meditative pacing and themes of solitude and self-discovery."
- "When you're craving energy and surprise, this thriller delivers with its unpredictable twists and high-octane sequences."

Return ONLY valid JSON with no explanation or markdown:
{ "explanations": { "<filmId>": "<explanation>", ... } }

Generate an explanation for every filmId provided.`

// ─── Handler ──────────────────────────────────────────────────────────────────

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

  try {
    await checkRateLimit(req, 'explain-match')
  } catch (err) {
    if (err instanceof RateLimitError) {
      return rateLimitResponse(err, CORS_HEADERS)
    }
  }

  let userProfile: unknown
  let films: Array<{ filmId: string; dimensions: unknown }>

  try {
    const body = await req.json()
    userProfile = body?.userProfile
    films = body?.films

    if (!userProfile || !Array.isArray(films) || films.length === 0) {
      throw new Error('missing fields')
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'userProfile and films array are required', code: 'INVALID_INPUT' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('[explain-match] ANTHROPIC_API_KEY is not set')
    return new Response(
      JSON.stringify({ error: 'Server configuration error', code: 'CONFIG_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const client = new Anthropic({ apiKey })

    const userMessage = JSON.stringify({
      userMoodProfile: userProfile,
      films: films.map((f) => ({ filmId: f.filmId, filmProfile: f.dimensions })),
    })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const rawText = message.content.find((b) => b.type === 'text')?.text ?? ''

    // Markdown code block varsa temizle
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    const jsonString = jsonMatch ? jsonMatch[1] : rawText.trim()

    const parsed = JSON.parse(jsonString)

    return new Response(
      JSON.stringify(parsed),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[explain-match] Error:', msg)

    return new Response(
      JSON.stringify({ error: 'Failed to generate explanations', code: 'EXPLAIN_FAILED' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
