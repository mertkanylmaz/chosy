/**
 * Archetype-aware hint engine for Posterle.
 *
 * Builds ordered hint sequences revealed across 6 attempts.
 * Adapted to work with MoodFlix film schema (overview not plot, year not release_date).
 */

export interface FilmHintContext {
  title: string
  genres: string[] | null
  year: number | null // MoodFlix uses year (INT), not release_date
  director: string | null
  cast: string[] | null // extracted from cast_json
  overview: string | null // MoodFlix uses overview, not mood_tags
  runtime: number | null
  vote_average: number | null
  original_language: string | null
}

export interface Hint {
  type:
    | 'genre'
    | 'decade'
    | 'year'
    | 'director'
    | 'cast'
    | 'mood'
    | 'runtime'
    | 'writer'
    | 'rating'
  value: string
}

const ARCHETYPES = [
  'The Analyst',
  'The Dreamer',
  'The Critic',
  'The Romantic',
  'The Adventurer',
  'The Philosopher',
  'The Aesthete',
  'The Comedian',
  'The Realist',
  'The Nostalgic',
  'The Rebel',
  'The Explorer',
] as const

export type Archetype = (typeof ARCHETYPES)[number] | 'default'

// ----------------------------------------------------------------------------
// Hint builders
// ----------------------------------------------------------------------------

function genreHint(film: FilmHintContext): Hint | null {
  if (!film.genres?.length) return null
  return { type: 'genre', value: film.genres[0] }
}

function genresCombinedHint(film: FilmHintContext): Hint | null {
  if (!film.genres?.length) return null
  return { type: 'genre', value: film.genres.slice(0, 2).join(' / ') }
}

function decadeHint(film: FilmHintContext): Hint | null {
  if (!film.year) return null
  return { type: 'decade', value: `${Math.floor(film.year / 10) * 10}s` }
}

function yearHint(film: FilmHintContext): Hint | null {
  if (!film.year) return null
  return { type: 'year', value: String(film.year) }
}

function directorHint(film: FilmHintContext): Hint | null {
  if (!film.director) return null
  return { type: 'director', value: film.director }
}

function castHint(film: FilmHintContext): Hint | null {
  if (!film.cast?.length) return null
  return { type: 'cast', value: film.cast[0] }
}

/**
 * Mood hint — extracts a keyword from overview since mood_tags
 * doesn't exist as a column. Falls back to genre if overview empty.
 */
function moodHint(film: FilmHintContext, index = 0): Hint | null {
  if (film.overview && film.overview.length > 20) {
    // Extract first sentence as a mood teaser (truncated)
    const sentences = film.overview.split(/[.!?]/).filter(Boolean)
    if (sentences.length > index) {
      const teaser = sentences[Math.min(index, sentences.length - 1)].trim()
      if (teaser.length > 5) {
        return { type: 'mood', value: teaser.length > 60 ? teaser.substring(0, 57) + '...' : teaser }
      }
    }
  }
  // Fallback to genre
  if (film.genres?.length) {
    return { type: 'mood', value: film.genres.join(', ') }
  }
  return null
}

function runtimeHint(film: FilmHintContext): Hint | null {
  if (!film.runtime) return null
  const bucket =
    film.runtime < 90 ? '< 90 min' : film.runtime <= 120 ? '90-120 min' : '> 120 min'
  return { type: 'runtime', value: bucket }
}

function ratingHint(film: FilmHintContext): Hint | null {
  if (film.vote_average == null) return null
  return { type: 'rating', value: `${film.vote_average.toFixed(1)}/10` }
}

// ----------------------------------------------------------------------------
// Archetype-specific hint sequences (attempts 2-6)
// ----------------------------------------------------------------------------

const HINT_SEQUENCES: Record<Archetype, ((f: FilmHintContext) => Hint | null)[]> = {
  default: [
    (f) => genreHint(f),
    (f) => decadeHint(f),
    (f) => directorHint(f),
    (f) => castHint(f),
    (f) => moodHint(f),
  ],
  'The Analyst': [
    (f) => genresCombinedHint(f),
    (f) => yearHint(f),
    (f) => directorHint(f),
    (f) => runtimeHint(f),
    (f) => ratingHint(f),
  ],
  'The Dreamer': [
    (f) => moodHint(f, 0),
    (f) => decadeHint(f),
    (f) => moodHint(f, 1),
    (f) => castHint(f),
    (f) => genreHint(f),
  ],
  'The Critic': [
    (f) => directorHint(f),
    (f) => yearHint(f),
    (f) => ratingHint(f),
    (f) => runtimeHint(f),
    (f) => genresCombinedHint(f),
  ],
  'The Romantic': [
    (f) => moodHint(f, 0),
    (f) => decadeHint(f),
    (f) => castHint(f),
    (f) => directorHint(f),
    (f) => genreHint(f),
  ],
  'The Adventurer': [
    (f) => genreHint(f),
    (f) => runtimeHint(f),
    (f) => yearHint(f),
    (f) => castHint(f),
    (f) => moodHint(f),
  ],
  'The Philosopher': [
    (f) => moodHint(f, 0),
    (f) => directorHint(f),
    (f) => decadeHint(f),
    (f) => runtimeHint(f),
    (f) => genresCombinedHint(f),
  ],
  'The Aesthete': [
    (f) => decadeHint(f),
    (f) => directorHint(f),
    (f) => moodHint(f, 0),
    (f) => castHint(f),
    (f) => genreHint(f),
  ],
  'The Comedian': [
    (f) => genreHint(f),
    (f) => castHint(f),
    (f) => yearHint(f),
    (f) => directorHint(f),
    (f) => moodHint(f),
  ],
  'The Realist': [
    (f) => yearHint(f),
    (f) => directorHint(f),
    (f) => runtimeHint(f),
    (f) => castHint(f),
    (f) => genreHint(f),
  ],
  'The Nostalgic': [
    (f) => decadeHint(f),
    (f) => moodHint(f, 0),
    (f) => castHint(f),
    (f) => directorHint(f),
    (f) => genreHint(f),
  ],
  'The Rebel': [
    (f) => moodHint(f, 0),
    (f) => directorHint(f),
    (f) => yearHint(f),
    (f) => castHint(f),
    (f) => genresCombinedHint(f),
  ],
  'The Explorer': [
    (f) => genresCombinedHint(f),
    (f) => decadeHint(f),
    (f) => castHint(f),
    (f) => moodHint(f),
    (f) => directorHint(f),
  ],
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Returns the hint for a given attempt number (1-6) and archetype.
 * Attempt 1: no hint. Attempts 2-6: ordered hint sequence.
 */
export function getHintForAttempt(
  attemptNumber: number,
  archetype: Archetype | string | null,
  film: FilmHintContext
): Hint | null {
  if (attemptNumber < 2 || attemptNumber > 6) return null

  const sequence =
    HINT_SEQUENCES[(archetype as Archetype) ?? 'default'] ?? HINT_SEQUENCES.default

  // Try archetype-specific hint first
  const primary = sequence[attemptNumber - 2]
  const primaryResult = primary(film)
  if (primaryResult) return primaryResult

  // Fallback: other positions in same sequence
  for (let i = 0; i < sequence.length; i++) {
    if (i === attemptNumber - 2) continue
    const fallback = sequence[i](film)
    if (fallback) return fallback
  }

  // Last resort: default sequence
  if (archetype !== 'default') {
    for (const fn of HINT_SEQUENCES.default) {
      const result = fn(film)
      if (result) return result
    }
  }

  return null
}

/**
 * Pixelation/blur level for a given attempt count (0-5+).
 * Higher attempts = lower blur = clearer image.
 */
export function getPixelationLevel(attemptsUsed: number): number {
  const levels = [60, 40, 24, 14, 8, 4]
  return levels[Math.min(Math.max(attemptsUsed, 0), 5)]
}
