/**
 * Edge Function: merge-anonymous-user (Sprint 1 / 1b)
 *
 * Anonim kullanıcı Apple ile kaydolurken Apple kimliği başka bir hesaba
 * aitse (`identity_already_exists`) istemci o hesaba girer ve anonim
 * ilerlemeyi bu fonksiyonla taşır.
 *
 * İki JWT, iki kimlik — tek JWT ile ASLA taşıma yapılmaz:
 *   · Authorization: Bearer <JWT-B>  — hedef (mevcut, kalıcı hesap)
 *   · gövde: { anonymous_access_token: <JWT-A> } — kaynak (anonim hesap)
 * İkisi de `auth.getUser` ile sunucuda İMZA DOĞRULANARAK okunur
 * (_shared/auth.ts ilkesi: JWT'nin içine bakılmaz). `is_anonymous` JWT
 * claim'inden DEĞİL, `auth.admin.getUserById` ile `auth.users` satırından
 * okunur: A anonim olmalı, B olmamalı.
 *
 * Akış:
 *   1. B doğrula (requireUser) → rate limit (anahtar: B'nin auth id'si, 5/dk)
 *   2. A doğrula (service.auth.getUser(jwtA)); A ≠ B
 *   3. is_anonymous iki kullanıcı için auth.users'tan
 *   4. A → public.users.id; satır yoksa önceki çağrı taşımayı bitirmiştir
 *   5. RPC merge_anonymous_user(from, to) — tek transaction (migration 122)
 *   6. admin.deleteUser(A) — yalnız 5 başarılıysa
 *
 * Yanıt sözleşmesi (DUR1 onayı, 2 Eki 2026) — yalnız İKİ başarı biçimi:
 *   200 { merged: true,  status, moved_gauntlet_id, ... }
 *   200 { merged: false, reason: 'anon_missing' }  — A artık yok (önceki çağrı sildi)
 * Diğer HER yanıt hatadır (400/401/429/500). İstemci yalnız `anon_missing`'i
 * "zaten birleşti" sayar; süresi dolmuş JWT-A 401'dir, anon_missing DEĞİL.
 *
 * Her hata dalı Sentry'ye yazılır.
 */

import {
  corsHeaders,
  errorResponse,
  getServiceClient,
  handleCors,
  jsonResponse,
} from '../_shared/gameUtils.ts'
import { requireUser, unauthorizedResponse } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
import { sentryCapture } from '../_shared/sentry.ts'

const FN = 'merge-anonymous-user'

/** GoTrue: imzası geçerli JWT'nin `sub`'ı auth.users'ta yok. */
const GOTRUE_USER_NOT_FOUND = 'user_not_found'

interface MergeRpcResult {
  status: 'merged' | 'target_won' | 'nothing_to_move' | 'already_merged'
  moved_gauntlet_id?: string | null
  dropped_gauntlet_id?: string | null
  moved_cycle?: string | null
  events_moved?: number
  corrections_moved?: number
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST bekleniyor', 405)
  }

  // ── 1. Hedef (JWT-B) — imza doğrulamalı getUser ────────────────────────────
  const target = await requireUser(req)
  if (!target.ok) {
    await sentryCapture({
      message: `${FN}: hedef JWT doğrulanamadı (${target.code})`,
      level: 'warning',
      tags: { fn: FN, step: 'target_auth' },
    })
    return unauthorizedResponse(target, corsHeaders)
  }

  // Rate limit anahtarı = JWT-B'nin doğrulanmış auth.users.id'si.
  try {
    await checkRateLimit(target.authUserId, FN)
  } catch (err) {
    await sentryCapture({
      message: `${FN}: rate limit reddi`,
      level: 'warning',
      tags: { fn: FN, step: 'rate_limit' },
      extra: { target_auth_id: target.authUserId, error: errText(err) },
    })
    return rateLimitResponse(err, corsHeaders)
  }

  if (target.appUserId === null) {
    // requireUser lookup hatasını da null'a indirger; iki durumda da hedef
    // satırı olmadan taşıma yapılamaz.
    await sentryCapture({
      message: `${FN}: hedef public.users satırı çözülemedi`,
      level: 'error',
      tags: { fn: FN, step: 'target_app_user' },
      extra: { target_auth_id: target.authUserId },
    })
    return errorResponse('TARGET_PROFILE_MISSING', 'Hedef profil bulunamadı', 500)
  }

  // ── 2. Kaynak (JWT-A) — imza doğrulamalı getUser ───────────────────────────
  let anonToken: string
  try {
    const body = await req.json() as { anonymous_access_token?: unknown }
    if (typeof body.anonymous_access_token !== 'string' || body.anonymous_access_token.length === 0) {
      throw new Error('anonymous_access_token eksik')
    }
    anonToken = body.anonymous_access_token
  } catch (err) {
    await sentryCapture({
      message: `${FN}: geçersiz gövde`,
      level: 'warning',
      tags: { fn: FN, step: 'body' },
      extra: { target_auth_id: target.authUserId, error: errText(err) },
    })
    return errorResponse('INVALID_INPUT', 'anonymous_access_token zorunlu', 400)
  }

  const service = getServiceClient()

  const { data: anonData, error: anonError } = await service.auth.getUser(anonToken)
  if (anonError?.code === GOTRUE_USER_NOT_FOUND) {
    // İmza geçerli, kullanıcı yok → önceki çağrı taşıyıp sildi. Hata değil.
    console.log(`[${FN}] anon_missing`, JSON.stringify({ target_auth_id: target.authUserId }))
    return jsonResponse({ merged: false, reason: 'anon_missing' }, 200)
  }
  const anonAuthId = anonData?.user?.id ?? null
  if (anonError || anonAuthId === null) {
    // Süresi dolmuş / bozuk JWT-A. Taşıma YAPILMADI — "zaten birleşti" değil.
    await sentryCapture({
      message: `${FN}: anonim JWT doğrulanamadı — taşıma yapılmadı`,
      level: 'error',
      tags: { fn: FN, step: 'anon_auth' },
      extra: {
        target_auth_id: target.authUserId,
        code: anonError?.code ?? null,
        error: anonError?.message ?? 'kullanıcı yok',
      },
    })
    return jsonResponse({ error: 'ANON_SESSION_INVALID', message: 'Anonim oturum doğrulanamadı' }, 401)
  }

  if (anonAuthId === target.authUserId) {
    await sentryCapture({
      message: `${FN}: kaynak ve hedef aynı auth kullanıcısı`,
      level: 'error',
      tags: { fn: FN, step: 'same_user' },
      extra: { auth_id: anonAuthId },
    })
    return errorResponse('SAME_USER', 'Kaynak ve hedef aynı', 400)
  }

  // ── 3. is_anonymous — auth.users satırından (JWT claim'i değil) ────────────
  const [anonRow, targetRow] = await Promise.all([
    service.auth.admin.getUserById(anonAuthId),
    service.auth.admin.getUserById(target.authUserId),
  ])
  if (anonRow.error || targetRow.error || !anonRow.data.user || !targetRow.data.user) {
    await sentryCapture({
      message: `${FN}: auth.users satırı okunamadı`,
      level: 'error',
      tags: { fn: FN, step: 'auth_row_lookup' },
      extra: {
        source_auth_id: anonAuthId,
        target_auth_id: target.authUserId,
        source_error: anonRow.error?.message ?? null,
        target_error: targetRow.error?.message ?? null,
      },
    })
    return errorResponse('AUTH_LOOKUP_FAILED', 'Kimlik kaydı okunamadı', 500)
  }
  if (anonRow.data.user.is_anonymous !== true) {
    await sentryCapture({
      message: `${FN}: kaynak kullanıcı anonim değil — reddedildi`,
      level: 'error',
      tags: { fn: FN, step: 'source_not_anonymous' },
      extra: { source_auth_id: anonAuthId, target_auth_id: target.authUserId },
    })
    return errorResponse('SOURCE_NOT_ANONYMOUS', 'Kaynak hesap anonim olmalı', 400)
  }
  if (targetRow.data.user.is_anonymous === true) {
    await sentryCapture({
      message: `${FN}: hedef kullanıcı anonim — reddedildi`,
      level: 'error',
      tags: { fn: FN, step: 'target_anonymous' },
      extra: { source_auth_id: anonAuthId, target_auth_id: target.authUserId },
    })
    return errorResponse('TARGET_ANONYMOUS', 'Hedef hesap anonim olamaz', 400)
  }

  // ── 4. Kaynak app user ─────────────────────────────────────────────────────
  const lookup = await service
    .from('users')
    .select('id')
    .eq('auth_id', anonAuthId)
    .maybeSingle()

  if (lookup.error) {
    await sentryCapture({
      message: `${FN}: kaynak users araması başarısız — hiçbir şey taşınmadı/silinmedi`,
      level: 'error',
      tags: { fn: FN, step: 'source_lookup' },
      extra: { source_auth_id: anonAuthId, error: lookup.error.message },
    })
    return errorResponse('SOURCE_LOOKUP_FAILED', 'Kaynak profil okunamadı', 500)
  }

  // ── 5. Taşıma (tek transaction) ────────────────────────────────────────────
  let result: MergeRpcResult
  if (lookup.data === null) {
    // Önceki çağrı RPC'yi bitirip auth silmede kalmış ya da anonim
    // kullanıcının hiç app satırı olmamış. Taşınacak veri yok.
    result = { status: 'already_merged' }
  } else {
    const fromId = (lookup.data as { id: string }).id
    const rpc = await service.rpc('merge_anonymous_user', {
      p_from: fromId,
      p_to: target.appUserId,
    })
    if (rpc.error) {
      await sentryCapture({
        message: `${FN}: merge_anonymous_user başarısız — anonim kullanıcı SİLİNMEDİ`,
        level: 'error',
        tags: { fn: FN, step: 'merge_rpc' },
        extra: {
          from_user_id: fromId,
          to_user_id: target.appUserId,
          code: rpc.error.code,
          error: rpc.error.message,
        },
      })
      return errorResponse('MERGE_FAILED', 'Birleştirme başarısız', 500)
    }
    result = rpc.data as MergeRpcResult
  }

  // ── 6. Anonim auth kullanıcısı ─────────────────────────────────────────────
  const { error: deleteError } = await service.auth.admin.deleteUser(anonAuthId)
  if (deleteError) {
    // Veri taşındı, auth kaydı kaldı. Hata yanıtı: aynı JWT-A ile tekrar
    // çağrı 4. adımda satır bulamaz → yalnız auth silmeyi yeniden dener.
    await sentryCapture({
      message: `${FN}: anonim auth kullanıcısı silinemedi (taşıma tamam)`,
      level: 'fatal',
      tags: { fn: FN, step: 'auth_delete' },
      extra: { source_auth_id: anonAuthId, status: result.status, error: deleteError.message },
    })
    return errorResponse('ANON_AUTH_DELETE_FAILED', 'Anonim kimlik silinemedi', 500)
  }

  console.log(`[${FN}] ${result.status}`, JSON.stringify({ source_auth_id: anonAuthId, to_user_id: target.appUserId }))
  return jsonResponse({ merged: true, ...result }, 200)
})
