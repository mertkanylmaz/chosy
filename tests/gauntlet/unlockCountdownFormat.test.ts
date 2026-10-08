/**
 * UnlockCountdown inline süre biçimi. displayParts (dakika tavan) ile birlikte.
 * Run: deno test tests/gauntlet/unlockCountdownFormat.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { displayParts } from '../../components/gauntlet/UnlockCountdown/displayParts.ts'
import {
  formatDuration,
  type DurationKey,
} from '../../components/gauntlet/UnlockCountdown/formatDuration.ts'

const H = 3_600_000
const M = 60_000
const S = 1_000

const EN: Record<DurationKey, string> = {
  durationHoursMinutes: '%{hours}h %{minutes}m',
  durationMinutes: '%{minutes}m',
}
const TR: Record<DurationKey, string> = {
  durationHoursMinutes: '%{hours} sa %{minutes} dk',
  durationMinutes: '%{minutes} dk',
}

const fmt = (table: Record<DurationKey, string>) => (ms: number): string =>
  formatDuration(displayParts(ms), (key, vars) =>
    table[key]
      .replace('%{hours}', String(vars.hours))
      .replace('%{minutes}', String(vars.minutes)))

Deno.test('0 < kalan < 60 sn → "1m" (0m değil)', () => {
  assertEquals(fmt(EN)(1), '1m')
  assertEquals(fmt(EN)(30 * S), '1m')
  assertEquals(fmt(EN)(60 * S), '1m')
})

Deno.test('59 dakika → "59m"', () => {
  assertEquals(fmt(EN)(59 * M), '59m')
})

Deno.test('tam 1 saat → "1h 0m" (saat varken dakika düşmez)', () => {
  assertEquals(fmt(EN)(H), '1h 0m')
})

Deno.test('2 sa 50 dk → "2h 50m"', () => {
  assertEquals(fmt(EN)(2 * H + 50 * M), '2h 50m')
})

Deno.test('TR şablonları', () => {
  assertEquals(fmt(TR)(30 * S), '1 dk')
  assertEquals(fmt(TR)(2 * H + 50 * M), '2 sa 50 dk')
})
