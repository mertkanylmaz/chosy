/**
 * Edge Function: submit-watch-feedback — "dün izledin mi?" cevabı (C.4)
 *
 * `generate-gauntlet`'in `pendingWatchFeedback` alanıyla önerdiği soruya
 * istemcinin verdiği cevabı `watch_feedback`'e yazar. `loved`/`ok`/`abandoned`
 * ayrıca `watchlist.watched_at`'i doldurur (yalnızca NULL ise — mevcut izleme
 * tarihi asla ezilmez, `markWatched` `_shared/gauntletCore.ts`'te).
 *
 * `not_watched` → watchlist'e dokunulmaz.
 * `skipped`     → watchlist'e dokunulmaz, answered_at NULL kalır. Migration
 *                 086 CHECK'e ekledi. `_shared/tasteVector.ts`'in
 *                 feedback_weights sözlüğünde 'skipped' YOK — bu kasıtlı,
 *                 tanınmayan response otomatik sıfır sinyal sayılır.
 *
 * Idempotent: (gauntlet_id, film_id) üzerinde partial UNIQUE index (069).
 * Zaten cevaplanmışsa hiçbir şey yazılmaz, mevcut durum açıkça döner
 * (`status: 'already_answered'`) — sessiz başarı DEĞİL.
 *
 * Deploy: supabase functions deploy submit-watch-feedback
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
import { markWatched } from '../_shared/gauntletCore.ts'
import {
  isValidWatchFeedbackResponse,
  type WatchFeedbackResponse,
} from '../../../types/gauntlet.ts'

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface WatchFeedbackRequest {
  gauntletId: string
  filmId: string
  response: WatchFeedbackResponse
}

interface WatchFeedbackResult {
  status: 'answered' | 'already_answered'
  response: WatchFeedbackResponse
}

interface GauntletRow {
  id: string
  user_id: string | null
  champion_film_id: string | null
}

/** `watchlist.watched_at`'i dolduran response'lar (CTO kararı, C.4). */
const WATCHLIST_RESPONSES: ReadonlySet<WatchFeedbackResponse> = new Set([
  'loved',
  'ok',
  'abandoned',
])

// ─── Girdi doğrulama ─────────────────────────────────────────────────────────

/**
 * Şekil doğrulaması. `types/gauntlet.ts`'in "dış paket yok" kuralı izlenir —
 * Zod değil, typeof/literal kontrolü (`isValidWatchFeedbackResponse` kilitli
 * dosyada, migration 086'daki CHECK ile birebir).
 */
function isValidRequest(v: unknown): v is WatchFeedbackRequest {
  if (typeof v !== 'object' || v === null) return false
  const b = v as Record<string, unknown>
  return (
    typeof b.gauntletId === 'string' &&
    typeof b.filmId === 'string' &&
    isValidWatchFeedbackResponse(b.response)
  )
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
      logError('watch_feedback_auth_failed', err)
      return errorResponse('UNAUTHORIZED', 'Oturum doğrulanamadı', 401)
    }
    logError('watch_feedback_auth_error', err)
    await sentryCapture({
      message: 'submit-watch-feedback: kimlik çözümleme hatası',
      level: 'error',
      tags: { function: 'submit-watch-feedback' },
      extra: { error: err instanceof Error ? err.message : String(err) },
    })
    return errorResponse('AUTH_ERROR', 'Kimlik doğrulama başarısız', 500)
  }

  let body: unknown
  try {
    body = await req.json()
  } catch (err) {
    logError('watch_feedback_bad_json', err, { user_id: appUserId })
    return errorResponse('INVALID_INPUT', 'Geçersiz JSON gövdesi', 400)
  }

  if (!isValidRequest(body)) {
    return errorResponse(
      'INVALID_INPUT',
      'gauntletId, filmId (string) ve geçerli bir response zorunlu',
      400,
    )
  }
  const { gauntletId, filmId, response } = body

  try {
    // ── Ownership + idempotency: submit-choice'taki paralel okuma deseni ──────
    const [gauntletRes, existingRes] = await Promise.all([
      service
        .from('daily_gauntlets')
        .select('id,user_id,champion_film_id')
        .eq('id', gauntletId)
        .maybeSingle(),
      service
        .from('watch_feedback')
        .select('id,response')
        .eq('gauntlet_id', gauntletId)
        .eq('film_id', filmId)
        .maybeSingle(),
    ])

    if (gauntletRes.error) {
      throw new Error(`gauntlet sorgusu başarısız: ${gauntletRes.error.message}`)
    }
    if (!gauntletRes.data) {
      return errorResponse('GAUNTLET_NOT_FOUND', 'Gauntlet bulunamadı', 404)
    }

    const gauntlet = gauntletRes.data as GauntletRow
    if (gauntlet.user_id !== appUserId) {
      // Başka kullanıcının gauntlet'ine yazma girişimi. 404 döner — 403
      // varlığı doğrulardı (submit-choice'taki desenle aynı).
      logInfo('watch_feedback_gauntlet_owner_mismatch', {
        user_id: appUserId,
        gauntlet_id: gauntlet.id,
      })
      return errorResponse('GAUNTLET_NOT_FOUND', 'Gauntlet bulunamadı', 404)
    }
    if (gauntlet.champion_film_id !== filmId) {
      return errorResponse(
        'UNPROCESSABLE_SUBMISSION',
        'filmId bu gauntlet\'in şampiyonu değil',
        422,
      )
    }

    if (existingRes.error) {
      throw new Error(`idempotency sorgusu başarısız: ${existingRes.error.message}`)
    }
    if (existingRes.data) {
      const existing = existingRes.data as { id: string; response: WatchFeedbackResponse }
      logInfo('watch_feedback_already_answered', {
        user_id: appUserId,
        gauntlet_id: gauntletId,
        film_id: filmId,
      })
      const result: WatchFeedbackResult = {
        status: 'already_answered',
        response: existing.response,
      }
      return jsonResponse(result)
    }

    // ── Yazma ───────────────────────────────────────────────────────────────
    const now = new Date().toISOString()
    const insert = await service.from('watch_feedback').insert({
      user_id: appUserId,
      film_id: filmId,
      gauntlet_id: gauntletId,
      response,
      asked_at: now,
      answered_at: response === 'skipped' ? null : now,
    })

    if (insert.error) {
      // 23505: aynı (gauntlet_id, film_id) için başka bir istek az önce
      // yazdı. Yarış idempotency kısıtının amaçladığı sonuçtur — yutulmuyor,
      // loglanıp GERÇEK kayıtlı değer okunup dönüyor (tahmin edilmiyor).
      if (insert.error.code === '23505') {
        logInfo('watch_feedback_insert_race', {
          user_id: appUserId,
          gauntlet_id: gauntletId,
          film_id: filmId,
        })
        const retry = await service
          .from('watch_feedback')
          .select('response')
          .eq('gauntlet_id', gauntletId)
          .eq('film_id', filmId)
          .single()
        if (retry.error || !retry.data) {
          throw new Error(
            `idempotency yarışı çözülemedi: ${retry.error?.message ?? 'satır yok'}`,
          )
        }
        const result: WatchFeedbackResult = {
          status: 'already_answered',
          response: retry.data.response as WatchFeedbackResponse,
        }
        return jsonResponse(result)
      }
      throw new Error(`watch_feedback yazımı başarısız: ${insert.error.message}`)
    }

    // ── Watchlist upsert (yalnızca loved/ok/abandoned) ─────────────────────
    if (WATCHLIST_RESPONSES.has(response)) {
      await markWatched(service, appUserId, filmId)
    }

    logInfo('watch_feedback_answered', {
      user_id: appUserId,
      gauntlet_id: gauntletId,
      film_id: filmId,
      response,
    })

    const result: WatchFeedbackResult = { status: 'answered', response }
    return jsonResponse(result)
  } catch (err) {
    logError('watch_feedback_submission_failed', err, {
      user_id: appUserId,
      gauntlet_id: gauntletId,
      film_id: filmId,
    })
    await sentryCapture({
      message: 'submit-watch-feedback: yazım başarısız',
      level: 'error',
      tags: { function: 'submit-watch-feedback' },
      extra: {
        user_id: appUserId,
        gauntlet_id: gauntletId,
        film_id: filmId,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return errorResponse('WATCH_FEEDBACK_FAILED', 'Geri bildirim kaydedilemedi', 503)
  }
})
