/**
 * get-daily-challenge — Returns today's puzzle for the authenticated user.
 *
 * Reads ONLY from public_daily_puzzles view (solution-safe).
 * Returns puzzle data + user progress + puzzle_no.
 * solution_ref / film_id / redaction_words NEVER appear in the response.
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
  getAppConfig,
  logInfo,
  logError,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import { buildWhyThisMovie, type WhyThisMovieText } from '../_shared/whyThisMovie.ts'

/** Imposter güven bahsi config'i (app_config: imposter_confidence_config) */
interface ImposterConfidenceConfig {
  levels: number[]
  correct_factor: Record<string, number>
  wrong_factor: Record<string, number>
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
    logError('get-daily-challenge.auth_failed', err)
    await sentryCapture({ message: `get-daily-challenge auth error: ${err}`, tags: { fn: 'get-daily-challenge' } })
    return errorResponse('AUTH_ERROR', 'Authentication failed', 500)
  }

  // ─── Parse input ───────────────────────────────────────────────────────────
  let gameId: string
  let puzzleDate: string

  try {
    const url = new URL(req.url)
    if (req.method === 'GET') {
      gameId = url.searchParams.get('game_id') ?? ''
      puzzleDate = url.searchParams.get('puzzle_date') ?? ''
    } else {
      const body = await req.json()
      gameId = body.game_id ?? ''
      puzzleDate = body.puzzle_date ?? ''
    }
  } catch {
    return errorResponse('INVALID_INPUT', 'Invalid request body', 400)
  }

  if (!gameId || !puzzleDate) {
    return errorResponse('MISSING_PARAMS', 'game_id and puzzle_date are required', 400)
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) {
    return errorResponse('INVALID_DATE', 'puzzle_date must be YYYY-MM-DD', 400)
  }

  const service = getServiceClient()

  try {
    // ─── 1. Fetch puzzle from secure view ──────────────────────────────────
    const { data: puzzle, error: puzzleError } = await service
      .from('public_daily_puzzles')
      .select('*')
      .eq('game_id', gameId)
      .eq('puzzle_date', puzzleDate)
      .single()

    if (puzzleError || !puzzle) {
      logError('get-daily-challenge.no_puzzle', puzzleError, { gameId, puzzleDate })
      return errorResponse(
        'NO_PUZZLE',
        "Bugünün bulmacası henüz hazır değil / Today's puzzle is not ready yet",
        404,
      )
    }

    // ─── 2. Fetch user progress ────────────────────────────────────────────
    const { data: scoreRow, error: scoreError } = await service
      .from('game_scores')
      .select('progress_json, solved, attempts, xp_awarded, completed_at')
      .eq('user_id', userId)
      .eq('puzzle_id', puzzle.id)
      .maybeSingle()

    if (scoreError) {
      logError('get-daily-challenge.score_fetch_failed', scoreError, { userId })
      await sentryCapture({
        message: `get-daily-challenge score fetch error: ${scoreError.message}`,
        tags: { fn: 'get-daily-challenge', user_id: userId },
      })
      return errorResponse('SCORE_FETCH_FAILED', 'Could not load progress', 500)
    }

    // ─── 3. Calculate puzzle_no ────────────────────────────────────────────
    const { count, error: countError } = await service
      .from('daily_puzzles')
      .select('id', { count: 'exact', head: true })
      .eq('game_type', gameId)
      .lte('date', puzzleDate)
      .eq('is_emergency_pool', false)

    if (countError) {
      logError('get-daily-challenge.count_failed', countError, { gameId, puzzleDate })
      // Non-fatal: continue with puzzle_no = 0
    }

    const puzzleNo = count ?? 0

    // ─── 4. Build response ─────────────────────────────────────────────────
    const progressJson = scoreRow?.progress_json
    const progress = scoreRow
      ? {
          guesses: progressJson?.guesses ?? [],
          completed: scoreRow.completed_at != null,
          won: scoreRow.solved ?? false,
          turns_played: progressJson?.turns_played,
          eliminated_ids: progressJson?.eliminated_ids,
          spotlight_guesses: progressJson?.spotlight_guesses,
          // Detective-specific fields
          stage: progressJson?.stage,
          stage1_guesses: progressJson?.stage1_guesses,
          timer_start_ms: progressJson?.timer_start_ms,
          total_guesses: progressJson?.total_guesses,
          hints_used: progressJson?.hints_used,
          // FadeIn — oyuncunun seçerek açtığı ipuçları (resume için)
          revealed_hints: progressJson?.revealed_hints,
          // Imposter V2 — oynanmış round'lar (resume için).
          // correct_ids/selected_ids KASITLI olarak çıkarıldı: istemcinin
          // devam etmek için yalnızca sonuç özetine ihtiyacı var.
          imposter_rounds: (progressJson?.imposter_rounds as
            | Array<{ round: number; correct: boolean; confidence?: number }>
            | undefined)?.map((r) => ({
            round: r.round,
            correct: r.correct,
            confidence: r.confidence,
          })),
        }
      : null

    // ─── 4a. Çözüm / ipucu içeriği — YALNIZCA hak edilmişse ───────────────
    // Migration 064'ten sonra film adı, poster ve ipucu içeriği view'dan
    // çıkmıyor (Hard Rule 1). İstemcinin tamamlanmış oyunu yeniden açtığında
    // sonucu gösterebilmesi için çözüm buradan, sunucu kontrolüyle döner.
    let revealedSolution: {
      film_id: string
      title: string
      year: number
      director: string | null
      poster_url: string | null
    } | null = null

    let revealedHintContents: Array<{ order: number; type: string; content: string }> | null = null
    let whyThisMovie: WhyThisMovieText | null = null

    const isCompleted = scoreRow?.completed_at != null
    const needsSolution = isCompleted
    const revealedOrders = (progressJson?.revealed_hints as number[] | undefined) ?? []
    const needsHints = gameId === 'fadein' && revealedOrders.length > 0

    if (needsSolution || needsHints) {
      const { data: fullPuzzle, error: fullPuzzleError } = await service
        .from('daily_puzzles')
        .select('solution_ref, puzzle_data')
        .eq('id', puzzle.id)
        .single()

      if (fullPuzzleError) {
        logError('get-daily-challenge.solution_fetch_failed', fullPuzzleError, { puzzleId: puzzle.id })
        await sentryCapture({
          message: `get-daily-challenge solution fetch error: ${fullPuzzleError.message}`,
          tags: { fn: 'get-daily-challenge', game_id: gameId },
        })
        return errorResponse('SOLUTION_FETCH_FAILED', 'Could not load puzzle state', 500)
      }

      if (needsSolution && fullPuzzle?.solution_ref) {
        const { data: film, error: filmError } = await service
          .from('films')
          .select('title, year, director, poster_url, genres, runtime, vote_average, metadata_json')
          .eq('id', fullPuzzle.solution_ref)
          .single()

        if (filmError) {
          logError('get-daily-challenge.film_fetch_failed', filmError, { puzzleId: puzzle.id })
          await sentryCapture({
            message: `get-daily-challenge film fetch error: ${filmError.message}`,
            tags: { fn: 'get-daily-challenge', game_id: gameId },
          })
          return errorResponse('SOLUTION_FETCH_FAILED', 'Could not load solution', 500)
        }

        revealedSolution = {
          film_id: fullPuzzle.solution_ref,
          title: film.title,
          year: film.year,
          director: film.director ?? null,
          poster_url: film.poster_url ?? null,
        }
        whyThisMovie = buildWhyThisMovie(film)
      }

      if (needsHints) {
        const hints =
          (fullPuzzle?.puzzle_data?.hints as
            | Array<{ order: number; type?: string; content?: string }>
            | undefined) ?? []
        revealedHintContents = hints
          .filter(h => revealedOrders.includes(h.order))
          .map(h => ({ order: h.order, type: h.type ?? 'unknown', content: h.content ?? '' }))
      }
    }

    // ─── 4b. Community stats for completed detective games ───────────────
    let communityStats = null
    if (gameId === 'detective' && progress?.completed) {
      try {
        // Get distribution
        const { data: distData } = await service.rpc('detective_distribution', {
          p_puzzle_date: puzzleDate,
        })
        // Get percentile
        const detScore = scoreRow?.progress_json?.detective_score ??
          (await service
            .from('game_scores')
            .select('detective_score')
            .eq('user_id', userId)
            .eq('puzzle_id', puzzle.id)
            .single()
          ).data?.detective_score ?? 0

        const { data: pctData } = await service.rpc('detective_percentile', {
          p_puzzle_date: puzzleDate,
          p_score: detScore,
        })

        // Count total
        const { count: totalCount } = await service
          .from('game_scores')
          .select('id', { count: 'exact', head: true })
          .eq('puzzle_id', puzzle.id)
          .not('completed_at', 'is', null)

        communityStats = {
          distribution: distData ?? {},
          total_players: totalCount ?? 0,
          percentile: Math.round(pctData ?? 50),
        }
      } catch (err) {
        logError('get-daily-challenge.community_stats_failed', err, { puzzleDate })
        // Non-fatal: continue without community stats
      }
    }

    // ─── 4c. Imposter güven bahsi config'i ────────────────────────────────
    // İstemci seçeneklerini ve çarpan önizlemesini buradan çizer — böylece
    // app_config tune edildiğinde UI ile sunucu ayrışmaz. Skorlamada yetki
    // yine sunucudadır; bu yalnızca gösterim içindir.
    let confidenceConfig: ImposterConfidenceConfig | null = null
    if (gameId === 'imposter') {
      try {
        confidenceConfig = await getAppConfig<ImposterConfidenceConfig>(
          service,
          'imposter_confidence_config',
        )
      } catch (err) {
        logError('get-daily-challenge.confidence_config_failed', err, { gameId })
        await sentryCapture({
          message: 'imposter_confidence_config missing — client will hide the bet selector',
          level: 'error',
          tags: { fn: 'get-daily-challenge', game_id: gameId },
        })
        // Non-fatal: istemci seçiciyi gizler, sunucu nötr çarpan uygular
      }
    }

    const response = {
      puzzle: {
        id: puzzle.id,
        game_id: puzzle.game_id,
        puzzle_date: puzzle.puzzle_date,
        difficulty: puzzle.difficulty,
        puzzle_data: puzzle.puzzle_data,
        max_attempts: puzzle.max_attempts,
      },
      progress,
      puzzle_no: puzzleNo,
      // Yalnızca oyun tamamlanmışsa
      ...(revealedSolution ? { revealed_solution: revealedSolution } : {}),
      ...(whyThisMovie ? { why_this_movie: whyThisMovie } : {}),
      // FadeIn — açılmış ipuçlarının içeriği (resume)
      ...(revealedHintContents ? { revealed_hint_contents: revealedHintContents } : {}),
      // Detective-only
      ...(communityStats ? { community_stats: communityStats } : {}),
      // Imposter-only
      ...(confidenceConfig ? { confidence_config: confidenceConfig } : {}),
    }

    logInfo('get-daily-challenge.served', {
      user_id: userId,
      game_id: gameId,
      puzzle_date: puzzleDate,
      puzzle_no: puzzleNo,
      has_progress: progress !== null,
    })

    return jsonResponse(response, 200, {
      'Cache-Control': 'private, max-age=300',
    })
  } catch (err) {
    logError('get-daily-challenge.unhandled', err, { userId })
    await sentryCapture({
      message: `get-daily-challenge unhandled error: ${err}`,
      level: 'error',
      tags: { fn: 'get-daily-challenge', user_id: userId },
    })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
