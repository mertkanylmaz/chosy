/**
 * Edge Function: sync-entitlement (MONEY-SEC-1)
 *
 * İstemci satın alma / restore sonrası kendi JWT'siyle çağırır. Fonksiyon RC
 * REST'ten kullanıcının O ANKİ durumunu okur ve `users.subscription_tier` +
 * `subscriptions` satırını service role ile yazar. İstemci gövdesinden hiçbir
 * değer okunmaz — yalnız kimlik (imza doğrulanmış JWT). Migration 135 istemci
 * yazımını kapattığından webhook gelene kadarki Free penceresini bu kapatır.
 *
 * Akış: requireUser → rate limit (5/dk, auth id) → RC REST → syncEntitlementFromRc.
 *
 * Yanıt:
 *   200 { synced: true,  tier, plan, status }
 *   200 { synced: false, reason: 'no_active_entitlement' }  — RC henüz görmüyor;
 *       yazım yok, downgrade yok. İstemci RC durumuna güvenmeye devam eder.
 * Diğer her yanıt hatadır (401/405/429/500/502/503); hepsi Sentry'ye yazılır.
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
import { syncEntitlementFromRc } from '../_shared/rcEntitlementSync.ts'
import { fetchRcSubscriber, RcRestError } from '../_shared/rcTransfer.ts'
import { sentryCapture } from '../_shared/sentry.ts'

const FN = 'sync-entitlement'

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST bekleniyor', 405)
  }

  const auth = await requireUser(req)
  if (!auth.ok) {
    await sentryCapture({
      message: `${FN}: JWT doğrulanamadı (${auth.code})`,
      level: 'warning',
      tags: { fn: FN, step: 'auth' },
    })
    return unauthorizedResponse(auth, corsHeaders)
  }

  try {
    await checkRateLimit(auth.authUserId, FN)
  } catch (err) {
    await sentryCapture({
      message: `${FN}: rate limit reddi`,
      level: 'warning',
      tags: { fn: FN, step: 'rate_limit' },
      extra: { auth_user_id: auth.authUserId, error: errText(err) },
    })
    return rateLimitResponse(err, corsHeaders)
  }

  if (auth.appUserId === null) {
    await sentryCapture({
      message: `${FN}: public.users satırı çözülemedi`,
      level: 'error',
      tags: { fn: FN, step: 'app_user' },
      extra: { auth_user_id: auth.authUserId },
    })
    return errorResponse('APP_USER_MISSING', 'Kullanıcı profili bulunamadı', 500)
  }
  const appUserId = auth.appUserId

  // RC app_user_id = auth.users.id (istemci Purchases.logIn(auth id)).
  let info
  try {
    info = await fetchRcSubscriber(auth.authUserId, Deno.env.get('REVENUECAT_SECRET_KEY'), fetch)
  } catch (err) {
    const code = err instanceof RcRestError ? err.code : 'RC_REST_UNKNOWN'
    await sentryCapture({
      message: `${FN}: RC REST başarısız (${code})`,
      level: 'error',
      tags: { fn: FN, step: 'rc_rest', error_code: code },
      extra: {
        auth_user_id: auth.authUserId,
        http_status: err instanceof RcRestError ? err.httpStatus : null,
        error: errText(err),
      },
    })
    return errorResponse(code, 'Abonelik durumu okunamadı', 502)
  }

  const service = getServiceClient()
  const outcome = await syncEntitlementFromRc(
    info,
    {
      updateUserTier: async (id, fields) => {
        const { error, count } = await service
          .from('users')
          .update(fields, { count: 'exact' })
          .eq('id', id)
        return { error, count }
      },
      upsertSubscription: async (row) => {
        const { error } = await service.from('subscriptions').upsert(row, { onConflict: 'user_id' })
        return { error }
      },
    },
    appUserId,
    Date.now(),
  )

  const baseExtra = { auth_user_id: auth.authUserId, app_user_id: appUserId }

  switch (outcome.kind) {
    case 'synced': {
      if (outcome.warnPeriodType) {
        await sentryCapture({
          message: `${FN}: period_type yok/tanınmayan — status 'active' yazıldı`,
          level: 'warning',
          tags: { fn: FN, error_code: 'RC_PERIOD_TYPE_MISSING' },
          extra: baseExtra,
        })
      }
      return jsonResponse({
        synced: true,
        tier: outcome.tier,
        plan: outcome.plan,
        status: outcome.status,
      })
    }
    case 'no_active_entitlement':
      // Hata değil: RC henüz yansıtmamış olabilir. Yazım yok → `info` düzeyinde iz.
      await sentryCapture({
        message: `${FN}: aktif chosy_plus entitlement yok — yazılmadı`,
        level: 'info',
        tags: { fn: FN, error_code: 'RC_SYNC_NO_ACTIVE_ENTITLEMENT' },
        extra: baseExtra,
      })
      return jsonResponse({ synced: false, reason: 'no_active_entitlement' })
    case 'environment_missing':
      await sentryCapture({
        message: `${FN}: environment RC yanıtından belirlenemedi — yazım yapılmadı`,
        level: 'error',
        tags: { fn: FN, error_code: 'RC_ENVIRONMENT_MISSING' },
        extra: { ...baseExtra, product_id: outcome.productId },
      })
      return errorResponse('RC_ENVIRONMENT_MISSING', 'Ortam belirlenemedi', 502)
    case 'unmapped_product':
      await sentryCapture({
        message: `${FN}: product_id eşlenemedi (${outcome.productId}) — yazım yapılmadı`,
        level: 'error',
        tags: { fn: FN, error_code: 'PRODUCT_ID_UNMAPPED' },
        extra: { ...baseExtra, product_id: outcome.productId },
      })
      return errorResponse('PRODUCT_ID_UNMAPPED', 'Ürün eşlenemedi', 502)
    case 'users_row_vanished':
      await sentryCapture({
        message: `${FN}: users UPDATE 0 satır — satır çözümlemeden sonra kayboldu`,
        level: 'error',
        tags: { fn: FN, error_code: 'USERS_ROW_VANISHED' },
        extra: baseExtra,
      })
      return errorResponse('USERS_ROW_VANISHED', 'Kullanıcı satırı bulunamadı', 500)
    case 'db_error':
      await sentryCapture({
        message: `${FN}: ${outcome.step} yazımı başarısız — ${outcome.error.message}`,
        level: 'error',
        tags: {
          fn: FN,
          error_code: outcome.step === 'users' ? 'USERS_TIER_UPDATE_FAILED' : 'SUBSCRIPTION_UPSERT_FAILED',
        },
        extra: { ...baseExtra, pg_code: outcome.error.code ?? null, pg_details: outcome.error.details ?? null },
      })
      return errorResponse('DB_WRITE_FAILED', 'Abonelik yazılamadı', 500)
  }
})
