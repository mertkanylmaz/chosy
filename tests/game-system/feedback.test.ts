/**
 * Unit tests for feedback.ts — CineMetrics and Logline feedback calculation.
 *
 * Each CineMetrics column has at least 3 scenarios: green, yellow, gray + edge cases.
 * Logline: correct and incorrect with reveal logic.
 *
 * NOTE: These tests import from the Edge Function _shared directory.
 * To run with Deno: deno test tests/game-system/feedback.test.ts
 * To run with Jest/Vitest: adjust imports (remove .ts extension).
 */

// For Deno test runner
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  compareYear,
  compareGenres,
  compareDirector,
  compareRating,
  compareRuntime,
  compareCountry,
  calculateCineMetricsFeedback,
  calculateLoglineFeedback,
} from '../../supabase/functions/_shared/feedback.ts'

// ─── Year ────────────────────────────────────────────────────────────────────

Deno.test('compareYear: exact match → green', () => {
  assertEquals(compareYear(1994, 1994), { result: 'green' })
})

Deno.test('compareYear: within 5 years → yellow', () => {
  assertEquals(compareYear(1997, 1994), { result: 'yellow' })
  assertEquals(compareYear(1990, 1994), { result: 'yellow' })
})

Deno.test('compareYear: outside 5 years → gray + direction', () => {
  const result = compareYear(1980, 1994)
  assertEquals(result.result, 'gray')
  assertEquals(result.direction, 'up') // guess < solution → "go up"
})

Deno.test('compareYear: guess higher → direction down', () => {
  const result = compareYear(2010, 1994)
  assertEquals(result.result, 'gray')
  assertEquals(result.direction, 'down')
})

Deno.test('compareYear: null handling', () => {
  assertEquals(compareYear(null, 1994), { result: 'gray' })
  assertEquals(compareYear(1994, null), { result: 'gray' })
  assertEquals(compareYear(null, null), { result: 'gray' })
})

Deno.test('compareYear: boundary ±5 edge', () => {
  assertEquals(compareYear(1989, 1994), { result: 'yellow' }) // diff = 5, inclusive
  const result = compareYear(1988, 1994) // diff = 6
  assertEquals(result.result, 'gray')
})

// ─── Genres ──────────────────────────────────────────────────────────────────

Deno.test('compareGenres: exact same set → green', () => {
  assertEquals(
    compareGenres(['Action', 'Drama'], ['drama', 'action']),
    { result: 'green' },
  )
})

Deno.test('compareGenres: partial overlap → yellow', () => {
  assertEquals(
    compareGenres(['Action', 'Comedy'], ['Action', 'Drama']),
    { result: 'yellow' },
  )
})

Deno.test('compareGenres: no overlap → gray', () => {
  assertEquals(
    compareGenres(['Comedy', 'Romance'], ['Horror', 'Thriller']),
    { result: 'gray' },
  )
})

Deno.test('compareGenres: null/empty handling', () => {
  assertEquals(compareGenres(null, ['Drama']), { result: 'gray' })
  assertEquals(compareGenres([], ['Drama']), { result: 'gray' })
  assertEquals(compareGenres(null, null), { result: 'green' })
})

Deno.test('compareGenres: case insensitive', () => {
  assertEquals(
    compareGenres(['DRAMA'], ['drama']),
    { result: 'green' },
  )
})

// ─── Director ────────────────────────────────────────────────────────────────

Deno.test('compareDirector: exact match → green', () => {
  assertEquals(compareDirector('Christopher Nolan', 'Christopher Nolan'), { result: 'green' })
})

Deno.test('compareDirector: case insensitive → green', () => {
  assertEquals(
    compareDirector('christopher nolan', 'Christopher Nolan'),
    { result: 'green' },
  )
})

Deno.test('compareDirector: comma-separated co-directors, partial match → green', () => {
  assertEquals(
    compareDirector('Lana Wachowski', 'Lana Wachowski, Lilly Wachowski'),
    { result: 'green' },
  )
})

Deno.test('compareDirector: no match → gray (NO yellow)', () => {
  assertEquals(
    compareDirector('Steven Spielberg', 'Christopher Nolan'),
    { result: 'gray' },
  )
})

Deno.test('compareDirector: null handling', () => {
  assertEquals(compareDirector(null, 'Nolan'), { result: 'gray' })
  assertEquals(compareDirector('Nolan', null), { result: 'gray' })
})

// ─── Rating ──────────────────────────────────────────────────────────────────

Deno.test('compareRating: exact match → green', () => {
  assertEquals(compareRating(8.5, 8.5), { result: 'green' })
})

Deno.test('compareRating: within 0.2 → green', () => {
  assertEquals(compareRating(8.3, 8.5), { result: 'green' })
  assertEquals(compareRating(8.7, 8.5), { result: 'green' })
})

Deno.test('compareRating: within 0.5 → yellow', () => {
  assertEquals(compareRating(8.0, 8.5), { result: 'yellow' })
  assertEquals(compareRating(9.0, 8.5), { result: 'yellow' })
})

Deno.test('compareRating: outside 0.5 → gray + direction', () => {
  const result = compareRating(6.0, 8.5)
  assertEquals(result.result, 'gray')
  assertEquals(result.direction, 'up')
})

Deno.test('compareRating: guess higher → direction down', () => {
  const result = compareRating(9.5, 8.0)
  assertEquals(result.result, 'gray')
  assertEquals(result.direction, 'down')
})

Deno.test('compareRating: null handling', () => {
  assertEquals(compareRating(null, 8.5), { result: 'gray' })
})

Deno.test('compareRating: boundary 0.2 edge', () => {
  assertEquals(compareRating(8.3, 8.5).result, 'green') // diff = 0.2
  assertEquals(compareRating(8.0, 8.5).result, 'yellow') // diff = 0.5
})

// ─── Runtime ─────────────────────────────────────────────────────────────────

Deno.test('compareRuntime: exact match → green', () => {
  assertEquals(compareRuntime(120, 120), { result: 'green' })
})

Deno.test('compareRuntime: within 5 minutes → green', () => {
  assertEquals(compareRuntime(117, 120), { result: 'green' })
  assertEquals(compareRuntime(125, 120), { result: 'green' })
})

Deno.test('compareRuntime: within 15 minutes → yellow', () => {
  assertEquals(compareRuntime(110, 120), { result: 'yellow' })
  assertEquals(compareRuntime(135, 120), { result: 'yellow' })
})

Deno.test('compareRuntime: outside 15 minutes → gray + direction', () => {
  const result = compareRuntime(90, 120)
  assertEquals(result.result, 'gray')
  assertEquals(result.direction, 'up')
})

Deno.test('compareRuntime: guess higher → direction down', () => {
  const result = compareRuntime(180, 120)
  assertEquals(result.result, 'gray')
  assertEquals(result.direction, 'down')
})

Deno.test('compareRuntime: null handling', () => {
  assertEquals(compareRuntime(120, null), { result: 'gray' })
})

Deno.test('compareRuntime: boundary 5 edge', () => {
  assertEquals(compareRuntime(115, 120).result, 'green') // diff = 5
  assertEquals(compareRuntime(114, 120).result, 'yellow') // diff = 6
})

Deno.test('compareRuntime: boundary 15 edge', () => {
  assertEquals(compareRuntime(105, 120).result, 'yellow') // diff = 15
  const r = compareRuntime(104, 120) // diff = 16
  assertEquals(r.result, 'gray')
})

// ─── Country ─────────────────────────────────────────────────────────────────

Deno.test('compareCountry: exact country match → green', () => {
  assertEquals(compareCountry(['US'], ['US']), { result: 'green' })
})

Deno.test('compareCountry: partial country overlap → green', () => {
  assertEquals(
    compareCountry(['US', 'GB'], ['GB', 'FR']),
    { result: 'green' },
  )
})

Deno.test('compareCountry: same continent, no country match → yellow', () => {
  assertEquals(
    compareCountry(['FR'], ['DE']),
    { result: 'yellow' }, // both Europe
  )
})

Deno.test('compareCountry: different continent → gray', () => {
  assertEquals(
    compareCountry(['US'], ['JP']),
    { result: 'gray' },
  )
})

Deno.test('compareCountry: null/empty handling', () => {
  assertEquals(compareCountry(null, ['US']), { result: 'gray' })
  assertEquals(compareCountry([], ['US']), { result: 'gray' })
  assertEquals(compareCountry(null, null), { result: 'green' })
})

Deno.test('compareCountry: case insensitive', () => {
  assertEquals(compareCountry(['us'], ['US']), { result: 'green' })
})

// ─── Full CineMetrics ───────────────────────────────────────────────────────

Deno.test('calculateCineMetricsFeedback: all green (same film)', () => {
  const film = {
    year: 1994,
    genres: ['Drama', 'Crime'],
    director: 'Frank Darabont',
    vote_average: 9.3,
    runtime: 142,
    country: ['US'],
  }
  const result = calculateCineMetricsFeedback(film, film)
  assertEquals(result.year.result, 'green')
  assertEquals(result.genres.result, 'green')
  assertEquals(result.director.result, 'green')
  assertEquals(result.rating.result, 'green')
  assertEquals(result.runtime.result, 'green')
  assertEquals(result.country.result, 'green')
})

Deno.test('calculateCineMetricsFeedback: mixed results', () => {
  const guess = {
    year: 2000,
    genres: ['Drama'],
    director: 'David Fincher',
    vote_average: 8.0,
    runtime: 160,
    country: ['US'],
  }
  const solution = {
    year: 1994,
    genres: ['Drama', 'Crime'],
    director: 'Frank Darabont',
    vote_average: 9.3,
    runtime: 142,
    country: ['US'],
  }
  const result = calculateCineMetricsFeedback(guess, solution)
  assertEquals(result.year.result, 'gray') // diff = 6 → outside ±5 threshold
  assertEquals(result.genres.result, 'yellow') // Drama overlaps
  assertEquals(result.director.result, 'gray') // different
  assertEquals(result.country.result, 'green') // same US
})

// ─── Logline ─────────────────────────────────────────────────────────────────

Deno.test('calculateLoglineFeedback: correct guess', () => {
  const result = calculateLoglineFeedback(true, ['prison', 'hope', 'freedom'], 0)
  assertEquals(result.correct, true)
  assertEquals(result.reveal, null)
})

Deno.test('calculateLoglineFeedback: wrong guess, reveals next word', () => {
  const result = calculateLoglineFeedback(false, ['prison', 'hope', 'freedom'], 0)
  assertEquals(result.correct, false)
  assertEquals(result.reveal, { revealed_index: 0, revealed_word: 'prison' })
})

Deno.test('calculateLoglineFeedback: wrong guess, second reveal', () => {
  const result = calculateLoglineFeedback(false, ['prison', 'hope', 'freedom'], 1)
  assertEquals(result.correct, false)
  assertEquals(result.reveal, { revealed_index: 1, revealed_word: 'hope' })
})

Deno.test('calculateLoglineFeedback: all words revealed, still wrong', () => {
  const result = calculateLoglineFeedback(false, ['prison', 'hope', 'freedom'], 3)
  assertEquals(result.correct, false)
  assertEquals(result.reveal, null)
})

Deno.test('calculateLoglineFeedback: empty redaction words', () => {
  const result = calculateLoglineFeedback(false, [], 0)
  assertEquals(result.correct, false)
  assertEquals(result.reveal, null)
})
