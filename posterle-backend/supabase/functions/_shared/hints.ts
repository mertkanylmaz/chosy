// Archetype-aware hint engine.
// Builds the ordered hint sequence revealed across 6 attempts.

export interface FilmHintContext {
  title: string
  genres: string[] | null
  release_year: number | null
  director: string | null
  writer: string | null
  cast: string[] | null
  mood_tags: string[] | null
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
  if (!film.release_year) return null
  return { type: 'decade', value: `${Math.floor(film.release_year / 10) * 10}s` }
}

function yearHint(film: FilmHintContext): Hint | null {
  if (!film.release_year) return null
  return { type: 'year', value: String(film.release_year) }
}

function directorHint(film: FilmHintContext): Hint | null {
  if (!film.director) return null
  return { type: 'director', value: film.director }
}

function writerHint(film: FilmHintContext): Hint | null {
  const writer = film.writer || film.director
  if (!writer) return null
  return { type: 'writer', value: writer }
}

function castHint(film: FilmHintContext): Hint | null {
  if (!film.cast?.length) return null
  return { type: 'cast', value: film.cast[0] }
}

function moodHint(film: FilmHintContext, index = 0): Hint | null {
  if (!film.mood_tags?.length) return null
  const tag = film.mood_tags[Math.min(index, film.mood_tags.length - 1)]
  return { type: 'mood', value: tag }
}

function runtimeHint(film: FilmHintContext): Hint | null {
  if (!film.runtime) return null
  const bucket =
    film.runtime < 90 ? '< 90 min' : film.runtime <= 120 ? '90–120 min' : '> 120 min'
  return { type: 'runtime', value: bucket }
}

function ratingHint(film: FilmHintContext): Hint | null {
  if (film.vote_average == null) return null
  return { type: 'rating', value: `IMDB: ${film.vote_average.toFixed(1)}/10` }
}

// ----------------------------------------------------------------------------
// Archetype-specific hint sequences
// Each archetype gets a 5-hint sequence (revealed on attempts 2-6).
// Attempt 1 reveals no hint (only pixelation reduction).
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
    (f) => writerHint(f),
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
    (f) => writerHint(f),
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
    (f) => writerHint(f),
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
 * Returns the hint to reveal for a given attempt number (1-6) and archetype.
 * - Attempt 1: no hint (only pixelation changes)
 * - Attempts 2-6: ordered hint sequence
 * Falls back to non-null hints if the archetype-specific one is missing data.
 */
export function getHintForAttempt(
  attemptNumber: number,
  archetype: Archetype | string | null,
  film: FilmHintContext
): Hint | null {
  if (attemptNumber < 2 || attemptNumber > 6) return null

  const sequence =
    HINT_SEQUENCES[(archetype as Archetype) ?? 'default'] ?? HINT_SEQUENCES.default

  // Try the archetype-specific hint at this position first
  const primary = sequence[attemptNumber - 2]
  const primaryResult = primary(film)
  if (primaryResult) return primaryResult

  // Fallback: try other positions in the same archetype sequence
  for (let i = 0; i < sequence.length; i++) {
    if (i === attemptNumber - 2) continue
    const fallback = sequence[i](film)
    if (fallback) return fallback
  }

  // Last resort: try the default sequence
  if (archetype !== 'default') {
    for (const fn of HINT_SEQUENCES.default) {
      const result = fn(film)
      if (result) return result
    }
  }

  return null
}

/**
 * Pixelation block size for a given attempt count (0-5+).
 * Higher attempts = smaller blocks = clearer image.
 */
export function getPixelationLevel(attemptsUsed: number): number {
  const levels = [60, 40, 24, 14, 8, 4]
  return levels[Math.min(Math.max(attemptsUsed, 0), 5)]
}
