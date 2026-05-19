/**
 * Edge Function: check-quota
 * Tek endpoint ile tum quota tiplerini kontrol eder ve tuketir.
 *
 * POST /functions/v1/check-quota
 * Body: { quota_type: 'search' | 'refine' | 'slot' | 'game', game_id?: string }
 * Auth: Supabase JWT (user_id token'dan cikarilir, body'den ALINMAZ)
 *
 * Deploy: supabase functions deploy check-quota
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Types ────────────────────────────────────────────────────────────────────

type QuotaType = 'search' | 'refine' | 'slot' | 'game'

interface CheckQuotaRequest {
  quota_type: QuotaType
  game_id?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * JWT'den user_id (users tablosundaki UUID) cikarir.
 * Authorization header'dan Supabase auth.uid() alip users tablosunda esler.
 */
async function getUserIdFromJWT(
  req: Request,
): Promise<{ userId: string; error?: string }> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return { userId: '', error: 'MISSING_AUTH' }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // User context ile client olustur (JWT verify icin)
  const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await supabaseUser.auth.getUser()
  if (error || !user) {
    return { userId: '', error: 'INVALID_TOKEN' }
  }

  // auth.uid() -> users.id eslestirmesi
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)
  const { data, error: lookupError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .single()

  if (lookupError || !data) {
    return { userId: '', error: 'USER_NOT_FOUND' }
  }

  return { userId: data.id }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Auth: user_id JWT'den cikar — ASLA body'den alma
  const { userId, error: authError } = await getUserIdFromJWT(req)
  if (authError || !userId) {
    return new Response(
      JSON.stringify({ error: 'Authentication required', code: authError ?? 'AUTH_FAILED' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Parse body
  let body: CheckQuotaRequest
  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body', code: 'INVALID_JSON' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const { quota_type, game_id } = body

  if (!['search', 'refine', 'slot', 'game'].includes(quota_type)) {
    return new Response(
      JSON.stringify({ error: 'Invalid quota_type', code: 'INVALID_QUOTA_TYPE' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // Game type icin game_id zorunlu
  if (quota_type === 'game' && !game_id) {
    return new Response(
      JSON.stringify({ error: 'game_id required for game quota', code: 'MISSING_GAME_ID' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    let result: Record<string, unknown>

    if (quota_type === 'game') {
      // Game-specific RPC
      const { data, error } = await supabaseAdmin.rpc('check_and_consume_game_quota', {
        p_user_id: userId,
        p_game_id: game_id,
      })

      if (error) throw error
      result = data as Record<string, unknown>
    } else {
      // Standard quota RPC
      const { data, error } = await supabaseAdmin.rpc('check_and_consume_quota', {
        p_user_id: userId,
        p_quota_type: quota_type,
      })

      if (error) throw error
      result = data as Record<string, unknown>
    }

    // Upgrade URL ekle (quota exceeded ise)
    if (!result.allowed) {
      (result as Record<string, unknown>).upgrade_url = 'chosy://paywall'
    }

    const statusCode = result.allowed ? 200 : 429

    return new Response(
      JSON.stringify(result),
      { status: statusCode, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[check-quota] Error:', msg)

    return new Response(
      JSON.stringify({ error: 'Quota check failed', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
