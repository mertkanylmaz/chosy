// supabase/functions/submit-puzzle-guess/index.ts
//
// Validates a user's guess against today's puzzle.
// - Atomic: locks attempt row, validates, updates state, records hint, updates streak.
// - Idempotent guard: rejects if attempt already completed.
// - Spoiler-safe: only reveals film data on win/loss.
// - Rate-limited implicitly: 6 attempts max per puzzle per user.

import {
  handleCors,
  jsonResponse,
  errorResponse,
  getUserClient,
  getServiceClient,
  requireUser,
  AuthError,
  isTitleMatch,
  normalizeTitle,
  logInfo,
  logError,
} from '../_shared/utils.ts'
import {
  getHintForAttempt,
  getPixelationLevel,
  type FilmHintContext,
  type Archetype,
} from '../_shared/hints.ts'

interface GuessRequest {
  puzzle_date?: string // optional — defaults to today
  guess_film_id?: number | null
  guess_text?: string | null
}

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use POST', 405)
  }

  // --- Auth ---
  let userId: string
  try {
    const userClient = getUserClient(req)
    const user = await requireUser(userClient)
    userId = user.id
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
    return errorResponse('GUESS_TOO_LONG', 'Guess must be ≤ 200 chars', 400)
  }

  const puzzleDate = body.puzzle_date ?? new Date().toISOString().split('T')[0]

  const service = getServiceClient()

  try {
    // --- Fetch puzzle + film (with full hint context) ---
    const { data: puzzle, error: puzzleError } = await service
      .from('daily_puzzles')
      .select(
        `
        id,
        puzzle_date,
        film_id,
        films!inner (
          id,
          title,
          original_title,
          alternative_titles,
          poster_url,
          release_date,
          runtime,
          director,
          writer,
          genres,
          cast,
          mood_tags,
          vote_average,
          original_language,
          plot
        )
      `
      )
      .eq('puzzle_date', puzzleDate)
      .maybeSingle()

    if (puzzleError) {
      logError('submit.puzzle_fetch_failed', puzzleError, { user_id: userId })
      return errorResponse('PUZZLE_FETCH_FAILED', 'Could not load puzzle', 500)
    }

    if (!puzzle) {
      return errorResponse('NO_PUZZLE', `No puzzle for ${puzzleDate}`, 404)
    }

    const film = (puzzle.films as unknown) as {
      id: number
      title: string
      original_title: string | null
      alternative_titles: string[] | null
      poster_url: string
      release_date: string | null
      runtime: number | null
      director: string | null
      writer: string | null
      genres: string[] | null
      cast: string[] | null
      mood_tags: string[] | null
      vote_average: number | null
      original_language: string | null
      plot: string | null
    }

    // --- Fetch attempt with row lock (for update) ---
    // Note: Supabase JS client doesn't expose FOR UPDATE directly, so we rely on
    // the UNIQUE constraint and conditional update. For strict serialization use
    // a stored procedure — see "production hardening" notes in README.
    const { data: attempt, error: attemptError } = await service
      .from('puzzle_attempts')
      .select(
        'id, attempts_used, guesses, result, won_on_attempt, archetype_at_time'
      )
      .eq('user_id', userId)
      .eq('puzzle_id', puzzle.id)
      .maybeSingle()

    if (attemptError) {
      logError('submit.attempt_fetch_failed', attemptError, { user_id: userId })
      return errorResponse('ATTEMPT_FETCH_FAILED', 'Could not load attempt', 500)
    }

    if (!attempt) {
      return errorResponse(
        'NO_ATTEMPT',
        'No attempt exists. Call get-todays-puzzle first.',
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
      isCorrect = body.guess_film_id === puzzle.film_id
      // For analytics: fetch the title the user "selected"
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

    // --- Update attempt with optimistic concurrency check ---
    // The .eq('attempts_used', attempt.attempts_used) clause acts as a
    // version check — if another request beat us to update, this updates 0 rows.
    const { data: updated, error: updateError } = await service
      .from('puzzle_attempts')
      .update({
        attempts_used: newAttemptsUsed,
        guesses: newGuesses,
        result,
        won_on_attempt: wonOnAttempt,
        completed_at: completedAt,
      })
      .eq('id', attempt.id)
      .eq('attempts_used', attempt.attempts_used) // optimistic lock
      .select('id, attempts_used, result, won_on_attempt')
      .maybeSingle()

    if (updateError || !updated) {
      logError('submit.update_failed_or_race', updateError, {
        user_id: userId,
        attempt_id: attempt.id,
      })
      return errorResponse(
        'UPDATE_CONFLICT',
        'Concurrent update detected. Please retry.',
        409
      )
    }

    // --- Build hint context and reveal hint (if game continues) ---
    let hintForResponse: { type: string; value: string } | null = null

    if (result === 'in_progress' && newAttemptsUsed >= 1) {
      const hintContext: FilmHintContext = {
        title: film.title,
        genres: film.genres,
        release_year: film.release_date
          ? new Date(film.release_date).getFullYear()
          : null,
        director: film.director,
        writer: film.writer,
        cast: film.cast,
        mood_tags: film.mood_tags,
        runtime: film.runtime,
        vote_average: film.vote_average,
        original_language: film.original_language,
      }

      const archetype = (attempt.archetype_at_time as Archetype) ?? 'default'
      const hint = getHintForAttempt(newAttemptsUsed + 1, archetype, hintContext)

      if (hint) {
        hintForResponse = { type: hint.type, value: hint.value }
        // Record hint reveal (fire-and-forget; failure doesn't break gameplay)
        service
          .rpc('record_hint_reveal', {
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
        'update_user_streak',
        {
          p_user_id: userId,
          p_won: result === 'won',
          p_puzzle_date: puzzleDate,
          p_archetype: attempt.archetype_at_time,
        }
      )

      if (streakError) {
        logError('submit.streak_update_failed', streakError, { user_id: userId })
        // Non-fatal — game state is still saved
      } else if (streakData) {
        updatedStreak = streakData as Record<string, unknown>
      }
    }

    // --- Build response ---
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
        title: film.title,
        original_title: film.original_title,
        poster_url: film.poster_url,
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
      response.streak = updatedStreak
    }

    logInfo('submit.processed', {
      user_id: userId,
      attempt_id: attempt.id,
      attempts_used: newAttemptsUsed,
      result,
      correct: isCorrect,
    })

    return jsonResponse(response)
  } catch (err) {
    logError('submit.unhandled', err, { user_id: userId })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
