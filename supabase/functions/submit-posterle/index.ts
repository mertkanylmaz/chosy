// supabase/functions/submit-posterle/index.ts
//
// Validates a user's guess against today's posterle puzzle.
// - Atomic: optimistic concurrency on attempts_used
// - Idempotent guard: rejects if attempt already completed
// - Spoiler-safe: only reveals film data on win/loss
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
  isTitleMatch,
  normalizeTitle,
  AuthError,
  logInfo,
  logError,
  FILM_SELECT_COLUMNS,
  type FilmRow,
} from '../_shared/posterleUtils.ts'
import {
  getHintForAttempt,
  getPixelationLevel,
  type FilmHintContext,
  type Archetype,
} from '../_shared/posterleHints.ts'

interface GuessRequest {
  puzzle_date?: string
  guess_film_id?: string | null // UUID in our schema
  guess_text?: string | null
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use POST', 405)
  }

  // --- Auth ---
  let appUserId: string
  try {
    const userClient = getUserClient(req)
    const { authUid } = await requireAuthUser(userClient)
    const service = getServiceClient()
    const appUser = await resolveAppUser(service, authUid)
    appUserId = appUser.id
  } catch (err) {
    if (err instanceof AuthError) {
      return errorResponse('UNAUTHORIZED', err.message, 401)
    }
    logError('submit.auth_failed', err)
    return errorResponse('AUTH_ERROR', 'Authentication failed', 500)
  }

  // --- Parse body ---
  let body: GuessRequest
  try {
    body = await req.json()
  } catch {
    return errorResponse('INVALID_BODY', 'Body must be JSON', 400)
  }

  if (!body.guess_film_id && !body.guess_text?.trim()) {
    return errorResponse('MISSING_GUESS', 'Provide guess_film_id or guess_text', 400)
  }

  if (body.guess_text && body.guess_text.length > 200) {
    return errorResponse('GUESS_TOO_LONG', 'Guess must be 200 chars max', 400)
  }

  const puzzleDate = body.puzzle_date ?? new Date().toISOString().split('T')[0]

  const service = getServiceClient()

  try {
    // --- Fetch puzzle + film ---
    const { data: puzzle, error: puzzleError } = await service
      .from('posterle_puzzles')
      .select(`
        id,
        puzzle_date,
        film_id,
        films!inner (${FILM_SELECT_COLUMNS})
      `)
      .eq('puzzle_date', puzzleDate)
      .maybeSingle()

    if (puzzleError) {
      logError('submit.puzzle_fetch_failed', puzzleError, { user_id: appUserId })
      return errorResponse('PUZZLE_FETCH_FAILED', 'Could not load puzzle', 500)
    }

    if (!puzzle) {
      return errorResponse('NO_PUZZLE', `No puzzle for ${puzzleDate}`, 404)
    }

    const filmRow = puzzle.films as unknown as FilmRow
    const film = normalizeFilm(filmRow)

    // --- Fetch attempt ---
    const { data: attempt, error: attemptError } = await service
      .from('posterle_attempts')
      .select('id, attempts_used, guesses, result, won_on_attempt, archetype_at_time')
      .eq('user_id', appUserId)
      .eq('puzzle_id', puzzle.id)
      .maybeSingle()

    if (attemptError) {
      logError('submit.attempt_fetch_failed', attemptError, { user_id: appUserId })
      return errorResponse('ATTEMPT_FETCH_FAILED', 'Could not load attempt', 500)
    }

    if (!attempt) {
      return errorResponse(
        'NO_ATTEMPT',
        'No attempt exists. Call get-posterle first.',
        404
      )
    }

    if (attempt.result !== 'in_progress') {
      return errorResponse(
        'ALREADY_COMPLETED',
        `Puzzle already ${attempt.result}`,
        400,
        { attempt }
      )
    }

    if (attempt.attempts_used >= 6) {
      return errorResponse('NO_ATTEMPTS_LEFT', 'All attempts used', 400)
    }

    // --- Validate guess ---
    let isCorrect = false
    let resolvedGuessText = body.guess_text ?? ''

    if (body.guess_film_id != null) {
      // UUID comparison
      isCorrect = body.guess_film_id === puzzle.film_id
      if (!resolvedGuessText) {
        const { data: guessedFilm } = await service
          .from('films')
          .select('title')
          .eq('id', body.guess_film_id)
          .maybeSingle()
        resolvedGuessText = guessedFilm?.title ?? `film_id:${body.guess_film_id}`
      }
    } else if (body.guess_text) {
      isCorrect = isTitleMatch(body.guess_text, film)
    }

    const newAttemptsUsed = attempt.attempts_used + 1
    const newGuess = {
      guess: resolvedGuessText,
      normalized: normalizeTitle(resolvedGuessText),
      film_id: body.guess_film_id ?? null,
      correct: isCorrect,
      attempt_number: newAttemptsUsed,
      timestamp: new Date().toISOString(),
    }
    const newGuesses = [...(attempt.guesses as unknown[]), newGuess]

    let result: 'in_progress' | 'won' | 'lost' = 'in_progress'
    let wonOnAttempt: number | null = null
    let completedAt: string | null = null

    if (isCorrect) {
      result = 'won'
      wonOnAttempt = newAttemptsUsed
      completedAt = new Date().toISOString()
    } else if (newAttemptsUsed >= 6) {
      result = 'lost'
      completedAt = new Date().toISOString()
    }

    // --- Optimistic concurrency update ---
    const { data: updated, error: updateError } = await service
      .from('posterle_attempts')
      .update({
        attempts_used: newAttemptsUsed,
        guesses: newGuesses,
        result,
        won_on_attempt: wonOnAttempt,
        completed_at: completedAt,
      })
      .eq('id', attempt.id)
      .eq('attempts_used', attempt.attempts_used) // version check
      .select('id, attempts_used, result, won_on_attempt')
      .maybeSingle()

    if (updateError || !updated) {
      logError('submit.update_conflict', updateError, {
        user_id: appUserId,
        attempt_id: attempt.id,
      })
      return errorResponse(
        'UPDATE_CONFLICT',
        'Concurrent update detected. Please retry.',
        409
      )
    }

    // --- Build hint (if game continues) ---
    let hintForResponse: { type: string; value: string } | null = null

    if (result === 'in_progress' && newAttemptsUsed >= 1) {
      const hintContext: FilmHintContext = {
        title: film.title,
        genres: film.genres,
        year: film.year,
        director: film.director,
        cast: film.cast,
        overview: film.overview,
        runtime: film.runtime,
        vote_average: film.vote_average,
        original_language: film.original_language,
      }

      const archetypeStr = (attempt.archetype_at_time as Archetype) ?? 'default'
      const hint = getHintForAttempt(newAttemptsUsed + 1, archetypeStr, hintContext)

      if (hint) {
        hintForResponse = { type: hint.type, value: hint.value }
        // Fire-and-forget hint recording
        service
          .rpc('record_posterle_hint', {
            p_attempt_id: attempt.id,
            p_attempt_number: newAttemptsUsed,
            p_hint_type: hint.type,
            p_hint_value: hint.value,
          })
          .then(({ error }) => {
            if (error) logError('submit.hint_record_failed', error)
          })
      }
    }

    // --- Update streak if game ended ---
    let updatedStreak: Record<string, unknown> | null = null
    if (result !== 'in_progress') {
      const { data: streakData, error: streakError } = await service.rpc(
        'update_posterle_streak',
        {
          p_user_id: appUserId,
          p_won: result === 'won',
          p_puzzle_date: puzzleDate,
          p_archetype: attempt.archetype_at_time,
        }
      )

      if (streakError) {
        logError('submit.streak_update_failed', streakError, { user_id: appUserId })
      } else if (streakData) {
        updatedStreak = streakData as Record<string, unknown>
      }
    }

    // --- Response ---
    const response: Record<string, unknown> = {
      correct: isCorrect,
      result,
      attempts_used: newAttemptsUsed,
      attempts_remaining: 6 - newAttemptsUsed,
      pixelation_level: getPixelationLevel(newAttemptsUsed),
      hint: hintForResponse,
    }

    if (result !== 'in_progress') {
      response.film = {
        id: film.id,
        tmdb_id: film.tmdb_id,
        title: film.title,
        original_title: film.original_title,
        poster_url: film.poster_url,
        year: film.year,
        runtime: film.runtime,
        director: film.director,
        genres: film.genres,
        cast: film.cast,
        vote_average: film.vote_average,
        overview: film.overview,
      }
      response.streak = updatedStreak
    }

    logInfo('submit.processed', {
      user_id: appUserId,
      attempt_id: attempt.id,
      attempts_used: newAttemptsUsed,
      result,
      correct: isCorrect,
    })

    return jsonResponse(response)
  } catch (err) {
    logError('submit.unhandled', err, { user_id: appUserId })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
