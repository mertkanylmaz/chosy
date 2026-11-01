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
  offerLabelKind,
  orderProviders,
  orderProvidersWithOffer,
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
  assertEquals(names(flattenProviders(buckets, 3)), ['fuboTV', 'MGM+ Amazon Channel', 'Amazon Video']) // K3 → K4 → K5
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
  // rent/buy aynı katman (K5) → yalnız display_priority: Amazon Video(1) < Apple(2) < Google(5)
  assertEquals(names(selectTopProviders(buckets)), ['Amazon Video', 'Apple TV Store', 'Google Play Movies'])
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
  // Ana sağlayıcı (MGM Plus) abonelikte VAR → varyantlar elenir; ikisi de K3, display_priority: fuboTV(3) < MGM Plus(9).
  assertEquals(names(selectTopProviders(buckets)), ['fuboTV', 'MGM Plus', 'Amazon Video'])
  assertEquals(orderProviders(buckets).length, 3)
})

Deno.test('select: boş bölge → boş liste', () => {
  assertEquals(selectTopProviders({}), [])
  assertEquals(orderProviders({ flatrate: [], free: [], ads: [], rent: [], buy: [] }), [])
})

Deno.test('group: stream = yalnız flatrate, free = free+ads; rent/buy kendi içinde, mağaza iki grupta da kalır', () => {
  const apple = r('Apple TV Store', 2)
  const groups = groupProviders({
    flatrate: [r('Max', 3), r('Netflix', 1)],
    ads: [r('Pluto TV', 1)],
    rent: [apple, r('Amazon Video', 1)],
    buy: [apple],
  })
  assertEquals(names(groups.stream), ['Netflix', 'Max'])
  assertEquals(names(groups.free), ['Pluto TV'])
  assertEquals(names(groups.rent), ['Amazon Video', 'Apple TV Store'])
  assertEquals(names(groups.buy), ['Apple TV Store'])
})

// ─── Faz 2-5 (P0-1): katmanlı sıralama ───────────────────────────────────────

Deno.test('P0-1 Midnight in Paris US: Sony Core kanalı + YouTube ücretsiz + Tubi reklamlı → ilk K2', () => {
  const buckets = {
    flatrate: [r('Sony Pictures Core Amazon Channel', 1)],
    free: [r('YouTube', 5)],
    ads: [r('Tubi TV', 3)],
    rent: [r('Apple TV Store', 1)],
  }
  const o = orderProvidersWithOffer(buckets)
  assertEquals(names(o.map((x) => x.provider)), ['Tubi TV', 'YouTube', 'Sony Pictures Core Amazon Channel', 'Apple TV Store'])
  assertEquals(o.map((x) => x.tier), [2, 2, 4, 5])
})

Deno.test('P0-1 Knives Out US: Lionsgate+ Amazon Channel + Amazon Video kiralık → ilk Lionsgate+ (K4)', () => {
  const o = orderProvidersWithOffer({
    flatrate: [r('Lionsgate+ Amazon Channel', 1)],
    rent: [r('Amazon Video', 1)],
  })
  assertEquals(o[0].provider.provider_name, 'Lionsgate+ Amazon Channel')
  assertEquals(o[0].tier, 4)
  assertEquals(offerLabelKind(o[0].offer, o[0].tier), 'addon')
})

Deno.test('P0-1 Amour TR: TV+, HBO Max (flatrate), Apple TV kiralık → ilk K1', () => {
  const o = orderProvidersWithOffer({
    flatrate: [{ provider_id: 9001, provider_name: 'TV+', display_priority: 7 }, { provider_id: 1899, provider_name: 'HBO Max', display_priority: 2 }],
    rent: [{ provider_id: 2, provider_name: 'Apple TV Store', display_priority: 1 }],
  })
  assertEquals(names(o.map((x) => x.provider)), ['HBO Max', 'TV+', 'Apple TV Store'])
  assertEquals(o.map((x) => x.tier), [1, 1, 5])
})

Deno.test('P0-1 K1: Amazon Video (mağaza) flatrate olsa bile ana marka sayılmaz; Netflix reklamlı K1', () => {
  const o = orderProvidersWithOffer({
    flatrate: [{ provider_id: 10, provider_name: 'Amazon Video', display_priority: 1 }, { provider_id: 1796, provider_name: 'Netflix Standard with Ads', display_priority: 9 }],
  })
  assertEquals(o.map((x) => x.provider.provider_id), [1796, 10])
})

Deno.test('P0-1 etiket: free ve ads ayrı, flatrate abonelik', () => {
  assertEquals(offerLabelKind('free'), 'free')
  assertEquals(offerLabelKind('ads'), 'ads')
  assertEquals(offerLabelKind('flatrate', 1), 'subscription')
  assertEquals(offerLabelKind('buy'), 'buy')
})

// ─── Faz 2-8: çift Paramount+ ────────────────────────────────────────────────
// Gerçek yanıt: TMDB /movie/361743/watch/providers (Top Gun: Maverick) US, 1 Kas 2026.
// Kök neden: 582 "Paramount+ Amazon Channel" ve 633 "Paramount+ Roku Premium Channel" marka
// tablosunda yok → ad anahtarı 'name:paramount+', id'li 2303/2616 ise 'paramount' → iki ayrı marka.

const rp = (provider_id: number, provider_name: string, display_priority: number): RankedProviderLike => ({
  provider_id,
  provider_name,
  display_priority,
})

const TOP_GUN_US = {
  flatrate: [
    rp(8, 'Netflix', 5),
    rp(2303, 'Paramount Plus Premium', 8),
    rp(2616, 'Paramount Plus Essential', 9),
    rp(582, 'Paramount+ Amazon Channel', 10),
    rp(2528, 'YouTube TV', 30),
    rp(633, 'Paramount+ Roku Premium Channel', 41),
    rp(1796, 'Netflix Standard with Ads', 3),
  ],
  rent: [rp(10, 'Amazon Video', 1), rp(2, 'Apple TV Store', 2)],
}

Deno.test('Faz 2-8 Top Gun US: Paramount+ TEK satır — dogrudan abonelik, kanal varyantlari gizli', async () => {
  const { brandOf, dedupeByBrand } = await import('../../utils/watchProviderBrands.ts')
  const ordered = dedupeByBrand(orderProviders(TOP_GUN_US))
  const paramount = ordered.filter((x) => brandOf(x).key === 'paramount')
  assertEquals(paramount.length, 1)
  assertEquals(paramount[0].provider_id, 2303) // dogrudan abonelik, kanal degil
  assertEquals(brandOf(paramount[0]).name, 'Paramount+')
  // kanal varyantlari ham siralamada da elenir (ana streaming'de var)
  assertEquals(orderProviders(TOP_GUN_US).some((x) => x.provider_id === 582 || x.provider_id === 633), false)
  // Netflix + reklamli varyanti da tek
  assertEquals(ordered.filter((x) => brandOf(x).key === 'netflix').length, 1)
})

Deno.test('Faz 2-8 Top Gun GB: yalniz kanal varyanti → yine TEK Paramount+ (eklenti etiketi)', async () => {
  const { brandOf, dedupeByBrand } = await import('../../utils/watchProviderBrands.ts')
  const gb = { flatrate: [rp(582, 'Paramount+ Amazon Channel', 10)] }
  const ordered = dedupeByBrand(orderProviders(gb))
  assertEquals(ordered.length, 1)
  assertEquals(brandOf(ordered[0]).name, 'Paramount+')
  assertEquals(orderProvidersWithOffer(gb)[0].tier, 4)
})

Deno.test('Faz 2-8 marka normalizasyonu genel: kanal/kademe/reklam sonekleri bilinen markaya iner, farkli marka birlesmez', async () => {
  const { brandOf } = await import('../../utils/watchProviderBrands.ts')
  const key = (id: number, name: string) => brandOf({ provider_id: id, provider_name: name }).key
  assertEquals(key(9999, 'Peacock Premium Roku Premium Channel'), 'peacock')
  assertEquals(key(9998, 'Disney Plus Amazon Channel'), 'disney')
  assertEquals(key(9997, 'Netflix Basic with Ads'), 'netflix')
  assertEquals(key(9996, 'Hulu Apple TV Channel'), 'hulu')
  // bilinmeyen marka kendi anahtarinda kalir; baska markaya karismaz
  assertEquals(key(9995, 'Starz Amazon Channel'), key(9994, 'Starz Roku Premium Channel'))
  assertEquals(key(9993, 'Starz') === key(9992, 'AMC+'), false)
  assertEquals(key(9991, 'Hallmark Channel') === key(9990, 'Hallmark+'), false) // genel " Channel" soyulmaz
})
