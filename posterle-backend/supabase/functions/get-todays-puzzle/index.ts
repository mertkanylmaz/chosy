// supabase/functions/get-todays-puzzle/index.ts
//
// Returns today's puzzle state for the authenticated user.
// - If no attempt exists, creates one (lazy initialization).
// - Returns puzzle poster URL, current attempt state, hints revealed so far.
// - SPOILER PROTECTION: film title/year/etc only returned if game completed.

import {
  handleCors,
  jsonResponse,
  errorResponse,
  getUserClient,
  getServiceClient,
  requireUser,
  AuthError,
  logInfo,
  logError,
} from '../_shared/utils.ts'
import { getPixelationLevel } from '../_shared/hints.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use GET or POST', 405)
  }

  let userId: string
  try {
    const userClient = getUserClient(req)
    const user = await requireUser(userClient)
    userId = user.id
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse('UNAUTHORIZED', err.message, 401)
    }
    logError('today.auth_failed', err)
    return errorResponse('AUTH_ERROR', 'Authentication failed', 500)
  }

  // Use service client to bypass RLS for cross-table reads
  const service = getServiceClient()

  const today = new Date().toISOString().split('T')[0]

  try {
    // 1. Fetch today's puzzle (must exist, curated previous night)
    const { data: puzzle, error: puzzleError } = await service
      .from('daily_puzzles')
      .select(
        `
        id,
        puzzle_date,
        difficulty_tier,
        film_id,
        films!inner (
          id,
          poster_url,
          title,
          original_title,
          release_date,
          runtime,
          director,
          genres,
          cast,
          mood_tags,
          vote_average,
          plot
        )
      `
      )
      .eq('puzzle_date', today)
      .maybeSingle()

    if (puzzleError) {
      logError('today.puzzle_fetch_failed', puzzleError, { user_id: userId })
      return errorResponse('PUZZLE_FETCH_FAILED', 'Could not load puzzle', 500)
    }

    if (!puzzle) {
      logError('today.no_puzzle_for_date', null, { date: today })
      return errorResponse(
        'NO_PUZZLE',
        'Today has no curated puzzle. Curation may have failed.',
        503
      )
    }

    const film = (puzzle.films as unknown) as {
      id: number
      poster_url: string
      title: string
      original_title: string | null
      release_date: string | null
      runtime: number | null
      director: string | null
      genres: string[] | null
      cast: string[] | null
      mood_tags: string[] | null
      vote_average: number | null
      plot: string | null
    }

    // 2. Fetch or lazily create user's attempt
    const { data: existingAttempt, error: attemptError } = await service
      .from('puzzle_attempts')
      .select('id, attempts_used, guesses, result, won_on_attempt, started_at, completed_at')
      .eq('user_id', userId)
      .eq('puzzle_id', puzzle.id)
      .maybeSingle()

    if (attemptError) {
      logError('today.attempt_fetch_failed', attemptError, { user_id: userId })
      return errorResponse('ATTEMPT_FETCH_FAILED', 'Could not load attempt', 500)
    }

    let attempt = existingAttempt
    if (!attempt) {
      // Get archetype snapshot
      const { data: userData } = await service
        .from('users')
        .select('archetype')
        .eq('id', userId)
        .maybeSingle()

      const { data: created, error: createError } = await service
        .from('puzzle_attempts')
        .insert({
          user_id: userId,
          puzzle_id: puzzle.id,
          archetype_at_time: userData?.archetype ?? null,
        })
        .select('id, attempts_used, guesses, result, won_on_attempt, started_at, completed_at')
        .single()

      if (createError) {
        // Race: another concurrent request may have created the attempt.
        if (createError.code === '23505') {
          const { data: refetched } = await service
            .from('puzzle_attempts')
            .select(
              'id, attempts_used, guesses, result, won_on_attempt, started_at, completed_at'
            )
            .eq('user_id', userId)
            .eq('puzzle_id', puzzle.id)
            .single()
          attempt = refetched
        } else {
          logError('today.attempt_create_failed', createError, { user_id: userId })
          return errorResponse('ATTEMPT_CREATE_FAILED', 'Could not create attempt', 500)
        }
      } else {
        attempt = created
      }
    }

    if (!attempt) {
      logError('today.attempt_resolution_failed', null, { user_id: userId })
      return errorResponse('ATTEMPT_RESOLUTION_FAILED', 'Could not resolve attempt', 500)
    }

    // 3. Fetch user's streak (optional, may not exist for first-time players)
    const { data: streak } = await service
      .from('puzzle_streaks')
      .select('current_streak, longest_streak, freeze_tokens, total_wins')
      .eq('user_id', userId)
      .maybeSingle()

    // 4. Fetch hints revealed so far
    const { data: hints } = await service
      .from('puzzle_hint_reveals')
      .select('attempt_number, hint_type, hint_value')
      .eq('attempt_id', attempt.id)
      .order('attempt_number', { ascending: true })

    // 5. Build response — spoiler-safe
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
        guesses: attempt.guesses, // contains only user's own guess strings, not the answer
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
        title: film.title,
        original_title: film.original_title,
        release_year: film.release_date
          ? new Date(film.release_date).getFullYear()
          : null,
        runtime: film.runtime,
        director: film.director,
        genres: film.genres,
        cast: film.cast,
        mood_tags: film.mood_tags,
        vote_average: film.vote_average,
        plot: film.plot,
      }
    }

    logInfo('today.served', {
      user_id: userId,
      attempt_id: attempt.id,
      attempts_used: attempt.attempts_used,
      result: attempt.result,
    })

    return jsonResponse(responsePayload)
  } catch (err) {
    logError('today.unhandled', err, { user_id: userId })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
