/**
 * Edge Function: send-daily-pick
 * Hourly cron — selects a personalized film for each eligible user
 * and queues it into notification_log (sent by send-notifications).
 *
 * Flow:
 *   1. Find users whose preferred_notification_hour matches current UTC-adjusted hour
 *   2. For each user: call match_films_v3 RPC → pick 1 fresh film
 *   3. Queue notification into notification_log (status='queued')
 *   4. send-notifications (separate cron) picks up and delivers via Expo Push API
 *
 * Required env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 *   EXPO_PUBLIC_POSTHOG_KEY (optional — for server-side analytics)
 *
 * Deploy: supabase functions deploy send-daily-pick
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibleUser {
  id: string
  push_token: string
  timezone: string
  preferred_notification_hour: number
  preferences_vector: string | null
  daily_pick_enabled: boolean
}

interface MatchedFilm {
  id: string
  tmdb_id: number
  title: string
  genres: string[] | null
  poster_url: string | null
  similarity: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get current hour in a user's timezone.
 */
function getCurrentHourInTZ(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    })
    return parseInt(formatter.format(new Date()), 10)
  } catch {
    return new Date().getUTCHours()
  }
}

/**
 * Check if current time is within quiet hours (23:00-08:00) in user TZ.
 */
function isQuietHours(tz: string): boolean {
  const hour = getCurrentHourInTZ(tz)
  return hour >= 23 || hour < 8
}

/**
 * Determine locale from timezone (simple heuristic matching schedule-notifications).
 */
function getLocale(tz: string): 'en' | 'tr' {
  return (tz.includes('Istanbul') || tz.includes('Turkey')) ? 'tr' : 'en'
}

/**
 * Build notification body from film data.
 * Format: "[Film title] — [genre1, genre2]" (max 60 chars)
 */
function buildBody(film: MatchedFilm, locale: 'en' | 'tr'): string {
  const genres = film.genres?.slice(0, 2).join(', ') ?? ''
  const suffix = genres ? ` — ${genres}` : ''
  const full = `${film.title}${suffix}`
  return full.length > 60 ? full.slice(0, 57) + '...' : full
}

/**
 * Send PostHog event server-side (fire-and-forget).
 */
async function trackPostHog(
  apiKey: string | undefined,
  event: string,
  userId: string,
  properties: Record<string, unknown>,
): Promise<void> {
  if (!apiKey) return
  try {
    await fetch('https://eu.i.posthog.com/capture/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: userId,
        properties,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // Non-critical — don't block notification flow
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const stats = { processed: 0, sent: 0, skipped: 0, errors: 0 }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const posthogKey = Deno.env.get('EXPO_PUBLIC_POSTHOG_KEY')
    const db = createClient(supabaseUrl, serviceKey)

    // ── 1. Fetch eligible users ───────────────────────────────────────────
    const { data: users, error: usersError } = await db
      .from('users')
      .select(`
        id,
        push_token,
        timezone,
        preferred_notification_hour,
        preferences_vector,
        daily_pick_enabled
      `)
      .not('push_token', 'is', null)
      .eq('push_enabled', true)
      .eq('daily_pick_enabled', true)

    if (usersError || !users) {
      console.error('[send-daily-pick] Failed to fetch users:', usersError?.message)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: usersError?.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    stats.processed = users.length
    const now = new Date()
    const todayUTC = now.toISOString().split('T')[0]

    // ── 2. Process each user ──────────────────────────────────────────────
    for (const user of users as EligibleUser[]) {
      try {
        const tz = user.timezone || 'UTC'
        const currentHour = getCurrentHourInTZ(tz)
        const preferredHour = user.preferred_notification_hour ?? 19 // Default 19:00 for daily pick

        // Check: is it the user's preferred hour (±0)?
        if (currentHour !== preferredHour) {
          stats.skipped++
          continue
        }

        // Check: quiet hours
        if (isQuietHours(tz)) {
          stats.skipped++
          continue
        }

        // Check: already sent today for this user
        const { data: existing } = await db
          .from('notification_log')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'daily_pick')
          .gte('created_at', todayUTC)
          .limit(1)

        if (existing && existing.length > 0) {
          stats.skipped++
          continue
        }

        // Check: last_daily_pick_at within 20 hours (prevent double-send)
        const { data: userData } = await db
          .from('users')
          .select('last_daily_pick_at')
          .eq('id', user.id)
          .single()

        if (userData?.last_daily_pick_at) {
          const lastSent = new Date(userData.last_daily_pick_at as string)
          const hoursSince = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60)
          if (hoursSince < 20) {
            stats.skipped++
            continue
          }
        }

        // Check: 24h notification frequency limit (max 2/day total)
        const { data: recentCount } = await db.rpc('user_notification_count_24h', {
          p_user_id: user.id,
        })
        if ((recentCount ?? 0) >= 2) {
          stats.skipped++
          continue
        }

        // ── 3. Get film recommendation ────────────────────────────────────
        // Get recent daily_pick film_ids to exclude (last 30 days)
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: recentPicks } = await db
          .from('notification_log')
          .select('data')
          .eq('user_id', user.id)
          .eq('type', 'daily_pick')
          .gte('created_at', thirtyDaysAgo.toISOString())

        const recentFilmIds = (recentPicks ?? [])
          .map((r: { data: Record<string, unknown> | null }) => r.data?.film_id as string)
          .filter(Boolean)

        // Get watchlist film IDs to exclude
        const { data: watchlistItems } = await db
          .from('watchlist')
          .select('film_id')
          .eq('user_id', user.id)

        const watchlistIds = (watchlistItems ?? []).map((w: { film_id: string }) => w.film_id)

        // Combine exclusion list
        const excludeIds = [...new Set([...recentFilmIds, ...watchlistIds])]

        // Use user's preferences_vector for personalized pick
        // If no preferences_vector, use a generic mood vector won't work — skip user
        if (!user.preferences_vector) {
          console.error(`[send-daily-pick] User ${user.id} has no preferences_vector — skipping`)
          stats.skipped++
          continue
        }

        // Call match_films_v3 with user's preferences vector as both mood and user vector
        // This gives us films similar to the user's overall taste profile
        const { data: films, error: matchError } = await db.rpc('match_films_v3', {
          query_vector: user.preferences_vector,
          user_vector: user.preferences_vector,
          mood_weight: 0.5,
          user_weight: 0.5,
          match_count: 5,
          exclude_ids: excludeIds.length > 0 ? excludeIds : null,
          tier_boost: true,
        })

        if (matchError || !films || films.length === 0) {
          console.error(`[send-daily-pick] match_films_v3 failed for user ${user.id}:`, matchError?.message ?? 'no films')
          stats.errors++
          continue
        }

        // Pick the top film
        const film = films[0] as MatchedFilm

        // ── 4. Queue notification ───────────────────────────────────────
        const locale = getLocale(tz)
        const title = locale === 'tr' ? '🎬 Bu aksamin secimi' : '🎬 Tonight\'s pick'
        const body = buildBody(film, locale)

        const { error: insertError } = await db.from('notification_log').insert({
          user_id: user.id,
          type: 'daily_pick',
          title,
          body,
          data: {
            film_id: film.id,
            tmdb_id: film.tmdb_id,
            source: 'daily_pick',
            screen: 'film',
            filmId: film.id,
          },
          status: 'queued',
          scheduled_for: now.toISOString(),
        })

        if (insertError) {
          console.error(`[send-daily-pick] notification_log insert failed for user ${user.id}:`, insertError.message)
          stats.errors++
          continue
        }

        // Update last_daily_pick_at
        await db
          .from('users')
          .update({ last_daily_pick_at: now.toISOString() })
          .eq('id', user.id)

        // PostHog server-side event
        await trackPostHog(posthogKey, 'daily_pick_sent', user.id, {
          film_id: film.id,
          tmdb_id: film.tmdb_id,
          film_title: film.title,
          similarity: film.similarity,
        })

        stats.sent++
      } catch (userErr) {
        console.error(`[send-daily-pick] Error processing user ${user.id}:`, userErr)
        stats.errors++
        // Continue to next user — never abort the whole batch
      }
    }

    return new Response(
      JSON.stringify({ ok: true, ...stats }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[send-daily-pick] Fatal error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(err), ...stats }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
