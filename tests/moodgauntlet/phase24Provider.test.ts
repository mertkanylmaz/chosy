/**
 * Faz 2-4: bolge cozumleyici, marka gruplama, saglayici olaylari, donus izleyici, poster seridi,
 * kart duzeltmeleri. Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { appReturnedAfterProviderEvent, assertNoFreeText, providerClickedEvent } from '../../utils/moodGauntletAnalytics.ts'
import { choose, initFlow, stripItems } from '../../utils/moodGauntletFlow.ts'
import { resolveWatchTarget } from '../../utils/moodWatchTarget.ts'
import { createProviderReturnTracker, PROVIDER_RETURN_WINDOW_MS } from '../../utils/providerReturn.ts'
import { dedupeByBrand } from '../../utils/watchProviderBrands.ts'
import { listWatchRegions, normalizeCountryCode, resolveWatchRegion } from '../../utils/watchRegion.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const prov = (id: number, priority: number, name: string) => ({ provider_id: id, provider_name: name, logo_path: '/x.png', display_priority: priority })

Deno.test('bolge onceligi: kullanici > storefront > cihaz > null; US son care YOK', () => {
  assertEquals(resolveWatchRegion({ chosen: 'de', storefront: 'TUR', device: 'US' }), { region: 'DE', source: 'user' })
  assertEquals(resolveWatchRegion({ chosen: null, storefront: 'TUR', device: 'US' }), { region: 'TR', source: 'storefront' })
  assertEquals(resolveWatchRegion({ chosen: null, storefront: null, device: 'us' }), { region: 'US', source: 'device' })
  assertEquals(resolveWatchRegion({ chosen: null, storefront: null, device: null }), { region: null, source: 'none' })
  // gecersiz storefront (taninmayan alpha-3) cihaza duser; bos sonuc 'US' olmaz
  assertEquals(resolveWatchRegion({ chosen: null, storefront: 'ZZZ', device: 'TR' }), { region: 'TR', source: 'device' })
  assertEquals(resolveWatchRegion({ chosen: null, storefront: '419', device: '419' }), { region: null, source: 'none' })
})

Deno.test('ulke kodu: alpha-3 → alpha-2, gecersiz → null', () => {
  assertEquals(normalizeCountryCode('TUR'), 'TR')
  assertEquals(normalizeCountryCode(' gbr '), 'GB')
  assertEquals(normalizeCountryCode('tr'), 'TR')
  assertEquals(normalizeCountryCode('USA'), 'US')
  assertEquals(normalizeCountryCode('123'), null)
  assertEquals(normalizeCountryCode(''), null)
  assertEquals(normalizeCountryCode(null), null)
})

Deno.test('ulke listesi: 139 bolge, TR adiyla arama, kod ile arama', () => {
  assertEquals(listWatchRegions('en', '').length, 139)
  assertEquals(listWatchRegions('tr', 'türk')[0], { code: 'TR', name: 'Türkiye' })
  assertEquals(listWatchRegions('en', 'turkey')[0].code, 'TR')
  assertEquals(listWatchRegions('en', 'zzzz'), [])
  assertEquals(listWatchRegions('en', 'de').some((r) => r.code === 'DE'), true)
})

Deno.test('marka gruplama: Netflix + Netflix Standard with Ads, Prime Video + Amazon Video tek logo', () => {
  const list = [prov(8, 1, 'Netflix'), prov(1796, 2, 'Netflix Standard with Ads'), prov(119, 3, 'Amazon Prime Video'), prov(10, 4, 'Amazon Video'), prov(1826, 5, 'TOD TV')]
  assertEquals(dedupeByBrand(list).map((p) => p.provider_id), [8, 119, 1826])
  // bilinmeyen marka: "with Ads" soneki atilarak ayni marka
  assertEquals(dedupeByBrand([prov(900, 1, 'Foo'), prov(901, 2, 'Foo with Ads')]).length, 1)
})

Deno.test('CTA: marka basina en uygun teklif (flatrate > ads > rent > buy), marka adi tek', () => {
  const r = resolveWatchTarget({
    title: 'Parasite', region: 'TR', providersReady: true,
    providers: { flatrate: [prov(8, 1, 'Netflix')], ads: [prov(1796, 1, 'Netflix Standard with Ads')], rent: [prov(10, 1, 'Amazon Video')] },
  })
  assertEquals([r.providerId, r.providerName, r.offerType], [8, 'Netflix', 'flatrate'])
  const rentOnly = resolveWatchTarget({
    title: 'Parasite', region: 'TR', providersReady: true,
    providers: { rent: [prov(10, 1, 'Amazon Video')], buy: [prov(9, 1, 'Amazon Prime Video')] },
  })
  assertEquals([rentOnly.providerName, rentOnly.offerType], ['Prime Video', 'rent'])
})

Deno.test('olaylar: provider_clicked / app_returned_after_provider metin tasimaz', () => {
  const ev = providerClickedEvent({ providerId: 8, offerType: 'flatrate', region: 'TR', linkKind: 'justwatch' })
  assertEquals(ev, { name: 'provider_clicked', props: { provider_id: 8, offer_type: 'flatrate', region: 'TR', link_kind: 'justwatch' } })
  assertNoFreeText(ev)
  assertNoFreeText(providerClickedEvent({ providerId: 1, offerType: null, region: null, linkKind: 'detail' }))
  assertEquals(appReturnedAfterProviderEvent(42.4), { name: 'app_returned_after_provider', props: { seconds_away: 42 } })
  // region alanina baslik sizamaz
  assertThrows(() => assertNoFreeText({ name: 'provider_clicked', props: { region: 'Parasite (2019)' } }))
})

Deno.test('donus izleyici: 30 dk penceresi, olay bir kez', () => {
  const tr = createProviderReturnTracker()
  assertEquals(tr.consume(1000), null) // bekleyen yok
  tr.markOpened(10_000)
  assertEquals(tr.consume(10_000 + 95_000), 95)
  assertEquals(tr.consume(10_000 + 96_000), null) // tek sefer
  tr.markOpened(0)
  assertEquals(tr.consume(PROVIDER_RETURN_WINDOW_MS + 1), null) // pencere asildi
  tr.markOpened(0)
  assertEquals(tr.consume(PROVIDER_RETURN_WINDOW_MS), PROVIDER_RETURN_WINDOW_MS / 1000)
})

Deno.test('poster seridi: kazanan vurgulu, elenen, henuz oynanmamis', () => {
  let f = initFlow(['a', 'b', 'c', 'd'])
  assertEquals(stripItems(f).map((i) => i.status), ['live', 'live', 'live', 'live'])
  f = choose(f, 'b')
  assertEquals(stripItems(f).map((i) => i.status), ['eliminated', 'advanced', 'live', 'live'])
  f = choose(f, 'c')
  assertEquals(stripItems(f).map((i) => i.status), ['eliminated', 'advanced', 'advanced', 'eliminated'])
  f = choose(f, 'c')
  assertEquals(stripItems(f).map((i) => i.status), ['eliminated', 'eliminated', 'advanced', 'eliminated'])
})

Deno.test('kartlar: yalniz yil (sure cipte), iskelet, ayni boy butonlar, serit stili %35', () => {
  const g = read('components/MoodGauntlet/GauntletStage.tsx')
  assertMatch(g, /metaMode="yearOnly"/)
  assertMatch(g, /reasonsLoading \? \(/)
  assertMatch(g, /skeletonLine/)
  assertMatch(g, /stripItems\(flow\)/)
  const tile = read('components/gauntlet/PosterTile/index.tsx')
  assertMatch(tile, /metaMode = 'yearRuntime'/) // gunluk varsayilan degismedi
  assert(!/metaMode/.test(read('components/gauntlet/ChampionReveal/index.tsx')))
  assertMatch(read('components/MoodGauntlet/styles.ts'), /stripCellEliminated: \{ opacity: 0\.35 \}/)
})

Deno.test('bolge kaynagi tek: LanguageContext cozumleyiciyi besler, olay + storefront, US fallback yok', () => {
  const ctx = read('contexts/LanguageContext.tsx')
  assertMatch(ctx, /resolveWatchRegion\(\{ chosen: chosenRaw, storefront: storefrontRaw, device: deviceRaw \}\)/)
  assertMatch(ctx, /watch_region_changed/)
  assertMatch(ctx, /source_before: regionSource/)
  const code = ctx.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert(!/'US'/.test(code), 'US fallback yok')
  assertMatch(read('services/storefrontRegion.ts'), /Purchases\.getStorefront\(\)/)
})
