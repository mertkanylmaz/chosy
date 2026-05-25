/**
 * Edge Function: slot-triple
 * 3 filtreli slot — duration + mood + era.
 * SADECE paid tier (monthly, annual, lifetime).
 *
 * POST /functions/v1/slot-triple
 * Body: { duration_filter?, mood_filter?, era_filter?, user_id? }
 * Auth: Supabase JWT (fallback: body.user_id)
 *
 * Deploy: supabase functions deploy slot-triple --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const PAID_TIERS = ['monthly', 'annual', 'lifetime']

type DurationFilter = 'short' | 'medium' | 'long' | 'any'
type EraFilter = '2020s' | '2010s' | '2000s' | 'classic' | 'any'

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
    const { data } = await admin
      .from('users')
      .select('id, subscription_tier')
      .eq('id', bodyUserId)
      .single()

    if (data) {
      return { userId: data.id, tier: data.subscription_tier ?? 'free' }
    }

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

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('=== SLOT-TRIPLE REQUEST ===')
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
    body = {}
  }

  const { userId, tier, error: authError } = await resolveUser(req, body)
  if (authError || !userId) {
    return json({ error: 'Auth required', code: authError }, 401)
  }

  // Premium gate
  if (!PAID_TIERS.includes(tier)) {
    return json({ error: 'PREMIUM_REQUIRED', tier, upgrade_url: 'chosy://paywall' }, 403)
  }

  const durationFilter: DurationFilter = (body.duration_filter as DurationFilter) ?? 'any'
  const eraFilter: EraFilter = (body.era_filter as EraFilter) ?? 'any'
  const moodFilter: string | undefined = (body.mood_filter as string)?.trim() || undefined

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

    // Get unwatched watchlist films
    const { data: watchlistFilms, error: wlError } = await admin
      .from('watchlist')
      .select('film_id, films(id, title, poster_url, year, runtime, vote_average, genres)')
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

        if (durationFilter !== 'any' && film.runtime != null) {
          const runtime = film.runtime as number
          if (runtime < minDur || runtime > maxDur) return false
        }

        if (eraFilter !== 'any' && film.year != null) {
          const year = film.year as number
          if (year < minYear || year > maxYear) return false
        }

        if (moodFilter) {
          const tags = (film.genres as string[]) ?? []
          const moodLower = moodFilter.toLowerCase()
          const hasMatch = tags.some((t: string) => t.toLowerCase().includes(moodLower))
          if (!hasMatch) return false
        }

        return true
      })

    if (candidates.length === 0) {
      return json({
        error: 'NO_MATCHES',
        message: 'No films match your filters. Try broader settings.',
        filters: { duration: durationFilter, mood: moodFilter, era: eraFilter },
      })
    }

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

    console.log('[slot-triple] Picked:', film.title)
    return json({
      film: {
        id: film.id,
        title: film.title,
        posterUrl: film.poster_url,
        year: film.year,
        runtime: film.runtime,
        voteAverage: film.vote_average,
        moodTags: film.genres ?? [],
      },
      variant: 'triple',
      candidateCount: candidates.length,
      filters: { duration: durationFilter, mood: moodFilter, era: eraFilter },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[slot-triple] Error:', msg)
    return json({ error: 'Internal error', code: 'INTERNAL_ERROR' }, 500)
  }
})
