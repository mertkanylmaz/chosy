/**
 * Edge Function: process-referral
 * Referral lifecycle management.
 *
 * POST /functions/v1/process-referral
 * Body: { action: 'apply' | 'check_activations', invite_code?: string }
 * Auth: Supabase JWT
 *
 * Actions:
 *   - apply: Signup with invite code (referee calls)
 *   - check_activations: Cron job to activate 7-day-old pending referrals
 *
 * Deploy: supabase functions deploy process-referral
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ProcessReferralRequest {
  action: 'apply' | 'check_activations'
  invite_code?: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const body: ProcessReferralRequest = await req.json()

    // ── Apply invite code ─────────────────────────────────────────────────
    if (body.action === 'apply') {
      // Extract user from JWT
      const authHeader = req.headers.get('authorization') || ''
      const token = authHeader.replace('Bearer ', '')

      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'UNAUTHORIZED' }),
          { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      if (!body.invite_code) {
        return new Response(
          JSON.stringify({ error: 'MISSING_INVITE_CODE' }),
          { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      const { data, error } = await supabase.rpc('apply_invite_code', {
        p_referee_id: user.id,
        p_invite_code: body.invite_code.toUpperCase(),
      })

      if (error) {
        console.error('[process-referral] apply_invite_code error:', error)
        return new Response(
          JSON.stringify({ error: 'APPLY_FAILED', details: error.message }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      return new Response(JSON.stringify(data), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // ── Check activations (cron) ──────────────────────────────────────────
    if (body.action === 'check_activations') {
      // Find pending referrals older than 7 days where referee has been active
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: pendingReferrals, error: fetchError } = await supabase
        .from('referrals')
        .select('id, referee_id, referrer_id')
        .eq('status', 'pending')
        .lt('referee_signed_up_at', sevenDaysAgo)

      if (fetchError) {
        console.error('[process-referral] Fetch pending error:', fetchError)
        return new Response(
          JSON.stringify({ error: 'FETCH_FAILED' }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      if (!pendingReferrals || pendingReferrals.length === 0) {
        return new Response(
          JSON.stringify({ status: 'NO_PENDING', activated: 0 }),
          { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      let activatedCount = 0
      const errors: string[] = []

      for (const referral of pendingReferrals) {
        // Check if referee has been active (at least 3 mood searches in 7 days)
        const { count, error: countError } = await supabase
          .from('mood_searches')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', referral.referee_id)
          .gte('created_at', sevenDaysAgo)

        if (countError) {
          errors.push(`Count error for ${referral.referee_id}: ${countError.message}`)
          continue
        }

        // Minimum 3 searches = active user
        if ((count ?? 0) >= 3) {
          const { data: activateResult, error: activateError } = await supabase
            .rpc('activate_referral', { p_referee_id: referral.referee_id })

          if (activateError) {
            errors.push(`Activate error for ${referral.referee_id}: ${activateError.message}`)
          } else {
            activatedCount++
            console.log(`[process-referral] Activated referral for ${referral.referee_id}:`, activateResult)
          }
        }
      }

      // Expire referrals older than 30 days that are still pending
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      await supabase
        .from('referrals')
        .update({ status: 'expired' })
        .eq('status', 'pending')
        .lt('referee_signed_up_at', thirtyDaysAgo)

      return new Response(
        JSON.stringify({
          status: 'DONE',
          checked: pendingReferrals.length,
          activated: activatedCount,
          errors: errors.length > 0 ? errors : undefined,
        }),
        { headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    return new Response(
      JSON.stringify({ error: 'INVALID_ACTION' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[process-referral] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
