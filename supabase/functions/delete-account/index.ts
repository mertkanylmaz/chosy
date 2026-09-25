/**
 * Edge Function: delete-account
 *
 * Kullanıcının tüm verilerini ve auth kaydını kalıcı olarak siler.
 * App Store gerekliliği: hesap silme özelliği zorunlu (GDPR + App Store Review).
 *
 * Silme sırası:
 *   1. subscriptions   — bugün CASCADE'li (014 sonrası), manuel silme kalıntı
 *   2. mood_searches   — bugün CASCADE'li, manuel silme kalıntı
 *   3. users           — CASCADE: public.users'a bağlı 26 FK'nin biri hariç
 *                        hepsi ON DELETE CASCADE (referred_by = SET NULL)
 *   4. auth.users      — Supabase Admin API (service_role key gerekli).
 *                        auth tarafındaki FK'ler (user_collection_progress,
 *                        winback_queue) da CASCADE — bu adım FK ile bloke olmaz
 *   5. PostHog kişisi  — GDPR erasure, event geçmişi dahil (ikincil)
 *
 * Sıra kritik: önce public (cascade), sonra auth. Tersi "ters orphan" üretir.
 *
 * Deploy:
 *   supabase functions deploy delete-account
 *
 * ENV gereksinimler (otomatik Supabase tarafından sağlanır):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SUPABASE_ANON_KEY
 *
 * ENV gereksinimler (supabase secrets ile elle kurulur):
 *   SENTRY_DSN                 — hata raporlama (yoksa sentryCapture sessiz atlar)
 *   POSTHOG_PERSONAL_API_KEY   — PostHog kişi silme (personal API key, phc_ DEĞİL)
 *   POSTHOG_PROJECT_ID         — PostHog proje numarası
 *   POSTHOG_API_HOST           — opsiyonel, varsayılan https://us.posthog.com
 *                                (ingestion host'u us.i.posthog.com DEĞİL)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { sentryCapture } from '../_shared/sentry.ts'

// ─── CORS ─────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── PostHog kişi silme ───────────────────────────────────────────────────────

/**
 * PostHog'daki kişiyi ve tüm event geçmişini siler (GDPR "right to erasure").
 *
 * distinct_id = `auth.users.id` — client `posthogAnalytics.identify(user.id)`
 * çağrısını Supabase auth uid'i ile yapıyor (app/auth.tsx:101).
 *
 * İki adım: distinct_id → person id çözümlemesi, sonra DELETE.
 * PostHog kişi silme endpoint'i distinct_id kabul etmez, iç person id ister.
 *
 * Hata yutulmaz ama akışı da durdurmaz: asıl veri (Postgres + auth) zaten
 * silinmiştir, bu ikincil bir temizliktir. Başarısızlık Sentry'ye fatal
 * seviyesinde yazılır — sessiz fallback değil, ölçülebilir başarısızlık.
 *
 * @returns Silme başarılıysa true
 */
async function deletePostHogPerson(authUid: string): Promise<boolean> {
  const apiKey = Deno.env.get('POSTHOG_PERSONAL_API_KEY')
  const projectId = Deno.env.get('POSTHOG_PROJECT_ID')
  const apiHost = Deno.env.get('POSTHOG_API_HOST') ?? 'https://us.posthog.com'

  if (!apiKey || !projectId) {
    await sentryCapture({
      message: 'delete-account: PostHog silme atlandı — secret eksik',
      level: 'fatal',
      tags: { fn: 'delete-account', step: 'posthog_config' },
      extra: {
        has_api_key: Boolean(apiKey),
        has_project_id: Boolean(projectId),
        auth_uid: authUid,
      },
    })
    return false
  }

  const authHeaders = { Authorization: `Bearer ${apiKey}` }

  try {
    // ── 1. distinct_id → person id ────────────────────────────────────────
    const lookupUrl =
      `${apiHost}/api/projects/${projectId}/persons/` +
      `?distinct_id=${encodeURIComponent(authUid)}`

    const lookupRes = await fetch(lookupUrl, { headers: authHeaders })

    if (!lookupRes.ok) {
      await sentryCapture({
        message: `delete-account: PostHog kişi araması başarısız (HTTP ${lookupRes.status})`,
        level: 'fatal',
        tags: { fn: 'delete-account', step: 'posthog_lookup' },
        extra: { auth_uid: authUid, status: lookupRes.status },
      })
      return false
    }

    const lookupBody = await lookupRes.json() as { results?: Array<{ id: number | string }> }
    const personId = lookupBody.results?.[0]?.id

    if (personId === undefined) {
      // Kişi hiç oluşmamış olabilir (analytics kapalı, event göndermemiş kullanıcı).
      // Silinecek bir şey yok — bu bir hata değil, ama izi kalsın.
      await sentryCapture({
        message: 'delete-account: PostHog kişisi bulunamadı, silme gereksiz',
        level: 'info',
        tags: { fn: 'delete-account', step: 'posthog_lookup' },
        extra: { auth_uid: authUid },
      })
      return true
    }

    // ── 2. Kişiyi + event'lerini sil ──────────────────────────────────────
    const deleteUrl =
      `${apiHost}/api/projects/${projectId}/persons/${personId}/?delete_events=true`

    const deleteRes = await fetch(deleteUrl, { method: 'DELETE', headers: authHeaders })

    if (!deleteRes.ok) {
      await sentryCapture({
        message: `delete-account: PostHog kişi silme başarısız (HTTP ${deleteRes.status})`,
        level: 'fatal',
        tags: { fn: 'delete-account', step: 'posthog_delete' },
        extra: { auth_uid: authUid, person_id: String(personId), status: deleteRes.status },
      })
      return false
    }

    return true
  } catch (err) {
    await sentryCapture({
      message: 'delete-account: PostHog silme sırasında beklenmedik hata',
      level: 'fatal',
      tags: { fn: 'delete-account', step: 'posthog_exception' },
      extra: { auth_uid: authUid, error: err instanceof Error ? err.message : String(err) },
    })
    return false
  }
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

    // ── 1a. Arama hatası ile "satır yok" AYRI durumlardır ───────────────────
    // Eski kod ikisini tek dala atıyordu: geçici bir hata (RLS, timeout,
    // PostgREST 5xx) da "kullanıcı yok" sayılıp auth kaydı siliniyordu, yani
    // public tarafı duran kullanıcının auth'u kazara yok ediliyordu.
    // PGRST116 = .single() sıfır satır buldu. Gerçek "yok" yalnızca budur.
    if (userRowError && userRowError.code !== 'PGRST116') {
      await sentryCapture({
        message: 'delete-account: users araması başarısız, hiçbir şey silinmedi',
        level: 'fatal',
        tags: { fn: 'delete-account', step: 'user_lookup' },
        extra: { auth_uid: authUid, code: userRowError.code, error: userRowError.message },
      })
      return new Response(
        JSON.stringify({ error: 'profile_lookup_failed', details: userRowError.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 1b. Gerçekten public profili olmayan kullanıcı ──────────────────────
    // Bu bir anomalidir (11 Eyl 2026 ölçümü: auth 281 / public 266), ama bu
    // kullanıcılar için auth kaydını silmek TAM silmedir — public tarafta
    // silinecek veri yok. Kullanıcıya başarı döner, anomali Sentry'ye fatal
    // olarak yazılır ki sessiz kalmasın.
    if (!userRow) {
      await sentryCapture({
        message: 'delete-account: public.users satırı yok, auth-only silme yapıldı',
        level: 'fatal',
        tags: { fn: 'delete-account', step: 'auth_only' },
        extra: { auth_uid: authUid },
      })

      const { error: authOnlyError } = await adminClient.auth.admin.deleteUser(authUid)

      if (authOnlyError) {
        await sentryCapture({
          message: 'delete-account: auth-only dalında auth silme başarısız',
          level: 'fatal',
          tags: { fn: 'delete-account', step: 'auth_only_delete' },
          extra: { auth_uid: authUid, error: authOnlyError.message },
        })
        return new Response(
          JSON.stringify({ error: 'auth_delete_failed', details: authOnlyError.message }),
          { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
        )
      }

      const phDeleted = await deletePostHogPerson(authUid)

      return new Response(
        JSON.stringify({ success: true, note: 'auth_only', posthog_deleted: phDeleted }),
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
      await sentryCapture({
        message: 'delete-account: subscriptions silinemedi',
        level: 'error',
        tags: { fn: 'delete-account', step: 'subscriptions' },
        extra: { user_id: userId, error: subsError.message },
      })
    }

    // mood_searches (ON DELETE CASCADE yok)
    const { error: searchError } = await adminClient
      .from('mood_searches')
      .delete()
      .eq('user_id', userId)

    if (searchError) {
      await sentryCapture({
        message: 'delete-account: mood_searches silinemedi',
        level: 'error',
        tags: { fn: 'delete-account', step: 'mood_searches' },
        extra: { user_id: userId, error: searchError.message },
      })
    }

    // ── 3. users satırını sil — CASCADE tetiklenir ──────────────────────────
    // Cascade: sessions → swipes, watchlist, user_streaks, user_milestones
    const { error: deleteUserError } = await adminClient
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteUserError) {
      await sentryCapture({
        message: 'delete-account: public.users silinemedi',
        level: 'fatal',
        tags: { fn: 'delete-account', step: 'users_delete' },
        extra: { user_id: userId, auth_uid: authUid, error: deleteUserError.message },
      })
      return new Response(
        JSON.stringify({ error: 'Failed to delete user data', details: deleteUserError.message }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 4. Supabase Auth kullanıcısını sil ─────────────────────────────────
    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(authUid)

    if (authDeleteError) {
      await sentryCapture({
        message: 'delete-account: auth user silinemedi (kısmi başarı, HTTP 207)',
        level: 'fatal',
        tags: { fn: 'delete-account', step: 'auth_delete' },
        extra: { auth_uid: authUid, error: authDeleteError.message },
      })
      // Veri zaten silindi — kısmi başarı olarak işaretle.
      // Client bunu HATA sayar (authService.ts:668-676) ve oturumu kapatmaz.
      return new Response(
        JSON.stringify({ success: true, warning: 'auth_user_delete_failed' }),
        { status: 207, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      )
    }

    // ── 5. PostHog kişisini + event geçmişini sil ──────────────────────────
    // İkincil temizlik: başarısızlığı Sentry'ye fatal yazılır ama hesap silme
    // yine de başarılı sayılır — asıl veri (Postgres + auth) çoktan gitti.
    const posthogDeleted = await deletePostHogPerson(authUid)

    console.log('[delete-account] Hesap tamamen silindi:', authUid)

    return new Response(
      JSON.stringify({ success: true, posthog_deleted: posthogDeleted }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    await sentryCapture({
      message: 'delete-account: beklenmedik hata',
      level: 'fatal',
      tags: { fn: 'delete-account', step: 'unhandled' },
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
})
