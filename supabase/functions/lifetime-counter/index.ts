/**
 * Edge Function: lifetime-counter
 * Public endpoint — auth gerekmez.
 * Founding Member scarcity counter'i doner.
 *
 * GET /functions/v1/lifetime-counter
 * Response: { sold, remaining, total, percent, sold_out }
 *
 * Cache: 60s — yuksek traffic'te DB'yi korur.
 * Deploy: supabase functions deploy lifetime-counter
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

// ─── In-memory cache (60s TTL) ───────────────────────────────────────────────
let cachedResult: Record<string, unknown> | null = null
let cacheTime = 0
const CACHE_TTL_MS = 60_000

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // Check cache
    const now = Date.now()
    if (cachedResult && (now - cacheTime) < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cachedResult), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      })
    }

    // Create Supabase client (service role for RPC access)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call RPC
    const { data, error } = await supabase.rpc('get_lifetime_counter')

    if (error) {
      console.error('[lifetime-counter] RPC error:', error)
      return new Response(
        JSON.stringify({ error: 'COUNTER_ERROR' }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // Update cache
    cachedResult = data as Record<string, unknown>
    cacheTime = now

    return new Response(JSON.stringify(data), {
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (err) {
    console.error('[lifetime-counter] Unexpected error:', err)
    return new Response(
      JSON.stringify({ error: 'INTERNAL_ERROR' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
