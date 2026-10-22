/**
 * Unit tests — saat sapması tespiti (AUTH-LOOP Faz 1).
 * Run: deno test tests/identity/clockSkew.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { CLOCK_SKEW_THRESHOLD_S, detectClockSkew } from '../../utils/clockSkew.ts'

const NOW_MS = 1_800_000_000_000
const NOW_S = NOW_MS / 1000

/** Sunucu zamanı `serverS`'te verilmiş, `expiresIn` ömürlü oturum. */
const issuedAt = (serverS: number, expiresIn = 3600) => ({
  expires_at: serverS + expiresIn,
  expires_in: expiresIn,
})

Deno.test('saat senkron: null', () => {
  assertEquals(detectClockSkew(issuedAt(NOW_S), NOW_MS), null)
  assertEquals(detectClockSkew(issuedAt(NOW_S + 2), NOW_MS), null)
})

Deno.test('eşik ve altı raporlanmaz, üstü raporlanır', () => {
  assertEquals(detectClockSkew(issuedAt(NOW_S + CLOCK_SKEW_THRESHOLD_S), NOW_MS), null)
  assertEquals(
    detectClockSkew(issuedAt(NOW_S + CLOCK_SKEW_THRESHOLD_S + 1), NOW_MS),
    { skewS: CLOCK_SKEW_THRESHOLD_S + 1, expiresIn: 3600 },
  )
})

Deno.test('işaret: cihaz geride +, ileride −', () => {
  assertEquals(detectClockSkew(issuedAt(NOW_S + 7200), NOW_MS)?.skewS, 7200)
  assertEquals(detectClockSkew(issuedAt(NOW_S - 7200), NOW_MS)?.skewS, -7200)
})

Deno.test('eksik ya da sonsuz alan: null', () => {
  assertEquals(detectClockSkew({}, NOW_MS), null)
  assertEquals(detectClockSkew({ expires_at: NOW_S, expires_in: null }, NOW_MS), null)
  assertEquals(detectClockSkew({ expires_at: Infinity, expires_in: 3600 }, NOW_MS), null)
})
