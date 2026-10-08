/**
 * Spotlight "NEXT PUZZLE" sayacı sunucunun `next_cycle_at`'ine sayar (F2/C4);
 * istemci 18:00 hesaplamaz, gece yarısına da saymaz.
 * Run: npm run test:next-puzzle
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { nextPuzzleCountdown } from '../../components/games/Spotlight/nextPuzzleClock.ts'

const NEXT = '2026-10-08T15:00:00.000Z' // İstanbul 18:00
const at = (iso: string) => new Date(iso)

Deno.test('17:59 yerel → 1 dakika', () => {
  assertEquals(nextPuzzleCountdown(at('2026-10-08T14:59:00Z'), NEXT), '00:01:00')
})

Deno.test('cycle başlangıcı (18:00) → 24 saat sonraki geçiş', () => {
  assertEquals(nextPuzzleCountdown(at('2026-10-08T15:00:00Z'), '2026-10-09T15:00:00.000Z'), '24:00:00')
})

Deno.test('23:59 yerel → 18:01 (gece yarısına 00:01 DEĞİL)', () => {
  assertEquals(nextPuzzleCountdown(at('2026-10-08T20:59:00Z'), '2026-10-09T15:00:00.000Z'), '18:01:00')
})

Deno.test('DST bitiş günü: sayaç sunucunun söylediği 25 saatlik aralığı gösterir', () => {
  // New York 31 Eki 18:00 EDT → 1 Kas 18:00 EST (25 saat).
  assertEquals(nextPuzzleCountdown(at('2026-10-31T22:00:00Z'), '2026-11-01T23:00:00.000Z'), '25:00:00')
})

Deno.test('geçiş anı geçmişse 00:00:00 (negatif değil)', () => {
  assertEquals(nextPuzzleCountdown(at('2026-10-08T15:05:00Z'), NEXT), '00:00:00')
})

Deno.test('next_cycle_at yok ya da bozuk → null (uydurma süre yok)', () => {
  assertEquals(nextPuzzleCountdown(at('2026-10-08T12:00:00Z'), undefined), null)
  assertEquals(nextPuzzleCountdown(at('2026-10-08T12:00:00Z'), 'yarın'), null)
})
