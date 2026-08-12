/**
 * Edge Function: revenuecat-webhook
 * Genel RevenueCat webhook handler — tum subscription event'lerini isler.
 *
 * POST /functions/v1/revenuecat-webhook
 * Auth: Bearer token (REVENUECAT_WEBHOOK_SECRET)
 *
 * Handled events:
 *   - INITIAL_PURCHASE / RENEWAL / PRODUCT_CHANGE → tier update
 *   - NON_RENEWING_PURCHASE → lifetime claim
 *   - CANCELLATION / EXPIRATION → will_renew flag + winback queue
 *   - BILLING_ISSUE → notification log
 *   - SUBSCRIBER_ALIAS → user merge (log only)
 *
 * Deploy: supabase functions deploy revenuecat-webhook
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { sentryCapture } from '../_shared/sentry.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Product ID → Tier Mapping ─────────────────────────────────────────────────

function mapProductToTier(productId: string): string {
  // Lifetime
  if (productId === 'com.chosy.lifetime') return 'lifetime'

  // Annual (yeni + eski)
  if (productId === 'com.chosy.annual') return 'annual'
  if (productId === 'chosyai_yearly') return 'annual'

  // Monthly (yeni + eski)
  if (productId === 'com.chosy.monthly') return 'monthly'
  if (productId === 'chosyai_monthly') return 'monthly'

  // Weekly (eski — sadece legacy)
  if (productId === 'chosyai_weekly') return 'weekly_legacy'

  return 'free'
}

// ─── Types ──────────────────────────────────────────────────────────────────────

interface RevenueCatEvent {
  type: string
  app_user_id: string
  product_id: string
  transaction_id?: string
  price_in_purchased_currency?: number
  currency?: string
  expiration_at_ms?: number
  [key: string]: unknown
}

interface RevenueCatWebhook {
  api_version: string
  event: RevenueCatEvent
}

// ─── Handler ────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Verify webhook secret ──────────────────────────────────────────────
    // FAIL-CLOSED: secret yoksa istek islenmez. Onceki `if (webhookSecret && ...)`
    // kalibi secret tanimsizken dogrulamayi tamamen atliyordu — 12 Agu 2026'da
    // secret'in `RC_WEBHOOK_SECRET` adiyla set edildigi, kodun ise
    // `REVENUECAT_WEBHOOK_SECRET` okudugu tespit edildi; yani bu webhook
    // aylarca kimlik dogrulamasiz calisti ve herkes entitlement yazabilirdi.
    const webhookSecret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')
    if (!webhookSecret) {
      console.error('[rc-webhook] REVENUECAT_WEBHOOK_SECRET tanimsiz — istek reddedildi')
      await sentryCapture({
        message: 'revenuecat-webhook: REVENUECAT_WEBHOOK_SECRET tanimsiz, webhook fail-closed reddetti',
        level: 'fatal',
        tags: { error_code: 'WEBHOOK_SECRET_MISSING', function: 'revenuecat-webhook' },
      })
      return new Response(
        JSON.stringify({ error: 'WEBHOOK_SECRET_MISSING' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const authHeader = req.headers.get('authorization') || ''

    if (authHeader !== `Bearer ${webhookSecret}`) {
      console.warn('[rc-webhook] Invalid auth header')
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED' }),
        { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 2. Parse payload ──────────────────────────────────────────────────────
    const payload: RevenueCatWebhook = await req.json()
    const event = payload.event

    console.log(`[rc-webhook] ${event.type} | product: ${event.product_id} | user: ${event.app_user_id}`)

    // ── 3. Supabase client ────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const tier = mapProductToTier(event.product_id)
    const userId = event.app_user_id

    // ── 4. Handle by event type ───────────────────────────────────────────────
    switch (event.type) {
      // ━━ Purchase / Renewal / Plan Change ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'PRODUCT_CHANGE':
      case 'UNCANCELLATION': {
        const expiresAt = event.expiration_at_ms
          ? new Date(event.expiration_at_ms).toISOString()
          : null // null = lifetime

        // Update users table
        await supabase
          .from('users')
          .update({
            subscription_tier: tier,
            subscription_active_until: expiresAt,
            subscription_will_renew: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        // Update subscriptions table
        await supabase
          .from('subscriptions')
          .update({
            plan: tier === 'weekly_legacy' ? 'weekly' : (tier === 'annual' ? 'annual' : tier),
            status: 'active',
            expires_at: expiresAt,
          })
          .eq('user_id', userId)
          .in('status', ['active', 'trial', 'expired', 'cancelled'])

        console.log(`[rc-webhook] Tier updated: ${tier} for ${userId}`)
        break
      }

      // ━━ Non-Renewing Purchase (Lifetime) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'NON_RENEWING_PURCHASE': {
        if (tier === 'lifetime') {
          // Claim lifetime spot via atomic RPC
          const { data, error } = await supabase.rpc('claim_lifetime_spot', {
            p_user_id: userId,
            p_price: event.price_in_purchased_currency || 89.99,
            p_rc_transaction_id: event.transaction_id || null,
          })

          if (error) {
            console.error('[rc-webhook] Lifetime claim RPC error:', error)
          } else {
            console.log('[rc-webhook] Lifetime claim result:', JSON.stringify(data))
          }

          // Also update users table expiry
          await supabase
            .from('users')
            .update({
              subscription_active_until: null, // lifetime = never expires
              subscription_will_renew: true,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId)
        }
        break
      }

      // ━━ Cancellation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'CANCELLATION': {
        // Erişim expire date'e kadar devam — sadece flag güncelle
        await supabase
          .from('users')
          .update({
            subscription_will_renew: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        console.log(`[rc-webhook] Cancellation flagged for ${userId}`)
        break
      }

      // ━━ Expiration ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'EXPIRATION': {
        // Artık free tier'a düş
        await supabase
          .from('users')
          .update({
            subscription_tier: 'free',
            subscription_will_renew: false,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)

        // Subscriptions tablosunu da güncelle
        await supabase
          .from('subscriptions')
          .update({ status: 'expired' })
          .eq('user_id', userId)
          .eq('status', 'active')

        // Win-back queue'ya ekle
        await supabase.from('winback_queue').insert({
          user_id: userId,
          churned_at: new Date().toISOString(),
        })

        console.log(`[rc-webhook] Expired + winback queued for ${userId}`)
        break
      }

      // ━━ Billing Issue ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'BILLING_ISSUE': {
        await supabase.from('notification_log').insert({
          user_id: userId,
          type: 'billing_issue',
          title: 'Payment issue',
          body: 'Your subscription renewal failed. Please update your payment method in Apple ID settings.',
          data: { screen: 'profile' },
          status: 'queued',
        })

        console.log(`[rc-webhook] Billing issue notification queued for ${userId}`)
        break
      }

      // ━━ Transfer / Alias ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      case 'TRANSFER':
      case 'SUBSCRIBER_ALIAS': {
        console.log(`[rc-webhook] ${event.type} for ${userId} — logged, no action`)
        break
      }

      default: {
        console.log(`[rc-webhook] Unhandled event type: ${event.type}`)
      }
    }

    return new Response(
      JSON.stringify({ status: 'OK', event_type: event.type, tier }),
      { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[rc-webhook] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
