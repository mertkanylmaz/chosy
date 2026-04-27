/**
 * Edge Function: parse-mood
 * Kullanıcının serbest metin girdisini 12 boyutlu TasteProfile'a dönüştürür.
 *
 * Deploy: supabase functions deploy parse-mood --no-verify-jwt
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

const SYSTEM_PROMPT = `You are MoodFlix Taste Parser. Given a user's mood description, extract a 12-dimensional taste profile.

Return ONLY valid JSON, no explanation:
{
  "emotional_state": {
    "joy": 0.0-1.0,
    "sadness": 0.0-1.0,
    "fear": 0.0-1.0,
    "anger": 0.0-1.0,
    "surprise": 0.0-1.0,
    "disgust": 0.0-1.0,
    "trust": 0.0-1.0,
    "anticipation": 0.0-1.0
  },
  "energy_level": 0.0-1.0,
  "pace_preference": "slow" | "medium" | "fast",
  "visual_style": "minimalist" | "cinematic" | "experimental" | "lush" | "raw",
  "thematic_depth": 0.0-1.0,
  "ending_preference": "hopeful" | "bittersweet" | "open" | "tragic" | "triumphant",
  "era_preference": { "from": year_number, "to": year_number },
  "cultural_context": ["country or region strings"],
  "avoid_signals": ["theme strings to avoid"],
  "narrative_style": "linear" | "nonlinear" | "anthology" | "dialogue-driven",
  "social_context": "alone" | "couple" | "friends" | "family",
  "rewatch_tolerance": true | false,
  "profile_name": "2-3 word mood summary in English",
  "profile_description": "One sentence explaining the mood and what kind of film experience this person needs"
}

Rules:
- Interpret emotions from context, not just keywords
- "I had a bad day" → high sadness + anticipation (wants comfort)
- "feeling adventurous" → high anticipation + surprise + high energy
- "need to cry" → high sadness, thematic_depth high, slow pace
- Multiple emotions can coexist (AND logic, not OR)
- If social context is unclear, default to "alone"
- Keep avoid_signals conservative — only add when clearly stated in input
- era_preference default when not mentioned: { "from": 1970, "to": 2025 }
- cultural_context default when not mentioned: []
- rewatch_tolerance: true if user implies comfort/familiar content, false for new discoveries
- profile_name and profile_description must always be in English
- Accept both English and Turkish input equally well

Genre-critical differentiation rules (IMPORTANT — these prevent cross-genre contamination):
- COMEDY/FUNNY/LAUGH signals → joy VERY HIGH (0.8-0.95), energy MEDIUM-LOW (0.3-0.5), anticipation LOW (0.1-0.25), fear LOW (0.05-0.15), anger LOW (0.05-0.15), thematic_depth LOW (0.1-0.2), ending "hopeful". Comedy is NOT high energy — high energy maps to Action.
- ACTION/THRILLER/ADVENTURE signals → energy VERY HIGH (0.8-0.95), anticipation HIGH (0.8-0.9), fear MODERATE (0.5-0.7), joy MODERATE (0.4-0.6), pace "fast"
- HORROR/SCARY signals → fear HIGH (0.8-0.9), anticipation HIGH, energy MODERATE, joy LOW (0.1-0.2)
- ROMANTIC signals → trust HIGH (0.8-0.9), joy MODERATE-HIGH (0.6-0.8), energy LOW-MODERATE (0.3-0.5)
- DRAMA/SAD signals → sadness HIGH (0.7-0.9), thematic_depth HIGH, energy LOW (0.1-0.3), pace "slow"
- When a mood clearly maps to one genre (e.g. "need a laugh" = comedy), actively SUPPRESS dimensions of other genres. A comedy profile should NOT have high anticipation/fear/anger values.`

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
    await checkRateLimit(req, 'parse-mood')
  } catch (err) {
    if (err instanceof RateLimitError) {
      return rateLimitResponse(err, CORS_HEADERS)
    }
  }

  let rawInput: string
  try {
    const body = await req.json()
    rawInput = body?.raw_input
    if (typeof rawInput !== 'string' || rawInput.trim().length === 0) {
      throw new Error('missing raw_input')
    }
    if (rawInput.length > 500) {
      throw new Error('raw_input too long')
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'raw_input string is required', code: 'INVALID_INPUT' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) {
    console.error('[parse-mood] ANTHROPIC_API_KEY is not set')
    return new Response(
      JSON.stringify({ error: 'Server configuration error', code: 'CONFIG_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: rawInput }],
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
    console.error('[parse-mood] Error:', msg)

    return new Response(
      JSON.stringify({ error: 'Failed to parse mood. Please try again.', code: 'PARSE_FAILED' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
