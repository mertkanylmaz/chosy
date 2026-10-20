/**
 * Unit tests — "Nerede izlenir" yükleme kararı (HOME-3).
 * none→empty, error→error, timeout→error, geç sonuç ilk çözümü ezmez, cancel.
 * Saf mantık; ağ/DB/cihaz gerektirmez. Sahte saat: std FakeTime.
 * Run: deno test tests/gauntlet/watchProvidersLoad.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { FakeTime } from 'https://deno.land/std@0.208.0/testing/time.ts'

import {
  WATCH_PROVIDERS_DEADLINE_MS,
  startLoad,
  type LoadDeps,
  type TmdbIdLookup,
} from '../../utils/watchProvidersLoad.ts'

type R = { status: 'ok' | 'empty' | 'error' }
const results = { empty: { status: 'empty' } as R, error: { status: 'error' } as R }
const OK: R = { status: 'ok' }

const later = <T>(ms: number, value: T): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

function deps(over: Partial<LoadDeps<R>>): LoadDeps<R> {
  return {
    readTmdbId: () => Promise.resolve<TmdbIdLookup>({ kind: 'ok', tmdbId: 1 }),
    fetchProviders: () => Promise.resolve(OK),
    results,
    ...over,
  }
}

Deno.test('başarı: ok → TMDB sonucu', async () => {
  const { promise } = startLoad(deps({}))
  assertEquals(await promise, { kind: 'result', result: OK })
})

Deno.test('tmdb_id gerçekten yok (none) → empty, TMDB çağrılmaz', async () => {
  let called = false
  const { promise } = startLoad(
    deps({
      readTmdbId: () => Promise.resolve<TmdbIdLookup>({ kind: 'none' }),
      fetchProviders: () => {
        called = true
        return Promise.resolve(OK)
      },
    }),
  )
  assertEquals(await promise, { kind: 'result', result: results.empty })
  assertEquals(called, false)
})

Deno.test('okuma hatası (error) → error, TMDB çağrılmaz', async () => {
  let called = false
  const { promise } = startLoad(
    deps({
      readTmdbId: () => Promise.resolve<TmdbIdLookup>({ kind: 'error' }),
      fetchProviders: () => {
        called = true
        return Promise.resolve(OK)
      },
    }),
  )
  assertEquals(await promise, { kind: 'result', result: results.error })
  assertEquals(called, false)
})

Deno.test('TMDB error sonucu olduğu gibi geçer', async () => {
  const { promise } = startLoad(deps({ fetchProviders: () => Promise.resolve(results.error) }))
  assertEquals(await promise, { kind: 'result', result: results.error })
})

Deno.test('reject (okuma) → rejected', async () => {
  const boom = new Error('boom')
  const { promise } = startLoad(deps({ readTmdbId: () => Promise.reject(boom) }))
  assertEquals(await promise, { kind: 'rejected', error: boom })
})

Deno.test('reject (TMDB) → rejected', async () => {
  const boom = new Error('boom')
  const { promise } = startLoad(deps({ fetchProviders: () => Promise.reject(boom) }))
  assertEquals(await promise, { kind: 'rejected', error: boom })
})

Deno.test('12 sn: select asılırsa timeout, adım tmdb_id_lookup', async () => {
  const time = new FakeTime()
  try {
    const { promise } = startLoad(deps({ readTmdbId: () => new Promise(() => {}) }))
    await time.tickAsync(WATCH_PROVIDERS_DEADLINE_MS)
    assertEquals(await promise, {
      kind: 'timeout',
      step: 'tmdb_id_lookup',
      timeoutMs: WATCH_PROVIDERS_DEADLINE_MS,
    })
  } finally {
    time.restore()
  }
})

Deno.test('12 sn: TMDB asılırsa timeout, adım tmdb_fetch', async () => {
  const time = new FakeTime()
  try {
    const { promise } = startLoad(deps({ fetchProviders: () => new Promise(() => {}) }))
    await time.tickAsync(WATCH_PROVIDERS_DEADLINE_MS)
    assertEquals(await promise, {
      kind: 'timeout',
      step: 'tmdb_fetch',
      timeoutMs: WATCH_PROVIDERS_DEADLINE_MS,
    })
  } finally {
    time.restore()
  }
})

Deno.test('toplam: select 8 sn + TMDB 8 sn → 12 sn aşımı (parçalar tek tek sınır içinde)', async () => {
  const time = new FakeTime()
  try {
    const { promise } = startLoad(
      deps({
        readTmdbId: () => later<TmdbIdLookup>(8_000, { kind: 'ok', tmdbId: 1 }),
        fetchProviders: () => later(8_000, OK),
      }),
    )
    await time.tickAsync(WATCH_PROVIDERS_DEADLINE_MS)
    assertEquals((await promise).kind, 'timeout')
  } finally {
    time.restore()
  }
})

Deno.test('geç sonuç timeout sonrası ilk çözümü ezmez', async () => {
  const time = new FakeTime()
  try {
    const { promise } = startLoad(deps({ fetchProviders: () => later(20_000, OK) }))
    await time.tickAsync(WATCH_PROVIDERS_DEADLINE_MS)
    const first = await promise
    await time.tickAsync(20_000)
    assertEquals(first.kind, 'timeout')
    assertEquals(await promise, first)
  } finally {
    time.restore()
  }
})

Deno.test('sınırdan önce gelen sonuç timeout üretmez', async () => {
  const time = new FakeTime()
  try {
    const { promise } = startLoad(deps({ fetchProviders: () => later(5_000, OK) }))
    await time.tickAsync(5_000)
    assertEquals(await promise, { kind: 'result', result: OK })
    // Sayaç temizlenmiş olmalı: sınırı aşmak çözülmüş sonucu değiştirmez.
    await time.tickAsync(WATCH_PROVIDERS_DEADLINE_MS)
    assertEquals(await promise, { kind: 'result', result: OK })
  } finally {
    time.restore()
  }
})

Deno.test('cancel: sayaç temizlenir, timeout üretilmez (sızıntı yok)', async () => {
  const time = new FakeTime()
  try {
    const started = startLoad(deps({ readTmdbId: () => new Promise(() => {}) }))
    started.cancel()
    await time.tickAsync(WATCH_PROVIDERS_DEADLINE_MS * 2)
    const raced = await Promise.race([started.promise, Promise.resolve('pending')])
    assertEquals(raced, 'pending')
  } finally {
    time.restore()
  }
})
