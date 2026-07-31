/**
 * dev-reset-games — Test icin gunluk oyun ilerlemesini sifirlar.
 *
 * NEDEN AYRI BIR FONKSIYON: `game_scores` uzerinde bilincli olarak DELETE
 * politikasi YOK. Olsaydi herhangi bir kullanici kaybettigi gunluk bulmacayi
 * silip kazanana kadar tekrar oynayabilirdi. Bu fonksiyon silme yetkisini
 * service_role ile alir ve YALNIZCA allowlist'teki test hesaplarina acar.
 *
 * Allowlist: app_config.key = 'dev_reset_user_ids' → { "user_ids": ["<uuid>"] }
 * Liste bos veya kayitsizsa fonksiyon HERKESE kapalidir (fail-closed).
 *
 * POST { puzzle_date?: 'YYYY-MM-DD', game_id?: string }
 *   puzzle_date verilmezse bugun kullanilir.
 *   game_id verilirse yalnizca o oyun sifirlanir, yoksa o gunun hepsi.
 *
 * Deploy: supabase functions deploy dev-reset-games
 */

import {
  handleCors,
  jsonResponse,
  errorResponse,
  getUserClient,
  getServiceClient,
  requireAuthUser,
  resolveAppUser,
  AuthError,
  logInfo,
  logError,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'

interface DevResetConfig {
  user_ids?: string[]
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  // ─── Auth ──────────────────────────────────────────────────────────────────
  let userId: string
  try {
    const userClient = getUserClient(req)
    const { authUid } = await requireAuthUser(userClient)
    const service = getServiceClient()
    const appUser = await resolveAppUser(service, authUid)
    userId = appUser.id
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse('UNAUTHORIZED', err.message, 401)
    }
    logError('dev-reset-games.auth_failed', err)
    return errorResponse('AUTH_ERROR', 'Authentication failed', 500)
  }

  const service = getServiceClient()

  // ─── Allowlist — fail-closed ───────────────────────────────────────────────
  const { data: cfgRow, error: cfgError } = await service
    .from('app_config')
    .select('value')
    .eq('key', 'dev_reset_user_ids')
    .maybeSingle()

  if (cfgError) {
    logError('dev-reset-games.config_failed', cfgError, { userId })
    return errorResponse('CONFIG_ERROR', 'Could not read allowlist', 500)
  }

  const allowed = (cfgRow?.value as DevResetConfig | null)?.user_ids
  if (!Array.isArray(allowed) || !allowed.includes(userId)) {
    logInfo('dev-reset-games.forbidden', {
      user_id: userId,
      config_missing: !Array.isArray(allowed),
    })
    // Cagirana KENDI users.id'si donuluyor — baskasinin bilgisi degil, sizinti
    // degil. Eskiden yanit tamamen ayrintisizdi ve allowlist satiri hic
    // olusturulmadigi icin buton herkese 403 veriyordu; hangi kimligin
    // listeye eklenecegi yanittan okunamiyordu.
    return errorResponse(
      'FORBIDDEN',
      `Not allowlisted. Add this users.id to app_config.dev_reset_user_ids: ${userId}`,
      403,
    )
  }

  // ─── Parse input ───────────────────────────────────────────────────────────
  let puzzleDate: string
  let gameId: string | null = null
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    puzzleDate = body.puzzle_date ?? new Date().toISOString().split('T')[0]
    gameId = typeof body.game_id === 'string' && body.game_id ? body.game_id : null
  } catch {
    return errorResponse('INVALID_INPUT', 'Invalid request body', 400)
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
    return errorResponse('INVALID_DATE', 'puzzle_date must be YYYY-MM-DD', 400)
  }

  try {
    // ─── O gunun bulmacalari ────────────────────────────────────────────────
    let puzzleQuery = service
      .from('daily_puzzles')
      .select('id, game_type')
      .eq('date', puzzleDate)

    if (gameId) puzzleQuery = puzzleQuery.eq('game_type', gameId)

    const { data: puzzles, error: puzzleError } = await puzzleQuery
    if (puzzleError) throw puzzleError

    const puzzleIds = (puzzles ?? []).map((p: { id: string }) => p.id)
    if (puzzleIds.length === 0) {
      return jsonResponse({ reset: 0, puzzle_date: puzzleDate, games: [], user_id: userId })
    }

    // ─── Yalnizca CAGIRAN kullanicinin skorlari silinir ─────────────────────
    const { data: deleted, error: deleteError } = await service
      .from('game_scores')
      .delete()
      .eq('user_id', userId)
      .in('puzzle_id', puzzleIds)
      .select('id')

    if (deleteError) throw deleteError

    const games = (puzzles ?? []).map((p: { game_type: string }) => p.game_type)

    logInfo('dev-reset-games.done', {
      user_id: userId,
      puzzle_date: puzzleDate,
      game_id: gameId,
      deleted: deleted?.length ?? 0,
    })

    return jsonResponse({
      reset: deleted?.length ?? 0,
      puzzle_date: puzzleDate,
      games,
      // Teshis: allowlist'e yanlis hesap yazildiginda fonksiyon 200 + 0 satir
      // donuyordu ve sebebi gorunmuyordu. Cagiran kimlik artik yanitla geliyor.
      user_id: userId,
    })
  } catch (err) {
    logError('dev-reset-games.failed', err, { userId, puzzleDate })
    await sentryCapture({
      message: `dev-reset-games failed: ${err}`,
      tags: { fn: 'dev-reset-games', user_id: userId },
    })
    return errorResponse('RESET_FAILED', 'Could not reset game progress', 500)
  }
})
