/**
 * Pure feedback calculation for CineMetrics and Logline game types.
 * No side effects — testable as a standalone module.
 *
 * CineMetrics: per-column comparison (year, genres, director, rating, runtime, country)
 * Logline: correct/incorrect + next word reveal
 */

import { shareSameContinent } from './continents.ts'

// ─── Types ──────────────────────────────────────────────────────────────────

export type FeedbackColor = 'green' | 'yellow' | 'gray'
export type Direction = 'up' | 'down'

export interface ColumnFeedback {
  result: FeedbackColor
  direction?: Direction
}

export interface CineMetricsFeedback {
  year: ColumnFeedback
  genres: ColumnFeedback
  director: ColumnFeedback
  rating: ColumnFeedback
  runtime: ColumnFeedback
  country: ColumnFeedback
}

export interface LoglineReveal {
  revealed_index: number
  revealed_word: string
}

// ─── Film data needed for comparison ────────────────────────────────────────

export interface FilmData {
  year: number | null
  genres: string[] | null
  director: string | null
  vote_average: number | null
  runtime: number | null
  country: string[] | null
}

// ─── CineMetrics Column Calculators ─────────────────────────────────────────

/** Year: exact → green, ±5 → yellow, else gray + direction */
export function compareYear(guess: number | null, solution: number | null): ColumnFeedback {
  if (guess == null || solution == null) return { result: 'gray' }
  if (guess === solution) return { result: 'green' }
  const diff = Math.abs(guess - solution)
  if (diff <= 5) return { result: 'yellow' }
  return {
    result: 'gray',
    direction: guess < solution ? 'up' : 'down',
  }
}

/**
 * Genres: set comparison (order-independent, lowercase).
 * Exact match → green, any overlap → yellow, else gray.
 */
export function compareGenres(guess: string[] | null, solution: string[] | null): ColumnFeedback {
  const g = new Set((guess ?? []).map((s) => s.toLowerCase().trim()))
  const s = new Set((solution ?? []).map((s) => s.toLowerCase().trim()))

  if (g.size === 0 && s.size === 0) return { result: 'green' }
  if (g.size === 0 || s.size === 0) return { result: 'gray' }

  // Check exact set equality
  if (g.size === s.size && [...g].every((v) => s.has(v))) return { result: 'green' }

  // Check any intersection
  for (const v of g) {
    if (s.has(v)) return { result: 'yellow' }
  }

  return { result: 'gray' }
}

/**
 * Director: normalize to arrays via comma-split, check intersection.
 * Any match → green, else gray. NO yellow (design decision).
 */
export function compareDirector(guess: string | null, solution: string | null): ColumnFeedback {
  if (!guess || !solution) return { result: 'gray' }

  const normalize = (d: string): string[] =>
    d
      .toLowerCase()
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

  const guessArr = normalize(guess)
  const solutionArr = normalize(solution)

  for (const g of guessArr) {
    if (solutionArr.includes(g)) return { result: 'green' }
  }

  return { result: 'gray' }
}

/** Rating (vote_average): ±0.2 → green, ±0.5 → yellow, else gray + direction */
export function compareRating(guess: number | null, solution: number | null): ColumnFeedback {
  if (guess == null || solution == null) return { result: 'gray' }
  const diff = Math.abs(guess - solution)
  if (diff <= 0.2) return { result: 'green' }
  if (diff <= 0.5) return { result: 'yellow' }
  return {
    result: 'gray',
    direction: guess < solution ? 'up' : 'down',
  }
}

/** Runtime (minutes): ±5 → green, ±15 → yellow, else gray + direction */
export function compareRuntime(guess: number | null, solution: number | null): ColumnFeedback {
  if (guess == null || solution == null) return { result: 'gray' }
  if (guess === solution) return { result: 'green' }
  const diff = Math.abs(guess - solution)
  if (diff <= 5) return { result: 'green' }
  if (diff <= 15) return { result: 'yellow' }
  return {
    result: 'gray',
    direction: guess < solution ? 'up' : 'down',
  }
}

/**
 * Country: set intersection → green, same continent → yellow, else gray.
 * Uses ISO alpha-2 country codes.
 */
export function compareCountry(guess: string[] | null, solution: string[] | null): ColumnFeedback {
  const g = guess ?? []
  const s = solution ?? []

  if (g.length === 0 && s.length === 0) return { result: 'green' }
  if (g.length === 0 || s.length === 0) return { result: 'gray' }

  // Direct country intersection
  const guessUpper = g.map((c) => c.toUpperCase())
  const solutionUpper = s.map((c) => c.toUpperCase())
  const intersection = guessUpper.filter((c) => solutionUpper.includes(c))
  if (intersection.length > 0) return { result: 'green' }

  // Continent proximity
  if (shareSameContinent(guessUpper, solutionUpper)) return { result: 'yellow' }

  return { result: 'gray' }
}

// ─── Full Feedback Calculators ──────────────────────────────────────────────

/** Calculate all 6 column feedbacks for CineMetrics game type. */
export function calculateCineMetricsFeedback(
  guess: FilmData,
  solution: FilmData,
): CineMetricsFeedback {
  return {
    year: compareYear(guess.year, solution.year),
    genres: compareGenres(guess.genres, solution.genres),
    director: compareDirector(guess.director, solution.director),
    rating: compareRating(guess.vote_average, solution.vote_average),
    runtime: compareRuntime(guess.runtime, solution.runtime),
    country: compareCountry(guess.country, solution.country),
  }
}

/**
 * Calculate Logline feedback.
 * Returns correct=true if guess matches, or the next word to reveal.
 *
 * @param isCorrectGuess - Whether the guessed film matches the solution
 * @param redactionWords - Ordered list of redacted words from puzzle_data
 * @param revealedCount - How many words have been revealed so far
 */
export function calculateLoglineFeedback(
  isCorrectGuess: boolean,
  redactionWords: string[],
  revealedCount: number,
): { correct: boolean; reveal: LoglineReveal | null } {
  if (isCorrectGuess) {
    return { correct: true, reveal: null }
  }

  // Find next unrevealed word
  if (revealedCount < redactionWords.length) {
    return {
      correct: false,
      reveal: {
        revealed_index: revealedCount,
        revealed_word: redactionWords[revealedCount],
      },
    }
  }

  // All words revealed, still wrong
  return { correct: false, reveal: null }
}

// ─── Logline Semantic Hints ──────────────────────────────────────────────────

export type SemanticMatch = 'same' | 'close' | 'different'

export interface LoglineSemanticHints {
  /** Tür eşleşmesi: same = aynı, close = ortak tür var, different = hiç örtüşmüyor */
  genre_match: SemanticMatch
  /** Dönem eşleşmesi: same = aynı on yıl, close = ±10 yıl, different = uzak */
  decade_match: SemanticMatch
  /** Tahmin edilen filmin ana türü (oyuncuya gösterilir) */
  guess_genre: string
  /** Tahmin edilen filmin on yılı (oyuncuya gösterilir) */
  guess_decade: string
}

/**
 * Logline yanlış tahminleri için semantic ipuçları üretir.
 * Tahmin edilen film ile çözüm filmini tür ve dönem bazında karşılaştırır.
 * Çözüm bilgisi SIZMAZ — sadece eşleşme derecesi döner.
 */
export function calculateLoglineSemanticHints(
  guessFilm: FilmData,
  solutionFilm: FilmData,
): LoglineSemanticHints {
  // Tür karşılaştırması
  const guessGenres = new Set((guessFilm.genres ?? []).map((g) => g.toLowerCase().trim()))
  const solutionGenres = new Set((solutionFilm.genres ?? []).map((g) => g.toLowerCase().trim()))

  let genre_match: SemanticMatch = 'different'
  if (guessGenres.size > 0 && solutionGenres.size > 0) {
    if (guessGenres.size === solutionGenres.size && [...guessGenres].every((g) => solutionGenres.has(g))) {
      genre_match = 'same'
    } else {
      for (const g of guessGenres) {
        if (solutionGenres.has(g)) {
          genre_match = 'close'
          break
        }
      }
    }
  }

  // Dönem karşılaştırması
  const guessYear = guessFilm.year ?? 0
  const solutionYear = solutionFilm.year ?? 0
  const guessDecade = Math.floor(guessYear / 10) * 10
  const solutionDecade = Math.floor(solutionYear / 10) * 10
  const decadeDiff = Math.abs(guessDecade - solutionDecade)

  let decade_match: SemanticMatch = 'different'
  if (guessYear > 0 && solutionYear > 0) {
    if (decadeDiff === 0) {
      decade_match = 'same'
    } else if (decadeDiff <= 10) {
      decade_match = 'close'
    }
  }

  // Oyuncuya gösterilecek bilgiler (kendi tahmininin bilgileri — çözüm değil)
  const mainGenre = guessFilm.genres?.[0] ?? 'Unknown'
  const decadeStr = guessYear > 0 ? `${guessDecade}s` : '?'

  return {
    genre_match,
    decade_match,
    guess_genre: mainGenre,
    guess_decade: decadeStr,
  }
}
