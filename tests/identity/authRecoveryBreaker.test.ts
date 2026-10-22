/**
 * Unit tests — anonim oturum kurtarma devre kesicisi (AUTH-LOOP Faz 1).
 *
 * Saf mantık; saat/uyku/uygulama durumu enjekte edilir, ağ gerekmez.
 * Run: deno test tests/identity/authRecoveryBreaker.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  backoffDelayMs,
  COOLDOWN_MS,
  createAuthRecovery,
  isRateLimitError,
  RATE_LIMIT_DEFAULT_WAIT_MS,
  type RecoveryError,
  type TripInfo,
} from '../../utils/authRecoveryBreaker.ts'

/** Elle ilerletilen saat; `sleep` saati ilerletir ve süreyi kaydeder. */
function harness() {
  let t = 1_000_000
  let active = true
  const sleeps: number[] = []
  const trips: TripInfo[] = []
  let signInCalls = 0
  const recovery = createAuthRecovery({
    now: () => t,
    sleep: (ms) => {
      sleeps.push(ms)
      t += ms
      return Promise.resolve()
    },
    isActive: () => active,
    onTrip: (info) => trips.push(info),
  })
  const ok = () => {
    signInCalls += 1
    return Promise.resolve({ data: { id: signInCalls }, error: null })
  }
  const failing = (error: RecoveryError) => () => {
    signInCalls += 1
    return Promise.resolve({ data: null as unknown as { id: number }, error })
  }
  return {
    recovery,
    ok,
    failing,
    sleeps,
    trips,
    calls: () => signInCalls,
    advance: (ms: number) => { t += ms },
    setActive: (v: boolean) => { active = v },
  }
}

Deno.test('backoff dizisi 1,2,4,8 sn ve tavan 60 sn', () => {
  assertEquals([0, 1, 2, 3, 4, 5].map(backoffDelayMs), [0, 1000, 2000, 4000, 8000, 16000])
  assertEquals(backoffDelayMs(7), 60_000)
  assertEquals(backoffDelayMs(30), 60_000)
})

Deno.test('ilk deneme beklemez; 2. 1 sn, 3. 2 sn bekler', async () => {
  const h = harness()
  assertEquals((await h.recovery.run(h.ok)).status, 'success')
  assertEquals(h.sleeps, [])
  assertEquals((await h.recovery.run(h.ok)).status, 'success')
  assertEquals((await h.recovery.run(h.ok)).status, 'success')
  assertEquals(h.sleeps, [1000, 2000])
  assertEquals(h.calls(), 3)
})

Deno.test('60 sn pencerede 4. deneme çağrılmaz; devre açılır, onTrip tek sefer', async () => {
  const h = harness()
  for (let i = 0; i < 3; i++) await h.recovery.run(h.ok)
  const fourth = await h.recovery.run(h.ok)
  assertEquals(fourth, { status: 'blocked', reason: 'window_limit' })
  assertEquals(h.calls(), 3)
  assertEquals(h.trips.length, 1)
  assertEquals(h.trips[0].reason, 'window_limit')
  assertEquals(h.trips[0].attempts, 3)

  // Devre açıkken tekrar tekrar istek: hâlâ çağrı yok, ikinci rapor yok.
  for (let i = 0; i < 10; i++) {
    assertEquals((await h.recovery.run(h.ok)).status, 'blocked')
  }
  assertEquals(h.calls(), 3)
  assertEquals(h.trips.length, 1)
})

Deno.test('pencere açılsa bile açık devre yeni deneme vermez (yalnız cooldown)', async () => {
  const h = harness()
  for (let i = 0; i < 4; i++) await h.recovery.run(h.ok)
  h.advance(4 * 60_000) // 5 dk'dan az
  assertEquals((await h.recovery.run(h.ok)).status, 'blocked')
  assertEquals(h.calls(), 3)
})

Deno.test('oturum tavanı: 5 deneme sonrası pencere dışında bile durur', async () => {
  const h = harness()
  for (let i = 0; i < 5; i++) {
    assertEquals((await h.recovery.run(h.ok)).status, 'success')
    h.advance(61_000) // her deneme kendi penceresinde, tripsiz
  }
  assertEquals(h.calls(), 5)
  assertEquals(await h.recovery.run(h.ok), { status: 'blocked', reason: 'session_cap' })
  assertEquals(h.calls(), 5)
  assertEquals(h.trips.map((t) => t.reason), ['session_cap'])
})

Deno.test('429 (status): hemen durur, tek onTrip, ikinci signIn yok', async () => {
  const h = harness()
  const out = await h.recovery.run(h.failing({ status: 429, code: 'over_request_rate_limit' }))
  assertEquals(out.status, 'rate_limited')
  assertEquals(h.trips.map((t) => t.reason), ['rate_limited'])
  assertEquals((await h.recovery.run(h.ok)).status, 'blocked')
  assertEquals(h.calls(), 1)
})

Deno.test('429 tespiti: status ya da over_*_rate_limit kodu', () => {
  assertEquals(isRateLimitError({ status: 429 }), true)
  assertEquals(isRateLimitError({ status: 400, code: 'over_email_send_rate_limit' }), true)
  assertEquals(isRateLimitError({ status: 400, code: 'over_request_rate_limit' }), true)
  assertEquals(isRateLimitError({ status: 500, code: 'unexpected_failure' }), false)
  assertEquals(isRateLimitError(null), false)
})

Deno.test('429 sonrası Retry-After cooldown\'dan uzunsa o beklenir', async () => {
  const h = harness()
  await h.recovery.run(h.failing({ status: 429, retryAfterMs: 20 * 60_000 }))
  h.advance(COOLDOWN_MS + 1)
  assertEquals(h.recovery.isCooldownElapsed(), false)
  h.advance(15 * 60_000)
  assertEquals(h.recovery.isCooldownElapsed(), true)
})

Deno.test('429 varsayılan bekleme 60 sn, cooldown 5 dk baskın', async () => {
  assertEquals(RATE_LIMIT_DEFAULT_WAIT_MS, 60_000)
  const h = harness()
  await h.recovery.run(h.failing({ status: 429 }))
  h.advance(COOLDOWN_MS - 1)
  assertEquals(h.recovery.isCooldownElapsed(), false)
  h.advance(1)
  assertEquals(h.recovery.isCooldownElapsed(), true)
})

Deno.test('cooldown: arka plandayken hak doğmaz; active + 5 dk sonra TEK hak', async () => {
  const h = harness()
  for (let i = 0; i < 4; i++) await h.recovery.run(h.ok) // 3 çağrı + trip
  h.advance(COOLDOWN_MS + 1)
  h.setActive(false)
  assertEquals(h.recovery.isCooldownElapsed(), false)
  assertEquals((await h.recovery.run(h.ok)).status, 'blocked')
  assertEquals(h.calls(), 3)

  h.setActive(true)
  assertEquals(h.recovery.isCooldownElapsed(), true)
  assertEquals((await h.recovery.run(h.ok)).status, 'success') // tek hak
  assertEquals(h.calls(), 4)

  // Hak tükendi: oturum tavanı (5) henüz dolmadı ama pencere sayacı
  // yeniden başladı; hak bypass'ı kalmadığı için tavanlar yine geçerli.
  assertEquals((await h.recovery.run(h.ok)).status, 'success')
  assertEquals(h.calls(), 5)
  assertEquals((await h.recovery.run(h.ok)).status, 'blocked')
  assertEquals(h.calls(), 5)
  assertEquals(h.trips.length, 2) // pencere trip'i + oturum tavanı trip'i
})

Deno.test('cooldown hakkıyla yapılan deneme de başarısızsa yeni devre açılır', async () => {
  const h = harness()
  await h.recovery.run(h.failing({ status: 429 }))
  h.advance(COOLDOWN_MS + 1)
  const out = await h.recovery.run(h.failing({ status: 429 }))
  assertEquals(out.status, 'rate_limited')
  assertEquals(h.trips.length, 2)
  assertEquals((await h.recovery.run(h.ok)).status, 'blocked')
  assertEquals(h.calls(), 2)
})

Deno.test('eşzamanlı çağrı birleşir: ikinci signIn çağrılmaz', async () => {
  const h = harness()
  const [a, b] = await Promise.all([h.recovery.run(h.ok), h.recovery.run(h.ok)])
  assertEquals([a.status, b.status], ['success', 'coalesced'])
  assertEquals(h.calls(), 1)
})

Deno.test('bekleme sonrası oturum gerekmiyorsa signIn çağrılmaz', async () => {
  const h = harness()
  await h.recovery.run(h.ok)
  const out = await h.recovery.run(h.ok, { stillNeeded: () => Promise.resolve(false) })
  assertEquals(out.status, 'skipped')
  assertEquals(h.calls(), 1)
})

Deno.test('429 olmayan hata: devre açmaz, çağırana error döner', async () => {
  const h = harness()
  const out = await h.recovery.run(h.failing({ status: 500 }))
  assertEquals(out.status, 'error')
  assertEquals(h.trips.length, 0)
})
