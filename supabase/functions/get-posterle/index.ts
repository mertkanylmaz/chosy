// supabase/functions/get-posterle/index.ts
//
// Returns today's posterle puzzle state for the authenticated user.
// - Lazy-creates attempt if none exists.
// - SPOILER PROTECTION: film details only returned if game completed.
//
// Adapted for MoodFlix schema:
// - films.id UUID, users.auth_id mapping
// - posterle_* tables, actual column names

import {
  handleCors,
  jsonResponse,
  errorResponse,
  getUserClient,
  getServiceClient,
  requireAuthUser,
  resolveAppUser,
  normalizeFilm,
  AuthError,
  logInfo,
  logError,
  FILM_SELECT_COLUMNS,
  type FilmRow,
} from '../_shared/posterleUtils.ts'
import { getPixelationLevel } from '../_shared/posterleHints.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use GET or POST', 405)
  }

  let appUserId: string
  let archetype: string | null = null

  try {
    const userClient = getUserClient(req)
    const { authUid } = await requireAuthUser(userClient)
    const service = getServiceClient()
    const appUser = await resolveAppUser(service, authUid)
    appUserId = appUser.id
    archetype = appUser.archetype
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse('UNAUTHORIZED', err.message, 401)
    }
    logError('today.auth_failed', err)
    return errorResponse('AUTH_ERROR', 'Authentication failed', 500)
  }

  const service = getServiceClient()
  const today = new Date().toISOString().split('T')[0]

  try {
    // 1. Fetch today's puzzle with film data
    const { data: puzzle, error: puzzleError } = await service
      .from('posterle_puzzles')
      .select(`
        id,
        puzzle_date,
        difficulty_tier,
        film_id,
        films!inner (${FILM_SELECT_COLUMNS})
      `)
      .eq('puzzle_date', today)
      .maybeSingle()

    if (puzzleError) {
      logError('today.puzzle_fetch_failed', puzzleError, { user_id: appUserId })
      return errorResponse('PUZZLE_FETCH_FAILED', 'Could not load puzzle', 500)
    }

    if (!puzzle) {
      logError('today.no_puzzle', null, { date: today })
      return errorResponse(
        'NO_PUZZLE',
        'No puzzle for today. Curation may have failed.',
        503
      )
    }

    const filmRow = puzzle.films as unknown as FilmRow
    const film = normalizeFilm(filmRow)

    // 2. Fetch or lazily create user's attempt
    const { data: existingAttempt, error: attemptError } = await service
      .from('posterle_attempts')
      .select('id, attempts_used, guesses, result, won_on_attempt, started_at, completed_at')
      .eq('user_id', appUserId)
      .eq('puzzle_id', puzzle.id)
      .maybeSingle()

    if (attemptError) {
      logError('today.attempt_fetch_failed', attemptError, { user_id: appUserId })
      return errorResponse('ATTEMPT_FETCH_FAILED', 'Could not load attempt', 500)
    }

    let attempt = existingAttempt
    if (!attempt) {
      const { data: created, error: createError } = await service
        .from('posterle_attempts')
        .insert({
          user_id: appUserId,
          puzzle_id: puzzle.id,
          archetype_at_time: archetype,
        })
        .select('id, attempts_used, guesses, result, won_on_attempt, started_at, completed_at')
        .single()

      if (createError) {
        // Race: concurrent request created the attempt
        if (createError.code === '23505') {
          const { data: refetched } = await service
            .from('posterle_attempts')
            .select('id, attempts_used, guesses, result, won_on_attempt, started_at, completed_at')
            .eq('user_id', appUserId)
            .eq('puzzle_id', puzzle.id)
            .single()
          attempt = refetched
        } else {
          logError('today.attempt_create_failed', createError, { user_id: appUserId })
          return errorResponse('ATTEMPT_CREATE_FAILED', 'Could not create attempt', 500)
        }
      } else {
        attempt = created
      }
    }

    if (!attempt) {
      logError('today.attempt_resolution_failed', null, { user_id: appUserId })
      return errorResponse('ATTEMPT_RESOLUTION_FAILED', 'Could not resolve attempt', 500)
    }

    // 3. Fetch streak
    const { data: streak } = await service
      .from('posterle_streaks')
      .select('current_streak, longest_streak, freeze_tokens, total_wins')
      .eq('user_id', appUserId)
      .maybeSingle()

    // 4. Fetch hints revealed so far
    const { data: hints } = await service
      .from('posterle_hint_reveals')
      .select('attempt_number, hint_type, hint_value')
      .eq('attempt_id', attempt.id)
      .order('attempt_number', { ascending: true })

    // 5. Build spoiler-safe response
    const isComplete = attempt.result !== 'in_progress'

    const responsePayload: Record<string, unknown> = {
      puzzle: {
        date: puzzle.puzzle_date,
        difficulty: puzzle.difficulty_tier,
        poster_url: film.poster_url,
        pixelation_level: getPixelationLevel(attempt.attempts_used),
      },
      attempt: {
        attempts_used: attempt.attempts_used,
        attempts_remaining: 6 - attempt.attempts_used,
        result: attempt.result,
        won_on_attempt: attempt.won_on_attempt,
        guesses: attempt.guesses,
      },
      hints: hints ?? [],
      streak: streak ?? {
        current_streak: 0,
        longest_streak: 0,
        freeze_tokens: 0,
        total_wins: 0,
      },
    }

    // Only reveal film details if game is complete
    if (isComplete) {
      responsePayload.film = {
        id: film.id,
        tmdb_id: film.tmdb_id,
        title: film.title,
        original_title: film.original_title,
        year: film.year,
        runtime: film.runtime,
        director: film.director,
        genres: film.genres,
        cast: film.cast,
        vote_average: film.vote_average,
        overview: film.overview,
      }
    }

    logInfo('today.served', {
      user_id: appUserId,
      attempt_id: attempt.id,
      attempts_used: attempt.attempts_used,
      result: attempt.result,
    })

    return jsonResponse(responsePayload)
  } catch (err) {
    logError('today.unhandled', err, { user_id: appUserId })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
