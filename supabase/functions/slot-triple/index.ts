/**
 * Edge Function: slot-triple
 * 3 filtreli slot — duration + mood + era.
 * SADECE paid tier (monthly, annual, lifetime).
 *
 * POST /functions/v1/slot-triple
 * Body: { duration_filter?, mood_filter?, era_filter? }
 * Auth: Supabase JWT
 *
 * Deploy: supabase functions deploy slot-triple
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PAID_TIERS = ['monthly', 'annual', 'lifetime']

type DurationFilter = 'short' | 'medium' | 'long' | 'any'
type EraFilter = '2020s' | '2010s' | '2000s' | 'classic' | 'any'

interface TripleRequest {
  duration_filter?: DurationFilter
  mood_filter?: string
  era_filter?: EraFilter
}

const DURATION_BOUNDS: Record<DurationFilter, [number, number]> = {
  short: [0, 90],
  medium: [90, 150],
  long: [150, 999],
  any: [0, 999],
}

const ERA_BOUNDS: Record<EraFilter, [number, number]> = {
  '2020s': [2020, 2029],
  '2010s': [2010, 2019],
  '2000s': [2000, 2009],
  classic: [1900, 1999],
  any: [1900, 2099],
}

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

  let body: TripleRequest
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const durationFilter: DurationFilter = body.duration_filter ?? 'any'
  const eraFilter: EraFilter = body.era_filter ?? 'any'
  const moodFilter: string | undefined = body.mood_filter?.trim() || undefined

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

    const [minDur, maxDur] = DURATION_BOUNDS[durationFilter]
    const [minYear, maxYear] = ERA_BOUNDS[eraFilter]

    // Apply filters
    const candidates = (watchlistFilms ?? [])
      .filter((w: Record<string, unknown>) => {
        const film = w.films as Record<string, unknown> | null
        if (!film) return false

        // Duration filter
        if (durationFilter !== 'any' && film.runtime != null) {
          const runtime = film.runtime as number
          if (runtime < minDur || runtime > maxDur) return false
        }

        // Era filter
        if (eraFilter !== 'any' && film.year != null) {
          const year = film.year as number
          if (year < minYear || year > maxYear) return false
        }

        // Mood filter (simple keyword match on mood_tags)
        if (moodFilter) {
          const tags = (film.mood_tags as string[]) ?? []
          const moodLower = moodFilter.toLowerCase()
          const hasMatch = tags.some((t: string) => t.toLowerCase().includes(moodLower))
          if (!hasMatch) return false
        }

        return true
      })

    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'NO_MATCHES',
          message: 'No films match your filters. Try broader settings.',
          filters: { duration: durationFilter, mood: moodFilter, era: eraFilter },
        }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Weighted random (uniform for triple)
    const randomIndex = Math.floor(Math.random() * candidates.length)
    const picked = candidates[randomIndex]
    const film = picked.films as Record<string, unknown>

    // Log spin
    await admin.from('slot_spins').insert({
      user_id: userId,
      film_id: film.id,
      variant: 'triple',
      filters: { duration: durationFilter, mood: moodFilter, era: eraFilter },
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
        variant: 'triple',
        candidateCount: candidates.length,
        filters: { duration: durationFilter, mood: moodFilter, era: eraFilter },
      }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[slot-triple] Error:', msg)
    return new Response(
      JSON.stringify({ error: 'Internal error', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
