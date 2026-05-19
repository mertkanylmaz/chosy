/**
 * Edge Function: winback-sequencer
 * Daily cron — detects churned users and queues win-back notifications.
 *
 * Churn definition: 14+ days without any activity (last_activity_at).
 *
 * Sequence:
 *   Day 14: "We miss you" + 1 bonus search grant
 *   Day 21: "New films match your last mood" (personalized)
 *   Day 30: "50% off special offer" (promotional)
 *   Day 60: "One tap to come back" + free first search
 *   Day 90+: Mark as 'inactive', stop notifications
 *
 * Deploy: supabase functions deploy winback-sequencer
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ─── Win-back templates ───────────────────────────────────────────────────────

interface WinbackTemplate {
  type: string
  title_en: string
  body_en: string
  title_tr: string
  body_tr: string
  data: Record<string, string>
}

const WINBACK_STAGES: Record<string, { minDays: number; maxDays: number; stage: string; template: WinbackTemplate }> = {
  day14: {
    minDays: 14,
    maxDays: 20,
    stage: 'day14',
    template: {
      type: 'winback_14',
      title_en: 'We miss you! 🎬',
      body_en: 'Here is 1 bonus search as a welcome-back gift.',
      title_tr: 'Seni özledik! 🎬',
      body_tr: 'Hoş geldin hediyesi: 1 bonus arama hakkı.',
      data: { screen: 'mood' },
    },
  },
  day21: {
    minDays: 21,
    maxDays: 29,
    stage: 'day21',
    template: {
      type: 'winback_21',
      title_en: 'New films matching your taste!',
      body_en: '3 new films match your last mood. Come see!',
      title_tr: 'Zevkine uygun yeni filmler!',
      body_tr: 'Son mood\'una uyan 3 yeni film eklendi. Gel gör!',
      data: { screen: 'mood' },
    },
  },
  day30: {
    minDays: 30,
    maxDays: 59,
    stage: 'day30',
    template: {
      type: 'winback_30',
      title_en: 'Special offer: 50% off! 🎉',
      body_en: 'Welcome back with a limited-time discount. 48 hours only.',
      title_tr: 'Özel teklif: %50 indirim! 🎉',
      body_tr: 'Sınırlı süreli indirimle geri dön. Sadece 48 saat.',
      data: { screen: 'paywall', action: 'winback_offer' },
    },
  },
  day60: {
    minDays: 60,
    maxDays: 89,
    stage: 'day60',
    template: {
      type: 'winback_60',
      title_en: 'One tap to come back',
      body_en: 'Your watchlist is waiting. First search is on us.',
      title_tr: 'Tek tıkla geri dön',
      body_tr: 'Watchlist\'in bekliyor. İlk arama bizden.',
      data: { screen: 'mood', action: 'free_search' },
    },
  },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const db = createClient(supabaseUrl, serviceKey)

    const now = new Date()
    let processed = 0
    let notified = 0
    let markedInactive = 0

    // ── Process each win-back stage ──────────────────────────────────
    for (const [key, config] of Object.entries(WINBACK_STAGES)) {
      const minDate = new Date(now)
      minDate.setDate(minDate.getDate() - config.maxDays)
      const maxDate = new Date(now)
      maxDate.setDate(maxDate.getDate() - config.minDays)

      // Find users in this churn window who haven't been notified for this stage
      const { data: churned, error } = await db
        .from('users')
        .select('id, timezone, push_token, push_enabled, winback_stage')
        .not('push_token', 'is', null)
        .eq('push_enabled', true)
        .lte('last_activity_at', maxDate.toISOString())
        .gte('last_activity_at', minDate.toISOString())
        .neq('winback_stage', 'inactive')

      if (error || !churned) continue

      for (const user of churned) {
        // Skip if already processed this stage
        if (user.winback_stage === config.stage) continue

        // Skip stages that should come later (don't send day30 before day21)
        const stageOrder = ['day14', 'day21', 'day30', 'day60']
        const currentStageIdx = stageOrder.indexOf(user.winback_stage ?? '')
        const targetStageIdx = stageOrder.indexOf(config.stage)
        if (currentStageIdx >= targetStageIdx) continue

        processed++

        // Determine locale
        const tz = user.timezone || 'UTC'
        const isTR = tz.includes('Istanbul') || tz.includes('Turkey')
        const t = config.template

        // Queue notification
        await db.from('notification_log').insert({
          user_id: user.id,
          type: t.type,
          title: isTR ? t.title_tr : t.title_en,
          body: isTR ? t.body_tr : t.body_en,
          data: t.data,
          status: 'queued',
          scheduled_for: now.toISOString(),
        })

        // Update winback stage
        await db
          .from('users')
          .update({ winback_stage: config.stage })
          .eq('id', user.id)

        // ── Stage-specific actions ────────────────────────────────
        if (key === 'day14') {
          // Grant 1 bonus search
          await db.rpc('grant_bonus_searches', {
            p_user_id: user.id,
            p_amount: 1,
            p_reason: 'winback_day14',
          }).catch(() => { /* Non-critical */ })
        }

        if (key === 'day60') {
          // Grant 1 free search for comeback
          await db.rpc('grant_bonus_searches', {
            p_user_id: user.id,
            p_amount: 1,
            p_reason: 'winback_day60',
          }).catch(() => { /* Non-critical */ })
        }

        notified++
      }
    }

    // ── Mark truly inactive users (90+ days) ─────────────────────────
    const inactiveThreshold = new Date(now)
    inactiveThreshold.setDate(inactiveThreshold.getDate() - 90)

    const { data: inactive } = await db
      .from('users')
      .select('id')
      .lte('last_activity_at', inactiveThreshold.toISOString())
      .neq('winback_stage', 'inactive')

    if (inactive && inactive.length > 0) {
      const inactiveIds = inactive.map(u => u.id)
      await db
        .from('users')
        .update({ winback_stage: 'inactive', push_enabled: false })
        .in('id', inactiveIds)
      markedInactive = inactiveIds.length
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed,
        notified,
        marked_inactive: markedInactive,
      }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Internal error', message: String(err) }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
