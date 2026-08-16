/**
 * Edge Function: submit-context-correction — ContextBar düzeltmesi (C.3)
 *
 * Kullanıcı ContextBar'da tahmin edilen bağlamı düzeltirse buraya yazılır.
 * CTO kararı (C.3, kilitli):
 *   1. İdempotency korunur — bu çağrı `daily_gauntlets`'e ASLA dokunmaz,
 *      bugünün dörtlüsü değişmez (§3.1 "günde 1 kez").
 *   2. Düzeltme yalnızca `context_corrections`'a yazılır — Faz F'in tahmin
 *      motorunun eğitim verisi. YARINKİ gauntlet'ı etkiler, bugünkünü değil.
 *   3. `context_patterns`/`context_corrections`'ta yalnız SELECT RLS var
 *      (migration 069, bilinçli — yazma service_role). Migration gerekmez.
 *
 * Deploy: supabase functions deploy submit-context-correction
 */

import {
  AuthError,
  errorResponse,
  getServiceClient,
  getUserClient,
  handleCors,
  jsonResponse,
  logError,
  logInfo,
  requireAuthUser,
  resolveAppUser,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import type { GauntletContext } from '../../../types/gauntlet.ts'

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface ContextCorrectionRequest {
  gauntletId: string
  corrected: GauntletContext
}

interface ContextCorrectionResult {
  status: 'saved'
}

interface GauntletRow {
  id: string
  user_id: string | null
  context: GauntletContext | null
}

// ─── Girdi doğrulama ─────────────────────────────────────────────────────────

const COMPANIONS = ['alone', 'partner', 'friends', 'family']
const DURATIONS = ['short', 'medium', 'any']
const ENERGIES = ['drained', 'normal', 'open']

/**
 * `GauntletContext` şekil doğrulaması — generate-gauntlet'taki `isValidContext`
 * ile birebir aynı (types/gauntlet.ts kilitli sözleşme, oraya export edilmiş
 * bir doğrulayıcı yok; iki fonksiyon bilinçli olarak ayrı tutulur).
 */
function isValidContext(v: unknown): v is GauntletContext {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (
    typeof c.companion === 'string' && COMPANIONS.includes(c.companion) &&
    typeof c.duration === 'string' && DURATIONS.includes(c.duration) &&
    typeof c.energy === 'string' && ENERGIES.includes(c.energy)
  )
}

function isValidRequest(v: unknown): v is ContextCorrectionRequest {
  if (typeof v !== 'object' || v === null) return false
  const b = v as Record<string, unknown>
  return typeof b.gauntletId === 'string' && isValidContext(b.corrected)
}

// ─── Handler ─────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'POST bekleniyor', 405)
  }

  let appUserId: string
  const service = getServiceClient()

  try {
    const userClient = getUserClient(req)
    const { authUid } = await requireAuthUser(userClient)
    const appUser = await resolveAppUser(service, authUid)
    appUserId = appUser.id
  } catch (err) {
    if (err instanceof AuthError) {
      logError('context_correction_auth_failed', err)
      return errorResponse('UNAUTHORIZED', 'Oturum doğrulanamadı', 401)
    }
    logError('context_correction_auth_error', err)
    await sentryCapture({
      message: 'submit-context-correction: kimlik çözümleme hatası',
      level: 'error',
      tags: { function: 'submit-context-correction' },
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
    return errorResponse('AUTH_ERROR', 'Kimlik doğrulama başarısız', 500)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    logError('context_correction_bad_json', err, { user_id: appUserId })
    return errorResponse('INVALID_INPUT', 'Geçersiz JSON gövdesi', 400)
  }

  if (!isValidRequest(body)) {
    return errorResponse(
      'INVALID_INPUT',
      'gauntletId (string) ve geçerli bir corrected context zorunlu',
      400,
    )
  }
  const { gauntletId, corrected } = body

  try {
    const gauntletRes = await service
      .from('daily_gauntlets')
      .select('id,user_id,context')
      .eq('id', gauntletId)
      .maybeSingle()

    if (gauntletRes.error) {
      throw new Error(`gauntlet sorgusu başarısız: ${gauntletRes.error.message}`)
    }
    if (!gauntletRes.data) {
      return errorResponse('GAUNTLET_NOT_FOUND', 'Gauntlet bulunamadı', 404)
    }

    const gauntlet = gauntletRes.data as GauntletRow
    if (gauntlet.user_id !== appUserId) {
      // Başka kullanıcının gauntlet'ine yazma girişimi. 404 döner — 403
      // varlığı doğrulardı (submit-choice / submit-watch-feedback deseniyle aynı).
      logInfo('context_correction_gauntlet_owner_mismatch', {
        user_id: appUserId,
        gauntlet_id: gauntlet.id,
      })
      return errorResponse('GAUNTLET_NOT_FOUND', 'Gauntlet bulunamadı', 404)
    }

    // Bugünün dörtlüsüne HİÇ dokunulmaz — yalnız ham gözlem kaydedilir.
    const insert = await service.from('context_corrections').insert({
      user_id: appUserId,
      gauntlet_id: gauntletId,
      predicted: gauntlet.context,
      corrected,
    })

    if (insert.error) {
      throw new Error(`context_corrections yazımı başarısız: ${insert.error.message}`)
    }

    logInfo('context_correction_saved', {
      user_id: appUserId,
      gauntlet_id: gauntletId,
      predicted: gauntlet.context,
      corrected,
    })

    const result: ContextCorrectionResult = { status: 'saved' }
    return jsonResponse(result)
  } catch (err) {
    logError('context_correction_submission_failed', err, {
      user_id: appUserId,
      gauntlet_id: gauntletId,
    })
    await sentryCapture({
      message: 'submit-context-correction: yazım başarısız',
      level: 'error',
      tags: { function: 'submit-context-correction' },
      extra: {
        user_id: appUserId,
        gauntlet_id: gauntletId,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return errorResponse('CONTEXT_CORRECTION_FAILED', 'Bağlam düzeltmesi kaydedilemedi', 503)
  }
})
