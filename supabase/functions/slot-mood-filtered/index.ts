/**
 * Edge Function: slot-mood-filtered
 * Mood bazli weighted random film secimi.
 * SADECE paid tier (monthly, annual, lifetime).
 *
 * POST /functions/v1/slot-mood-filtered
 * Body: { mood: string, user_id?: string }
 * Auth: Supabase JWT (fallback: body.user_id)
 *
 * Deploy: supabase functions deploy slot-mood-filtered --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIN_FILMS = 5
const TOP_N = 7
const PAID_TIERS = ['monthly', 'annual', 'lifetime']

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/**
 * Resolve user — JWT first, fallback to body.user_id
 * Returns app user UUID + tier
 */
async function resolveUser(
  req: Request,
  body: Record<string, unknown>,
): Promise<{ userId: string; tier: string; error?: string }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Strategy 1: JWT auth
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      })

      const { data: { user }, error } = await userClient.auth.getUser()
      if (user && !error) {
        const { data, error: lookupError } = await admin
          .from('users')
          .select('id, subscription_tier')
          .eq('auth_id', user.id)
          .single()

        if (data && !lookupError) {
          return { userId: data.id, tier: data.subscription_tier ?? 'free' }
        }
        console.error('[auth] User lookup failed:', lookupError?.message)
      } else {
        console.error('[auth] getUser failed:', error?.message)
      }
    } catch (e) {
      console.error('[auth] JWT strategy threw:', (e as Error).message)
    }
  }

  // Strategy 2: body.user_id fallback
  const bodyUserId = body.user_id as string | undefined
  if (bodyUserId) {
    console.log('[auth] Fallback to body.user_id')
    // Try as app user id
    const { data } = await admin
      .from('users')
      .select('id, subscription_tier')
      .eq('id', bodyUserId)
      .single()

    if (data) {
      return { userId: data.id, tier: data.subscription_tier ?? 'free' }
    }

    // Try as auth_id
    const { data: d2 } = await admin
      .from('users')
      .select('id, subscription_tier')
      .eq('auth_id', bodyUserId)
      .single()

    if (d2) {
      return { userId: d2.id, tier: d2.subscription_tier ?? 'free' }
    }
  }

  return { userId: '', tier: '', error: 'NO_USER_CONTEXT' }
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

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('=== SLOT-MOOD-FILTERED REQUEST ===')
  console.log('Method:', req.method)
  console.log('Auth header present:', !!req.headers.get('Authorization'))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const { userId, tier, error: authError } = await resolveUser(req, body)
  if (authError || !userId) {
    return json({ error: 'Auth required', code: authError }, 401)
  }

  // Premium gate
  if (!PAID_TIERS.includes(tier)) {
    return json({ error: 'PREMIUM_REQUIRED', tier, upgrade_url: 'chosy://paywall' }, 403)
  }

  const mood = (body.mood as string)?.trim()
  if (!mood) {
    return json({ error: 'mood field required' }, 400)
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // Quota check
    const { data: quotaResult, error: quotaError } = await admin.rpc('check_and_consume_quota', {
      p_user_id: userId,
      p_quota_type: 'slot',
    })
    if (quotaError) throw quotaError
    if (!quotaResult?.allowed) {
      return json({ error: 'QUOTA_EXCEEDED', ...quotaResult }, 429)
    }

    // Get watchlist films with film_profiles
    const { data: watchlistFilms, error: wlError } = await admin
      .from('watchlist')
      .select(`
        film_id,
        films(id, title, poster_url, year, runtime, vote_average, genres,
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
      return json({ error: 'NEED_MORE_FILMS', min: MIN_FILMS, current: unwatched.length }, 400)
    }

    // Parse mood to vector (8-dim emotional state)
    const moodVector = await parseMoodToVector(mood)

    // Score films by cosine similarity
    const scored = unwatched
      .map((w: Record<string, unknown>) => {
        const film = w.films as Record<string, unknown>
        const profiles = film.film_profiles as Array<Record<string, unknown>> | null
        const profile = profiles?.[0] ?? null
        const dims = profile?.dimensions_json as Record<string, unknown> | null

        let filmVector: number[] = []
        if (dims?.emotional_state) {
          const es = dims.emotional_state as Record<string, number>
          filmVector = [
            es.joy ?? 0, es.sadness ?? 0, es.fear ?? 0, es.anger ?? 0,
            es.surprise ?? 0, es.disgust ?? 0, es.trust ?? 0, es.anticipation ?? 0,
          ]
        }

        const score = filmVector.length === 8
          ? Math.max(0.1, cosineSimilarity(moodVector, filmVector))
          : 0.3

        return { film, score }
      })
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, TOP_N)

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

    console.log('[slot-mood-filtered] Picked:', picked.film.title, 'score:', picked.score)
    return json({
      film: {
        id: picked.film.id,
        title: picked.film.title,
        posterUrl: picked.film.poster_url,
        year: picked.film.year,
        runtime: picked.film.runtime,
        voteAverage: picked.film.vote_average,
        moodTags: (picked.film.genres as string[]) ?? [],
      },
      variant: 'mood_filtered',
      matchScore: picked.score,
      mood,
      candidateCount: unwatched.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[slot-mood-filtered] Error:', msg)
    return json({ error: 'Internal error', code: 'INTERNAL_ERROR' }, 500)
  }
})
