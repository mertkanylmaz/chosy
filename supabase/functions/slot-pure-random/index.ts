/**
 * Edge Function: slot-pure-random
 * Watchlist'ten random unwatched film secer.
 * Tum tier'lara acik, quota check ('slot' type).
 *
 * POST /functions/v1/slot-pure-random
 * Auth: Supabase JWT
 *
 * Deploy: supabase functions deploy slot-pure-random
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MIN_FILMS = 3

/** JWT'den users.id cikarir */
async function getUserId(req: Request): Promise<{ userId: string; error?: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { userId: '', error: 'MISSING_AUTH' }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  const supabaseUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await supabaseUser.auth.getUser()
  if (error || !user) return { userId: '', error: 'INVALID_TOKEN' }

  const supabaseAdmin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  const { data, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (lookupError || !data) return { userId: '', error: 'USER_NOT_FOUND' }
  return { userId: data.id }
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

  const { userId, error: authError } = await getUserId(req)
  if (authError || !userId) {
    return new Response(
      JSON.stringify({ error: 'Auth required', code: authError }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
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

    // Get unwatched watchlist films
    const { data: watchlistFilms, error: wlError } = await admin
      .from('watchlist')
      .select('film_id, films(id, title, poster_url, year, runtime, vote_average, mood_tags)')
      .eq('user_id', userId)
      .is('watched_at', null)

    if (wlError) throw wlError

    const unwatched = (watchlistFilms ?? []).filter((w: Record<string, unknown>) => w.films)

    if (unwatched.length < MIN_FILMS) {
      return new Response(
        JSON.stringify({ error: 'NEED_MORE_FILMS', min: MIN_FILMS, current: unwatched.length }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
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

    return new Response(
      JSON.stringify({
        film: {
          id: film.id,
          title: film.title,
          posterUrl: film.poster_url,
          year: film.year,
          runtime: film.runtime,
          voteAverage: film.vote_average,
          moodTags: film.mood_tags ?? [],
        },
        variant: 'pure_random',
        candidateCount: unwatched.length,
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[slot-pure-random] Error:', msg)
    return new Response(
      JSON.stringify({ error: 'Internal error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
