/**
 * Kimlik çözümü önbelleği (Sprint 10a).
 * Run: npm run test:identity-cache
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { createIdentityCache } from '../../utils/identityCache.ts'

/** Çağrı sayan sahte çözücü — her çağrı bir "sorgu"dur. */
function counter(result: string | null | Error, delayMs = 0) {
  const state = { calls: 0 }
  const fetcher = async (): Promise<string | null> => {
    state.calls += 1
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))
    if (result instanceof Error) throw result
    return result
  }
  return { state, fetcher }
}

Deno.test('aynı authUid ardışık çağrı → tek sorgu', async () => {
  const cache = createIdentityCache()
  const { state, fetcher } = counter('app-1')

  assertEquals(await cache.resolve('auth-1', 'get', fetcher), 'app-1')
  assertEquals(await cache.resolve('auth-1', 'get', fetcher), 'app-1')
  assertEquals(await cache.resolve('auth-1', 'read', fetcher), 'app-1')
  assertEquals(state.calls, 1)
})

Deno.test('farklı authUid → yeniden çözüm (açık temizleme olmadan)', async () => {
  const cache = createIdentityCache()
  const a = counter('app-A')
  const b = counter('app-B')

  assertEquals(await cache.resolve('auth-A', 'get', a.fetcher), 'app-A')
  assertEquals(await cache.resolve('auth-B', 'get', b.fetcher), 'app-B')
  assertEquals(b.state.calls, 1)
  // Geri dönüş: A artık önbellekte değil, yeniden çözülür.
  assertEquals(await cache.resolve('auth-A', 'get', a.fetcher), 'app-A')
  assertEquals(a.state.calls, 2)
})

Deno.test('eşzamanlı 5 çağrı → tek sorgu', async () => {
  const cache = createIdentityCache()
  const { state, fetcher } = counter('app-1', 10)

  const results = await Promise.all(
    [1, 2, 3, 4, 5].map(() => cache.resolve('auth-1', 'get', fetcher)),
  )
  assertEquals(results, ['app-1', 'app-1', 'app-1', 'app-1', 'app-1'])
  assertEquals(state.calls, 1)
})

Deno.test('null sonuç önbelleklenmez', async () => {
  const cache = createIdentityCache()
  const { state, fetcher } = counter(null)

  assertEquals(await cache.resolve('auth-1', 'read', fetcher), null)
  assertEquals(await cache.resolve('auth-1', 'read', fetcher), null)
  assertEquals(state.calls, 2)
})

Deno.test('hata önbelleklenmez ve uçuş kaydı temizlenir', async () => {
  const cache = createIdentityCache()
  const bad = counter(new Error('ağ'))
  await assertRejects(() => cache.resolve('auth-1', 'get', bad.fetcher), Error, 'ağ')

  const good = counter('app-1')
  assertEquals(await cache.resolve('auth-1', 'get', good.fetcher), 'app-1')
  assertEquals(good.state.calls, 1)
})

Deno.test('null sonrası başarılı çözüm önbelleğe yazılır', async () => {
  const cache = createIdentityCache()
  assertEquals(await cache.resolve('auth-1', 'read', counter(null).fetcher), null)

  const ok = counter('app-1')
  assertEquals(await cache.resolve('auth-1', 'read', ok.fetcher), 'app-1')
  assertEquals(await cache.resolve('auth-1', 'read', ok.fetcher), 'app-1')
  assertEquals(ok.state.calls, 1)
})

Deno.test('clearIdentityCache sonrası yeniden çözüm', async () => {
  const cache = createIdentityCache()
  const { state, fetcher } = counter('app-1')

  await cache.resolve('auth-1', 'get', fetcher)
  cache.clear()
  await cache.resolve('auth-1', 'get', fetcher)
  assertEquals(state.calls, 2)
})

Deno.test('clear uçuştaki çözümün sonucunu önbelleğe yazdırmaz', async () => {
  const cache = createIdentityCache()
  const slow = counter('app-OLD', 20)

  const pending = cache.resolve('auth-1', 'get', slow.fetcher)
  cache.clear()
  assertEquals(await pending, 'app-OLD')

  const fresh = counter('app-NEW')
  assertEquals(await cache.resolve('auth-1', 'get', fresh.fetcher), 'app-NEW')
  assertEquals(fresh.state.calls, 1)
})

Deno.test('set bilinen çözümü yazar (ensureAppUser yolu)', async () => {
  const cache = createIdentityCache()
  cache.set('auth-1', 'app-1')
  const { state, fetcher } = counter('app-X')

  assertEquals(await cache.resolve('auth-1', 'get', fetcher), 'app-1')
  assertEquals(state.calls, 0)
})

Deno.test('farklı mode uçuşu paylaşmaz (read null → get yine oluşturur)', async () => {
  const cache = createIdentityCache()
  const read = counter(null, 10)
  const get = counter('app-1', 10)

  const [r, g] = await Promise.all([
    cache.resolve('auth-1', 'read', read.fetcher),
    cache.resolve('auth-1', 'get', get.fetcher),
  ])
  assertEquals(r, null)
  assertEquals(g, 'app-1')
  assertEquals(read.state.calls, 1)
  assertEquals(get.state.calls, 1)
})
