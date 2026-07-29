/**
 * submit-guess — Validates a film guess for a daily puzzle.
 *
 * Handles: rate limiting, feedback calculation, XP/DNA scoring.
 * solution_ref / film_id / redaction_words NEVER appear in the response.
 *
 * Hard rules enforced:
 * - Solution stays server-side only
 * - Game state lives in game_scores.progress_json (single source of truth)
 * - DNA/score writes via Edge Function only
 * - Config read lazily from app_config
 */

import {
  handleCors,
  jsonResponse,
  errorResponse,
  getUserClient,
  getServiceClient,
  requireAuthUser,
  resolveAppUser,
  getAppConfig,
  AuthError,
  logInfo,
  logError,
} from '../_shared/gameUtils.ts'
import { sentryCapture } from '../_shared/sentry.ts'
import { buildWhyThisMovie } from '../_shared/whyThisMovie.ts'
import {
  calculateCineMetricsFeedback,
  calculateLoglineFeedback,
  calculateLoglineSemanticHints,
  type FilmData,
  type CineMetricsFeedback,
  type LoglineSemanticHints,
} from '../_shared/feedback.ts'
import {
  applyConfidenceFactor,
  hasHintCredit,
  isValidConfidence,
  meanXpFactor,
  resolveXpFactor,
  NEUTRAL_CONFIDENCE_CONFIG,
  type ImposterConfidenceConfig,
} from '../_shared/confidence.ts'

// ─── Sabitler ────────────────────────────────────────────────────────────────

/**
 * Detective'de izin verilen yanlis tahmin sayisi.
 *
 * 12 secenegin hepsi denenebilseydi oyun garanti kazanilirdi; 6 hak, 6 ipucuyla
 * birebir ortusuyor (her yanlis tahmin bir ipucu aciyor).
 */
const DETECTIVE_MAX_GUESSES = 6

// ─── Types ───────────────────────────────────────────────────────────────────

interface GuessValues {
  year: number
  genres: string[]
  director: string | string[]
  rating: number
  runtime: number
  country: string[]
}

interface GuessEntry {
  film_id: string
  title: string
  feedback: CineMetricsFeedback | null
  timestamp: string
  values?: GuessValues
}

/** Spotlight-specific guess entry */
interface SpotlightGuessEntry {
  turn: number
  film_id: string
  title: string
  correct: boolean
}

/** Imposter V2 round sonucu */
interface ImposterRoundResult {
  round: number
  correct_ids: number[]
  selected_ids: number[]
  correct: boolean
  /** Oyuncunun bu round için yatırdığı güven (50 | 75 | 100) */
  confidence?: number
  /** Güven × sonuç ile belirlenen XP çarpanı */
  xp_factor?: number
}

interface ProgressJson {
  guesses: GuessEntry[]
  guess_timestamps: string[]
  completed: boolean
  won: boolean
  revealed_count: number
  // Spotlight-specific fields
  turns_played?: number
  spotlight_guesses?: SpotlightGuessEntry[]
  eliminated_ids?: string[]
  /** Spotlight V3: oyuncunun denedigi harfler (buyuk harf, tekil) */
  spotlight_letters?: string[]
  /**
   * Spotlight V3: acilmis pozisyonlar ve harfleri.
   * Harf oyuncuya zaten gosterilmis oldugu icin sizinti degil; oyuna geri
   * donuldugunde maskeyi yeniden cizebilmek icin gerekli.
   */
  spotlight_revealed?: Array<{ pos: number; ch: string }>
  // Imposter V2 fields
  imposter_rounds?: ImposterRoundResult[]
  // FadeIn fields — oyuncunun seçerek açtığı ipuçları
  revealed_hints?: number[]
  hints_used?: number
}

interface GameXpConfig {
  daily_base: number
  guess_ladder: number[]
  fail_xp: number
  streak_mult_7: number
  streak_mult_30: number
}

interface RevealedSolution {
  /** Cozum filminin UUID'si — oyun BITTIGINDE doner, kesif akisi icin gerekli */
  film_id: string
  title: string
  year: number | null
  director: string | null
  poster_url: string | null
}

// ─── Streak XP Multiplier ─────────────────────────────────────────────────────

/**
 * Kullanıcının streak uzunluğuna göre XP çarpanı uygular.
 * Config'teki streak_mult_7 (7+ gün) ve streak_mult_30 (30+ gün) kullanılır.
 */
async function applyStreakMultiplier(
  service: ReturnType<typeof getServiceClient>,
  userId: string,
  baseXp: number,
  xpConfig: GameXpConfig,
): Promise<number> {
  try {
    const { data } = await service
      .from('user_streaks')
      .select('current_streak')
      .eq('user_id', userId)
      .single()

    const streak = data?.current_streak ?? 0

    if (streak >= 30 && xpConfig.streak_mult_30 > 1) {
      return Math.round(baseXp * xpConfig.streak_mult_30)
    }
    if (streak >= 7 && xpConfig.streak_mult_7 > 1) {
      return Math.round(baseXp * xpConfig.streak_mult_7)
    }
  } catch {
    // Streak sorgusu başarısız — base XP kullan
  }
  return baseXp
}

/**
 * Daily Chest'in "yarin cift XP" odulunu uygular.
 *
 * Odul get-daily-chest tarafindan user_streaks.double_xp_date'e yazilir;
 * burada yalnizca o tarihte kazanilan XP ikiye katlanir. Bayrak tuketilmez —
 * gun boyunca gecerlidir, ertesi gun kendiliginden duser.
 */
async function applyDoubleXp(
  service: ReturnType<typeof getServiceClient>,
  userId: string,
  baseXp: number,
  puzzleDate: string,
): Promise<number> {
  const { data, error } = await service
    .from('user_streaks')
    .select('double_xp_date')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    logError('submit-guess.double_xp_read_failed', error, { userId })
    return baseXp
  }

  return data?.double_xp_date === puzzleDate ? baseXp * 2 : baseXp
}

// ─── Main ────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (req.method !== 'POST') {
    return errorResponse('METHOD_NOT_ALLOWED', 'Use POST', 405)
  }

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
    logError('submit-guess.auth_failed', err)
    await sentryCapture({ message: `submit-guess auth error: ${err}`, tags: { fn: 'submit-guess' } })
    return errorResponse('AUTH_ERROR', 'Authentication failed', 500)
  }

  // ─── Parse input ───────────────────────────────────────────────────────────
  let puzzleId: string
  let guessFilmId: string
  let currentTurn: number | undefined
  let guessActorId: number | undefined
  // Imposter V2: round bazlı submit
  let imposterRound: number | undefined
  let guessActorIds: number[] | undefined
  // Imposter V2: güven bahsi (50 | 75 | 100)
  let confidence: number | undefined
  // FadeIn: ipucu açma (tahmin harcamaz)
  let hintOrder: number | undefined
  // Spotlight V3: harf tahmini (tek karakter)
  let spotlightLetter: string | undefined

  try {
    const body = await req.json()
    puzzleId = body.puzzle_id ?? ''
    guessFilmId = body.guess_film_id ?? ''
    currentTurn = body.current_turn != null ? Number(body.current_turn) : undefined
    guessActorId = body.guess_actor_id != null ? Number(body.guess_actor_id) : undefined
    // Imposter V2 params
    imposterRound = body.imposter_round != null ? Number(body.imposter_round) : undefined
    if (Array.isArray(body.guess_actor_ids)) {
      guessActorIds = body.guess_actor_ids.map(Number)
    }
    confidence = body.confidence != null ? Number(body.confidence) : undefined
    // Not: `detective_stage` artik okunmuyor — Detective tek fazli.
    // Eski istemciler gondermeye devam edebilir, yok sayilir.
    // FadeIn hint reveal
    hintOrder = body.hint_order != null ? Number(body.hint_order) : undefined
    spotlightLetter = typeof body.spotlight_letter === 'string'
      ? body.spotlight_letter.trim().toLocaleUpperCase('tr-TR')
      : undefined
  } catch {
    return errorResponse('INVALID_INPUT', 'Invalid request body', 400)
  }

  if (!puzzleId || (!guessFilmId && guessActorId == null && !guessActorIds && hintOrder == null && !spotlightLetter)) {
    return errorResponse('MISSING_PARAMS', 'puzzle_id and guess_film_id (or guess_actor_id/guess_actor_ids for imposter, hint_order for a hint reveal) are required', 400)
  }

  const service = getServiceClient()

  try {
    // ─── 1. Fetch or create game_scores row ────────────────────────────────
    let { data: scoreRow, error: scoreError } = await service
      .from('game_scores')
      .select('id, progress_json, solved, attempts, completed_at, xp_awarded')
      .eq('user_id', userId)
      .eq('puzzle_id', puzzleId)
      .maybeSingle()

    if (scoreError) {
      logError('submit-guess.score_fetch_failed', scoreError, { userId, puzzleId })
      await sentryCapture({
        message: `submit-guess score fetch: ${scoreError.message}`,
        tags: { fn: 'submit-guess', user_id: userId },
      })
      return errorResponse('SCORE_FETCH_FAILED', 'Could not load game state', 500)
    }

    // Create new score row if none exists
    if (!scoreRow) {
      const { data: created, error: createError } = await service
        .from('game_scores')
        .insert({
          user_id: userId,
          puzzle_id: puzzleId,
          solved: false,
          attempts: 0,
          completed_at: null,
          progress_json: {
            guesses: [],
            guess_timestamps: [],
            completed: false,
            won: false,
            revealed_count: 0,
          },
          dna_signals: [],
          xp_awarded: 0,
        })
        .select('id, progress_json, solved, attempts, completed_at, xp_awarded')
        .single()

      if (createError) {
        // Race condition: another request created it
        if (createError.code === '23505') {
          const { data: refetched } = await service
            .from('game_scores')
            .select('id, progress_json, solved, attempts, completed_at, xp_awarded')
            .eq('user_id', userId)
            .eq('puzzle_id', puzzleId)
            .single()
          scoreRow = refetched
        } else {
          logError('submit-guess.score_create_failed', createError, { userId, puzzleId })
          await sentryCapture({
            message: `submit-guess score create: ${createError.message}`,
            tags: { fn: 'submit-guess' },
          })
          return errorResponse('SCORE_CREATE_FAILED', 'Could not create game state', 500)
        }
      } else {
        scoreRow = created
      }
    }

    if (!scoreRow) {
      return errorResponse('SCORE_RESOLUTION_FAILED', 'Could not resolve game state', 500)
    }

    const progress: ProgressJson = scoreRow.progress_json ?? {
      guesses: [],
      guess_timestamps: [],
      completed: false,
      won: false,
      revealed_count: 0,
    }

    // ─── Check already completed ───────────────────────────────────────────
    if (progress.completed || scoreRow.completed_at != null) {
      return errorResponse(
        'ALREADY_COMPLETED',
        "Bugünün bulmacası zaten tamamlandı / Today's puzzle is already completed",
        409,
      )
    }

    // ─── 2. Rate limit: 10 guesses per 60 seconds ─────────────────────────
    const now = new Date()
    const nowISO = now.toISOString()
    const sixtySecondsAgo = now.getTime() - 60_000
    const recentGuesses = (progress.guess_timestamps ?? []).filter(
      (ts: string) => new Date(ts).getTime() > sixtySecondsAgo,
    )
    if (recentGuesses.length >= 10) {
      return errorResponse(
        'RATE_LIMIT',
        'Çok hızlı tahmin yapıyorsunuz / Too many guesses, slow down',
        429,
      )
    }

    // ─── 3. Fetch puzzle (service role — full data including solution) ──────
    const { data: puzzle, error: puzzleError } = await service
      .from('daily_puzzles')
      .select('id, solution_ref, film_id, puzzle_data, game_type, max_attempts, date')
      .eq('id', puzzleId)
      .single()

    if (puzzleError || !puzzle) {
      logError('submit-guess.puzzle_not_found', puzzleError, { puzzleId })
      return errorResponse('PUZZLE_NOT_FOUND', 'Puzzle not found', 404)
    }

    // ─── FadeIn: ipucu açma ────────────────────────────────────────────────
    // Tahmin hattına girmez — attempts artmaz, XP/DNA'ya dokunulmaz.
    // İpucu İÇERİĞİ yalnızca burada döner: migration 064'ten sonra view
    // yalnızca order+type gönderiyor, içerik sunucuda yaşıyor (Hard Rule 1).
    if (hintOrder != null) {
      if (puzzle.game_type !== 'fadein') {
        return errorResponse('INVALID_HINT', 'hint_order is only supported for fadein', 400)
      }

      const puzzleHints =
        (puzzle.puzzle_data?.hints as Array<{ order: number; type?: string; content?: string }> | undefined) ?? []
      const hint = puzzleHints.find(h => h.order === hintOrder)
      if (!hint) {
        return errorResponse('INVALID_HINT', `Hint ${hintOrder} not found in this puzzle`, 400)
      }

      const revealedHints = progress.revealed_hints ?? []
      if (revealedHints.includes(hintOrder)) {
        return errorResponse('ALREADY_REVEALED', `Hint ${hintOrder} already revealed`, 400)
      }

      // Kredi: her yanlış tahmin 1 ipucu hakkı verir (sunucu otoritesi)
      if (!hasHintCredit(revealedHints.length, (progress.guesses ?? []).length)) {
        return errorResponse(
          'NO_HINT_CREDIT',
          'İpucu hakkınız yok / No hint credit available',
          400,
        )
      }

      const updatedHints = [...revealedHints, hintOrder]
      const hintProgress: ProgressJson = {
        ...progress,
        revealed_hints: updatedHints,
        hints_used: updatedHints.length,
      }

      const { error: hintError } = await service
        .from('game_scores')
        .update({ progress_json: hintProgress })
        .eq('id', scoreRow.id)

      if (hintError) {
        logError('submit-guess.hint_update_failed', hintError, { userId, puzzleId })
        await sentryCapture({
          message: `submit-guess hint update failed: ${hintError.message}`,
          tags: { fn: 'submit-guess', user_id: userId },
        })
        return errorResponse('UPDATE_FAILED', 'Could not save hint state', 500)
      }

      logInfo('submit-guess.hint_revealed', {
        user_id: userId,
        puzzle_id: puzzleId,
        game_type: 'fadein',
        hint_order: hintOrder,
        hints_used: updatedHints.length,
      })

      return jsonResponse({
        revealed_hints: updatedHints,
        hints_used: updatedHints.length,
        hint: { order: hintOrder, type: hint.type ?? 'unknown', content: hint.content ?? '' },
      })
    }

    // ─── Spotlight V3: harf tahmini ────────────────────────────────────
    // Tahmin harcamaz degil — yanlis harf bir hak goturur. Dogru harf
    // basliktaki tum pozisyonlarini acar ve gorseli netlestirir.
    //
    // HARD RULE 1: Baslik metni response'a GIRMEZ. Yalnizca tahmin edilen
    // harfin pozisyonlari doner; acilmamis harfler istemcide yoktur.
    if (spotlightLetter != null) {
      if (puzzle.game_type !== 'spotlight') {
        return errorResponse('INVALID_ACTION', 'spotlight_letter is only valid for spotlight', 400)
      }
      if ([...spotlightLetter].length !== 1) {
        return errorResponse('INVALID_LETTER', 'spotlight_letter must be a single character', 400)
      }

      const spProgress = scoreRow.progress_json as ProgressJson
      if (spProgress?.completed) {
        return errorResponse('ALREADY_COMPLETED', 'Puzzle already completed', 409)
      }

      // Hak biten oyuncu harf acmaya devam edememeli — bu dal genel
      // max-attempts kontrolunden ONCE calisiyor, kendi kontrolunu yapar.
      if (scoreRow.attempts >= puzzle.max_attempts) {
        return errorResponse('MAX_ATTEMPTS', 'No more attempts remaining', 409)
      }

      const triedLetters = spProgress?.spotlight_letters ?? []
      if (triedLetters.includes(spotlightLetter)) {
        return errorResponse('LETTER_ALREADY_TRIED', 'Letter already guessed', 400)
      }

      const { data: solFilm, error: solErr } = await service
        .from('films')
        .select('title')
        .eq('id', puzzle.solution_ref)
        .single()

      if (solErr || !solFilm) {
        logError('submit-guess.solution_film_not_found', solErr, { solution_ref: puzzle.solution_ref })
        return errorResponse('SOLUTION_MISSING', 'Puzzle configuration error', 500)
      }

      // Pozisyonlar baslik karakter dizisi uzerinden — maske ile ayni indeksleme
      const titleChars = [...(solFilm.title as string)]
      const positions: number[] = []
      titleChars.forEach((ch, i) => {
        if (ch.toLocaleUpperCase('tr-TR') === spotlightLetter) positions.push(i)
      })

      const hit = positions.length > 0
      const updatedLetters = [...triedLetters, spotlightLetter]
      const prevRevealed = spProgress?.spotlight_revealed ?? []
      const seenPositions = new Set(prevRevealed.map(r => r.pos))
      const revealed = [
        ...prevRevealed,
        ...positions
          .filter(pos => !seenPositions.has(pos))
          .map(pos => ({ pos, ch: titleChars[pos] })),
      ]

      // Yanlis harf bir hak goturur; dogru harf bedava
      const attemptsAfter = hit ? scoreRow.attempts : scoreRow.attempts + 1
      const outOfAttempts = attemptsAfter >= puzzle.max_attempts

      // Haklar bittiyse oyun BURADA kapanir. Onceki surumde yalnizca
      // out_of_attempts bayragi donuyor, oyun hic tamamlanmiyordu; oyuncu
      // "0 hak" ile ekranda kilitli kaliyor ve sonraki harf 409 aliyordu.
      const updatedProgress: ProgressJson = {
        ...spProgress,
        guesses: spProgress?.guesses ?? [],
        guess_timestamps: spProgress?.guess_timestamps ?? [],
        completed: outOfAttempts,
        won: false,
        revealed_count: spProgress?.revealed_count ?? 0,
        spotlight_letters: updatedLetters,
        spotlight_revealed: revealed,
      }

      const letterUpdatePayload: Record<string, unknown> = {
        progress_json: updatedProgress,
        attempts: attemptsAfter,
      }

      let letterXp = 0
      const letterDnaSignals: { dim: string; val: number }[] = []

      if (outOfAttempts) {
        const xpConfig = await getAppConfig<GameXpConfig>(service, 'game_xp_config')
        letterXp = xpConfig.fail_xp
        letterXp = await applyStreakMultiplier(service, userId, letterXp, xpConfig)
        letterXp = await applyDoubleXp(service, userId, letterXp, puzzle.date)
        letterDnaSignals.push({ dim: 'knowledge', val: 0.1 })

        letterUpdatePayload.solved = false
        letterUpdatePayload.completed_at = nowISO
        letterUpdatePayload.xp_awarded = letterXp
        letterUpdatePayload.dna_signals = letterDnaSignals
      }

      const { error: letterUpdateError } = await service
        .from('game_scores')
        .update(letterUpdatePayload)
        .eq('id', scoreRow.id)

      if (letterUpdateError) {
        logError('submit-guess.letter_update_failed', letterUpdateError, { userId, puzzleId })
        return errorResponse('UPDATE_FAILED', 'Could not save letter state', 500)
      }

      // Oyun kapandiysa cozum ve kesif metni doner (film tahmini yolundaki
      // ile ayni sozlesme) — istemci sonuc ekranina gecebilsin diye.
      let letterSolution: RevealedSolution | null = null
      let letterWhy: ReturnType<typeof buildWhyThisMovie> | null = null
      let letterDnaUpdated = false

      if (outOfAttempts) {
        const { data: solFull } = await service
          .from('films')
          .select('id, title, year, genres, director, runtime, vote_average, country, metadata_json, poster_url')
          .eq('id', puzzle.solution_ref)
          .single()

        if (solFull) {
          letterSolution = {
            film_id: solFull.id,
            title: solFull.title,
            year: solFull.year,
            director: solFull.director,
            poster_url: solFull.poster_url,
          }
          letterWhy = buildWhyThisMovie(solFull)
        }

        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          const dnaResponse = await fetch(
            `${supabaseUrl}/functions/v1/recompute-cinema-dna`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                user_id: userId,
                signals: letterDnaSignals,
                daily_completed: true,
              }),
            },
          )
          letterDnaUpdated = dnaResponse.ok
        } catch (err) {
          logError('submit-guess.dna_recompute_error', err, { userId })
        }
      }

      logInfo('submit-guess.spotlight_letter', {
        user_id: userId,
        puzzle_id: puzzleId,
        game_type: 'spotlight',
        hit,
        attempts: attemptsAfter,
      })

      return jsonResponse({
        letter: spotlightLetter,
        hit,
        positions,
        tried_letters: updatedLetters,
        revealed: revealed,
        attempts_used: attemptsAfter,
        max_attempts: puzzle.max_attempts,
        out_of_attempts: outOfAttempts,
        completed: outOfAttempts,
        won: false,
        xp_awarded: letterXp,
        dna_updated: letterDnaUpdated,
        revealed_solution: letterSolution,
        why_this_movie: letterWhy,
      })
    }

    // Check max attempts
    if (scoreRow.attempts >= puzzle.max_attempts) {
      return errorResponse(
        'MAX_ATTEMPTS',
        "Bugünün bulmacası zaten tamamlandı / No more attempts remaining",
        409,
      )
    }

    // ─── 4. Fetch guessed film (skip for imposter — uses actor ID) ─────────
    let guessFilm: {
      id: string; title: string; year: number; genres: string[];
      director: string; runtime: number; vote_average: number;
      country: string[]; metadata_json: Record<string, unknown>; poster_url: string | null;
    } | null = null

    if (puzzle.game_type !== 'imposter') {
      const { data, error: guessError } = await service
        .from('films')
        .select('id, title, year, genres, director, runtime, vote_average, country, metadata_json, poster_url')
        .eq('id', guessFilmId)
        .single()

      if (guessError || !data) {
        logError('submit-guess.guess_film_not_found', guessError, { guessFilmId })
        return errorResponse('FILM_NOT_FOUND', 'Guessed film not found', 404)
      }
      guessFilm = data
    }

    // ─── 5. Fetch solution film ────────────────────────────────────────────
    const { data: solutionFilm, error: solutionError } = await service
      .from('films')
      .select('id, title, year, genres, director, runtime, vote_average, country, metadata_json, poster_url')
      .eq('id', puzzle.solution_ref)
      .single()

    if (solutionError || !solutionFilm) {
      logError('submit-guess.solution_film_not_found', solutionError, { solution_ref: puzzle.solution_ref })
      await sentryCapture({
        message: `submit-guess: solution film missing for puzzle ${puzzleId}`,
        level: 'fatal',
        tags: { fn: 'submit-guess', puzzle_id: puzzleId },
      })
      return errorResponse('SOLUTION_MISSING', 'Puzzle configuration error', 500)
    }

    // ─── 6. Calculate feedback ─────────────────────────────────────────────
    const isCorrect = guessFilm != null && guessFilm.id === solutionFilm.id
    const newAttempts = scoreRow.attempts + 1
    let feedback: CineMetricsFeedback | null = null
    let loglineReveal: { revealed_index: number; revealed_word: string } | null = null
    let loglineHints: LoglineSemanticHints | null = null

    // ─── Spotlight V3: film tahmini (tek gorsel + baslik maskesi) ──────
    // Harf tahmini yukarida ayri bir dalda islenir. Buraya yalnizca
    // "filmi biliyorum" tahmini duser.
    if (puzzle.game_type === 'spotlight') {
      const spProgress = progress
      const triedLetters = spProgress.spotlight_letters ?? []
      const revealed = spProgress.spotlight_revealed ?? []

      const spotlightGuesses: SpotlightGuessEntry[] = [
        ...(spProgress.spotlight_guesses ?? []),
        { turn: newAttempts, film_id: guessFilm!.id, title: guessFilm!.title, correct: isCorrect },
      ]

      const completed = isCorrect || newAttempts >= puzzle.max_attempts
      const won = isCorrect

      const updatedProgress: ProgressJson = {
        guesses: spProgress.guesses,
        guess_timestamps: [...(spProgress.guess_timestamps ?? []), nowISO],
        completed,
        won,
        revealed_count: spProgress.revealed_count ?? 0,
        turns_played: newAttempts,
        spotlight_guesses: spotlightGuesses,
        spotlight_letters: triedLetters,
        spotlight_revealed: revealed,
      }

      let xpAwarded = 0
      const dnaSignals: { dim: string; val: number }[] = []

      if (completed) {
        const xpConfig = await getAppConfig<GameXpConfig>(service, 'game_xp_config')
        if (won) {
          const ladderIndex = Math.min(newAttempts - 1, xpConfig.guess_ladder.length - 1)
          xpAwarded = xpConfig.guess_ladder[ladderIndex] ?? xpConfig.fail_xp
        } else {
          xpAwarded = xpConfig.fail_xp
        }
        xpAwarded = await applyStreakMultiplier(service, userId, xpAwarded, xpConfig)
        xpAwarded = await applyDoubleXp(service, userId, xpAwarded, puzzle.date)

        // V3 gorsel bir oyun: az harfle bilmek visual_sense'i besler
        const letterPenalty = triedLetters.length * 0.05
        dnaSignals.push({ dim: 'knowledge', val: won ? Math.max(0.2, 0.8 - letterPenalty) : 0.1 })
        dnaSignals.push({ dim: 'visual_sense', val: won ? Math.max(0.2, 0.9 - letterPenalty) : 0 })
      }

      const updatePayload: Record<string, unknown> = {
        progress_json: updatedProgress,
        attempts: newAttempts,
      }
      if (completed) {
        updatePayload.solved = won
        updatePayload.completed_at = nowISO
        updatePayload.xp_awarded = xpAwarded
        updatePayload.dna_signals = dnaSignals
      }

      const { error: updateError } = await service
        .from('game_scores')
        .update(updatePayload)
        .eq('id', scoreRow.id)

      if (updateError) {
        logError('submit-guess.update_failed', updateError, { userId, puzzleId })
        await sentryCapture({
          message: `submit-guess update failed: ${updateError.message}`,
          tags: { fn: 'submit-guess', user_id: userId },
        })
        return errorResponse('UPDATE_FAILED', 'Could not save game state', 500)
      }

      let dnaUpdated = false
      if (completed && dnaSignals.length > 0) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          const dnaResponse = await fetch(
            `${supabaseUrl}/functions/v1/recompute-cinema-dna`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                user_id: userId,
                signals: dnaSignals,
                daily_completed: completed,
              }),
            },
          )
          dnaUpdated = dnaResponse.ok
        } catch (err) {
          logError('submit-guess.dna_recompute_error', err, { userId })
        }
      }

      let revealedSolution: RevealedSolution | null = null
      if (completed) {
        revealedSolution = {
          film_id: solutionFilm.id,
          title: solutionFilm.title,
          year: solutionFilm.year,
          director: solutionFilm.director,
          poster_url: solutionFilm.poster_url,
        }
      }

      logInfo('submit-guess.processed', {
        user_id: userId,
        puzzle_id: puzzleId,
        game_type: 'spotlight',
        correct: isCorrect,
        attempts: newAttempts,
        letters_tried: triedLetters.length,
        completed,
        won,
        xp_awarded: xpAwarded,
      })

      return jsonResponse({
        correct: isCorrect,
        attempts_used: newAttempts,
        max_attempts: puzzle.max_attempts,
        completed,
        won,
        xp_awarded: xpAwarded,
        dna_updated: dnaUpdated,
        tried_letters: triedLetters,
        revealed: revealed,
        revealed_solution: revealedSolution,
        why_this_movie: completed ? buildWhyThisMovie(solutionFilm) : null,
      })
    }

    // ─── Imposter V2: round-based actor selection ──────────────────────
    if (puzzle.game_type === 'imposter') {
      if (imposterRound == null || !guessActorIds || guessActorIds.length === 0) {
        return errorResponse('MISSING_PARAMS', 'imposter_round and guess_actor_ids[] are required for imposter', 400)
      }

      if (imposterRound < 1 || imposterRound > 3) {
        return errorResponse('INVALID_ROUND', 'imposter_round must be 1, 2, or 3', 400)
      }

      // Validate puzzle_data has rounds
      const rounds = puzzle.puzzle_data?.rounds as
        Array<{ round: number; options: Array<{ id: number; name: string }>; imposter_ids: number[]; film_title: string; poster_url: string | null }> | undefined
      if (!rounds || rounds.length < 3) {
        return errorResponse('PUZZLE_DATA_INVALID', 'Imposter V2 puzzle data missing rounds', 500)
      }

      const roundData = rounds.find(r => r.round === imposterRound)
      if (!roundData) {
        return errorResponse('INVALID_ROUND', `Round ${imposterRound} not found`, 400)
      }

      // Güven bahsi — config her çağrıda okunur (module-level constant YASAK).
      // Config yoksa (migration 062 henüz push edilmemişse) oyunu 500'e
      // düşürmek yerine nötre düşeriz; durum Sentry'ye bildirilir.
      let confConfig: ImposterConfidenceConfig
      let confConfigLoaded = true
      try {
        confConfig = await getAppConfig<ImposterConfidenceConfig>(
          service,
          'imposter_confidence_config',
        )
      } catch (err) {
        confConfigLoaded = false
        logError('submit-guess.confidence_config_missing', err, { userId, puzzleId })
        await sentryCapture({
          message: 'imposter_confidence_config missing — falling back to neutral betting',
          level: 'error',
          tags: { fn: 'submit-guess', game_type: 'imposter' },
        })
        confConfig = NEUTRAL_CONFIDENCE_CONFIG
      }
      const roundConfidence = confidence ?? confConfig.levels[0]
      // Nötre düşmüşsek istemcinin gönderdiği seviyeyi reddetmeyiz —
      // çarpan zaten 1'e çözülür, oyun akışı kesilmez.
      if (confConfigLoaded && !isValidConfidence(confConfig, roundConfidence)) {
        return errorResponse(
          'INVALID_CONFIDENCE',
          `confidence must be one of ${confConfig.levels.join(', ')}`,
          400,
        )
      }

      // Check round not already played
      const prevRounds = progress.imposter_rounds ?? []
      if (prevRounds.some(r => r.round === imposterRound)) {
        return errorResponse('ALREADY_PLAYED', `Round ${imposterRound} already submitted`, 400)
      }

      // Validate all selected actors are in options
      const optionIds = new Set(roundData.options.map(o => o.id))
      for (const actorId of guessActorIds) {
        if (!optionIds.has(actorId)) {
          return errorResponse('INVALID_GUESS', `Actor ${actorId} not in options for round ${imposterRound}`, 400)
        }
      }

      // Check correctness: selected set matches imposter_ids set exactly
      const imposterSet = new Set(roundData.imposter_ids)
      const selectedSet = new Set(guessActorIds)
      const roundCorrect = imposterSet.size === selectedSet.size &&
        [...imposterSet].every(id => selectedSet.has(id))

      // Bahsin karşılığı: doğruda ödül, yanlışta ceza çarpanı
      const roundXpFactor = resolveXpFactor(confConfig, roundConfidence, roundCorrect)

      const roundResult: ImposterRoundResult = {
        round: imposterRound,
        correct_ids: roundData.imposter_ids,
        selected_ids: guessActorIds,
        correct: roundCorrect,
        confidence: roundConfidence,
        xp_factor: roundXpFactor,
      }

      const updatedRounds = [...prevRounds, roundResult]
      const isLastRound = imposterRound === 3
      const completed = isLastRound
      const correctCount = updatedRounds.filter(r => r.correct).length
      const won = completed && correctCount === 3

      const updatedProgress: ProgressJson = {
        guesses: [],
        guess_timestamps: [...(progress.guess_timestamps ?? []), nowISO],
        completed,
        won,
        revealed_count: 0,
        imposter_rounds: updatedRounds,
      }

      // XP & DNA — only on completion (round 3)
      let xpAwarded = 0
      let confidenceFactor: number | null = null
      const dnaSignals: { dim: string; val: number }[] = []

      if (completed) {
        const xpConfig = await getAppConfig<GameXpConfig>(service, 'game_xp_config')
        // XP based on correct rounds: 3/3 = max, 2/3 = mid, 1/3 = low, 0/3 = fail
        if (correctCount === 3) {
          xpAwarded = xpConfig.guess_ladder[0] ?? xpConfig.daily_base
        } else if (correctCount >= 1) {
          const ladderIdx = Math.min(3 - correctCount, xpConfig.guess_ladder.length - 1)
          xpAwarded = xpConfig.guess_ladder[ladderIdx] ?? xpConfig.fail_xp
        } else {
          xpAwarded = xpConfig.fail_xp
        }

        // Güven bahsi: 3 round'un çarpan ortalaması.
        // Eksik xp_factor (eski kayıt) 1.0 sayılır — hep %50 oynayan
        // oyuncu için sonuç bugünküyle birebir aynı kalır.
        confidenceFactor = meanXpFactor(updatedRounds)
        xpAwarded = applyConfidenceFactor(xpAwarded, confidenceFactor)

        // Streak XP çarpanı — bahis uygulandıktan SONRA
        xpAwarded = await applyStreakMultiplier(service, userId, xpAwarded, xpConfig)
        xpAwarded = await applyDoubleXp(service, userId, xpAwarded, puzzle.date)

        // DNA: Knowledge (cast recognition) — bahisten etkilenmez
        const knowledgeSignal = 0.1 + correctCount * 0.2 // 0.1 to 0.7
        dnaSignals.push({ dim: 'knowledge', val: knowledgeSignal })
      }

      // Update game_scores
      const updatePayload: Record<string, unknown> = {
        progress_json: updatedProgress,
        attempts: updatedRounds.length,
      }
      if (completed) {
        updatePayload.solved = won
        updatePayload.completed_at = nowISO
        updatePayload.xp_awarded = xpAwarded
        updatePayload.dna_signals = dnaSignals
      }

      const { error: updateError } = await service
        .from('game_scores')
        .update(updatePayload)
        .eq('id', scoreRow.id)

      if (updateError) {
        logError('submit-guess.update_failed', updateError, { userId, puzzleId })
        await sentryCapture({
          message: `submit-guess update failed: ${updateError.message}`,
          tags: { fn: 'submit-guess', user_id: userId },
        })
        return errorResponse('UPDATE_FAILED', 'Could not save game state', 500)
      }

      // DNA recompute — only on completion
      let dnaUpdated = false
      if (completed && dnaSignals.length > 0) {
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          const dnaResponse = await fetch(
            `${supabaseUrl}/functions/v1/recompute-cinema-dna`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                user_id: userId,
                signals: dnaSignals,
                daily_completed: completed,
              }),
            },
          )
          dnaUpdated = dnaResponse.ok
        } catch (err) {
          logError('submit-guess.dna_recompute_error', err, { userId })
        }
      }

      // Round-level response: correct actors revealed for learning moment
      const revealedActors = roundData.options
        .filter(o => imposterSet.has(o.id))
        .map(o => o.name)

      const response = {
        round: imposterRound,
        round_correct: roundCorrect,
        correct_count: correctCount,
        revealed_imposters: revealedActors,
        completed,
        won,
        xp_awarded: xpAwarded,
        dna_updated: dnaUpdated,
        confidence: roundConfidence,
        round_xp_factor: roundXpFactor,
        confidence_factor: confidenceFactor,
        revealed_solution: completed ? {
          film_id: solutionFilm.id,
          title: solutionFilm.title,
          year: solutionFilm.year,
          director: solutionFilm.director,
          poster_url: solutionFilm.poster_url,
        } : null,
        why_this_movie: completed ? buildWhyThisMovie(solutionFilm) : null,
      }

      logInfo('submit-guess.processed', {
        user_id: userId,
        puzzle_id: puzzleId,
        game_type: 'imposter',
        round: imposterRound,
        round_correct: roundCorrect,
        correct_count: correctCount,
        confidence: roundConfidence,
        round_xp_factor: roundXpFactor,
        completed,
        won,
        xp_awarded: xpAwarded,
      })

      return jsonResponse(response)
    }

    // ─── Detective: tek fazli eleme oyunu ──────────────────────────────────
    // Ikinci faz (karsilastirmali feedback) kaldirildi — zaten 1. fazda
    // ogrenilen ipuclarini tekrar ediyordu, yeni bilgi uretmiyordu.
    if (puzzle.game_type === 'detective') {
      if (!guessFilm) {
        return errorResponse('INTERNAL_ERROR', 'Missing guess film data', 500)
      }

      // Validate film is in options and not eliminated
      const puzzleOptions = (puzzle.puzzle_data?.options as Array<{ film_id: string; title: string }>) ?? []
      const validOption = puzzleOptions.find(o => o.film_id === guessFilmId)
      if (!validOption) {
        return errorResponse('INVALID_GUESS', 'Film not in detective options', 400)
      }

      const eliminatedIds: string[] = progress.eliminated_ids ?? []
      if (eliminatedIds.includes(guessFilmId)) {
        return errorResponse('ALREADY_ELIMINATED', 'Film already eliminated', 400)
      }

      const stage1Guesses: Array<{ film_id: string; title: string; correct: boolean }> =
        (progress as Record<string, unknown>).stage1_guesses as typeof stage1Guesses ?? []
      const timerStart: number =
        (progress as Record<string, unknown>).timer_start_ms as number ?? Date.now()
      const hintsUsed: number =
        (progress as Record<string, unknown>).hints_used as number ?? 0

      const isDetectiveCorrect = guessFilm.id === solutionFilm.id

      const newStage1Guesses = [
        ...stage1Guesses,
        { film_id: guessFilm.id, title: guessFilm.title, correct: isDetectiveCorrect },
      ]

      if (isDetectiveCorrect) {
        // Cozuldu
        const totalGuesses = newStage1Guesses.length
        const elapsedMs = Date.now() - timerStart

        // Kazanma skoru — Tahmin %60, Ipucu %25, Sure %15
        const minutes = elapsedMs / 60000
        const timeScore = minutes <= 2 ? 150 : minutes <= 5
          ? Math.round(150 - (minutes - 2) * (100 / 3))
          : 50
        const guessScore = Math.max(0, 600 - (totalGuesses - 1) * 100)
        const hintScore = hintsUsed === 0 ? 250 : hintsUsed === 1 ? 150 : 50
        const difficulty = (puzzle.puzzle_data as Record<string, unknown>)?.difficulty as number ?? 1
        const diffMult = 1 + (difficulty - 1) * 0.125
        const detectiveScore = Math.min(
          1000,
          Math.round((guessScore + hintScore + timeScore) * diffMult),
        )

        const xpConfig = await getAppConfig<GameXpConfig>(service, 'game_xp_config')
        const ladderIdx = Math.min(totalGuesses - 1, xpConfig.guess_ladder.length - 1)
        let xpAwarded = xpConfig.guess_ladder[ladderIdx] ?? xpConfig.fail_xp
        xpAwarded = await applyStreakMultiplier(service, userId, xpAwarded, xpConfig)
      xpAwarded = await applyDoubleXp(service, userId, xpAwarded, puzzle.date)

        const dnaSignals = [
          { dim: 'knowledge', val: 0.3 + 0.1 * (DETECTIVE_MAX_GUESSES - totalGuesses) },
          { dim: 'deduction', val: (DETECTIVE_MAX_GUESSES - totalGuesses + 1) / DETECTIVE_MAX_GUESSES },
          { dim: 'visual_sense', val: 0.3 },
        ]

        const updatedProgress = {
          ...progress,
          stage: 3,
          stage1_guesses: newStage1Guesses,
          eliminated_ids: eliminatedIds,
          guess_timestamps: [...(progress.guess_timestamps ?? []), nowISO],
          timer_start_ms: timerStart,
          total_guesses: totalGuesses,
          hints_used: hintsUsed,
          completed: true,
          won: true,
        }

        // Ipucu cozumlemesi — ham deger gonderilir, etiket/bicim istemcide
        const decoyConns = (puzzle.puzzle_data?.decoy_connections as Array<{ decoy_title: string; shared_traits: string[] }>) ?? []
        const cluesList = (puzzle.puzzle_data?.clues as Array<{ type: string; value: unknown }>) ?? []
        const clueBreakdown = {
          clue_explanations: cluesList.map(c => ({
            clue_type: c.type,
            clue_value: c.value,
          })),
          decoy_connections: decoyConns.map(d => ({
            decoy_title: d.decoy_title,
            shared_traits: d.shared_traits,
          })),
        }

        // Update game_scores
        await service
          .from('game_scores')
          .update({
            progress_json: updatedProgress,
            attempts: newAttempts,
            solved: true,
            completed_at: nowISO,
            xp_awarded: xpAwarded,
            dna_signals: dnaSignals,
            detective_score: detectiveScore,
          })
          .eq('id', scoreRow.id)

        // DNA recompute (fire-and-forget)
        let dnaUpdated = false
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          const dnaResp = await fetch(`${supabaseUrl}/functions/v1/recompute-cinema-dna`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ user_id: userId, signals: dnaSignals, daily_completed: true }),
          })
          dnaUpdated = dnaResp.ok
        } catch { /* fire-and-forget */ }

        return jsonResponse({
          correct: true,
          stage: 3,
          completed: true,
          won: true,
          detective_score: detectiveScore,
          xp_awarded: xpAwarded,
          dna_updated: dnaUpdated,
          // Lucky Spot mekanigi kaldirildi (tek fazli eleme oyunu)
          lucky_spot: false,
          eliminated_ids: eliminatedIds,
          revealed_solution: {
            film_id: solutionFilm.id,
            title: solutionFilm.title,
            year: solutionFilm.year,
            director: solutionFilm.director,
            poster_url: solutionFilm.poster_url,
          },
          why_this_movie: buildWhyThisMovie(solutionFilm),
          clue_breakdown: clueBreakdown,
          community_stats: null, // Will be populated on get-daily-challenge
        })
      }

      // ── Yanlis tahmin: filmi ele, yeni ipucu ver ──
      // `newStage1Guesses` yukarida kuruldu (correct: false olarak)
      const newEliminatedIds = [...eliminatedIds, guessFilmId]
      const remainingCount = puzzleOptions.length - newEliminatedIds.length
      const wrongGuesses = newStage1Guesses.length

      // Sonraki ipucu (tur = eleme sayisi + 1)
      const cluesList = (puzzle.puzzle_data?.clues as Array<{ turn: number; type: string; value: unknown }>) ?? []
      const nextClue = cluesList.find(c => c.turn === wrongGuesses + 1) ?? null

      // Ipucu cozumlemesi — ham deger gonderilir, etiket/bicim istemcide
      const decoyConns = (puzzle.puzzle_data?.decoy_connections as Array<{ decoy_title: string; shared_traits: string[] }>) ?? []
      const puzzleClues = (puzzle.puzzle_data?.clues as Array<{ type: string; value: unknown }>) ?? []
      const clueBreakdown = {
        clue_explanations: puzzleClues.map(c => ({
          clue_type: c.type,
          clue_value: c.value,
        })),
        decoy_connections: decoyConns.map(d => ({
          decoy_title: d.decoy_title,
          shared_traits: d.shared_traits,
        })),
      }

      // ── Deneme hakki bitti: kayip ──
      if (wrongGuesses >= DETECTIVE_MAX_GUESSES) {
        const elapsedMs = Date.now() - timerStart
        const detectiveScore = Math.max(50, 150 - wrongGuesses * 10)

        const xpConfig = await getAppConfig<GameXpConfig>(service, 'game_xp_config')
        let xpAwarded = xpConfig.fail_xp
        xpAwarded = await applyStreakMultiplier(service, userId, xpAwarded, xpConfig)
        xpAwarded = await applyDoubleXp(service, userId, xpAwarded, puzzle.date)

        const dnaSignals = [
          { dim: 'knowledge', val: 0.1 },
          { dim: 'deduction', val: 0 },
          { dim: 'visual_sense', val: 0.3 },
        ]

        const updatedProgress = {
          ...progress,
          stage: 3,
          stage1_guesses: newStage1Guesses,
          eliminated_ids: newEliminatedIds,
          guess_timestamps: [...(progress.guess_timestamps ?? []), nowISO],
          timer_start_ms: timerStart,
          total_guesses: wrongGuesses,
          hints_used: hintsUsed,
          completed: true,
          won: false,
        }

        await service
          .from('game_scores')
          .update({
            progress_json: updatedProgress,
            attempts: newAttempts,
            solved: false,
            completed_at: nowISO,
            xp_awarded: xpAwarded,
            dna_signals: dnaSignals,
            detective_score: detectiveScore,
          })
          .eq('id', scoreRow.id)

        // DNA recompute (fire-and-forget)
        let dnaUpdated = false
        try {
          const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
          const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          const dnaResp = await fetch(`${supabaseUrl}/functions/v1/recompute-cinema-dna`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ user_id: userId, signals: dnaSignals, daily_completed: true }),
          })
          dnaUpdated = dnaResp.ok
        } catch { /* fire-and-forget */ }

        logInfo('submit-guess.detective.lost', { userId, elapsedMs, wrongGuesses })

        return jsonResponse({
          correct: false,
          stage: 3,
          completed: true,
          won: false,
          detective_score: detectiveScore,
          xp_awarded: xpAwarded,
          dna_updated: dnaUpdated,
          lucky_spot: false,
          eliminated_ids: newEliminatedIds,
          remaining_count: remainingCount,
          revealed_solution: {
            film_id: solutionFilm.id,
            title: solutionFilm.title,
            year: solutionFilm.year,
            director: solutionFilm.director,
            poster_url: solutionFilm.poster_url,
          },
          why_this_movie: buildWhyThisMovie(solutionFilm),
          clue_breakdown: clueBreakdown,
          community_stats: null,
        })
      }

      // ── Oyun devam ediyor ──
      const updatedProgress = {
        ...progress,
        stage: 1,
        stage1_guesses: newStage1Guesses,
        eliminated_ids: newEliminatedIds,
        guess_timestamps: [...(progress.guess_timestamps ?? []), nowISO],
        timer_start_ms: timerStart,
        hints_used: hintsUsed,
        completed: false,
        won: false,
      }

      await service
        .from('game_scores')
        .update({ progress_json: updatedProgress, attempts: newAttempts })
        .eq('id', scoreRow.id)

      return jsonResponse({
        correct: false,
        stage: 1,
        eliminated_ids: newEliminatedIds,
        next_clue: nextClue,
        remaining_count: remainingCount,
        completed: false,
        won: false,
        detective_score: null,
        xp_awarded: 0,
        dna_updated: false,
        revealed_solution: null,
      })
    }

    // ─── CineMetrics / Logline / Quoted / FadeIn feedback ──────────────────
    // guessFilm is always set for non-imposter game types (guarded above)
    if (!guessFilm) {
      return errorResponse('INTERNAL_ERROR', 'Missing guess film data', 500)
    }

    if (puzzle.game_type === 'cinemetrics') {
      const guessData: FilmData = {
        year: guessFilm.year,
        genres: guessFilm.genres,
        director: guessFilm.director,
        vote_average: guessFilm.vote_average,
        runtime: guessFilm.runtime,
        country: guessFilm.country,
      }
      const solutionData: FilmData = {
        year: solutionFilm.year,
        genres: solutionFilm.genres,
        director: solutionFilm.director,
        vote_average: solutionFilm.vote_average,
        runtime: solutionFilm.runtime,
        country: solutionFilm.country,
      }
      feedback = calculateCineMetricsFeedback(guessData, solutionData)
    } else if (puzzle.game_type === 'logline') {
      const redactionWords: string[] = puzzle.puzzle_data?.redaction_words ?? []
      const result = calculateLoglineFeedback(
        isCorrect,
        redactionWords,
        progress.revealed_count ?? 0,
      )
      if (result.reveal) {
        loglineReveal = result.reveal
      }

      // Yanlış tahminde semantic hints üret (tür/dönem yakınlığı)
      if (!isCorrect && guessFilm) {
        const guessData: FilmData = {
          year: guessFilm.year,
          genres: guessFilm.genres,
          director: guessFilm.director,
          vote_average: guessFilm.vote_average,
          runtime: guessFilm.runtime,
          country: guessFilm.country,
        }
        const solutionData: FilmData = {
          year: solutionFilm.year,
          genres: solutionFilm.genres,
          director: solutionFilm.director,
          vote_average: solutionFilm.vote_average,
          runtime: solutionFilm.runtime,
          country: solutionFilm.country,
        }
        loglineHints = calculateLoglineSemanticHints(guessData, solutionData)
      }
    }

    // ─── 6b. Build guess values for CineMetrics grid display ────────────────
    const guessValues: GuessValues | undefined = puzzle.game_type === 'cinemetrics'
      ? {
          year: guessFilm.year,
          genres: guessFilm.genres,
          director: guessFilm.director,
          rating: guessFilm.vote_average,
          runtime: guessFilm.runtime,
          country: guessFilm.country,
        }
      : undefined

    // ─── 7. Update progress_json ───────────────────────────────────────────
    const guessEntry: GuessEntry = {
      film_id: guessFilm.id,
      title: guessFilm.title,
      feedback,
      timestamp: nowISO,
      ...(guessValues && { values: guessValues }),
    }

    const isLastAttempt = newAttempts >= puzzle.max_attempts
    const completed = isCorrect || isLastAttempt
    const won = isCorrect

    const newRevealedCount = loglineReveal
      ? (progress.revealed_count ?? 0) + 1
      : (progress.revealed_count ?? 0)

    const updatedProgress: ProgressJson = {
      guesses: [...progress.guesses, guessEntry],
      guess_timestamps: [...(progress.guess_timestamps ?? []), nowISO],
      completed,
      won,
      revealed_count: newRevealedCount,
    }

    // ─── 8. Calculate XP if completed ──────────────────────────────────────
    let xpAwarded = 0
    const dnaSignals: { dim: string; val: number }[] = []

    if (completed) {
      const xpConfig = await getAppConfig<GameXpConfig>(service, 'game_xp_config')

      if (won) {
        // 0-indexed: attempts-1 because newAttempts is 1-based
        const ladderIndex = Math.min(newAttempts - 1, xpConfig.guess_ladder.length - 1)
        xpAwarded = xpConfig.guess_ladder[ladderIndex] ?? xpConfig.fail_xp
      } else {
        xpAwarded = xpConfig.fail_xp
      }
      // Streak XP çarpanı
      xpAwarded = await applyStreakMultiplier(service, userId, xpAwarded, xpConfig)
        xpAwarded = await applyDoubleXp(service, userId, xpAwarded, puzzle.date)

      // ─── 9. DNA signals ────────────────────────────────────────────────
      const difficulty = puzzle.puzzle_data?.difficulty ?? 1

      if (puzzle.game_type === 'cinemetrics') {
        const knowledgeSignal = won ? 0.5 + 0.1 * difficulty : 0.1
        const deductionSignal = won
          ? (puzzle.max_attempts + 1 - newAttempts) / puzzle.max_attempts
          : 0

        // Check if director was green in first 3 attempts
        let auteurSignal = 0
        const allGuesses = updatedProgress.guesses
        for (let i = 0; i < Math.min(3, allGuesses.length); i++) {
          if (allGuesses[i]?.feedback?.director?.result === 'green') {
            auteurSignal = 0.7
            break
          }
        }

        dnaSignals.push({ dim: 'knowledge', val: knowledgeSignal })
        dnaSignals.push({ dim: 'deduction', val: deductionSignal })
        if (auteurSignal > 0) {
          dnaSignals.push({ dim: 'auteur_sense', val: auteurSignal })
        }
      } else if (puzzle.game_type === 'logline') {
        const knowledgeSignal = won ? 0.4 + 0.1 * difficulty : 0.1
        const deductionSignal = won
          ? (puzzle.max_attempts - newRevealedCount) / puzzle.max_attempts
          : 0

        dnaSignals.push({ dim: 'knowledge', val: knowledgeSignal })
        dnaSignals.push({ dim: 'deduction', val: deductionSignal })
      } else if (puzzle.game_type === 'quoted') {
        // Quoted: film quote recognition → Knowledge + Deduction
        const knowledgeSignal = won ? 0.5 + 0.1 * difficulty : 0.1
        const deductionSignal = won
          ? (puzzle.max_attempts + 1 - newAttempts) / puzzle.max_attempts
          : 0

        dnaSignals.push({ dim: 'knowledge', val: knowledgeSignal })
        dnaSignals.push({ dim: 'deduction', val: deductionSignal })
      } else if (puzzle.game_type === 'fadein') {
        // FadeIn: poster recognition → Visual Sense + Knowledge
        const visualSignal = won
          ? 0.5 + 0.1 * (puzzle.max_attempts - newAttempts)
          : 0.1
        const knowledgeSignal = won ? 0.3 + 0.1 * difficulty : 0.1

        dnaSignals.push({ dim: 'visual_sense', val: visualSignal })
        dnaSignals.push({ dim: 'knowledge', val: knowledgeSignal })
      }
    }

    // ─── Update game_scores ──────────────────────────────────────────────
    const updatePayload: Record<string, unknown> = {
      progress_json: updatedProgress,
      attempts: newAttempts,
    }
    if (completed) {
      updatePayload.solved = won
      updatePayload.completed_at = nowISO
      updatePayload.xp_awarded = xpAwarded
      updatePayload.dna_signals = dnaSignals
    }

    const { error: updateError } = await service
      .from('game_scores')
      .update(updatePayload)
      .eq('id', scoreRow.id)

    if (updateError) {
      logError('submit-guess.update_failed', updateError, { userId, puzzleId })
      await sentryCapture({
        message: `submit-guess update failed: ${updateError.message}`,
        tags: { fn: 'submit-guess', user_id: userId },
      })
      return errorResponse('UPDATE_FAILED', 'Could not save game state', 500)
    }

    // ─── 10. Trigger DNA recompute (fire-and-forget) ─────────────────────
    let dnaUpdated = false
    if (completed && dnaSignals.length > 0) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const dnaResponse = await fetch(
          `${supabaseUrl}/functions/v1/recompute-cinema-dna`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              user_id: userId,
              signals: dnaSignals,
              daily_completed: completed,
            }),
          },
        )
        dnaUpdated = dnaResponse.ok
        if (!dnaResponse.ok) {
          logError('submit-guess.dna_recompute_failed', null, {
            status: dnaResponse.status,
            userId,
          })
          await sentryCapture({
            message: `submit-guess: recompute-cinema-dna returned ${dnaResponse.status}`,
            level: 'warning',
            tags: { fn: 'submit-guess', user_id: userId },
          })
        }
      } catch (err) {
        logError('submit-guess.dna_recompute_error', err, { userId })
        await sentryCapture({
          message: `submit-guess: recompute-cinema-dna fetch error: ${err}`,
          level: 'warning',
          tags: { fn: 'submit-guess', user_id: userId },
        })
      }
    }

    // ─── 11. Build response ──────────────────────────────────────────────
    // CRITICAL: solution_ref, film_id, redaction_words NEVER in response
    let revealedSolution: RevealedSolution | null = null
    if (completed) {
      revealedSolution = {
        film_id: solutionFilm.id,
        title: solutionFilm.title,
        year: solutionFilm.year,
        director: solutionFilm.director,
        poster_url: solutionFilm.poster_url,
      }
    }

    const response = {
      correct: isCorrect,
      feedback: puzzle.game_type === 'cinemetrics' ? feedback : null,
      guess_values: guessValues ?? null,
      logline_reveal: loglineReveal,
      logline_hints: loglineHints,
      guesses_used: newAttempts,
      completed,
      won,
      xp_awarded: xpAwarded,
      dna_updated: dnaUpdated,
      revealed_solution: revealedSolution,
      // Film kesfi koprusu — tamamlanmada tum oyunlarda doner
      why_this_movie: completed ? buildWhyThisMovie(solutionFilm) : null,
    }

    logInfo('submit-guess.processed', {
      user_id: userId,
      puzzle_id: puzzleId,
      game_type: puzzle.game_type,
      correct: isCorrect,
      attempt: newAttempts,
      completed,
      won,
      xp_awarded: xpAwarded,
    })

    return jsonResponse(response)
  } catch (err) {
    logError('submit-guess.unhandled', err, { userId })
    await sentryCapture({
      message: `submit-guess unhandled error: ${err}`,
      level: 'error',
      tags: { fn: 'submit-guess', user_id: userId },
    })
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500)
  }
})
