/**
 * P-4a — Spotlight "NEXT PUZZLE" sayacı sonraki yerel 18:00'e sayar.
 * Hedef kuralının kendisi tests/gauntlet/unlockClock.test.ts'te; burada
 * sayacın o hedefe bağlandığı ve gece yarısına SAYMADIĞI kanıtlanır.
 * Run: npm run test:next-puzzle
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { nextPuzzleCountdown } from '../../components/games/Spotlight/nextPuzzleClock.ts'

// Yerel saatle kurulur; 4 Eki 2026 hiçbir yaygın dilimde DST geçiş günü değil.
const at = (h: number, mi = 0, s = 0, d = 4) => new Date(2026, 9, d, h, mi, s, 0)

Deno.test('17:59 → 1 dakika (bugün 18:00)', () => {
  assertEquals(nextPuzzleCountdown(at(17, 59)), '00:01:00')
})

Deno.test('18:00 tam → 24 saat (yarın 18:00, kapı ile tutarlı)', () => {
  assertEquals(nextPuzzleCountdown(at(18, 0)), '24:00:00')
})

Deno.test('23:59 → 18:01 (gece yarısına 00:01 DEĞİL)', () => {
  assertEquals(nextPuzzleCountdown(at(23, 59)), '18:01:00')
})

Deno.test('00:00 → 18 saat (aynı gün 18:00)', () => {
  assertEquals(nextPuzzleCountdown(at(0, 0, 0, 5)), '18:00:00')
})
