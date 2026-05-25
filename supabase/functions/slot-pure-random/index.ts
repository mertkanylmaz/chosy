/**
 * Edge Function: slot-pure-random
 * Watchlist'ten random unwatched film secer.
 * Tum tier'lara acik, quota check ('slot' type).
 *
 * POST /functions/v1/slot-pure-random
 * Auth: Supabase JWT (fallback: body.user_id)
 *
 * Deploy: supabase functions deploy slot-pure-random --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIN_FILMS = 3

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/**
 * Resolve user — JWT first, fallback to body.user_id
 * Returns app user UUID (users.id), not auth UID
 */
async function resolveUser(
  req: Request,
  body: Record<string, unknown>,
): Promise<{ userId: string; error?: string }> {
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
        console.log('[auth] JWT valid, auth_uid:', user.id)
        const { data, error: lookupError } = await admin
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single()

        if (data && !lookupError) {
          console.log('[auth] Resolved app user:', data.id)
          return { userId: data.id }
        }
        console.error('[auth] User lookup failed:', lookupError?.message)
      } else {
        console.error('[auth] getUser failed:', error?.message)
      }
    } catch (e) {
      console.error('[auth] JWT strategy threw:', (e as Error).message)
    }
  }

  // Strategy 2: body.user_id fallback (for demo/debug)
  const bodyUserId = body.user_id as string | undefined
  if (bodyUserId) {
    console.log('[auth] Fallback to body.user_id:', bodyUserId)
    // Verify it exists in users table
    const { data, error } = await admin
      .from('users')
      .select('id')
      .eq('id', bodyUserId)
      .single()

    if (data && !error) {
      return { userId: data.id }
    }

    // Maybe it's an auth_id, not app user id
    const { data: d2, error: e2 } = await admin
      .from('users')
      .select('id')
      .eq('auth_id', bodyUserId)
      .single()

    if (d2 && !e2) {
      console.log('[auth] body.user_id was auth_id, resolved to:', d2.id)
      return { userId: d2.id }
    }

    console.error('[auth] body.user_id not found in users table')
  }

  return { userId: '', error: 'NO_USER_CONTEXT' }
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('=== SLOT-PURE-RANDOM REQUEST ===')
  console.log('Method:', req.method)
  console.log('Auth header present:', !!req.headers.get('Authorization'))
  console.log('Auth header prefix:', req.headers.get('Authorization')?.substring(0, 30))

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // Parse body (may contain user_id fallback)
  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    // empty body is fine for pure random
  }

  const { userId, error: authError } = await resolveUser(req, body)
  if (authError || !userId) {
    console.error('[slot-pure-random] Auth failed:', authError)
    return json({ error: 'Auth required', code: authError }, 401)
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // Quota check
    console.log('[slot-pure-random] Calling check_and_consume_quota for user:', userId)
    const { data: quotaResult, error: quotaError } = await admin.rpc('check_and_consume_quota', {
      p_user_id: userId,
      p_quota_type: 'slot',
    })

    console.log('[slot-pure-random] Quota result:', JSON.stringify(quotaResult), 'error:', JSON.stringify(quotaError))

    if (quotaError) throw quotaError
    if (!quotaResult?.allowed) {
      return json({ error: 'QUOTA_EXCEEDED', ...quotaResult }, 429)
    }

    // Get unwatched watchlist films
    const { data: watchlistFilms, error: wlError } = await admin
      .from('watchlist')
      .select('film_id, films(id, title, poster_url, year, runtime, vote_average, genres)')
      .eq('user_id', userId)
      .is('watched_at', null)

    if (wlError) throw wlError

    const unwatched = (watchlistFilms ?? []).filter((w: Record<string, unknown>) => w.films)
    console.log('[slot-pure-random] Unwatched count:', unwatched.length)

    if (unwatched.length < MIN_FILMS) {
      return json({ error: 'NEED_MORE_FILMS', min: MIN_FILMS, current: unwatched.length }, 400)
    }

    // Random pick
    const randomIndex = Math.floor(Math.random() * unwatched.length)
    const picked = unwatched[randomIndex]
    const film = picked.films as Record<string, unknown>

    // Log spin
    await admin.from('slot_spins').insert({
      user_id: userId,
      film_id: film.id,
      variant: 'pure_random',
      accepted: false,
    })

    console.log('[slot-pure-random] Picked film:', film.title)
    return json({
      film: {
        id: film.id,
        title: film.title,
        posterUrl: film.poster_url,
        year: film.year,
        runtime: film.runtime,
        voteAverage: film.vote_average,
        moodTags: (film.genres as string[]) ?? [],
      },
      variant: 'pure_random',
      candidateCount: unwatched.length,
    })
  } catch (err) {
    const msg = err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null
        ? JSON.stringify(err)
        : String(err)
    console.error('[slot-pure-random] Error:', msg)
    return json({ error: 'Internal error', code: 'INTERNAL_ERROR', detail: msg }, 500)
  }
})
