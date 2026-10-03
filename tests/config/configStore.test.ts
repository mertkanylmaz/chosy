/**
 * app_config anlık görüntü deposu (Sprint 10b) — TTL, tek-uçuş, stale-while-error.
 * Run: npm run test:config-store
 */

import { assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { createConfigStore, parseSnapshot } from '../../utils/configStore.ts'

const TTL = 5 * 60 * 1000

/** Elle ilerletilen saat. */
function clock(start = 1_000_000) {
  const state = { t: start }
  return { state, now: () => state.t }
}

/** Çağrı sayan sahte yükleyici. */
function loader(values: Record<string, unknown> | Error, delayMs = 0) {
  const state = { calls: 0 }
  const fn = async (): Promise<Record<string, unknown>> => {
    state.calls += 1
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
    if (values instanceof Error) throw values
    return values
  }
  return { state, fn }
}

Deno.test('ilk çağrı yükler, TTL içinde ikinci çağrı ağa gitmez', async () => {
  const c = clock()
  const store = createConfigStore({ ttlMs: TTL, now: c.now })
  const l = loader({ a: 1 })

  assertEquals((await store.refresh(l.fn)).status, 'refreshed')
  c.state.t += TTL - 1
  assertEquals((await store.refresh(l.fn)).status, 'fresh')
  assertEquals(l.state.calls, 1)
  assertEquals(store.getSnapshot()?.values, { a: 1 })
})

Deno.test('TTL dolunca yeniden yükler (sınır dahil değil)', async () => {
  const c = clock()
  const store = createConfigStore({ ttlMs: TTL, now: c.now })
  const l = loader({ a: 1 })

  await store.refresh(l.fn)
  c.state.t += TTL // yaş == ttl → taze DEĞİL
  assertEquals(store.isFresh(), false)
  assertEquals((await store.refresh(l.fn)).status, 'refreshed')
  assertEquals(l.state.calls, 2)
})

Deno.test('eşzamanlı 5 refresh → tek yükleyici çağrısı', async () => {
  const store = createConfigStore({ ttlMs: TTL })
  const l = loader({ a: 1 }, 10)

  const results = await Promise.all([1, 2, 3, 4, 5].map(() => store.refresh(l.fn)))
  assertEquals(results.map((r) => r.status), Array(5).fill('refreshed'))
  assertEquals(l.state.calls, 1)
})

Deno.test('force uçuştaki isteği paylaşır, ikinci istek açmaz', async () => {
  const store = createConfigStore({ ttlMs: TTL })
  const l = loader({ a: 1 }, 10)

  await Promise.all([store.refresh(l.fn), store.refresh(l.fn, { force: true })])
  assertEquals(l.state.calls, 1)
})

Deno.test('force taze önbelleği de yeniler', async () => {
  const store = createConfigStore({ ttlMs: TTL })
  const l = loader({ a: 1 })

  await store.refresh(l.fn)
  assertEquals((await store.refresh(l.fn, { force: true })).status, 'refreshed')
  assertEquals(l.state.calls, 2)
})

Deno.test('hata + eski önbellek → stale_on_error, eski değer korunur', async () => {
  const c = clock()
  const store = createConfigStore({ ttlMs: TTL, now: c.now })
  await store.refresh(loader({ a: 'old' }).fn)
  c.state.t += TTL + 1

  const boom = new Error('ağ')
  const result = await store.refresh(loader(boom).fn)
  assertEquals(result.status, 'stale_on_error')
  assertEquals(result.error, boom)
  assertEquals(store.getSnapshot()?.values, { a: 'old' })
})

Deno.test('hata + önbellek yok → error_no_cache', async () => {
  const store = createConfigStore({ ttlMs: TTL })
  const boom = new Error('ağ')

  const result = await store.refresh(loader(boom).fn)
  assertEquals(result.status, 'error_no_cache')
  assertEquals(result.error, boom)
  assertEquals(store.getSnapshot(), null)
})

Deno.test('başarısız yükleme fetchedAt ilerletmez — sonraki çağrı yeniden dener', async () => {
  const c = clock()
  const store = createConfigStore({ ttlMs: TTL, now: c.now })
  await store.refresh(loader({ a: 1 }).fn)
  c.state.t += TTL + 1

  await store.refresh(loader(new Error('ağ')).fn)
  assertEquals(store.isFresh(), false)

  const ok = loader({ a: 2 })
  assertEquals((await store.refresh(ok.fn)).status, 'refreshed')
  assertEquals(ok.state.calls, 1)
  assertEquals(store.getSnapshot()?.values, { a: 2 })
})

Deno.test('senkron fırlatan yükleyici de sonuç olarak döner, uçuş kaydı temizlenir', async () => {
  const store = createConfigStore({ ttlMs: TTL })
  const sync = (): Promise<Record<string, unknown>> => {
    throw new Error('senkron')
  }
  assertEquals((await store.refresh(sync)).status, 'error_no_cache')

  const ok = loader({ a: 1 })
  assertEquals((await store.refresh(ok.fn)).status, 'refreshed')
})

Deno.test('kalıcı depodan geri yüklenen bayat görüntü yenilenir, hatada korunur', async () => {
  const c = clock()
  const store = createConfigStore({ ttlMs: TTL, now: c.now })
  store.setSnapshot({ values: { a: 'disk' }, fetchedAt: c.state.t - TTL - 1 })

  const result = await store.refresh(loader(new Error('ağ')).fn)
  assertEquals(result.status, 'stale_on_error')
  assertEquals(store.getSnapshot()?.values, { a: 'disk' })
})

Deno.test('kalıcı depodan geri yüklenen taze görüntü ağa gitmez', async () => {
  const c = clock()
  const store = createConfigStore({ ttlMs: TTL, now: c.now })
  store.setSnapshot({ values: { a: 'disk' }, fetchedAt: c.state.t - 1000 })

  const l = loader({ a: 'net' })
  assertEquals((await store.refresh(l.fn)).status, 'fresh')
  assertEquals(l.state.calls, 0)
})

Deno.test('parseSnapshot: geçerli kayıt, boş kayıt, bozuk kayıt', () => {
  assertEquals(parseSnapshot(null), null)
  assertEquals(parseSnapshot('{"values":{"k":true},"fetchedAt":123}'), {
    values: { k: true },
    fetchedAt: 123,
  })
  assertThrows(() => parseSnapshot('{bozuk'))
  assertThrows(() => parseSnapshot('{"values":[],"fetchedAt":1}'))
  assertThrows(() => parseSnapshot('{"values":{},"fetchedAt":"x"}'))
  assertThrows(() => parseSnapshot('null'))
})

Deno.test('taze önbellek yok + ağ hatası + eski önbellek var → eski değer döner, hata tek istekte (tek rapor)', async () => {
  const c = clock()
  const store = createConfigStore({ ttlMs: TTL, now: c.now })
  await store.refresh(loader({ flag: 'eski' }).fn)
  c.state.t += 10 * TTL // TTL çoktan dolmuş

  const failing = loader(new Error('ağ'), 10)
  const results = await Promise.all([1, 2, 3].map(() => store.refresh(failing.fn)))

  assertEquals(results.map((r) => r.status), ['stale_on_error', 'stale_on_error', 'stale_on_error'])
  // Yükleyici (Sentry'ye yazan yer) eşzamanlı çağrılar için TEK kez çalıştı.
  assertEquals(failing.state.calls, 1)
  assertEquals(store.getSnapshot()?.values, { flag: 'eski' })
})
