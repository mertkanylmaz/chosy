/**
 * V-1 Tur 6 — 18:00 kapısı: bir sonraki kapı anı (yerel saat).
 * `getNextUnlockAt()` = __DEV__/e2e bypass + `nextUnlockAfter()`; bypass
 * `isUnlockedNow()` ile aynı iki satır, burada saf kural test edilir.
 * Run: deno test tests/gauntlet/unlockClock.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { UNLOCK_HOUR, nextUnlockAfter } from '../../components/gauntlet/GauntletShell/unlockClock.ts'

const at = (y: number, mo: number, d: number, h: number, mi = 0, s = 0) =>
  new Date(y, mo - 1, d, h, mi, s, 0)

Deno.test('kapı saati 18', () => {
  assertEquals(UNLOCK_HOUR, 18)
})

Deno.test('17:59 → bugün 18:00', () => {
  assertEquals(nextUnlockAfter(at(2026, 9, 28, 17, 59)), at(2026, 9, 28, 18))
})

Deno.test('17:59:59 → bugün 18:00 (son saniye)', () => {
  assertEquals(nextUnlockAfter(at(2026, 9, 28, 17, 59, 59)), at(2026, 9, 28, 18))
})

Deno.test('18:00 tam → yarın 18:00 (kapı açık, isUnlockedNow ile tutarlı)', () => {
  assertEquals(nextUnlockAfter(at(2026, 9, 28, 18)), at(2026, 9, 29, 18))
})

Deno.test('23:59 → yarın 18:00', () => {
  assertEquals(nextUnlockAfter(at(2026, 9, 28, 23, 59)), at(2026, 9, 29, 18))
})

Deno.test('gece yarısı sonrası 00:01 → aynı gün 18:00', () => {
  assertEquals(nextUnlockAfter(at(2026, 9, 29, 0, 1)), at(2026, 9, 29, 18))
})

Deno.test('00:00 tam → aynı gün 18:00', () => {
  assertEquals(nextUnlockAfter(at(2026, 9, 29, 0, 0)), at(2026, 9, 29, 18))
})

Deno.test('ay ve yıl sonu: 31 Ara 20:00 → 1 Oca 18:00', () => {
  assertEquals(nextUnlockAfter(at(2026, 12, 31, 20)), at(2027, 1, 1, 18))
})
