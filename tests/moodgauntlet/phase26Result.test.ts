/**
 * Faz 2-6: sağlayıcı yok durumu, varış satırı, bölge değişimi, sonuç kaydırma.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { resultCtaMode } from '../../utils/moodResultCta.ts'
import { resolveWatchTarget } from '../../utils/moodWatchTarget.ts'
import { orderProvidersWithOffer } from '../../utils/watchProviderList.ts'
import { resultScrollKey, shouldScrollToTop } from '../../utils/resultScroll.ts'

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const prov = (id: number, pr: number, name: string) => ({ provider_id: id, provider_name: name, logo_path: '/x.png', display_priority: pr })

/** Mary and Max: TR'de kayıt yok (state 'empty'), US'de var. */
const TR = { state: 'empty' as const, providers: null }
const US = { state: 'ok' as const, providers: { link: 'https://www.themoviedb.org/movie/1/watch?locale=US', flatrate: [prov(1, 5, 'Tubi TV')], rent: [prov(10, 1, 'Amazon Video')], free: [prov(73, 2, 'Tubi')] } }

function view(_region: string, d: { state: 'empty' | 'ok'; providers: typeof US.providers | null }) {
  const target = resolveWatchTarget({ providersReady: d.state === 'ok', providers: d.providers })
  return { target, mode: resultCtaMode(d.state, target) }
}

Deno.test('Mary and Max TR → sarı CTA yok (unavailable); US → "Where to watch" (watch) + ilk logo K-sırasında', () => {
  const tr = view('TR', TR)
  assertEquals(tr.mode, 'unavailable')
  assertEquals(tr.target.providerFound, false)
  const us = view('US', US)
  assertEquals(us.mode, 'watch')
  // K-sırası: free (K2) önce, flatrate-diğer (K3) sonra, rent (K5) son
  const first = orderProvidersWithOffer(US.providers)[0]
  assertEquals(first.provider.provider_name, 'Tubi')
  assertEquals(us.target.providerName, 'Tubi')
})

Deno.test('bölge değişimi: aynı film TR → US → TR, mod / CTA / etiket birlikte yeniden türetilir', () => {
  const seq = [view('TR', TR), view('US', US), view('TR', TR)].map((v) => [v.mode, v.target.offerLabel, v.target.providerName])
  assertEquals(seq, [['unavailable', null, null], ['watch', 'free', 'Tubi'], ['unavailable', null, null]])
})

Deno.test('mod tablosu (Faz 2-8): loading pasif; error → watch (sheet "yüklenemedi"); noRegion → hidden; empty → unavailable', () => {
  const none = { providerFound: false }
  assertEquals(resultCtaMode('loading', none), 'loading')
  assertEquals(resultCtaMode('error', none), 'watch') // asla 'unavailable' ("yayında değil") değil
  assertEquals(resultCtaMode('noRegion', none), 'hidden')
  assertEquals(resultCtaMode('empty', none), 'unavailable')
  assertEquals(resultCtaMode('ok', none), 'unavailable') // veri geldi, liste boş
  assertEquals(resultCtaMode('ok', { providerFound: true }), 'watch')
})

Deno.test('Mary and Max: unavailable modunda sarı CTA yok + Save for later; varış satırı ve JustWatch metni kalktı', () => {
  const en = JSON.parse(read('locales/en.json')).moodGauntlet
  const tr = JSON.parse(read('locales/tr.json')).moodGauntlet
  assert(!('opensJustWatch' in en) && !('opensJustWatch' in tr))
  assertEquals(en.notStreaming, 'Not streaming in %{country} right now')
  assertEquals(tr.notStreaming, 'Şu an %{country} için yayında değil')
  const src = read('components/MoodGauntlet/ResultStage.tsx')
  assert(!/moodGauntlet\.offerHint/.test(src), 'CTA altındaki eski ipucu kalmamalı')
  assertMatch(src, /ctaMode === 'unavailable'/)
  assertMatch(src, /showCard && \(\s*<WatchOptionsCard/) // Faz 2-10a: sari CTA yerine tek kart
  assertMatch(src, /variant="filled"/) // beyaz Save for later
  assertMatch(src, /gauntlet\.saveForLater\.action/)
  assertMatch(src, /RegionPickerSheet/)
})

Deno.test('sonuç kaydırma: yeni sonuçta en üst, aynı sonuçta (detaydan dönüş) konum korunur', () => {
  const a = resultScrollKey('f1', 0)
  assertEquals(shouldScrollToTop(null, a), false) // ilk bağlanma
  assertEquals(shouldScrollToTop(a, a), false) // detaydan dönüş / yeniden render
  assertEquals(shouldScrollToTop(a, resultScrollKey('f1', 1)), true) // Another four / intensity, aynı film bile olsa
  assertEquals(shouldScrollToTop(a, resultScrollKey('f2', 0)), true) // yeni arama
  assertMatch(read('components/MoodGauntlet/ResultStage.tsx'), /scrollTo\(\{ y: 0, animated: false \}\)/)
})
