/**
 * Edge Function: process-lifetime-purchase
 * RevenueCat webhook handler for lifetime purchases.
 *
 * POST /functions/v1/process-lifetime-purchase
 * Body: RevenueCat webhook payload
 * Auth: Webhook secret (REVENUECAT_WEBHOOK_SECRET env var)
 *
 * Flow:
 *   1. Validate webhook auth
 *   2. Extract user ID + transaction info
 *   3. Call claim_lifetime_spot RPC
 *   4. Optional: notify via Slack/Discord webhook
 *
 * Deploy: supabase functions deploy process-lifetime-purchase
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// RevenueCat event types we care about
const LIFETIME_PRODUCT_IDS = ['com.chosy.lifetime']

interface RevenueCatEvent {
  type: string
  app_user_id: string
  product_id: string
  transaction_id?: string
  price?: number
  currency?: string
  [key: string]: unknown
}

interface RevenueCatWebhook {
  api_version: string
  event: RevenueCatEvent
}

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Validate webhook secret ──────────────────────────────────────────
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
    const authHeader = req.headers.get('authorization') || ''

    if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
      console.warn('[process-lifetime] Invalid webhook auth')
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Parse payload ────────────────────────────────────────────────────
    const payload: RevenueCatWebhook = await req.json()
    const event = payload.event

    console.log(`[process-lifetime] Event: ${event.type}, product: ${event.product_id}, user: ${event.app_user_id}`)

    // Only process relevant events
    if (!['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE'].includes(event.type)) {
      return new Response(
        JSON.stringify({ status: 'IGNORED', reason: `Event type ${event.type} not relevant` }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Only process lifetime product
    if (!LIFETIME_PRODUCT_IDS.includes(event.product_id)) {
      return new Response(
        JSON.stringify({ status: 'IGNORED', reason: `Product ${event.product_id} not lifetime` }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 3. Claim lifetime spot ──────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase.rpc('claim_lifetime_spot', {
      p_user_id: event.app_user_id,
      p_price: event.price || 89.99,
      p_rc_transaction_id: event.transaction_id || null,
    })

    if (error) {
      console.error('[process-lifetime] RPC error:', error)
      return new Response(
        JSON.stringify({ error: 'CLAIM_FAILED', details: error.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const result = data as Record<string, unknown>
    console.log('[process-lifetime] Claim result:', JSON.stringify(result))

    // ── 4. Notify (optional — Slack/Discord webhook) ────────────────────────
    const notifyUrl = Deno.env.get('FOUNDING_MEMBER_NOTIFY_URL')
    if (notifyUrl && result.success) {
      try {
        await fetch(notifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `New Founding Member #${result.sale_number}! Total: ${result.total_sold}/1000`,
          }),
        })
      } catch (notifyErr) {
        // Non-critical — log and continue
        console.warn('[process-lifetime] Notify failed:', notifyErr)
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[process-lifetime] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
