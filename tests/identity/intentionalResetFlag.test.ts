/**
 * Unit tests — kasıtlı sıfırlama bayrağı (identity_reset, Sprint 1).
 *
 * Saf mantık; saat enjekte edilir, cihaz/ağ gerekmez.
 * Run: deno test tests/identity/intentionalResetFlag.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  createIntentionalResetFlag,
  INTENTIONAL_RESET_TTL_MS,
} from '../../utils/intentionalResetFlag.ts'

/** Elle ilerletilen saat. */
function fakeClock(start = 1_000_000) {
  let t = start
  return {
    now: () => t,
    advance: (ms: number) => {
      t += ms
    },
  }
}

Deno.test('mark → consume true, ikinci consume false (tek kullanım)', () => {
  const clock = fakeClock()
  const flag = createIntentionalResetFlag(clock.now)

  flag.mark()
  clock.advance(300) // signOut → SIGNED_OUT gecikmesi
  assertEquals(flag.consume(), true)
  assertEquals(flag.consume(), false)
})

Deno.test('mark, 31 sn sonra consume → false (süre doldu)', () => {
  const clock = fakeClock()
  const flag = createIntentionalResetFlag(clock.now)

  flag.mark()
  clock.advance(31_000)
  assertEquals(flag.consume(), false)
})

Deno.test('mark, signOut hatası temizliği sonrası consume → false', () => {
  const clock = fakeClock()
  const flag = createIntentionalResetFlag(clock.now)

  // resetToFreshSession: mark → signOut hata döner → erken temizlik
  flag.mark()
  flag.consume()
  // Sonraki (gerçek) SIGNED_OUT süre içinde gelse de bastırılmaz.
  clock.advance(1_000)
  assertEquals(flag.consume(), false)
})

Deno.test('sınır: tam TTL anında consume → true, TTL+1 ms → false', () => {
  const clock = fakeClock()
  const flag = createIntentionalResetFlag(clock.now)

  flag.mark()
  clock.advance(INTENTIONAL_RESET_TTL_MS)
  assertEquals(flag.consume(), true)

  flag.mark()
  clock.advance(INTENTIONAL_RESET_TTL_MS + 1)
  assertEquals(flag.consume(), false)
})

Deno.test('mark yokken consume → false', () => {
  const flag = createIntentionalResetFlag(fakeClock().now)
  assertEquals(flag.consume(), false)
})
