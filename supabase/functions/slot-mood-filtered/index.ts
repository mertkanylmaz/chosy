/**
 * Edge Function: slot-mood-filtered
 * Mood bazli weighted random film secimi.
 * SADECE paid tier (monthly, annual, lifetime).
 *
 * POST /functions/v1/slot-mood-filtered
 * Body: { mood: string }
 * Auth: Supabase JWT
 *
 * Deploy: supabase functions deploy slot-mood-filtered
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIN_FILMS = 5
const TOP_N = 7
const PAID_TIERS = ['monthly', 'annual', 'lifetime']

/** JWT'den users.id + tier cikarir */
async function getUserInfo(req: Request): Promise<{
  userId: string;
  tier: string;
  error?: string;
}> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { userId: '', tier: '', error: 'MISSING_AUTH' }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await supabaseUser.auth.getUser()
  if (error || !user) return { userId: '', tier: '', error: 'INVALID_TOKEN' }

  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data, error: lookupError } = await admin
    .from('users')
    .select('id, subscription_tier')
    .eq('auth_id', user.id)
    .single()

  if (lookupError || !data) return { userId: '', tier: '', error: 'USER_NOT_FOUND' }
  return { userId: data.id, tier: data.subscription_tier }
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB)
  return mag === 0 ? 0 : dot / mag
}

/** Weighted random pick from scored films */
function weightedRandomPick(
  films: Array<{ film: Record<string, unknown>; score: number }>,
): { film: Record<string, unknown>; score: number } {
  const total = films.reduce((sum, f) => sum + f.score, 0)
  let rand = Math.random() * total
  for (const f of films) {
    rand -= f.score
    if (rand <= 0) return f
  }
  return films[films.length - 1]
}

/** Parse mood text to simple vector using Claude */
async function parseMoodToVector(mood: string): Promise<number[]> {
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const anthropic = new Anthropic({ apiKey: anthropicApiKey })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Rate this mood on 8 dimensions (0.0-1.0): "${mood}"
Return ONLY a JSON array of 8 floats: [joy, sadness, fear, anger, surprise, disgust, trust, anticipation]
Example: [0.8, 0.1, 0.0, 0.0, 0.6, 0.0, 0.7, 0.9]`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const match = text.match(/\[[\d.,\s]+\]/)
  if (!match) throw new Error('Failed to parse mood vector')
  return JSON.parse(match[0])
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const { userId, tier, error: authError } = await getUserInfo(req)
  if (authError || !userId) {
    return new Response(
      JSON.stringify({ error: 'Auth required', code: authError }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Premium gate
  if (!PAID_TIERS.includes(tier)) {
    return new Response(
      JSON.stringify({ error: 'PREMIUM_REQUIRED', tier, upgrade_url: 'chosy://paywall' }),
      { status: 403, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  let body: { mood?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const mood = body.mood?.trim()
  if (!mood) {
    return new Response(
      JSON.stringify({ error: 'mood field required' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const admin = createClient(supabaseUrl, serviceKey)

    // Quota check
    const { data: quotaResult, error: quotaError } = await admin.rpc('check_and_consume_quota', {
      p_user_id: userId,
      p_quota_type: 'slot',
    })
    if (quotaError) throw quotaError
    if (!quotaResult?.allowed) {
      return new Response(
        JSON.stringify({ error: 'QUOTA_EXCEEDED', ...quotaResult }),
        { status: 429, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Get watchlist films with film_profiles (dimensions_json has emotional dims)
    // film_profiles.film_id -> films.id, so we join through films
    const { data: watchlistFilms, error: wlError } = await admin
      .from('watchlist')
      .select(`
        film_id,
        films(id, title, poster_url, year, runtime, vote_average, mood_tags,
          film_profiles(dimensions_json)
        )
      `)
      .eq('user_id', userId)
      .is('watched_at', null)

    if (wlError) throw wlError

    const unwatched = (watchlistFilms ?? []).filter(
      (w: Record<string, unknown>) => w.films,
    )

    if (unwatched.length < MIN_FILMS) {
      return new Response(
        JSON.stringify({ error: 'NEED_MORE_FILMS', min: MIN_FILMS, current: unwatched.length }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Parse mood to vector (8-dim emotional state)
    const moodVector = await parseMoodToVector(mood)

    // Score films by cosine similarity using dimensions_json emotional_state
    const scored = unwatched
      .map((w: Record<string, unknown>) => {
        const film = w.films as Record<string, unknown>

        // film_profiles is nested inside films (one-to-one)
        const profiles = film.film_profiles as Array<Record<string, unknown>> | null
        const profile = profiles?.[0] ?? null
        const dims = profile?.dimensions_json as Record<string, unknown> | null

        // Extract 8-dim emotional vector from dimensions_json.emotional_state
        let filmVector: number[] = []
        if (dims?.emotional_state) {
          const es = dims.emotional_state as Record<string, number>
          filmVector = [
            es.joy ?? 0, es.sadness ?? 0, es.fear ?? 0, es.anger ?? 0,
            es.surprise ?? 0, es.disgust ?? 0, es.trust ?? 0, es.anticipation ?? 0,
          ]
        }

        // If no emotional dimensions, assign base score
        const score = filmVector.length === 8
          ? Math.max(0.1, cosineSimilarity(moodVector, filmVector))
          : 0.3

        return { film, score }
      })
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, TOP_N)

    // Weighted random from top N
    const picked = weightedRandomPick(scored)

    // Log spin
    await admin.from('slot_spins').insert({
      user_id: userId,
      film_id: picked.film.id,
      variant: 'mood_filtered',
      mood_context: mood,
      match_score: picked.score,
      accepted: false,
    })

    return new Response(
      JSON.stringify({
        film: {
          id: picked.film.id,
          title: picked.film.title,
          posterUrl: picked.film.poster_url,
          year: picked.film.year,
          runtime: picked.film.runtime,
          voteAverage: picked.film.vote_average,
          moodTags: picked.film.mood_tags ?? [],
        },
        variant: 'mood_filtered',
        matchScore: picked.score,
        mood,
        candidateCount: unwatched.length,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[slot-mood-filtered] Error:', msg)
    return new Response(
      JSON.stringify({ error: 'Internal error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
