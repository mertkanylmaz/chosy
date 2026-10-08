/**
 * UnlockCountdown görünüm hesabı (dakika tavanı). Saniye hanesi yok.
 * Run: deno test tests/gauntlet/unlockCountdownDisplay.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { displayParts } from '../../components/gauntlet/UnlockCountdown/displayParts.ts'

const H = 3_600_000
const M = 60_000
const S = 1_000

Deno.test('tam sıfır → 00:00', () => {
  assertEquals(displayParts(0), { hours: 0, minutes: 0 })
})

Deno.test('0 < kalan < 60 sn → 00:01 (00:00 değil)', () => {
  assertEquals(displayParts(1), { hours: 0, minutes: 1 })
  assertEquals(displayParts(30 * S), { hours: 0, minutes: 1 })
  assertEquals(displayParts(59 * S + 999), { hours: 0, minutes: 1 })
})

Deno.test('tam dakika sınırı: 60 sn → 00:01, 60 sn + 1 ms → 00:02', () => {
  assertEquals(displayParts(M), { hours: 0, minutes: 1 })
  assertEquals(displayParts(M + 1), { hours: 0, minutes: 2 })
})

Deno.test('saat sınırı taşar: 59 dk 30 sn → 01:00', () => {
  assertEquals(displayParts(59 * M + 30 * S), { hours: 1, minutes: 0 })
  assertEquals(displayParts(H), { hours: 1, minutes: 0 })
})

Deno.test('2 sa 49 dk 13 sn → 02:50', () => {
  assertEquals(displayParts(2 * H + 49 * M + 13 * S), { hours: 2, minutes: 50 })
})

Deno.test('negatif kalan sıfıra kenetlenir', () => {
  assertEquals(displayParts(-5 * S), { hours: 0, minutes: 0 })
})
