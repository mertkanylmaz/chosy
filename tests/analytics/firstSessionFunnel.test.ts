/**
 * İlk oturum funnel bayrağı — kurulum başına bir kez.
 * Run: deno test tests/analytics/firstSessionFunnel.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  FIRST_SESSION_FLAG_KEYS,
  parseIsUpgrade,
  resolveIsUpgrade,
  serializeIsUpgrade,
  fireFirstSessionEvent,
  type FlagStore,
} from '../../utils/firstSessionFunnel.ts'

function memoryStore(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init))
  const store: FlagStore = {
    getItem: (k) => Promise.resolve(data.get(k) ?? null),
    setItem: (k, v) => {
      data.set(k, v)
      return Promise.resolve()
    },
  }
  return { store, data }
}

Deno.test('ilk sefer gönderir, ikinci sefer göndermez', async () => {
  const { store } = memoryStore()
  let sent = 0
  const r1 = await fireFirstSessionEvent(store, 'first_gauntlet_started', () => sent++)
  const r2 = await fireFirstSessionEvent(store, 'first_gauntlet_started', () => sent++)
  assertEquals(r1.outcome, 'sent')
  assertEquals(r2.outcome, 'already_sent')
  assertEquals(sent, 1)
})

Deno.test('logout sonrası tekrar göndermez (bayraklar cihaz düzeyi, sıfırlamadan muaf)', async () => {
  const { store, data } = memoryStore()
  let sent = 0
  await fireFirstSessionEvent(store, 'first_onboarding_completed', () => sent++)
  // sessionReset: yalnız muaf listedeki anahtarlar sağ çıkar, geri kalanı silinir.
  const exempt = new Set<string>(Object.values(FIRST_SESSION_FLAG_KEYS))
  data.set('kullanici_verisi', 'x')
  for (const k of [...data.keys()]) if (!exempt.has(k)) data.delete(k)
  await fireFirstSessionEvent(store, 'first_onboarding_completed', () => sent++)
  assertEquals(sent, 1)
})

Deno.test('olaylar birbirinden bağımsız bayrak kullanır', async () => {
  const { store } = memoryStore()
  const sent: string[] = []
  await fireFirstSessionEvent(store, 'first_gauntlet_started', () => sent.push('s'))
  await fireFirstSessionEvent(store, 'first_gauntlet_completed', () => sent.push('c'))
  assertEquals(sent, ['s', 'c'])
})

Deno.test('okuma hatasında GÖNDERMEZ', async () => {
  const store: FlagStore = {
    getItem: () => Promise.reject(new Error('boom')),
    setItem: () => Promise.resolve(),
  }
  let sent = 0
  const r = await fireFirstSessionEvent(store, 'first_gauntlet_completed', () => sent++)
  assertEquals(r.outcome, 'read_failed')
  assertEquals(sent, 0)
})

Deno.test('yazma hatasında olay gitmiştir, hata döner', async () => {
  const store: FlagStore = {
    getItem: () => Promise.resolve(null),
    setItem: () => Promise.reject(new Error('disk')),
  }
  let sent = 0
  const r = await fireFirstSessionEvent(store, 'first_gauntlet_completed', () => sent++)
  assertEquals(r.outcome, 'write_failed')
  assertEquals(sent, 1)
})

Deno.test('is_upgrade: temiz kurulum → false', async () => {
  const r = await resolveIsUpgrade(() => Promise.resolve(['moodflix_language', 'sb-x-auth-token']))
  assertEquals(r.value, false)
})

Deno.test('is_upgrade: onboarding anahtarı var → true (kullanıcıya özgü ve global)', async () => {
  assertEquals((await resolveIsUpgrade(() => Promise.resolve(['chosy_onboarded_abc']))).value, true)
  assertEquals((await resolveIsUpgrade(() => Promise.resolve(['chosy_onboarded']))).value, true)
})

Deno.test('is_upgrade: okuma hatası → null + hata', async () => {
  const r = await resolveIsUpgrade(() => Promise.reject(new Error('boom')))
  assertEquals(r.value, null)
  assertEquals(r.error instanceof Error, true)
})

Deno.test('is_upgrade: saklanan değer tutarlı çözülür', () => {
  assertEquals(parseIsUpgrade(serializeIsUpgrade(true)), true)
  assertEquals(parseIsUpgrade(serializeIsUpgrade(false)), false)
  assertEquals(parseIsUpgrade(null), null)
  assertEquals(parseIsUpgrade('x'), null)
})
