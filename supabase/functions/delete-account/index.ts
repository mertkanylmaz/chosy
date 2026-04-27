/**
 * Edge Function: delete-account
 *
 * Kullanıcının tüm verilerini ve auth kaydını kalıcı olarak siler.
 * App Store gerekliliği: hesap silme özelliği zorunlu (GDPR + App Store Review).
 *
 * Silme sırası:
 *   1. subscriptions   — ON DELETE CASCADE yok, manuel sil
 *   2. mood_searches   — ON DELETE CASCADE yok, manuel sil
 *   3. users           — CASCADE: sessions→swipes, watchlist, user_streaks, user_milestones
 *   4. auth.users      — Supabase Admin API (service_role key gerekli)
 *
 * Deploy:
 *   supabase functions deploy delete-account
 *
 * ENV gereksinimler (otomatik Supabase tarafından sağlanır):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  // ── JWT'den kullanıcıyı doğrula ────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing authorization header' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
  const token = authHeader.replace('Bearer ', '')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

  // User client — token ile kullanıcıyı doğrula
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired token' }),
      { status: 401, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const authUid = user.id

  // Admin client — service role ile tam yetki
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  try {
    // ── 1. users tablosundan iç UUID'yi al ──────────────────────────────────
    const { data: userRow, error: userRowError } = await adminClient
      .from('users')
      .select('id')
      .eq('auth_id', authUid)
      .single()

    if (userRowError || !userRow) {
      // Kullanıcı satırı bulunamazsa sadece auth user'ı sil
      console.warn('[delete-account] users satırı bulunamadı, sadece auth siliniyor:', authUid)
      await adminClient.auth.admin.deleteUser(authUid)
      return new Response(
        JSON.stringify({ success: true, note: 'auth_only' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    const userId: string = userRow.id

    // ── 2. CASCADE olmayan tabloları önce temizle ───────────────────────────

    // subscriptions (ON DELETE CASCADE yok)
    const { error: subsError } = await adminClient
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)

    if (subsError) {
      console.warn('[delete-account] subscriptions silinemedi:', subsError.message)
    }

    // mood_searches (ON DELETE CASCADE yok)
    const { error: searchError } = await adminClient
      .from('mood_searches')
      .delete()
      .eq('user_id', userId)

    if (searchError) {
      console.warn('[delete-account] mood_searches silinemedi:', searchError.message)
    }

    // ── 3. users satırını sil — CASCADE tetiklenir ──────────────────────────
    // Cascade: sessions → swipes, watchlist, user_streaks, user_milestones
    const { error: deleteUserError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteUserError) {
      console.error('[delete-account] users silinemedi:', deleteUserError.message)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user data', details: deleteUserError.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 4. Supabase Auth kullanıcısını sil ─────────────────────────────────
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(authUid)

    if (authDeleteError) {
      console.error('[delete-account] auth user silinemedi:', authDeleteError.message)
      // Veri zaten silindi — kısmi başarı olarak işaretle
      return new Response(
        JSON.stringify({ success: true, warning: 'auth_user_delete_failed' }),
        { status: 207, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    console.log('[delete-account] Hesap tamamen silindi:', authUid)

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('[delete-account] Beklenmedik hata:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
