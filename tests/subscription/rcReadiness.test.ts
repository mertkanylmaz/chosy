/**
 * Unit tests — RC hazırlık sinyalleri (R-2).
 *
 * Saf mantık; SDK/ağ yok. Zaman aşımı için kısa gerçek timer kullanılır.
 * Run: deno test tests/subscription/rcReadiness.test.ts
 */

import { assertEquals, assertInstanceOf, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  IdentityReadySignal,
  RcReadinessError,
  RcReadySignal,
} from '../../utils/rcReadiness.ts'

const noop = (): void => {}
const tick = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Bekleyenin settle olup olmadığını gözlemler (settle → true). */
function track(p: Promise<void>): { done: () => boolean; result: Promise<'ok' | RcReadinessError> } {
  let settled = false;
  const result = p.then(
    () => {
      settled = true;
      return 'ok' as const;
    },
    (e: unknown) => {
      settled = true;
      return e as RcReadinessError;
    },
  );
  return { done: () => settled, result };
}

// ─── rcReady ─────────────────────────────────────────────────────────────────

Deno.test('rcReady: markReady sonrası wait hemen döner', async () => {
  const s = new RcReadySignal()
  s.markReady()
  await s.wait(50, noop)
})

Deno.test('rcReady: bekleyen, markReady ile uyanır', async () => {
  const s = new RcReadySignal()
  const t = track(s.wait(500, noop))
  await tick(5)
  assertEquals(t.done(), false)
  s.markReady()
  assertEquals(await t.result, 'ok')
})

Deno.test('rcReady: timeout → tipli hata + onTimeout bir kez', async () => {
  const s = new RcReadySignal()
  let calls = 0
  const err = await assertRejects(
    () => s.wait(20, () => { calls += 1 }),
    RcReadinessError,
  )
  assertEquals(calls, 1)
  assertEquals((err as RcReadinessError).signal, 'rc')
  assertEquals((err as RcReadinessError).reason, 'timeout')
})

Deno.test('rcReady: markFailed → hızlı hata, onTimeout ÇAĞRILMAZ', async () => {
  const s = new RcReadySignal()
  let calls = 0
  const t = track(s.wait(500, () => { calls += 1 }))
  s.markFailed(new Error('boom'))
  const r = await t.result
  assertInstanceOf(r, RcReadinessError)
  assertEquals((r as RcReadinessError).reason, 'failed')
  assertEquals(calls, 0)
})

Deno.test('rcReady: failed sonrası markReady yeniden açar', async () => {
  const s = new RcReadySignal()
  s.markFailed(new Error('boom'))
  s.markReady()
  await s.wait(50, noop)
})

// ─── identityReady ───────────────────────────────────────────────────────────

Deno.test('identity: configure aynı kimlikle → complete(hedef bilinmiyor) hemen resolve', async () => {
  const s = new IdentityReadySignal()
  s.complete('user-A')
  await s.wait(50, noop)
})

Deno.test('identity: begin → bekleyen, complete ile uyanır', async () => {
  const s = new IdentityReadySignal()
  s.begin('user-A')
  const t = track(s.wait(500, noop))
  await tick(5)
  assertEquals(t.done(), false)
  s.complete('user-A')
  assertEquals(await t.result, 'ok')
})

Deno.test('identity: bekleyen geçişte yeni begin deferred değiştirmez; yalnız SON hedefle resolve', async () => {
  const s = new IdentityReadySignal()
  s.begin('user-A')
  const waiter = track(s.wait(500, noop)) // eski hedef zamanında bekleyen
  s.begin('user-B') // geçiş sürerken hedef değişti
  s.complete('user-A') // eski hedefin logIn'i bitti → yok sayılmalı
  await tick(10)
  assertEquals(waiter.done(), false)
  s.complete('user-B')
  assertEquals(await waiter.result, 'ok') // aynı deferred uyandı, timeout'a düşmedi
})

Deno.test('identity: logOut (begin(null)) sonrası sıradaki herhangi kimlik resolve eder', async () => {
  const s = new IdentityReadySignal()
  s.complete('user-A') // soğuk açılış: hazır
  s.begin(null) // logOutPurchases
  assertEquals(s.state, 'pending')
  const t = track(s.wait(500, noop))
  s.begin('user-B') // yeni anonim kimlik için identifyUser
  s.complete('user-B')
  assertEquals(await t.result, 'ok')
})

Deno.test('identity: hazır sinyal yeni begin ile pending olur (bayat promise yok)', () => {
  const s = new IdentityReadySignal()
  s.complete('user-A')
  assertEquals(s.state, 'ok')
  s.begin('user-B')
  assertEquals(s.state, 'pending')
})

Deno.test('identity: son hedefin logIn hatası → bekleyen hızlı hata (timeout değil)', async () => {
  const s = new IdentityReadySignal()
  let calls = 0
  s.begin('user-A')
  const t = track(s.wait(500, () => { calls += 1 }))
  s.fail('user-A', new Error('logIn failed'))
  const r = await t.result
  assertInstanceOf(r, RcReadinessError)
  assertEquals((r as RcReadinessError).reason, 'failed')
  assertEquals(calls, 0)
})

Deno.test('identity: eski hedefin hatası yok sayılır', async () => {
  const s = new IdentityReadySignal()
  s.begin('user-A')
  s.begin('user-B')
  s.fail('user-A', new Error('stale'))
  assertEquals(s.state, 'pending')
  s.complete('user-B')
  await s.wait(50, noop)
})

Deno.test('identity: failed sonrası başarılı complete toparlar', async () => {
  const s = new IdentityReadySignal()
  s.begin('user-A')
  s.fail('user-A', new Error('x'))
  assertEquals(s.state, 'failed')
  s.complete('user-A')
  await s.wait(50, noop)
})

Deno.test('identity: timeout → tipli hata, signal=identity', async () => {
  const s = new IdentityReadySignal()
  s.begin('user-A')
  const err = await assertRejects(() => s.wait(20, noop), RcReadinessError)
  assertEquals((err as RcReadinessError).signal, 'identity')
  assertEquals((err as RcReadinessError).reason, 'timeout')
})
