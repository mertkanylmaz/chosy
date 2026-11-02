/**
 * Where to watch bağlamı (Faz 2-3 → Faz 2-8): bölgedeki ilk sağlayıcı (katmanlı sıra), etiket
 * türü, olay özellikleri, allowlist ve native sheet kaynak sözleşmesi. Dış URL ÜRETİLMEZ.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { appOpenFor } from '../../constants/watchAppOpen.ts'
import { pickActionEvent } from '../../utils/moodGauntletAnalytics.ts'
import { labelKindOf, resolveWatchTarget } from '../../utils/moodWatchTarget.ts'
import { adsOnlyIds, groupProviders, offerLabelKind, orderProvidersWithOffer } from '../../utils/watchProviderList.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

const prov = (id: number, priority: number, name = `P${id}`) => ({ provider_id: id, provider_name: name, logo_path: '/x.png', display_priority: priority })

Deno.test('flatrate saglayici: ilk saglayici bilgisi, URL alani YOK', () => {
  const r = resolveWatchTarget({ providersReady: true, providers: { flatrate: [prov(8, 1, 'Netflix')] } })
  assertEquals(r.providerId, 8)
  assertEquals(r.providerName, 'Netflix')
  assertEquals(r.offerType, 'flatrate')
  assertEquals(r.labelKind, 'watch')
  assertEquals(r.providerFound, true)
  assert(!('url' in r) && !('kind' in r), 'Faz 2-8: hedef dis adres tasimaz')
})

Deno.test('oncelik (Faz 2-5 katmanlari): K1 ana marka flatrate > free > ads > rent > buy (rent listede once olsa da)', () => {
  const order = orderProvidersWithOffer({
    buy: [prov(1, 1)], rent: [prov(2, 1)], ads: [prov(3, 1)], free: [prov(4, 1)], flatrate: [prov(5, 1, 'Netflix')],
  }).map((o) => `${o.provider.provider_id}:${o.offer}`)
  assertEquals(order, ['5:flatrate', '4:free', '3:ads', '2:rent', '1:buy'])
  assertEquals(offerLabelKind('flatrate'), 'subscription')
  assertEquals(offerLabelKind('ads'), 'ads')
  assertEquals(offerLabelKind('free'), 'free')
  assertEquals(offerLabelKind('rent'), 'rent')
  // ayni saglayici hem flatrate hem rent: ilk (flatrate) kova sayilir
  assertEquals(orderProvidersWithOffer({ flatrate: [prov(8, 1)], rent: [prov(8, 1)] })[0].offer, 'flatrate')
})

Deno.test('yalniz rent/buy: teklif turu rent, Apple TV Store → Apple TV marka adi', () => {
  const r = resolveWatchTarget({
    providersReady: true,
    providers: { rent: [prov(2, 1, 'Apple TV Store')], buy: [prov(3, 2, 'Google Play Movies')] },
  })
  assertEquals(r.offerType, 'rent')
  assertEquals(r.labelKind, 'rent')
  assertEquals(r.providerName, 'Apple TV')
  assertEquals(labelKindOf('buy'), 'buy')
  assertEquals(labelKindOf('rent'), 'rent')
  assertEquals(labelKindOf('free'), 'watch')
  assertEquals(labelKindOf(null), 'watch')
})

Deno.test('hic saglayici yok / bos kovalar / veri hazir degil: provider_found false', () => {
  for (const providers of [{}, { flatrate: [] }, null]) {
    const r = resolveWatchTarget({ providersReady: true, providers })
    assertEquals([r.providerFound, r.providerId, r.providerName, r.offerType], [false, null, null, null])
  }
  const notReady = resolveWatchTarget({ providersReady: false, providers: { flatrate: [prov(8, 1)] } })
  assertEquals(notReady.providerFound, false)
})

Deno.test('allowlist (Karar 3b): BOS baslar; yalniz https ana sayfa kabul edilir', () => {
  assertEquals(appOpenFor('netflix'), null)
  assertEquals(appOpenFor('prime'), null)
  const list = {
    netflix: { homeUrl: 'https://www.netflix.com/', verifiedOn: '2026-11-02' },
    bad: { homeUrl: 'http://example.com/', verifiedOn: '2026-11-02' },
  }
  assertEquals(appOpenFor('netflix', list)?.homeUrl, 'https://www.netflix.com/')
  assertEquals(appOpenFor('bad', list), null)
  assertEquals(appOpenFor('unknown', list), null)
})

Deno.test('gruplar: Stream yalniz flatrate; Free = free + ads (reklamli ayri taninir); Rent/Buy kendi icinde', () => {
  const apple = prov(2, 2, 'Apple TV Store')
  const buckets = {
    flatrate: [prov(8, 1, 'Netflix')],
    free: [prov(73, 2, 'Tubi')],
    ads: [prov(300, 1, 'Pluto TV'), prov(73, 2, 'Tubi')],
    rent: [apple],
    buy: [apple],
  }
  const g = groupProviders(buckets)
  assertEquals(g.stream.map((p) => p.provider_name), ['Netflix'])
  assertEquals(g.free.map((p) => p.provider_name).sort(), ['Pluto TV', 'Tubi'])
  assertEquals(g.rent.length + g.buy.length, 2)
  // Tubi hem free hem ads: reklamsiz sayilir; yalniz ads kovasindaki Pluto reklamli
  assertEquals([...adsOnlyIds(buckets)], [300])
})

Deno.test('olay: watch_now provider_id + offer_type tasir (link_kind YOK); diger eylemler eski bicimde', () => {
  assertEquals(
    pickActionEvent('watch_now', true, { providerId: 8, offerType: 'flatrate' }),
    { name: 'mood_tonight_pick_action', props: { action: 'watch_now', provider_found: true, provider_id: 8, offer_type: 'flatrate' } },
  )
  assertEquals(
    pickActionEvent('watch_now', false, { providerId: null, offerType: null }).props,
    { action: 'watch_now', provider_found: false, provider_id: null, offer_type: null },
  )
  assertEquals(pickActionEvent('watch_now', true).props, { action: 'watch_now', provider_found: true })
  assertEquals(pickActionEvent('share').props, { action: 'share' })
  assertEquals(pickActionEvent('where').props, { action: 'where' })
})

Deno.test('ResultStage: CTA sheet acar, dis baglanti uretmez; yukleniyorken pasif; fragman akisi degismedi', () => {
  const src = read('components/MoodGauntlet/ResultStage.tsx')
  assertMatch(src, /resolveWatchTarget\(\{/)
  assertMatch(src, /pickActionEvent\(\s*'watch_now',\s*target\.providerFound,/)
  assertMatch(src, /setWhereOpen\(true\)/)
  assertMatch(src, /sheetOpen=\{whereOpen\}/)
  assertMatch(src, /disabled=\{ctaMode === 'loading'\}/)
  assertMatch(src, /moodGauntlet\.whereToWatch/)
  // yalniz fragman Linking kullanir (Karar 10); saglayici/JustWatch/TMDB adresi yok
  assertEquals((src.match(/Linking\.openURL\(/g) ?? []).length, 1)
  assertMatch(src, /Linking\.openURL\(trailerUrl\(trailerKey\)\)/)
  assert(!/ArrowUpRight/.test(src), 'dis baglanti oku kalkti')
  assert(!/justwatch|themoviedb|providerSearchUrl|link_kind|linkKind/i.test(src))
  assert(!/moodGauntlet\.(openIn|watchOn|rentOn|buyOn)/.test(src))
  assert(!/moodGauntlet\.offerHint/.test(src), 'Faz 2-6: CTA alti abonelik ipucu kalkti (etiketler logo altinda)')
  // logo alti tur etiketi YALNIZ mood sonucunda acik
  assertMatch(src, /showOfferLabels/)
  assert(!/showOfferLabels/.test(read('components/gauntlet/ChampionReveal/index.tsx')), 'günlük gauntlet etiketleri değişmemeli')
})

Deno.test('ProvidersSheet: uc durum ayri, grup sirasi Stream/Free/Rent or buy (tek sabit), allowlist disinda satir dokunulmaz, tek olay', () => {
  const src = read('components/gauntlet/WatchProviders/ProvidersSheet.tsx')
  assertMatch(src, /SHEET_GROUP_ORDER\.map\(/)
  assert(!/const GROUP_ORDER/.test(src), 'sheet kendi grup sirasi kopyasini tutmaz')
  assertMatch(src, /state === 'error'[\s\S]*?gauntlet\.watchProviders\.error[\s\S]*?onPress=\{onRetry\}/)
  assertMatch(src, /moodGauntlet\.notStreaming/)
  // 'yayinda degil' yalniz empty / bos ok icin — error dalinda gecmez
  const errorBranch = src.slice(src.indexOf("state === 'error'"), src.indexOf("state === 'noRegion'"))
  assert(!/notStreaming/.test(errorBranch))
  assertMatch(src, /appOpenFor\(brand\.key\)/)
  assertMatch(src, /kind: 'app_open'/)
  assertEquals((src.match(/Linking\.openURL\(/g) ?? []).length, 1)
  assertMatch(src, /Linking\.openURL\(homeUrl\)/)
  assert(!/ArrowRight|CaretRight|ChevronRight/.test(src), 'bilgi satirinda chevron yok')
  assertMatch(src, /whereToWatchOpenedEvent\(\{ filmId, surface, region, state \}\)/)
  assertMatch(src, /attribution/)
  assert(!/expo-web-browser|WebBrowser/.test(src))
})

Deno.test('locales: Faz 2-8 anahtarlari en+tr, JustWatch/TMDB varis metni ve openIn kalkti', () => {
  const en = JSON.parse(read('locales/en.json'))
  const tr = JSON.parse(read('locales/tr.json'))
  assertEquals(en.moodGauntlet.whereToWatch, 'Where to watch')
  assertEquals(tr.moodGauntlet.whereToWatch, 'Nerede izlenir')
  for (const k of ['opensJustWatch', 'opensTmdb', 'openIn']) {
    assert(!(k in en.moodGauntlet) && !(k in tr.moodGauntlet), 'kalmamali: ' + k)
  }
  assertEquals([en.gauntlet.watchProviders.group.free, tr.gauntlet.watchProviders.group.free], ['Free', 'Ücretsiz'])
  assertEquals([en.gauntlet.watchProviders.withAds, tr.gauntlet.watchProviders.withAds], ['with ads', 'reklamlı'])
  assertEquals([en.gauntlet.watchProviders.openApp, tr.gauntlet.watchProviders.openApp], ['Open %{provider}', "%{provider}'i aç"])
  assertEquals(en.moodGauntlet.offerHint, { subscription: 'With subscription', addon: 'Add-on subscription', free: 'Free to watch', ads: 'Free with ads', rent: 'Rent or buy', buy: 'Rent or buy' })
  assertEquals(tr.moodGauntlet.offerHint, { subscription: 'Abonelikle', addon: 'Ek abonelik', free: 'Ücretsiz izlenir', ads: 'Reklamlı ücretsiz', rent: 'Kirala veya satın al', buy: 'Kirala veya satın al' })
  for (const k of ['watchOn', 'rentOn', 'buyOn', 'rentBuyOn']) {
    assert(!(k in en.moodGauntlet) && !(k in tr.moodGauntlet), 'eski CTA anahtari kalmamali: ' + k)
  }
  assertEquals(en.gauntlet.watchProviders.availabilityIn, 'Availability in %{country}')
  assertEquals(tr.gauntlet.watchProviders.availabilityIn, '%{country} için')
  assertEquals(en.gauntlet.watchProviders.change, 'Change')
  assertEquals(tr.gauntlet.watchProviders.change, 'Değiştir')
  assert(!('offer' in en.gauntlet.watchProviders) && !('offer' in tr.gauntlet.watchProviders))
})

Deno.test('film detayi (Faz 2-8): eski ProviderIcon FlatList yok; WatchProvidersSection + film_detail yuzeyi; Linking yalniz fragman', () => {
  const src = read('app/film/[id].tsx')
  assert(!/ProviderIcon|fetchMovieWatchProviders|flattenProviders|justWatchText/.test(src))
  assertMatch(src, /<WatchProvidersSection filmId=\{film\.id\} surface="film_detail" \/>/)
  assertEquals((src.match(/Linking\.openURL\(/g) ?? []).length, 1)
  assertMatch(src, /openTrailer/)
  const section = read('components/gauntlet/WatchProviders/WatchProvidersSection.tsx')
  assertMatch(section, /useWatchProviders\(filmId, region\)/)
})

Deno.test('Faz 2-8 cila: sonuc basligi 3 satirla sinirli; logo sutunu TR etiketinde tasmaz (flexShrink + minWidth)', () => {
  assertMatch(read('components/MoodGauntlet/ResultStage.tsx'), /styles\.resultTitle, titleStyle\]\} numberOfLines=\{3\}/)
  const st = read('components/gauntlet/WatchProviders/styles.ts')
  assertMatch(st, /logoCol: \{[^}]*flexShrink: 1,[^}]*minWidth: ROW_LOGO_SIZE/)
})

Deno.test('Faz 2-8: loading yer tutucusu = ok duzeni (logo satiri + atif yuksekligi) → veri gelince kayma yok', () => {
  assertMatch(read('components/gauntlet/WatchProviders/index.tsx'), /state === 'loading'\) \{\s*return \(\s*<>\s*<View style=\{rowStyle\} \/>\s*<View style=\{styles\.attributionSpacer\} \/>/)
  assertMatch(read('components/gauntlet/WatchProviders/styles.ts'), /attributionSpacer: \{\s*height: type\.caption\.lineHeight/)
})
