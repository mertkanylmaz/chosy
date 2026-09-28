/**
 * Unit tests — "Nerede izlenir" kanal varyantı tekilleştirmesi (V-2 Tur D).
 *
 * Örnek liste: TMDB `/movie/1366/watch/providers` (Rocky) US yanıtının
 * 28 Eyl 2026 tarihli ad sırası — TestFlight'ta görülen MGM+ tekrarının kaynağı.
 * Saf fonksiyon; ağ/DB/cihaz gerektirmez.
 * Run: deno test tests/gauntlet/watchProviderList.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  dedupeChannelVariants,
  flattenProviders,
  groupProviders,
  orderProviders,
  selectTopProviders,
  type ProviderLike,
  type RankedProviderLike,
} from '../../utils/watchProviderList.ts'

let nextId = 1
const p = (provider_name: string): ProviderLike => ({ provider_id: nextId++, provider_name })
const names = (list: ProviderLike[]): string[] => list.map((x) => x.provider_name)

const ROCKY_US_FLATRATE = [
  'fuboTV',
  'MGM+ Amazon Channel',
  'Paramount Plus Premium',
  'Paramount Plus Essential',
  'Philo',
  'AMC Plus Apple TV channel',
  'Paramount+ Amazon Channel',
  'AMC+ Amazon Channel',
  'AMC+',
  'YouTube TV',
  'AMC',
  'MGM Plus',
  'Paramount+ Roku Premium Channel',
].map(p)

Deno.test('Rocky US: ana sağlayıcı varken kanal varyantları gizlenir, sırası korunur', () => {
  assertEquals(names(dedupeChannelVariants(ROCKY_US_FLATRATE)), [
    'fuboTV',
    'MGM Plus', // MGM+ Amazon Channel'ın yerine, onun sırasında
    'Paramount Plus Premium',
    'Paramount Plus Essential',
    'Philo',
    'AMC+', // AMC Plus Apple TV channel + AMC+ Amazon Channel → AMC+
    'Paramount+ Amazon Channel', // ana "Paramount+" yok → tek varyant
    'YouTube TV',
    'AMC', // "AMC" ≠ "AMC+" — ayrı servis
  ])
})

Deno.test('ana sağlayıcı yoksa grubun ilk varyantı tek başına kalır', () => {
  const list = ['MGM+ Roku Premium Channel', 'MGM+ Amazon Channel', 'Philo'].map(p)
  assertEquals(names(dedupeChannelVariants(list)), ['MGM+ Roku Premium Channel', 'Philo'])
})

Deno.test('açık listede olmayan "Channel" adları varyant sayılmaz', () => {
  const list = ['Hallmark Channel', 'Hallmark Channel Amazon Channel'].map(p)
  assertEquals(names(dedupeChannelVariants(list)), ['Hallmark Channel'])
})

Deno.test('TR listesi: tekrar yok, değişmez', () => {
  const tr = { flatrate: ['TV+', 'HBO Max'].map(p), rent: [p('Apple TV Store')] }
  assertEquals(names(flattenProviders(tr)), ['TV+', 'HBO Max', 'Apple TV Store'])
})

Deno.test('boş bölge: kova yok → boş liste', () => {
  assertEquals(flattenProviders({}), [])
  assertEquals(flattenProviders({ flatrate: [], rent: [], buy: [] }), [])
})

Deno.test('flatten: aynı provider_id kovalar arası tekrarlanmaz, limit tekilleştirmeden sonra', () => {
  const amazon = p('Amazon Video')
  const buckets = {
    flatrate: ['MGM+ Amazon Channel', 'MGM+ Roku Premium Channel', 'fuboTV'].map(p),
    rent: [amazon],
    buy: [amazon, p('Apple TV Store')],
  }
  assertEquals(names(flattenProviders(buckets, 3)), ['MGM+ Amazon Channel', 'fuboTV', 'Amazon Video'])
})

// ─── V-3 Tur G2 (C5): selectTopProviders ─────────────────────────────────────

/** `display_priority` açıkça verilir — TMDB kova sırası bu alana göre DEĞİL. */
const r = (provider_name: string, display_priority: number): RankedProviderLike => ({
  provider_id: nextId++,
  provider_name,
  display_priority,
})

Deno.test('select: ≤3 sağlayıcı → hepsi, kova sırasıyla (flatrate > free > ads > rent > buy)', () => {
  const buckets = {
    buy: [r('Apple TV Store', 1)],
    ads: [r('Pluto TV', 1)],
    flatrate: [r('Netflix', 5)],
  }
  assertEquals(names(selectTopProviders(buckets)), ['Netflix', 'Pluto TV', 'Apple TV Store'])
  assertEquals(orderProviders(buckets).length, 3)
})

Deno.test('select: >3 sağlayıcı → ilk 3; tam sayı orderProviders uzunluğunda', () => {
  const buckets = {
    flatrate: [r('Max', 8), r('Netflix', 2)],
    free: [r('Tubi', 4)],
    rent: [r('Apple TV Store', 1), r('Google Play Movies', 3)],
  }
  assertEquals(names(selectTopProviders(buckets)), ['Netflix', 'Max', 'Tubi'])
  assertEquals(orderProviders(buckets).length, 5)
  assertEquals(names(selectTopProviders(buckets, 1)), ['Netflix'])
})

Deno.test('select: yalnız rent/buy → rent önce, aynı mağaza iki kez sayılmaz', () => {
  const apple = r('Apple TV Store', 2)
  const buckets = {
    rent: [r('Google Play Movies', 5), apple],
    buy: [apple, r('Amazon Video', 1)],
  }
  assertEquals(names(selectTopProviders(buckets)), ['Apple TV Store', 'Google Play Movies', 'Amazon Video'])
  assertEquals(orderProviders(buckets).length, 3)
})

Deno.test('select: tekilleştirme kesmeden ÖNCE — varyantlar yer kaplamaz, grup sırası korunur', () => {
  const buckets = {
    flatrate: [
      r('MGM+ Amazon Channel', 1),
      r('MGM+ Roku Premium Channel', 2),
      r('fuboTV', 3),
      r('MGM Plus', 9), // ana sağlayıcı — varyantın (1. sıra) yerine oturur
    ],
    rent: [r('Amazon Video', 1)],
  }
  assertEquals(names(selectTopProviders(buckets)), ['MGM Plus', 'fuboTV', 'Amazon Video'])
  assertEquals(orderProviders(buckets).length, 3)
})

Deno.test('select: boş bölge → boş liste', () => {
  assertEquals(selectTopProviders({}), [])
  assertEquals(orderProviders({ flatrate: [], free: [], ads: [], rent: [], buy: [] }), [])
})

Deno.test('group: stream = flatrate+free+ads; rent/buy kendi içinde, mağaza iki grupta da kalır', () => {
  const apple = r('Apple TV Store', 2)
  const groups = groupProviders({
    flatrate: [r('Max', 3), r('Netflix', 1)],
    ads: [r('Pluto TV', 1)],
    rent: [apple, r('Amazon Video', 1)],
    buy: [apple],
  })
  assertEquals(names(groups.stream), ['Netflix', 'Max', 'Pluto TV'])
  assertEquals(names(groups.rent), ['Amazon Video', 'Apple TV Store'])
  assertEquals(names(groups.buy), ['Apple TV Store'])
})
