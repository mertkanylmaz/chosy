/**
 * Unit tests — NO_PUZZLE ayrımı (utils/puzzleAvailability.ts, P-1c E).
 * Run: npm run test:puzzle-availability
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  isNoPuzzleResponse,
  isPuzzleUnavailableError,
  NO_PUZZLE_CODE,
  PuzzleUnavailableError,
} from '../../utils/puzzleAvailability.ts'

Deno.test('404 + error NO_PUZZLE → unavailable', () => {
  assertEquals(
    isNoPuzzleResponse(404, { error: NO_PUZZLE_CODE, message: "Today's puzzle is not ready yet" }),
    true,
  )
})

Deno.test('başka 404 (yanlış route / eksik deploy) → NO_PUZZLE DEĞİL', () => {
  assertEquals(isNoPuzzleResponse(404, { error: 'NOT_FOUND' }), false)
  assertEquals(isNoPuzzleResponse(404, { message: 'Requested function was not found' }), false)
})

Deno.test('NO_PUZZLE kodu ama 404 değil → gerçek hata yolu', () => {
  assertEquals(isNoPuzzleResponse(500, { error: NO_PUZZLE_CODE }), false)
  assertEquals(isNoPuzzleResponse(200, { error: NO_PUZZLE_CODE }), false)
})

Deno.test('gövde okunamadı / status yok → NO_PUZZLE DEĞİL', () => {
  assertEquals(isNoPuzzleResponse(404, null), false)
  assertEquals(isNoPuzzleResponse(404, 'NO_PUZZLE'), false)
  assertEquals(isNoPuzzleResponse(null, { error: NO_PUZZLE_CODE }), false)
  assertEquals(isNoPuzzleResponse(undefined, { error: NO_PUZZLE_CODE }), false)
})

Deno.test('PuzzleUnavailableError tanınır, alanları taşır', () => {
  const e = new PuzzleUnavailableError('spotlight', '2026-10-14')
  assertEquals(isPuzzleUnavailableError(e), true)
  assertEquals(e.gameId, 'spotlight')
  assertEquals(e.puzzleDate, '2026-10-14')
  assertEquals(e.name, 'PuzzleUnavailableError')
})

Deno.test('prototip zinciri kopsa da name ile tanınır (Babel extends Error)', () => {
  const e = new Error('x')
  e.name = 'PuzzleUnavailableError'
  assertEquals(isPuzzleUnavailableError(e), true)
})

Deno.test('ağ hatası / genel hata → unavailable DEĞİL (fatal yolu korunur)', () => {
  assertEquals(isPuzzleUnavailableError(new TypeError('Network request failed')), false)
  assertEquals(isPuzzleUnavailableError(new Error('Edge Function returned a non-2xx status code')), false)
  assertEquals(isPuzzleUnavailableError(null), false)
  assertEquals(isPuzzleUnavailableError('PuzzleUnavailableError'), false)
})
