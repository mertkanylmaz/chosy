/**
 * "Watch options" kartı (Faz 2-10a): saf özet + kaynak sözleşmesi.
 * Gerçek render yok (cihazda doğrulanır); burada davranışın kaynak düzeyindeki kilitleri var.
 * Run: deno test --allow-read --unstable-sloppy-imports tests/moodgauntlet/watchOptionsCard.test.ts
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import fixture from '../fixtures/tmdbWatchProviders.beforeSunrise76.json' with { type: 'json' }
import { resultCtaMode } from '../../utils/moodResultCta.ts'
import { watchOptionCount, watchOptionGroups, watchOptionStrip } from '../../utils/watchOptionsSummary.ts'
import { brandOf } from '../../utils/watchProviderBrands.ts'
import { groupProvidersForSheet } from '../../utils/watchProviderList.ts'

const prov = (id: number, name: string, priority = 1) => ({
  provider_id: id,
  provider_name: name,
  logo_path: `/l${id}.png`,
  display_priority: priority,
})

const read = (path: string): string => Deno.readTextFileSync(path)
const count = (src: string, needle: string | RegExp): number =>
  typeof needle === 'string' ? src.split(needle).length - 1 : (src.match(needle) ?? []).length

// ── Saf özet ────────────────────────────────────────────────────────────────

Deno.test('özet: fixture ABD (ads + rent + buy) → Free · Rent or buy, sheet sırasında', () => {
  // deno-lint-ignore no-explicit-any
  const us = (fixture as any).results.US
  assertEquals(watchOptionGroups(us), ['free', 'rentBuy'])
})

Deno.test('özet: üç grup da varsa Stream · Free · Rent or buy', () => {
  const p = { flatrate: [prov(8, 'Netflix')], ads: [prov(73, 'Tubi TV')], rent: [prov(2, 'Apple TV')] }
  assertEquals(watchOptionGroups(p), ['stream', 'free', 'rentBuy'])
})

Deno.test('özet: yalnız rent/buy olan film tek grup; boş gruplar atlanır', () => {
  assertEquals(watchOptionGroups({ rent: [prov(2, 'Apple TV')], buy: [prov(3, 'Google Play')] }), ['rentBuy'])
  assertEquals(watchOptionGroups({ flatrate: [], free: [], ads: [], rent: [], buy: [] }), [])
})

Deno.test('logolar (A1.2): 4 marka → hepsi görünür, rozet yok; marka bazlı tekil', () => {
  // Eski kural en fazla 3 logoydu; CTO kararı (Home-A1.2): ≤5 tekil sağlayıcı → hepsi.
  const p = {
    flatrate: [prov(8, 'Netflix', 1), prov(1796, 'Netflix Standard with Ads', 2), prov(337, 'Disney+', 3)],
    rent: [prov(2, 'Apple TV', 4), prov(3, 'Google Play', 5)],
  }
  const s = watchOptionStrip(p)
  assertEquals(s.logos.length, 4)
  assertEquals(s.overflow, 0)
  assertEquals(new Set(s.logos.map((l) => brandOf(l).key)).size, 4)
  assertEquals(watchOptionCount(p), 4) // Netflix, Disney+, Apple TV, Google Play
})

/** n farklı markalı rent sağlayıcısı (id 1000+i, ad "Svc i"). */
const rentN = (n: number) => ({ rent: Array.from({ length: n }, (_, i) => prov(1000 + i, `Svc ${i}`, i + 1)) })

Deno.test('şerit: 1, 3, 5 sağlayıcı → hepsi, +N yok', () => {
  for (const n of [1, 3, 5]) {
    const s = watchOptionStrip(rentN(n))
    assertEquals(s.logos.length, n)
    assertEquals(s.overflow, 0)
    assertEquals(watchOptionCount(rentN(n)), n)
  }
})

Deno.test('şerit: 6 → 4 logo + "+2"; 7 → 4 logo + "+3"; a11y sayısı kırpılmamış tekil toplam', () => {
  const six = watchOptionStrip(rentN(6))
  assertEquals([six.logos.length, six.overflow], [4, 2])
  const seven = watchOptionStrip(rentN(7))
  assertEquals([seven.logos.length, seven.overflow], [4, 3])
  assertEquals(watchOptionCount(rentN(6)), 6)
  assertEquals(watchOptionCount(rentN(7)), 7)
  // ilk 4 logo mevcut sıradadır
  assertEquals(six.logos.map((l) => l.provider_id), [1000, 1001, 1002, 1003])
})

Deno.test('şerit: aynı marka iki grupta (YouTube Free 235 + Rent 192) → bir kez, Free grubunun logosuyla', () => {
  const p = {
    free: [prov(235, 'YouTube', 1)],
    rent: [prov(192, 'YouTube', 1), prov(2, 'Apple TV', 2)],
  }
  const s = watchOptionStrip(p)
  assertEquals(s.logos.map((l) => l.provider_id), [235, 2])
  assertEquals(watchOptionCount(p), 2)
})

Deno.test('şerit: Iron Giant benzeri (1 free + 6 kiralık/satın alma, YouTube ikisinde) → 4 logo + "+2"', () => {
  const p = {
    free: [prov(235, 'YouTube', 1)],
    rent: [prov(192, 'YouTube', 1), prov(2, 'Apple TV', 2), prov(3, 'Google Play', 3), prov(10, 'Amazon Video', 4)],
    buy: [prov(7, 'Fandango At Home', 5), prov(68, 'Microsoft Store', 6), prov(2, 'Apple TV', 2)],
  }
  const s = watchOptionStrip(p)
  assertEquals(watchOptionCount(p), 6)
  assertEquals([s.logos.length, s.overflow], [4, 2])
  assertEquals(s.logos[0].provider_id, 235) // Free grubu Rent or buy'dan önce
})

Deno.test('şerit: sıra Stream → Free → Rent or buy (grup içi mevcut sıra); Stream olmayan film Free ile başlar', () => {
  const all = watchOptionStrip({
    rent: [prov(2, 'Apple TV', 1)],
    ads: [prov(73, 'Tubi TV', 1)],
    flatrate: [prov(8, 'Netflix', 1)],
  })
  assertEquals(all.logos.map((l) => l.provider_id), [8, 73, 2])
  const noStream = watchOptionStrip({ rent: [prov(2, 'Apple TV', 1)], ads: [prov(73, 'Tubi TV', 1)] })
  assertEquals(noStream.logos.map((l) => l.provider_id), [73, 2])
})

Deno.test('şerit: boş veri → logo yok, rozet yok, sayı 0', () => {
  const s = watchOptionStrip({ flatrate: [], free: [], ads: [], rent: [], buy: [] })
  assertEquals([s.logos.length, s.overflow, watchOptionCount({})], [0, 0, 0])
})

// ── Gruplar arası tekilleştirme YOK ──────────────────────────────────────────

Deno.test('Prime Video hem Stream\'de hem Rent or buy\'da görünür (gruplar arası tekilleştirme yok)', () => {
  const g = groupProvidersForSheet({
    flatrate: [prov(119, 'Amazon Prime Video')],
    rent: [prov(10, 'Amazon Video')],
  })
  assertEquals(g.stream.map((p) => brandOf(p).key), ['prime'])
  assertEquals(g.rentBuy.map((p) => brandOf(p).key), ['prime'])
  assertEquals(watchOptionGroups({ flatrate: [prov(119, 'Amazon Prime Video')], rent: [prov(10, 'Amazon Video')] }), [
    'stream',
    'rentBuy',
  ])
})

// ── Kart kaynak sözleşmesi ──────────────────────────────────────────────────

const CARD = 'components/gauntlet/WatchProviders/WatchOptionsCard.tsx'

Deno.test('kart: iç içe dokunulabilir öğe yok; her Pressable tek onPress + tek accessibilityRole', () => {
  const src = read(CARD)
  const pressables = count(src, '<Pressable')
  assertEquals(pressables, 2) // ok + error hâli; ikisi de ayrı dal
  assertEquals(count(src, 'onPress={'), pressables)
  assertEquals(count(src, 'accessibilityRole="button"'), pressables)
  assert(!src.includes('TouchableOpacity'))
  assert(!src.includes('TouchableHighlight'))
  assert(!src.includes('Linking'))
})

Deno.test('kart: See all ve Change yok; atıf ve a11y etiketi var; dış bağlantı yok', () => {
  const src = read(CARD)
  assert(!/seeAll/i.test(src))
  assert(!src.includes('watchProviders.change'))
  assert(!src.includes('watchProviders.label'))
  assert(src.includes('gauntlet.watchProviders.attribution'))
  assert(src.includes('JustWatch'))
  assert(src.includes('watchOptions.a11y'))
  assert(src.includes('watchOptions.errorTitle'))
  assert(!src.includes('notStreaming')) // error ASLA "yayında değil" demez
})

// ── ResultStage sözleşmesi ──────────────────────────────────────────────────

const STAGE = 'components/MoodGauntlet/ResultStage.tsx'

Deno.test('ResultStage: tek ProvidersSheet örneği, sarı CTA ve başlığı kalktı', () => {
  const src = read(STAGE)
  assertEquals(count(src, '<ProvidersSheet'), 1)
  assertEquals(count(src, '<WatchOptionsCard'), 1)
  assert(!src.includes('PrimaryAction'))
  assert(!src.includes("t('moodGauntlet.whereToWatch')"))
  assert(src.includes("surface=\"mood_result\""))
})

Deno.test('ResultStage: unavailable/hidden yerleşimi korunur', () => {
  const src = read(STAGE)
  assert(src.includes("ctaMode === 'unavailable'"))
  assert(src.includes("t('moodGauntlet.notStreaming'"))
  assert(src.includes("t('gauntlet.watchProviders.change')"))
  assert(src.includes("t('gauntlet.saveForLater.action')"))
  // hidden (noRegion): WatchProvidersRow bugünkü gibi
  assert(/ctaMode === 'hidden'[\s\S]{0,200}<WatchProvidersRow/.test(src))
  assert(src.includes('showOfferLabels'))
  // Save · Trailer · Share satırı
  assert(src.includes("t('moodGauntlet.save')") && src.includes("t('moodGauntlet.trailer')") && src.includes("t('moodGauntlet.shareA11y')"))
  // kart yalnız loading/watch modunda
  assert(src.includes("const showCard = ctaMode === 'loading' || ctaMode === 'watch'"))
})

Deno.test('resultCtaMode: mod haritası değişmedi', () => {
  assertEquals(resultCtaMode('loading', { providerFound: false }), 'loading')
  assertEquals(resultCtaMode('ok', { providerFound: true }), 'watch')
  assertEquals(resultCtaMode('error', { providerFound: false }), 'watch')
  assertEquals(resultCtaMode('empty', { providerFound: false }), 'unavailable')
  assertEquals(resultCtaMode('ok', { providerFound: false }), 'unavailable')
  assertEquals(resultCtaMode('noRegion', { providerFound: false }), 'hidden')
})

Deno.test('i18n: watchOptions anahtarları en + tr birlikte', () => {
  for (const lang of ['en', 'tr']) {
    const j = JSON.parse(read(`locales/${lang}.json`))
    const w = j.gauntlet.watchProviders.watchOptions
    assert(w.title && w.a11y && w.errorTitle, lang)
  }
})

Deno.test('kart (Home-A1.1): ülke · özet TEK satır, bölge satırı yok, atıf sola, sheet atfı ortalı kalır', () => {
  const src = read(CARD).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert(!/cardStyles\.region/.test(src))
  assertEquals(count(src, 'cardStyles.summary'), 1)
  assert(/\[regionName, categories\]\.filter\(\(part\) => part !== ''\)\.join\(SUMMARY_SEPARATOR\)/.test(src))
  assert(/SUMMARY_SEPARATOR = ' · '/.test(src))
  assert(/<WatchOptionsAttribution style=\{cardStyles\.attributionLeft\} \/>/.test(src))
  assert(/attributionLeft: \{ textAlign: 'left' \}/.test(src))
  // iskelet: başlık + logo + 2 satır (özet, atıf) = ok hâlinin 4 çocuğu → düzen zıplamaz
  assertEquals(count(src, '<View style={cardStyles.skelLine} />'), 2)
  // vurgu/gölge/büyüyen başlık eklenmedi
  assert(!/shadow|elevation/i.test(src))
  assert(/title: \{ \.\.\.type\.body, fontWeight: '600'/.test(src))
  // sheet içi atıf varsayılan (ortalı) stilde: `style` verilmeyen çağrılar
  const wrapper = read('components/gauntlet/ChampionReveal/ChampionWatchOptions.tsx')
  assert(wrapper.includes('attribution={<WatchOptionsAttribution />}'))
  assert(read(STAGE).includes('attribution={<WatchOptionsAttribution />}'))
})

Deno.test('kart (Home-A1.2): şerit watchOptionStrip ile, "+N" rozeti sessiz ve dokunulmaz; sheet değişmedi', () => {
  const src = read(CARD).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert(src.includes('watchOptionStrip(providers)'))
  assert(!src.includes('watchOptionLogos'))
  assert(src.includes('{`+${overflow}`}'))
  assert(/overflow > 0 &&/.test(src))
  // rozet: ayrı dokunma hedefi yok (Pressable sayısı değişmedi), vurgu rengi/gölge yok
  assertEquals(count(src, '<Pressable'), 2)
  const more = src.match(/  more: \{[^}]*\}/)?.[0] ?? ''
  assert(/width: LOGO/.test(more) && /height: LOGO/.test(more) && /radius\.poster/.test(more))
  assert(/color\.surface\.base/.test(more))
  const moreText = src.match(/  moreText: \{[^}]*\}/)?.[0] ?? ''
  assert(/color\.text\.secondary/.test(moreText))
  assert(!/accent|marquee|beam|shadow|elevation/i.test(more + moreText))
  // yükseklik: logoRow minHeight LOGO (tek satır), 5 öğe 232pt sığar
  assert(/logoRow: \{[^}]*minHeight: LOGO/.test(src))
  const sheet = read('components/gauntlet/WatchProviders/ProvidersSheet.tsx')
  assert(!sheet.includes('watchOptionStrip') && !sheet.includes('watchOptionItems'))
})
