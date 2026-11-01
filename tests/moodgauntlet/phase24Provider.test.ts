/**
 * Faz 2-4: bolge cozumleyici, marka gruplama, saglayici olaylari, donus izleyici, poster seridi,
 * kart duzeltmeleri. Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { appReturnedAfterProviderEvent, assertNoFreeText, providerClickedEvent } from '../../utils/moodGauntletAnalytics.ts'
import { choose, initFlow, stripItems } from '../../utils/moodGauntletFlow.ts'
import { resolveWatchTarget } from '../../utils/moodWatchTarget.ts'
import { WATCH_REGION_ALIASES, watchRegionName } from '../../constants/watchRegions.ts'
import { justWatchSearchUrl, tmdbWatchLink } from '../../utils/watchProviderLinks.ts'
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
  assertEquals(listWatchRegions('en', 'türkiye')[0], { code: 'TR', name: 'Türkiye' })
  assertEquals(listWatchRegions('en', 'zzzz'), [])
  assertEquals(listWatchRegions('en', 'de').some((r) => r.code === 'DE'), true)
})

Deno.test('ulke listesi (Faz 2-5): kelime basi eslesme once, EN kisa adlar', () => {
  assertEquals(watchRegionName('US', 'en'), 'United States')
  assertEquals(watchRegionName('GB', 'en'), 'United Kingdom')
  assertEquals(listWatchRegions('en', 'united').slice(0, 3).map((r) => r.code), ['AE', 'GB', 'US'])
  assertEquals(listWatchRegions('en', 'states')[0].code, 'US')
  // "ar": Argentina kelime basi; Bulgaria'da yalniz ortada geciyor → Argentina once (adla siralamada Bulgaria onde olurdu)
  const ar = listWatchRegions('en', 'ar').map((r) => r.name)
  assertEquals(ar.indexOf('Argentina') < ar.indexOf('Bulgaria'), true)
  // "korea" → South Korea (kelime basi, ikinci kelime)
  assertEquals(listWatchRegions('en', 'korea')[0].code, 'KR')
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
  const ev = providerClickedEvent({ filmId: '0b1c2d3e-0000-4000-8000-000000000001', surface: 'mood_result', providerId: 8, offerType: 'flatrate', region: 'TR', linkKind: 'justwatch' })
  assertEquals(ev, { name: 'provider_clicked', props: { film_id: '0b1c2d3e-0000-4000-8000-000000000001', surface: 'mood_result', provider_id: 8, offer_type: 'flatrate', region: 'TR', link_kind: 'justwatch' } })
  assertNoFreeText(ev)
  assertNoFreeText(providerClickedEvent({ filmId: '0b1c2d3e-0000-4000-8000-000000000001', surface: 'mood_result', providerId: 1, offerType: null, region: null, linkKind: 'detail' }))
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

const TMDB = 'https://www.themoviedb.org/movie/129/watch?locale=JP'
const flat = (link?: string) => ({ link, flatrate: [prov(8, 1, 'Netflix')] })
const target = (region: string | null, link?: string) =>
  resolveWatchTarget({ title: 'My Neighbor Totoro', region, providersReady: true, providers: flat(link) })

Deno.test('JustWatch: yerel adli yollar (404 duzeltmesi) — TR /tr/arama, GB /uk/search', () => {
  assertEquals(target('TR').url, 'https://www.justwatch.com/tr/arama?q=My%20Neighbor%20Totoro')
  assertEquals(target('TR').kind, 'justwatch')
  assertEquals(target('GB').url, 'https://www.justwatch.com/uk/search?q=My%20Neighbor%20Totoro')
  const slugs: Record<string, string> = {
    US: 'us/search', CA: 'ca/search', DE: 'de/Suche', FR: 'fr/recherche', ES: 'es/buscar',
    MX: 'mx/buscar', IT: 'it/cerca', BR: 'br/busca',
  }
  for (const [cc, path] of Object.entries(slugs)) {
    assertEquals(justWatchSearchUrl(cc, 'A'), `https://www.justwatch.com/${path}?q=A`)
  }
  assert(!/\/tr\/search/.test(target('TR').url ?? ''))
})

Deno.test('listede olmayan ulke (JP): TMDB watch linki varsa tmdb_watch, yoksa null (CTA gizli)', () => {
  assertEquals(justWatchSearchUrl('JP', 'A'), null)
  const withLink = target('JP', TMDB)
  assertEquals([withLink.kind, withLink.url], ['tmdb_watch', TMDB])
  const noLink = target('JP')
  assertEquals([noLink.kind, noLink.url, noLink.providerFound], ['none', null, true])
  // themoviedb.org disi link kabul edilmez
  assertEquals(tmdbWatchLink('https://evil.example/watch'), null)
  assertEquals(target('JP', 'https://evil.example/watch').kind, 'none')
})

Deno.test('bolge null: tmdb link ya da null — asla us', () => {
  assertEquals(justWatchSearchUrl(null, 'A'), null)
  const withLink = target(null, TMDB)
  assertEquals([withLink.kind, withLink.url], ['tmdb_watch', TMDB])
  const noLink = target(null)
  assertEquals([noLink.kind, noLink.url], ['none', null])
  assert(!(withLink.url ?? '').includes('justwatch') && !(noLink.url ?? '').includes('/us/'))
})

Deno.test('CTA gizleme: kind=none iken ResultStage dugmeyi cizmez; provider_clicked region + provider_id tasir', () => {
  const src = read('components/MoodGauntlet/ResultStage.tsx')
  assertMatch(src, /ctaMode === 'loading' \|\| ctaMode === 'watch'\) && \(\s*<PrimaryAction/)
  assertMatch(src, /providerClickedEvent\(\{\s*filmId: champion\.id,\s*surface: 'mood_result',\s*providerId: target\.providerId,[\s\S]*?region,/)
  assertEquals(
    providerClickedEvent({ filmId: '0b1c2d3e-0000-4000-8000-000000000001', surface: 'mood_result', providerId: 8, offerType: 'flatrate', region: 'TR', linkKind: 'tmdb_watch' }).props,
    { film_id: '0b1c2d3e-0000-4000-8000-000000000001', surface: 'mood_result', provider_id: 8, offer_type: 'flatrate', region: 'TR', link_kind: 'tmdb_watch' },
  )
  assertNoFreeText(providerClickedEvent({ filmId: '0b1c2d3e-0000-4000-8000-000000000001', surface: 'mood_result', providerId: 8, offerType: 'flatrate', region: 'JP', linkKind: 'provider_direct' }))
})

Deno.test('ulke adi: TR "Türkiye" (EN ve TR)', () => {
  assertMatch(read('constants/watchRegions.ts'), /TR: \{ en: "Türkiye", tr: "Türkiye" \}/)
})

Deno.test('ulke arama: takma ad + aksansiz/kucuk harf (Turkey, turk, türk, TURKIYE → TR); baska ulkeye takma ad yok', () => {
  for (const q of ['Turkey', 'turk', 'türk', 'TURKIYE', 'Türkiye', 'tr']) {
    for (const lang of ['en', 'tr'] as const) {
      assert(listWatchRegions(lang, q).some((r) => r.code === 'TR'), `${lang}:${q}`)
    }
  }
  assertEquals(listWatchRegions('tr', 'İstanbul'), [])
  assertEquals(Object.keys(WATCH_REGION_ALIASES), ['TR'])
})

Deno.test('offerHint: free / ads ayri metin (TMDB ads kovasi ayri), ResultStage ads icin ayri anahtar', () => {
  assertMatch(read('components/gauntlet/WatchProviders/index.tsx'), /moodGauntlet\.offerHint\.\$\{kind\}/) // Faz 2-6: etiketler yalniz logo altinda
  const en = JSON.parse(read('locales/en.json')).moodGauntlet.offerHint
  const tr = JSON.parse(read('locales/tr.json')).moodGauntlet.offerHint
  assertEquals([en.free, en.ads, tr.free, tr.ads], ['Free to watch', 'Free with ads', 'Ücretsiz izlenir', 'Reklamlı ücretsiz'])
})
