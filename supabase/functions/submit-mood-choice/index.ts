/**
 * Edge Function: submit-mood-choice (Mood Gauntlet, Faz 2-1)
 *
 * Mood Gauntlet seçimini `choice_events`'e `context.source='mood'` ile yazar.
 * Günlük gauntlet (submit-choice / generate-gauntlet) koduna DOKUNMAZ.
 *
 * Gövde: { mood_search_id, set_id, set_index?, round 1|2|3, film_a, film_b,
 *          winner|null, outcome 'choice'|'neither' }
 *
 * Doğrulama: requireUser → mood_searches satırı bu kullanıcıya ait VE son 24 saatte →
 * film_a/film_b films'te var → winner/outcome tutarlı (saf mantık: _shared/moodChoice.ts).
 * Yazım: record_choice_event (p_set_champion=false). Tekrar istek: 200 + idempotent:true.
 * Rate limit: 30/dk. Hata: Sentry + kodlu yanıt.
 *
 * Deploy: supabase functions deploy submit-mood-choice
 */
import { requireUser, unauthorizedResponse } from '../_shared/auth.ts'
import { checkRateLimit, rateLimitResponse } from '../_shared/rateLimit.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import {
  buildRecordChoiceArgs,
  isSearchRecent,
  parseMoodChoiceRequest,
} from '../_shared/moodChoice.ts'
import {
  errorResponse,
  getServiceClient,
  handleCors,
  jsonResponse,
  logError,
} from '../_shared/gameUtils.ts'

const FN = 'submit-mood-choice'

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCors(req)
  if (cors) return cors
  if (req.method !== 'POST') return errorResponse('METHOD_NOT_ALLOWED', 'POST bekleniyor', 405)

  const auth = await requireUser(req)
  if (!auth.ok) return unauthorizedResponse(auth, {})

  try {
    await checkRateLimit(auth.authUserId, FN)
  } catch (err) {
    return rateLimitResponse(err, {})
  }

  if (!auth.appUserId) {
    return errorResponse('USER_NOT_FOUND', 'Uygulama kullanıcısı bulunamadı', 404)
  }
  const appUserId = auth.appUserId

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return errorResponse('INVALID_INPUT', 'Geçersiz JSON gövdesi', 400)
  }
  const parsed = parseMoodChoiceRequest(raw)
  if (!parsed.ok) return errorResponse('INVALID_INPUT', parsed.message, 400)
  const choice = parsed.value

  const service = getServiceClient()
  try {
    const search = await service
      .from('mood_searches')
      .select('id,user_id,searched_at')
      .eq('id', choice.mood_search_id)
      .maybeSingle()
    if (search.error) throw new Error(`mood_searches sorgusu başarısız: ${search.error.message}`)
    // Başka kullanıcının araması: 404 (403 varlığı doğrulardı — submit-context-correction deseni).
    if (!search.data || search.data.user_id !== appUserId) {
      return errorResponse('SEARCH_NOT_FOUND', 'Arama bulunamadı', 404)
    }
    if (!isSearchRecent(search.data.searched_at, Date.now())) {
      return errorResponse('SEARCH_EXPIRED', 'Arama 24 saatten eski', 410)
    }

    const films = await service.from('films').select('id').in('id', [choice.film_a, choice.film_b])
    if (films.error) throw new Error(`films sorgusu başarısız: ${films.error.message}`)
    if ((films.data ?? []).length !== 2) {
      return errorResponse('FILM_NOT_FOUND', 'Film bulunamadı', 400)
    }

    const rpc = await service.rpc('record_choice_event', buildRecordChoiceArgs(appUserId, choice))
    if (rpc.error) throw new Error(`record_choice_event başarısız: ${rpc.error.message}`)
    const status = (rpc.data as { status?: string } | null)?.status
    if (status === 'duplicate') return jsonResponse({ status: 'ok', idempotent: true })
    if (status !== 'inserted') {
      throw new Error(`record_choice_event beklenmeyen sonuç: ${String(status)}`)
    }
    return jsonResponse({ status: 'ok', idempotent: false })
  } catch (err) {
    logError('mood_choice_failed', err, { user_id: appUserId, mood_search_id: choice.mood_search_id })
    await sentryCapture({
      message: `${FN}: yazım başarısız`,
      level: 'error',
      tags: { function: FN },
      extra: {
        user_id: appUserId,
        mood_search_id: choice.mood_search_id,
        round: choice.round,
        error: err instanceof Error ? err.message : String(err),
      },
    })
    return errorResponse('MOOD_CHOICE_FAILED', 'Seçim kaydedilemedi', 503)
  }
})
