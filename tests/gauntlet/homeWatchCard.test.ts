/**
 * Home-A1: Daily Pick'te TEK izleme girişi (Watch options kartı). Kaynak düzeyinde kilitler;
 * gerçek render cihazda doğrulanır. Run: npm run test:champion
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { championWatchMode } from '../../components/gauntlet/ChampionReveal/watchMode.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
/** Yorumlar çıkarılır: kaldırılan öğeler açıklamada anılabilir. */
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const reveal = code('components/gauntlet/ChampionReveal/index.tsx')
const wrapper = code('components/gauntlet/ChampionReveal/ChampionWatchOptions.tsx')

const prov = (id: number) => ({ provider_id: id, provider_name: `P${id}`, logo_path: `/l${id}.png`, display_priority: id })

Deno.test('Home: eski izleme girişleri kalktı (sarı CTA, WatchProvidersRow, watch_now_tapped)', () => {
  assert(!/WatchProvidersRow/.test(reveal))
  assert(!/ArrowUpRight/.test(reveal))
  assert(!/handleWatchNow/.test(reveal))
  assert(!/watch_now_tapped/.test(reveal))
  assert(!/variant="marquee"/.test(reveal))
  assert(!/watchProviders\.(label|seeAll)/.test(reveal + wrapper))
})

Deno.test('Home: tek kart, tek ProvidersSheet (surface=champion), kart sheet açar', () => {
  assertEquals((wrapper.match(/<WatchOptionsCard/g) ?? []).length, 1)
  assertEquals((wrapper.match(/<ProvidersSheet/g) ?? []).length, 1)
  assertMatch(wrapper, /surface="champion"/)
  assertMatch(wrapper, /onPress=\{openSheet\}/)
  assertMatch(wrapper, /setSheetOpen\(true\)/)
  assertMatch(wrapper, /attribution=\{<WatchOptionsAttribution \/>\}/)
  assertEquals((reveal.match(/<ChampionWatchOptions/g) ?? []).length, 1)
})

Deno.test('Home: dışarı açan yol yok', () => {
  assert(!/Linking|openURL|WebBrowser/.test(wrapper + reveal))
})

Deno.test('Home: mod kararı resultCtaMode ile; veri yokken kart ve yanlış CTA çıkmaz', () => {
  assertMatch(code('components/gauntlet/ChampionReveal/watchMode.ts'), /resultCtaMode\(state, \{ providerFound \}\)/)
  assertEquals(championWatchMode('loading', null), 'loading')
  assertEquals(championWatchMode('error', null), 'watch')
  assertEquals(championWatchMode('empty', null), 'unavailable')
  assertEquals(championWatchMode('ok', {}), 'unavailable') // ok ama hiç sağlayıcı yok
  assertEquals(championWatchMode('noRegion', null), 'hidden')
  assertEquals(championWatchMode('ok', { flatrate: [prov(8)] }), 'watch')
})

Deno.test('Home: unavailable/noRegion → notStreaming/noRegion + Change, kart yok; ülke seçici korunur', () => {
  assertMatch(wrapper, /moodGauntlet\.notStreaming/)
  assertMatch(wrapper, /gauntlet\.watchProviders\.noRegion/)
  assertMatch(wrapper, /gauntlet\.watchProviders\.change'/)
  assertMatch(wrapper, /<RegionPickerSheet/)
  // kart yalnız loading/watch dalında
  assertMatch(wrapper, /if \(mode === 'loading' \|\| mode === 'watch'\) \{[\s\S]*?<WatchOptionsCard[\s\S]*?\n  \}\n/)
})

Deno.test('Home: Save birincil yalnız unavailable/hidden; ikincil satır mevcut anahtarlarla', () => {
  assertMatch(reveal, /saveIsPrimary = watchMode === 'unavailable' \|\| watchMode === 'hidden'/)
  assertMatch(reveal, /variant="filled"/)
  assertMatch(reveal, /t\('moodGauntlet\.save'\)/)
  assertMatch(reveal, /t\('moodGauntlet\.savedShort'\)/)
  assertMatch(reveal, /t\('gauntlet\.share\.action'\)/)
  // kaydetme mantığı aynı
  assertMatch(reveal, /saveChampionForLater\(gauntletId, champion\.id\)/)
  assertMatch(reveal, /posthogAnalytics\.track\('save_for_later'/)
})

Deno.test('Home: film detayı erişimi korunur (poster dokunuşu + VoiceOver başlık activate)', () => {
  assertMatch(reveal, /onPress=\{handleOpenFilm\}/)
  assertMatch(reveal, /accessibilityActions=\{\[\{ name: 'activate' \}\]/)
  assertMatch(reveal, /actionName === 'activate'\) handleOpenFilm\(\)/)
})

Deno.test('Paylaşılan bileşenler değişmedi: Result kartı hâlâ tek kart', () => {
  const result = code('components/MoodGauntlet/ResultStage.tsx')
  assertEquals((result.match(/<WatchOptionsCard/g) ?? []).length, 1)
  assertEquals((result.match(/<ProvidersSheet/g) ?? []).length, 1)
})

Deno.test('Hero kilitli: heroHeight formülü ve hero bloğu aynı', () => {
  const hh = read('components/gauntlet/ChampionReveal/heroHeight.ts')
  assertMatch(hh, /HERO_MIN_HEIGHT = 160/)
  assertMatch(hh, /HERO_MAX_RATIO = 0\.42/)
})

Deno.test('Home-A1.1: kart + Save/Share Spotlight/Pro ile aynı 16 pt kenarda; gövdede yatay dolgu yok', () => {
  const styles = read('components/gauntlet/ChampionReveal/styles.ts')
  const block = (name: string) => styles.match(new RegExp(`  ${name}: \{[^}]*\}`))?.[0] ?? ''
  assert(!/paddingHorizontal/.test(block('body')), 'body yatay dolgu taşımaz')
  assertMatch(block('actionsWrapper'), /paddingHorizontal: space\.base/)
  assertMatch(block('textBlock'), /paddingHorizontal: space\.lg/)
  assertMatch(block('metaLine'), /paddingHorizontal: space\.lg/)
  assert(!/marginHorizontal\s*:\s*-|margin\w*:\s*-/.test(styles.replace(/TITLE_OVERLAP/g, '')), 'negatif margin yok')
  assertMatch(read('components/gauntlet/SpotlightBonusCard/styles.ts'), /marginHorizontal: space\.base/)
  assertMatch(read('components/gauntlet/MoodEntryCard/styles.ts'), /marginHorizontal: space\.base/)
  assertMatch(reveal, /style=\{\[styles\.textBlock, titleStyle\]\}/)
})
