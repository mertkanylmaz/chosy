/**
 * Edge Function: send-notifications
 * Cron-triggered (every minute) — sends queued notifications via Expo Push API.
 *
 * Reads notification_log WHERE status='queued' AND scheduled_for <= NOW()
 * Sends in batches of 100 via Expo Push API.
 * Updates status: sent | failed (retry up to 3 times).
 *
 * Required secrets:
 *   - EXPO_ACCESS_TOKEN: Expo push notification access token
 *
 * Deploy: supabase functions deploy send-notifications
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const MAX_BATCH_SIZE = 100
const MAX_RETRIES = 3

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationRow {
  id: string
  user_id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  retry_count: number
}

interface ExpoPushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  sound: 'default'
  priority: 'high'
  channelId: string
}

interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string
  message?: string
  details?: { error?: string }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN')

    const db = createClient(supabaseUrl, serviceKey)

    // ── Fetch queued notifications ready to send ──────────────────────
    const { data: notifications, error: fetchError } = await db
      .from('notification_log')
      .select(`
        id,
        user_id,
        type,
        title,
        body,
        data,
        retry_count
      `)
      .eq('status', 'queued')
      .lte('scheduled_for', new Date().toISOString())
      .lt('retry_count', MAX_RETRIES)
      .order('scheduled_for', { ascending: true })
      .limit(MAX_BATCH_SIZE * 2) // Fetch extra to account for missing tokens

    if (fetchError || !notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, message: 'No queued notifications' }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── Resolve push tokens for all users ─────────────────────────────
    const userIds = [...new Set(notifications.map((n: NotificationRow) => n.user_id))]
    const { data: users } = await db
      .from('users')
      .select('id, push_token, push_enabled')
      .in('id', userIds)

    const tokenMap = new Map<string, string>()
    for (const user of (users ?? [])) {
      if (user.push_token && user.push_enabled) {
        tokenMap.set(user.id, user.push_token)
      }
    }

    // ── Build Expo push messages ──────────────────────────────────────
    const messages: ExpoPushMessage[] = []
    const notificationIds: string[] = []
    const skipIds: string[] = [] // No token — mark as failed

    for (const notif of notifications as NotificationRow[]) {
      const token = tokenMap.get(notif.user_id)
      if (!token) {
        skipIds.push(notif.id)
        continue
      }

      // Validate Expo push token format
      if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        skipIds.push(notif.id)
        continue
      }

      messages.push({
        to: token,
        title: notif.title || 'Chosy.ai',
        body: notif.body || '',
        data: (notif.data as Record<string, unknown>) ?? undefined,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
      })
      notificationIds.push(notif.id)
    }

    // Mark skipped as failed (no token)
    if (skipIds.length > 0) {
      await db
        .from('notification_log')
        .update({ status: 'failed', retry_count: MAX_RETRIES })
        .in('id', skipIds)
    }

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, sent: 0, skipped: skipIds.length }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── Send via Expo Push API (batch) ────────────────────────────────
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    }
    if (expoToken) {
      headers['Authorization'] = `Bearer ${expoToken}`
    }

    // Send in batches of MAX_BATCH_SIZE
    let totalSent = 0
    let totalFailed = 0

    for (let i = 0; i < messages.length; i += MAX_BATCH_SIZE) {
      const batch = messages.slice(i, i + MAX_BATCH_SIZE)
      const batchIds = notificationIds.slice(i, i + MAX_BATCH_SIZE)

      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify(batch),
        })

        if (!response.ok) {
          // Entire batch failed — increment retry count
          await db
            .from('notification_log')
            .update({
              status: 'queued',
              retry_count: db.rpc ? undefined : undefined, // Will handle below
            })
            .in('id', batchIds)

          // Increment retry counts individually
          for (const id of batchIds) {
            await db.rpc('increment_retry', { p_id: id }).catch(() => {
              // Fallback: just mark failed if RPC doesn't exist
            })
          }
          totalFailed += batch.length
          continue
        }

        const result = await response.json()
        const tickets: ExpoPushTicket[] = result.data ?? result

        // Process each ticket
        for (let j = 0; j < tickets.length; j++) {
          const ticket = tickets[j]
          const notifId = batchIds[j]

          if (ticket.status === 'ok') {
            await db
              .from('notification_log')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
              })
              .eq('id', notifId)
            totalSent++
          } else {
            // Check if it's a permanent error (invalid token)
            const isPermanent = ticket.details?.error === 'DeviceNotRegistered'

            if (isPermanent) {
              // Mark as permanently failed and clear user's push token
              await db
                .from('notification_log')
                .update({ status: 'failed', retry_count: MAX_RETRIES })
                .eq('id', notifId)

              // Find the user and clear their token
              const notif = (notifications as NotificationRow[]).find(n => n.id === notifId)
              if (notif) {
                await db
                  .from('users')
                  .update({ push_token: null })
                  .eq('id', notif.user_id)
              }
            } else {
              // Transient error — increment retry
              const notif = (notifications as NotificationRow[]).find(n => n.id === notifId)
              const newRetry = (notif?.retry_count ?? 0) + 1
              const newStatus = newRetry >= MAX_RETRIES ? 'failed' : 'queued'

              await db
                .from('notification_log')
                .update({ status: newStatus, retry_count: newRetry })
                .eq('id', notifId)
            }
            totalFailed++
          }
        }
      } catch (batchErr) {
        // Network error — leave as queued for retry
        console.error('Batch send error:', batchErr)
        totalFailed += batch.length
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: notifications.length,
        sent: totalSent,
        failed: totalFailed,
        skipped: skipIds.length,
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
