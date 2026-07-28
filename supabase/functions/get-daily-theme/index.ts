/**
 * get-daily-theme — Günün gizli bağlantısını (tema) döner.
 *
 * Hard Rule 1: tema etiketi oynanmamış bir bulmaca için çözüm ipucudur.
 * Bu yüzden theme_type / theme_key / theme_label KİLİTLİYKEN response'a GİRMEZ;
 * yalnızca "kaç/kaç" sayacı döner. Etiket ancak temalı bulmacaların hepsi
 * tamamlandığında açılır.
 *
 * Deploy: supabase functions deploy get-daily-theme
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

interface ThemeRow {
  theme_type: string
  theme_key: string
  theme_label: string
  game_types: string[]
}

interface ThemePuzzleRow {
  id: string
  game_type: string
  solution_ref: string | null
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
    logError('get-daily-theme.auth_failed', err)
    await sentryCapture({ message: `get-daily-theme auth error: ${err}`, tags: { fn: 'get-daily-theme' } })
    return errorResponse('AUTH_ERROR', 'Authentication failed', 500)
  }

  // ─── Parse input ───────────────────────────────────────────────────────────
  let puzzleDate: string
  try {
    const url = new URL(req.url)
    if (req.method === 'GET') {
      puzzleDate = url.searchParams.get('puzzle_date') ?? ''
    } else {
      const body = await req.json()
      puzzleDate = body.puzzle_date ?? ''
    }
  } catch {
    return errorResponse('INVALID_INPUT', 'Invalid request body', 400)
  }

  if (!puzzleDate) {
    return errorResponse('MISSING_PARAMS', 'puzzle_date is required', 400)
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
    return errorResponse('INVALID_DATE', 'puzzle_date must be YYYY-MM-DD', 400)
  }

  const service = getServiceClient()

  try {
    // ─── 1. Tema satırı ──────────────────────────────────────────────────────
    const { data: themeData, error: themeError } = await service
      .from('daily_themes')
      .select('theme_type, theme_key, theme_label, game_types')
      .eq('theme_date', puzzleDate)
      .maybeSingle()

    if (themeError) {
      logError('get-daily-theme.theme_fetch_failed', themeError, { puzzleDate })
      await sentryCapture({
        message: `get-daily-theme theme fetch error: ${themeError.message}`,
        tags: { fn: 'get-daily-theme' },
      })
      return errorResponse('THEME_FETCH_FAILED', 'Could not load theme', 500)
    }

    const theme = themeData as ThemeRow | null
    if (!theme) {
      return jsonResponse({ state: 'none' }, 200, { 'Cache-Control': 'private, max-age=60' })
    }

    // ─── 2. Temaya gerçekten uyan bulmacalar ────────────────────────────────
    const { data: puzzleData, error: puzzleError } = await service
      .from('daily_puzzles')
      .select('id, game_type, solution_ref')
      .eq('date', puzzleDate)
      .eq('theme_matched', true)
      .eq('is_emergency_pool', false)

    if (puzzleError) {
      logError('get-daily-theme.puzzle_fetch_failed', puzzleError, { puzzleDate })
      await sentryCapture({
        message: `get-daily-theme puzzle fetch error: ${puzzleError.message}`,
        tags: { fn: 'get-daily-theme' },
      })
      return errorResponse('PUZZLE_FETCH_FAILED', 'Could not load theme puzzles', 500)
    }

    const puzzles = (puzzleData ?? []) as ThemePuzzleRow[]
    const total = puzzles.length

    if (total === 0) {
      // Tema satırı var ama eşleşen bulmaca yok (reconciliation bekliyor olabilir)
      return jsonResponse({ state: 'none' }, 200, { 'Cache-Control': 'private, max-age=60' })
    }

    // ─── 3. Kullanıcının tamamladıkları ─────────────────────────────────────
    const { data: scoreData, error: scoreError } = await service
      .from('game_scores')
      .select('puzzle_id, completed_at')
      .eq('user_id', userId)
      .in('puzzle_id', puzzles.map(p => p.id))
      .not('completed_at', 'is', null)

    if (scoreError) {
      logError('get-daily-theme.score_fetch_failed', scoreError, { userId, puzzleDate })
      await sentryCapture({
        message: `get-daily-theme score fetch error: ${scoreError.message}`,
        tags: { fn: 'get-daily-theme', user_id: userId },
      })
      return errorResponse('SCORE_FETCH_FAILED', 'Could not load progress', 500)
    }

    const completedIds = new Set(
      ((scoreData ?? []) as Array<{ puzzle_id: string }>).map(s => s.puzzle_id),
    )
    const completed = puzzles.filter(p => completedIds.has(p.id)).length

    // ─── 4. Kilitli: etiket GÖNDERİLMEZ ─────────────────────────────────────
    if (completed < total) {
      logInfo('get-daily-theme.locked', {
        user_id: userId, puzzle_date: puzzleDate, completed, total,
      })
      return jsonResponse(
        {
          state: 'locked',
          completed,
          total,
          game_types: puzzles.map(p => p.game_type),
        },
        200,
        { 'Cache-Control': 'private, max-age=60' },
      )
    }

    // ─── 5. Açık: etiket + tamamlanmış bulmacaların filmleri ────────────────
    const solutionIds = puzzles.map(p => p.solution_ref).filter((id): id is string => id != null)

    const { data: filmData, error: filmError } = await service
      .from('films')
      .select('id, title, year, poster_url')
      .in('id', solutionIds)

    if (filmError) {
      logError('get-daily-theme.film_fetch_failed', filmError, { puzzleDate })
      await sentryCapture({
        message: `get-daily-theme film fetch error: ${filmError.message}`,
        tags: { fn: 'get-daily-theme' },
      })
      return errorResponse('FILM_FETCH_FAILED', 'Could not load theme films', 500)
    }

    const filmById = new Map(
      ((filmData ?? []) as Array<{ id: string; title: string; year: number; poster_url: string | null }>)
        .map(f => [f.id, f]),
    )

    const films = puzzles
      .map(p => {
        const f = p.solution_ref ? filmById.get(p.solution_ref) : undefined
        if (!f) return null
        return {
          game_id: p.game_type,
          title: f.title,
          year: f.year,
          poster_url: f.poster_url,
        }
      })
      .filter((f): f is NonNullable<typeof f> => f != null)

    logInfo('get-daily-theme.unlocked', {
      user_id: userId,
      puzzle_date: puzzleDate,
      theme_type: theme.theme_type,
      total,
    })

    return jsonResponse(
      {
        state: 'unlocked',
        theme_type: theme.theme_type,
        theme_label: theme.theme_label,
        completed,
        total,
        films,
      },
      200,
      { 'Cache-Control': 'private, max-age=60' },
    )
  } catch (err) {
    logError('get-daily-theme.unhandled', err, { userId, puzzleDate })
    await sentryCapture({
      message: `get-daily-theme unhandled error: ${err}`,
      level: 'error',
      tags: { fn: 'get-daily-theme', user_id: userId },
    })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
