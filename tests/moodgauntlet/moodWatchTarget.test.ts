/**
 * Watch now hedefi (Faz 2-3): bölgedeki ilk sağlayıcı (flatrate > free > ads > rent > buy) →
 * sağlayıcının resmî arama URL'si → JustWatch → /film/:id; düğme etiketi; olay özellikleri.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { pickActionEvent } from '../../utils/moodGauntletAnalytics.ts'
import { justWatchCountry, justWatchSearchUrl, labelKindOf, resolveWatchTarget } from '../../utils/moodWatchTarget.ts'
import { mappedProviderIds, providerDisplayName, providerSearchUrl } from '../../utils/watchProviderLinks.ts'
import { offerLabelKind, orderProvidersWithOffer } from '../../utils/watchProviderList.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

const prov = (id: number, priority: number, name = `P${id}`) => ({ provider_id: id, provider_name: name, logo_path: '/x.png', display_priority: priority })
const base = { title: 'Perfect Days', region: 'TR' as string | null }

Deno.test('flatrate saglayici: sagalayicinin resmi arama URL\'si (baslik kodlu), TMDB sayfasi DEGIL', () => {
  const r = resolveWatchTarget({
    ...base, providersReady: true,
    providers: { link: 'https://www.themoviedb.org/movie/1/watch?locale=TR', flatrate: [prov(8, 1, 'Netflix')] },
  })
  assertEquals(r.kind, 'provider')
  assertEquals(r.url, 'https://www.netflix.com/search?q=Perfect%20Days')
  assert(!r.url?.includes('themoviedb'))
  assertEquals(r.providerId, 8)
  assertEquals(r.providerName, 'Netflix')
  assertEquals(r.offerType, 'flatrate')
  assertEquals(r.labelKind, 'watch')
  assertEquals(r.providerFound, true)
})

Deno.test('oncelik: flatrate > free > ads > rent > buy (rent listede once olsa da)', () => {
  const order = orderProvidersWithOffer({
    buy: [prov(1, 1)], rent: [prov(2, 1)], ads: [prov(3, 1)], free: [prov(4, 1)], flatrate: [prov(5, 1)],
  }).map((o) => `${o.provider.provider_id}:${o.offer}`)
  assertEquals(order, ['5:flatrate', '4:free', '3:ads', '2:rent', '1:buy'])
  assertEquals(offerLabelKind('flatrate'), 'subscription')
  assertEquals(offerLabelKind('ads'), 'free')
  assertEquals(offerLabelKind('free'), 'free')
  assertEquals(offerLabelKind('rent'), 'rent')
  // ayni saglayici hem flatrate hem rent: ilk (flatrate) kova sayilir
  assertEquals(orderProvidersWithOffer({ flatrate: [prov(8, 1)], rent: [prov(8, 1)] })[0].offer, 'flatrate')
})

Deno.test('yalniz rent/buy: "Rent on" / "Buy on" etiketi, Apple TV Store → Apple TV', () => {
  const r = resolveWatchTarget({
    ...base, region: 'US', title: 'Heat', providersReady: true,
    providers: { rent: [prov(2, 1, 'Apple TV Store')], buy: [prov(3, 2, 'Google Play Movies')] },
  })
  assertEquals(r.offerType, 'rent')
  assertEquals(r.labelKind, 'rent')
  assertEquals(r.providerName, 'Apple TV')
  assertEquals(r.url, 'https://tv.apple.com/search?term=Heat')
  assertEquals(labelKindOf('buy'), 'buy')
  assertEquals(labelKindOf('rent'), 'rent')
  assertEquals(labelKindOf('free'), 'watch')
  assertEquals(labelKindOf(null), 'watch')
})

Deno.test('eslesme tablosu: istenen saglayicilarin hepsi eslenmis, URL sablonu https + baslik kodlu', () => {
  // Netflix, Prime Video (US 9 / TR 119), Disney+, HBO Max/Max, Apple TV+ (350), Apple TV Store (2),
  // Google Play (3), YouTube (192), Hulu (15), Paramount+ (531/2303/2616), Peacock (386/387), Mubi (11)
  for (const id of [8, 9, 119, 337, 1899, 350, 2, 3, 192, 15, 531, 2303, 2616, 386, 387, 11]) {
    const u = providerSearchUrl(id, 'Amélie & Co')
    assert(u !== null, `eşleme yok: ${id}`)
    assertMatch(u, /^https:\/\/[a-z.]+\//)
    assert(u.includes('Am%C3%A9lie%20%26%20Co'), u)
  }
  assertEquals(providerSearchUrl(999999, 'X'), null)
  assertEquals(providerSearchUrl(8, '   '), null)
  assert(mappedProviderIds().length >= 16)
  assertEquals(providerDisplayName('Amazon Prime Video'), 'Prime Video')
})

Deno.test('tabloda olmayan saglayici (ör. TR TOD) → JustWatch film aramasi', () => {
  const r = resolveWatchTarget({ ...base, title: 'Amélie & Co', providersReady: true, providers: { flatrate: [prov(1826, 1, 'TOD TV')] } })
  assertEquals(r.kind, 'justwatch')
  assertEquals(r.url, 'https://www.justwatch.com/tr/search?q=Am%C3%A9lie%20%26%20Co')
  assertEquals(r.providerFound, true)
  assertEquals(r.providerName, 'TOD TV')
  assertEquals(justWatchCountry('GB'), 'uk')
  assertEquals(justWatchCountry(' us '), 'us')
  assertEquals(justWatchSearchUrl('US', 'A'), 'https://www.justwatch.com/us/search?q=A')
})

Deno.test('hic saglayici yok / bos kovalar / veri hazir degil: /film/:id, provider_found false', () => {
  for (const providers of [{ link: 'https://a.b/c' }, { link: 'https://a.b/c', flatrate: [] }, null]) {
    const r = resolveWatchTarget({ ...base, providersReady: true, providers })
    assertEquals([r.kind, r.url, r.providerFound, r.providerId, r.providerName, r.offerType], ['detail', null, false, null, null, null])
  }
  const notReady = resolveWatchTarget({ ...base, providersReady: false, providers: { flatrate: [prov(8, 1)] } })
  assertEquals([notReady.kind, notReady.providerFound], ['detail', false])
})

Deno.test('bolge yok + tabloda olmayan saglayici: uydurma adres yok → detay (saglayici yine bulundu)', () => {
  const r = resolveWatchTarget({ ...base, region: null, providersReady: true, providers: { flatrate: [prov(1826, 1, 'TOD TV')] } })
  assertEquals([r.kind, r.url, r.providerFound], ['detail', null, true])
  // tabloda olan saglayici bolgesiz de calisir (URL bolgeye bagli degil)
  const direct = resolveWatchTarget({ ...base, region: null, providersReady: true, providers: { flatrate: [prov(8, 1)] } })
  assertEquals(direct.kind, 'provider')
})

Deno.test('olay: watch_now provider_id + offer_type + link_kind tasir; diger eylemler eski bicimde', () => {
  assertEquals(
    pickActionEvent('watch_now', true, { providerId: 8, offerType: 'flatrate', linkKind: 'provider' }),
    { name: 'mood_tonight_pick_action', props: { action: 'watch_now', provider_found: true, provider_id: 8, offer_type: 'flatrate', link_kind: 'provider' } },
  )
  assertEquals(
    pickActionEvent('watch_now', false, { providerId: null, offerType: null, linkKind: 'detail' }).props,
    { action: 'watch_now', provider_found: false, provider_id: null, offer_type: null, link_kind: 'detail' },
  )
  assertEquals(pickActionEvent('watch_now', true).props, { action: 'watch_now', provider_found: true })
  assertEquals(pickActionEvent('share').props, { action: 'share' })
  assertEquals(pickActionEvent('where').props, { action: 'where' })
})

Deno.test('ResultStage baglantisi: hedef cozulur, universal link, hata sessiz degil, yukleniyorken pasif', () => {
  const src = read('components/MoodGauntlet/ResultStage.tsx')
  assertMatch(src, /resolveWatchTarget\(\{/)
  assertMatch(src, /pickActionEvent\(\s*'watch_now',\s*target\.providerFound,/)
  assertMatch(src, /linkKind: target\.url === null \? 'detail' : target\.kind/)
  assertMatch(src, /Linking\.openURL\(target\.url\)/)
  assert(!/openBrowserAsync/.test(src), 'uygulama ici tarayici kalmamali (universal link uygulamayi acar)')
  // acilamazsa hata kaydi + detay ekrani (sessiz fallback degil)
  assertMatch(src, /MOOD_GAUNTLET_WATCH_OPEN_FAILED/)
  assertMatch(src, /openFilm\(champion\.id\)/)
  assertMatch(src, /disabled=\{providers\.state === 'loading'\}/)
  // etiket: Watch on X / Rent on X / Buy on X (TR: ek yok)
  assertMatch(src, /moodGauntlet\.rentOn/)
  assertMatch(src, /moodGauntlet\.buyOn/)
  assertMatch(src, /moodGauntlet\.watchOn/)
  assert(!/rentBuyOn/.test(src))
  // logo altı tür etiketi YALNIZ mood sonucunda açık
  assertMatch(src, /showOfferLabels/)
  assert(!/showOfferLabels/.test(read('components/gauntlet/ChampionReveal/index.tsx')), 'günlük gauntlet etiketleri değişmemeli')
})

Deno.test('locales: Watch / Rent / Buy CTA ve tur etiketleri en+tr', () => {
  const en = JSON.parse(read('locales/en.json'))
  const tr = JSON.parse(read('locales/tr.json'))
  assertEquals(en.moodGauntlet.watchOn, 'Watch on %{provider}')
  assertEquals(en.moodGauntlet.rentOn, 'Rent on %{provider}')
  assertEquals(en.moodGauntlet.buyOn, 'Buy on %{provider}')
  assertEquals(tr.moodGauntlet.watchOn, 'İzle · %{provider}')
  assertEquals(tr.moodGauntlet.rentOn, 'Kirala · %{provider}')
  assertEquals(tr.moodGauntlet.buyOn, 'Satın al · %{provider}')
  assert(!('rentBuyOn' in en.moodGauntlet) && !('rentBuyOn' in tr.moodGauntlet))
  assert(!/'(da|de|ta|te|dan|den)\b/.test(tr.moodGauntlet.watchOn + tr.moodGauntlet.rentOn + tr.moodGauntlet.buyOn), 'TR CTA ek kullanmaz')
  assertEquals(en.gauntlet.watchProviders.offer, { subscription: 'Subscription', free: 'Free', rent: 'Rent', buy: 'Buy' })
  assertEquals(tr.gauntlet.watchProviders.offer, { subscription: 'Abonelik', free: 'Ücretsiz', rent: 'Kirala', buy: 'Satın al' })
})
