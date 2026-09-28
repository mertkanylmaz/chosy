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
  type ProviderLike,
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
