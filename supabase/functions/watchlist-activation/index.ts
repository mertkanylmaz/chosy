/**
 * Edge Function: watchlist-activation
 * Two patterns triggered by pg_cron:
 *   - weekend_pick  (Friday 15:00 UTC) — oldest high-match unwatched film
 *   - mood_recall   (Wednesday 17:00 UTC) — film from a recent mood search
 *
 * Queues into notification_log (status='queued'), delivered by send-notifications.
 *
 * Frequency caps:
 *   - Max 2 watchlist activations per week (Mon 00:00 UTC reset)
 *   - Skip if daily_pick already sent today
 *   - Quiet hours: 23:00–08:00 in user timezone
 *
 * Deploy: supabase functions deploy watchlist-activation
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Pattern = 'weekend_pick' | 'mood_recall'

interface EligibleUser {
  id: string
  push_token: string
  timezone: string
}

interface WatchlistRow {
  film_id: string
  created_at: string
  match_score: number | null
  films: { title: string } | null
}

interface MoodRecallRow {
  mood_text: string
  recommended_film_ids: string[] | null
}

interface WatchlistFilm {
  film_id: string
  created_at: string
  films: { title: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get current hour in user's timezone. */
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

/** Quiet hours: 23:00–08:00 in user timezone. */
function isQuietHours(tz: string): boolean {
  const hour = getCurrentHourInTZ(tz)
  return hour >= 23 || hour < 8
}

/** Determine locale from timezone. */
function getLocale(tz: string): 'en' | 'tr' {
  return (tz.includes('Istanbul') || tz.includes('Turkey')) ? 'tr' : 'en'
}

/** Monday 00:00 UTC of the current week. */
function getMondayUTC(): string {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1 // days since Monday
  const monday = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - diff,
    0, 0, 0, 0,
  ))
  return monday.toISOString()
}

/** Truncate string at maxLen, add ellipsis. */
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

/** Days between two dates. */
function daysBetween(a: Date, b: Date): number {
  const ms = Math.abs(b.getTime() - a.getTime())
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  const stats = { pattern: '' as string, processed: 0, sent: 0, skipped: 0, errors: 0 }

  try {
    // ── Parse pattern ───────────────────────────────────────────────────────
    let pattern: Pattern
    try {
      const body = await req.json()
      pattern = body.pattern
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid body — expected { "pattern": "weekend_pick" | "mood_recall" }' }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    if (pattern !== 'weekend_pick' && pattern !== 'mood_recall') {
      return new Response(
        JSON.stringify({ error: `Unknown pattern: ${pattern}` }),
        { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    stats.pattern = pattern

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(supabaseUrl, serviceKey)

    // ── Fetch eligible users ────────────────────────────────────────────────
    const { data: users, error: usersError } = await db
      .from('users')
      .select('id, push_token, timezone')
      .not('push_token', 'is', null)
      .eq('push_enabled', true)
      .eq('watchlist_notifications_enabled', true)

    if (usersError || !users) {
      console.error('[watchlist-activation] Failed to fetch users:', usersError?.message)
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: usersError?.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    stats.processed = users.length
    const now = new Date()
    const todayUTC = now.toISOString().split('T')[0]
    const mondayUTC = getMondayUTC()

    // ── Process each user ───────────────────────────────────────────────────
    for (const user of users as EligibleUser[]) {
      try {
        const tz = user.timezone || 'UTC'

        // Cap: quiet hours
        if (isQuietHours(tz)) {
          stats.skipped++
          continue
        }

        // Cap: already received daily_pick today
        const { data: dailyToday } = await db
          .from('notification_log')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'daily_pick')
          .gte('created_at', todayUTC)
          .limit(1)

        if (dailyToday && dailyToday.length > 0) {
          stats.skipped++
          continue
        }

        // Cap: max 2 watchlist activations this week (since Monday)
        const { data: weeklyActivations } = await db
          .from('notification_log')
          .select('id')
          .eq('user_id', user.id)
          .in('type', ['weekend_pick', 'mood_recall'])
          .in('status', ['queued', 'sent'])
          .gte('created_at', mondayUTC)

        if (weeklyActivations && weeklyActivations.length >= 2) {
          stats.skipped++
          continue
        }

        // ── Pattern-specific logic ────────────────────────────────────────
        const locale = getLocale(tz)
        let title: string
        let body: string
        let notifData: Record<string, unknown>

        if (pattern === 'weekend_pick') {
          const result = await buildWeekendPick(db, user.id, locale)
          if (!result) {
            stats.skipped++
            continue
          }
          title = result.title
          body = result.body
          notifData = result.data
        } else {
          const result = await buildMoodRecall(db, user.id, locale)
          if (!result) {
            stats.skipped++
            continue
          }
          title = result.title
          body = result.body
          notifData = result.data
        }

        // ── Queue notification ──────────────────────────────────────────
        const { error: insertError } = await db.from('notification_log').insert({
          user_id: user.id,
          type: pattern,
          title,
          body,
          data: {
            ...notifData,
            source: pattern,
            screen: 'film',
          },
          status: 'queued',
          scheduled_for: now.toISOString(),
        })

        if (insertError) {
          console.error(`[watchlist-activation] notification_log insert failed for user ${user.id}:`, insertError.message)
          stats.errors++
          continue
        }

        stats.sent++
      } catch (userErr) {
        console.error(`[watchlist-activation] Error processing user ${user.id}:`, userErr)
        stats.errors++
        // Continue to next user — never abort the whole batch
      }
    }

    return new Response(
      JSON.stringify({ ok: true, ...stats }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[watchlist-activation] Fatal error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(err), ...stats }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})

// ─── Pattern A: Weekend Pick ────────────────────────────────────────────────

interface NotifPayload {
  title: string
  body: string
  data: Record<string, unknown>
}

/**
 * Weekend Pick: oldest unwatched film with highest match_score in watchlist.
 * Requires 3+ unwatched films.
 */
async function buildWeekendPick(
  db: ReturnType<typeof createClient>,
  userId: string,
  locale: 'en' | 'tr',
): Promise<NotifPayload | null> {
  // Get unwatched films in watchlist, ordered by oldest first then highest match_score
  const { data: watchlistItems, error } = await db
    .from('watchlist')
    .select('film_id, created_at, match_score, films(title)')
    .eq('user_id', userId)
    .is('watched_at', null)
    .order('created_at', { ascending: true })

  if (error || !watchlistItems) {
    console.error(`[watchlist-activation] weekend_pick query failed for user ${userId}:`, error?.message)
    return null
  }

  const items = watchlistItems as unknown as WatchlistRow[]

  // Need 3+ unwatched films
  if (items.length < 3) return null

  // Pick the one with highest match_score; break ties by oldest created_at (already sorted)
  let best = items[0]
  for (const item of items) {
    if ((item.match_score ?? 0) > (best.match_score ?? 0)) {
      best = item
    }
  }

  const filmTitle = best.films?.title ?? 'a film'
  const daysWaiting = daysBetween(new Date(best.created_at), new Date())

  const title = locale === 'tr' ? '🎬 Hafta sonu onerimiz' : '🎬 This weekend'
  const body = locale === 'tr'
    ? `${truncate(filmTitle, 30)} — ${daysWaiting} gundur listenizde bekliyor`
    : `${truncate(filmTitle, 30)} — waiting in your list for ${daysWaiting} days`

  return {
    title,
    body: truncate(body, 100),
    data: {
      film_id: best.film_id,
      filmId: best.film_id,
      pattern: 'weekend_pick',
    },
  }
}

// ─── Pattern B: Mood Recall ─────────────────────────────────────────────────

/**
 * Mood Recall: find a recent mood search whose recommended films ended up
 * in the user's watchlist (unwatched).
 *
 * Join path: mood_searches.recommended_film_ids (UUID[]) overlaps with
 * watchlist.film_id for the same user.
 */
async function buildMoodRecall(
  db: ReturnType<typeof createClient>,
  userId: string,
  locale: 'en' | 'tr',
): Promise<NotifPayload | null> {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // Get recent mood searches with mood_text and recommended_film_ids
  const { data: searches, error: searchError } = await db
    .from('mood_searches')
    .select('mood_text, recommended_film_ids')
    .eq('user_id', userId)
    .not('mood_text', 'is', null)
    .not('recommended_film_ids', 'is', null)
    .gte('searched_at', thirtyDaysAgo.toISOString())
    .order('searched_at', { ascending: false })
    .limit(10)

  if (searchError || !searches || searches.length === 0) return null

  // Get unwatched watchlist films
  const { data: watchlistItems, error: wlError } = await db
    .from('watchlist')
    .select('film_id, created_at, films(title)')
    .eq('user_id', userId)
    .is('watched_at', null)

  if (wlError || !watchlistItems || watchlistItems.length === 0) return null

  const wlFilmIds = new Set(
    (watchlistItems as unknown as WatchlistFilm[]).map((w) => w.film_id),
  )
  const wlMap = new Map(
    (watchlistItems as unknown as WatchlistFilm[]).map((w) => [w.film_id, w]),
  )

  // Find first mood search that has an overlapping film in watchlist
  for (const search of searches as MoodRecallRow[]) {
    if (!search.recommended_film_ids || !search.mood_text) continue

    const overlapping = search.recommended_film_ids.filter((fid) => wlFilmIds.has(fid))
    if (overlapping.length === 0) continue

    // Pick the most recently added film from that search
    let bestFilm: WatchlistFilm | null = null
    for (const fid of overlapping) {
      const wlItem = wlMap.get(fid)
      if (!wlItem) continue
      if (!bestFilm || new Date(wlItem.created_at) > new Date(bestFilm.created_at)) {
        bestFilm = wlItem
      }
    }

    if (!bestFilm) continue

    const filmTitle = bestFilm.films?.title ?? 'a film'
    const moodQuery = truncate(search.mood_text, 40)

    const title = locale === 'tr' ? '💭 Hala o ruh halinde misin?' : '💭 Still in the mood?'
    const body = locale === 'tr'
      ? `'${moodQuery}' icin ${truncate(filmTitle, 25)} kaydetmistin — hala bekliyor`
      : `Remember '${moodQuery}'? You saved ${truncate(filmTitle, 25)} — still in the mood?`

    return {
      title,
      body: truncate(body, 120),
      data: {
        film_id: bestFilm.film_id,
        filmId: bestFilm.film_id,
        pattern: 'mood_recall',
        mood_query: search.mood_text,
      },
    }
  }

  return null
}
