/**
 * Edge Function: schedule-notifications
 * Cron-triggered — queues daily notifications into notification_log.
 *
 * Schedules:
 *   - Daily ritual push: 18:00 in the user's own timezone (D-02, sabit)
 *   - Sunday evening: 19:00 user TZ (Sundays only)
 *   - Streak warning: 22:00 user TZ (if no activity that day, streak > 0)
 *   - Quota refill: 00:05 next day (only if quota was exhausted yesterday)
 *
 * Deploy: supabase functions deploy schedule-notifications
 * Cron: Run every hour (Supabase pg_cron or external cron)
 *
 * IMPORTANT: This function should be called with service_role key.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Notification Templates (server-side, simplified) ─────────────────────────

/**
 * D-02 (Kapsam Kilidi): günde TEK push, kullanıcı-yerel 18:00.
 *
 * `users.preferred_notification_hour` KASITLI OLARAK OKUNMUYOR. O kolon
 * mood-search döneminin "sabah kancası" saatiydi ve M2 Faz 1 ölçümünde
 * 237/237 satırda kolon DEFAULT'u olan 9 değerindeydi — yani hiçbir kullanıcı
 * onu hiç değiştirmemiş, kişiselleştirme sinyali taşımıyor. Ritüel saati ürün
 * kararıdır, kullanıcı tercihi değil (D-02). Kolon SİLİNMİYOR, yalnızca bu
 * okuma noktası kaldırıldı.
 *
 * `users.timezone` ise okunmaya DEVAM EDİYOR — 18'in "kimin 18'i" olduğunu
 * yalnızca o belirler (E-01).
 */
const RITUAL_HOUR = 18

interface Template { title: string; body: string; data: Record<string, string> }

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const DAILY_HOOKS_EN: Template[] = [
  { title: 'What are you in the mood for? 🎬', body: 'Your morning film discovery awaits.', data: { screen: 'mood' } },
  { title: 'Morning coffee + cinema?', body: 'Discover a film that matches your mood today.', data: { screen: 'mood' } },
  { title: 'New day, new discoveries', body: 'What kind of story would lift you up today?', data: { screen: 'mood' } },
]

const DAILY_HOOKS_TR: Template[] = [
  { title: 'Bugün ne izlemek istersin? 🎬', body: 'Sabah film keşfin hazır.', data: { screen: 'mood' } },
  { title: 'Sabah kahvesi yanına bir film?', body: 'Bugünkü ruh haline uygun bir film keşfet.', data: { screen: 'mood' } },
  { title: 'Yeni gün, yeni keşifler', body: 'Bugün seni hangi hikaye heyecanlandırır?', data: { screen: 'mood' } },
]

const SUNDAY_EN: Template[] = [
  { title: 'Sunday cinema ritual 🎬', body: '5 moods, 5 films. Which one is yours?', data: { screen: 'mood' } },
  { title: 'The week ends, the evening is yours', body: 'Set your mood and find tonight\'s film.', data: { screen: 'mood' } },
]

const SUNDAY_TR: Template[] = [
  { title: 'Pazar sinema ritüeli 🎬', body: '5 mood, 5 film. Hangisi senin?', data: { screen: 'mood' } },
  { title: 'Hafta bitiyor, akşam senin', body: 'Ruh halini ayarla ve bu akşamın filmini bul.', data: { screen: 'mood' } },
]

const STREAK_WARNING_EN: Template[] = [
  { title: '{streak}-day streak at risk! 🔥', body: 'One mood search keeps your streak alive.', data: { screen: 'mood' } },
]

const STREAK_WARNING_TR: Template[] = [
  { title: '{streak} günlük streak tehlikede! 🔥', body: '1 mood aramasıyla streak\'ini koru.', data: { screen: 'mood' } },
]

const QUOTA_REFILL_EN: Template[] = [
  { title: 'Fresh searches ready! 🎬', body: 'New day, new discoveries. Your quota has been refilled.', data: { screen: 'mood' } },
]

const QUOTA_REFILL_TR: Template[] = [
  { title: 'Yeni aramalar hazır! 🎬', body: 'Yeni gün, yeni keşifler. Kotan yenilendi.', data: { screen: 'mood' } },
]

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
    return new Date().getUTCHours() // Fallback to UTC
  }
}

/**
 * Get current day of week (0=Sunday) in a user's timezone.
 */
function getDayOfWeekInTZ(tz: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    })
    const day = formatter.format(new Date())
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return dayMap[day] ?? new Date().getUTCDay()
  } catch {
    return new Date().getUTCDay()
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(supabaseUrl, serviceKey)

    // ── Fetch all users with push tokens enabled ──────────────────────
    const { data: users, error: usersError } = await db
      .from('users')
      .select(`
        id,
        push_token,
        push_enabled,
        timezone,
        archetype_id,
        subscription_tier,
        last_activity_at,
        winback_stage
      `)
      .not('push_token', 'is', null)
      .eq('push_enabled', true)

    if (usersError || !users) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch users', details: usersError?.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    let scheduled = 0
    const now = new Date()
    const todayUTC = now.toISOString().split('T')[0]

    for (const user of users) {
      const tz = user.timezone || 'UTC'
      const currentHour = getCurrentHourInTZ(tz)
      const dayOfWeek = getDayOfWeekInTZ(tz)

      // ── Check 24h frequency limit (max 1/day for active users) ──
      const { data: recentCount } = await db.rpc('user_notification_count_24h', {
        p_user_id: user.id,
      })

      if ((recentCount ?? 0) >= 2) continue // Max 2 notifications per 24h

      // Determine locale from timezone (simple heuristic)
      const locale = (tz.includes('Istanbul') || tz.includes('Turkey')) ? 'tr' : 'en'

      // ── 1. Daily Ritual Push (18:00 user-local, D-02) ────────────────
      if (currentHour === RITUAL_HOUR) {
        // Check if already scheduled today
        const { data: existing } = await db
          .from('notification_log')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'daily_hook')
          .gte('created_at', todayUTC)
          .limit(1)

        if (!existing || existing.length === 0) {
          const template = pickRandom(locale === 'tr' ? DAILY_HOOKS_TR : DAILY_HOOKS_EN)
          await db.from('notification_log').insert({
            user_id: user.id,
            type: 'daily_hook',
            title: template.title,
            body: template.body,
            data: template.data,
            status: 'queued',
            scheduled_for: now.toISOString(),
          })
          scheduled++
        }
      }

      // ── 2. Sunday Evening Ritual ────────────────────────────────────
      if (dayOfWeek === 0 && currentHour === 19) {
        const { data: existing } = await db
          .from('notification_log')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'sunday_ritual')
          .gte('created_at', todayUTC)
          .limit(1)

        if (!existing || existing.length === 0) {
          const template = pickRandom(locale === 'tr' ? SUNDAY_TR : SUNDAY_EN)
          await db.from('notification_log').insert({
            user_id: user.id,
            type: 'sunday_ritual',
            title: template.title,
            body: template.body,
            data: template.data,
            status: 'queued',
            scheduled_for: now.toISOString(),
          })
          scheduled++
        }
      }

      // ── 3. Streak Warning (22:00 if no activity today) ─────────────
      if (currentHour === 22) {
        // Check if user has a streak and no activity today
        const { data: streak } = await db
          .from('user_streaks')
          .select('current_streak, last_active_date')
          .eq('user_id', user.id)
          .single()

        if (streak && streak.current_streak > 0 && streak.last_active_date !== todayUTC) {
          const { data: existing } = await db
            .from('notification_log')
            .select('id')
            .eq('user_id', user.id)
            .eq('type', 'streak_warning')
            .gte('created_at', todayUTC)
            .limit(1)

          if (!existing || existing.length === 0) {
            const template = pickRandom(locale === 'tr' ? STREAK_WARNING_TR : STREAK_WARNING_EN)
            await db.from('notification_log').insert({
              user_id: user.id,
              type: 'streak_warning',
              title: template.title.replace('{streak}', String(streak.current_streak)),
              body: template.body.replace('{streak}', String(streak.current_streak)),
              data: template.data,
              status: 'queued',
              scheduled_for: now.toISOString(),
            })
            scheduled++
          }
        }
      }

      // ── 4. Quota Refill (00:05, only if quota exhausted yesterday) ──
      if (currentHour === 0) {
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        const { data: quotaRow } = await db
          .from('user_daily_quotas')
          .select('searches_used')
          .eq('user_id', user.id)
          .eq('date', yesterdayStr)
          .single()

        // Only notify if they actually used up their quota
        if (quotaRow && quotaRow.searches_used > 0) {
          const { data: limits } = await db
            .from('subscription_limits')
            .select('daily_search_limit')
            .eq('tier', user.subscription_tier || 'free')
            .single()

          const limit = limits?.daily_search_limit ?? 3
          if (quotaRow.searches_used >= limit) {
            const { data: existing } = await db
              .from('notification_log')
              .select('id')
              .eq('user_id', user.id)
              .eq('type', 'quota_refill')
              .gte('created_at', todayUTC)
              .limit(1)

            if (!existing || existing.length === 0) {
              const template = pickRandom(locale === 'tr' ? QUOTA_REFILL_TR : QUOTA_REFILL_EN)
              await db.from('notification_log').insert({
                user_id: user.id,
                type: 'quota_refill',
                title: template.title,
                body: template.body,
                data: template.data,
                status: 'queued',
                scheduled_for: now.toISOString(),
              })
              scheduled++
            }
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, users_processed: users.length, notifications_scheduled: scheduled }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
