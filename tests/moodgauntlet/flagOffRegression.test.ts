/**
 * Mood Gauntlet bayrak KAPALI regresyon sözleşmesi (Faz 2-1). Repoda React render altyapısı
 * yok; bu testler kaynağı okur — davranışsal doğrulama cihazda. Bayrak kapalıyken Pro Mode
 * release/2.2 ile aynı: eski MoodSearchScreen yolu, peek daveti aynen.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { isFunctionNotDeployed } from '../../utils/moodChoicePolicy.ts'
import {
  assertNoFreeText,
  completedEvent,
  firstFourVisibleEvent,
  intensityEvent,
  MOOD_GAUNTLET_EVENT_NAMES,
  matchChosenEvent,
  noneOfTheseEvent,
  pickActionEvent,
  pipelineFallbackEvent,
  startedEvent,
  anotherFourEvent,
} from '../../utils/moodGauntletAnalytics.ts'
import { toGauntletFilm, hasMeta } from '../../utils/moodGauntletFilm.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('bayrak varsayilani false, testers bos; okuma lazy getter (kural 5/6)', () => {
  const rc = read('services/remoteConfig.ts')
  assertMatch(rc, /mood_gauntlet_enabled: false/)
  assertMatch(rc, /mood_gauntlet_testers: \[\] as readonly string\[\]/)
  const flags = read('services/appConfigFlags.ts')
  assertMatch(flags, /export async function isMoodGauntletEnabled\(\)/)
  assertMatch(flags, /remoteConfig\.get\('mood_gauntlet_enabled'\)/)
  assertMatch(flags, /remoteConfig\.get\('mood_gauntlet_testers'\)/)
  // yeni ayri .from('app_config') istegi acilmaz (fonksiyon govdesinde)
  const body = flags.slice(flags.indexOf('export async function isMoodGauntletEnabled'))
  assert(!/from\('app_config'\)/.test(body.slice(0, body.indexOf('\n}\n'))))
  assert(!/from\('app_config'\)/.test(read('hooks/useMoodGauntletEnabled.ts')))
})

Deno.test('pro-mode: kapi aynen; allowed dalinda bayrak kapaliyken ESKI MoodSearchScreen', () => {
  const screen = read('app/pro-mode.tsx')
  assertMatch(screen, /if \(gate === 'locked'\)/)
  assertMatch(screen, /if \(gate === 'offer'\)/)
  assertMatch(screen, /\{gauntletEnabled \? \(\s*<>\s*<StatusBar[^>]*\/>\s*<MoodGauntletShell \/>\s*<\/>\s*\) : \(\s*<MoodSearchScreen \/>\s*\)\}/)
  // bayrak okunurken eski/yeni kabuk CIZILMEZ (yanlis kabugun bir kare gorunmesi yok)
  assertMatch(screen, /if \(loading \|\| gate === 'checking' \|\| gauntletFlagLoading\)/)
})

Deno.test('eski Pro Mode yolu dokunulmadi: MoodSearchScreen yeni kabuga/bayraga bagli degil', () => {
  const old = read('components/Home/MoodSearchScreen/index.tsx')
  assert(!/MoodGauntlet|mood_gauntlet|useMoodGauntlet/.test(old))
  const deck = read('app/discover.tsx')
  assert(!/MoodGauntlet|mood_gauntlet/.test(deck))
})

Deno.test('peek kurali: bayrak ACIKKEN davet gizli, KAPALIYKEN satirlar ayni (iki yuzey)', () => {
  const shell = read('components/gauntlet/GauntletShell/index.tsx')
  assertMatch(shell, /const peekOfferEnabled = useMoodOfferEnabled\(\);/)
  assertMatch(shell, /const moodGauntletOn = useMoodGauntletEnabled\(\);/)
  assertMatch(shell, /const moodOfferEnabled = peekOfferEnabled && !moodGauntletOn;/)
  // MONEY-1C regresyon testlerinin bagli oldugu satirlar degismedi
  assertMatch(shell, /const showMoodInvite =\s*moodOfferEnabled &&/)
  assertMatch(shell, /invite: showMoodInvite,/)
  const result = read('components/games/Spotlight/SpotlightResult.tsx')
  assertMatch(result, /const moodOfferEnabled = peekOfferEnabled && !moodGauntletOn;/)
  assertMatch(result, /const showMoodInvite = moodOfferEnabled && spotlightInviteFits\(/)
})

Deno.test('hook: okuma bitene/hata verene kadar enabled=false (bayrak kapaliyken hicbir yuzey cizilmez)', () => {
  const hook = read('hooks/useMoodGauntletEnabled.ts')
  assertMatch(hook, /useState<MoodGauntletFlag>\(\{ enabled: false, loading: true \}\)/)
  assertMatch(hook, /MOOD_GAUNTLET_FLAG_READ_FAILED/)
  assertMatch(hook, /setState\(\{ enabled: false, loading: false \}\)/)
})

Deno.test('Mood Gauntlet swipe / otomatik watchlist yazimi YOK; watchlist yalniz Sonraya birak dokunusuyla', () => {
  const dir = 'components/MoodGauntlet/'
  const files = ['index.tsx', 'EntryStage.tsx', 'GauntletStage.tsx', 'ResultStage.tsx', 'StatusStage.tsx', 'useMoodGauntlet.ts']
  for (const f of files) {
    const src = read(dir + f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    assert(!/PanGesture|Gesture\.|swipe/i.test(src), `${f}: swipe yok`)
    assert(!/saveSession|setPendingSearchId|startPreload/.test(src), `${f}: eski deste/recent yazimi yok`)
    if (f !== 'ResultStage.tsx') assert(!/addToWatchlist/.test(src), `${f}: otomatik watchlist yok`)
  }
  assertMatch(read(dir + 'ResultStage.tsx'), /const handleSave = useCallback\(async \(\) => \{[\s\S]*?await addToWatchlist\(/)
  assert(!/ChampionReveal/.test(read(dir + 'ResultStage.tsx').replace(/\/\*[\s\S]*?\*\//, '')), 'ChampionReveal kullanilmaz')
})

Deno.test('locales: moodGauntlet anahtarlari en/tr tam parite, interpolasyon degiskenleri ayni', () => {
  const en = JSON.parse(read('locales/en.json')).moodGauntlet as Record<string, string>
  const tr = JSON.parse(read('locales/tr.json')).moodGauntlet as Record<string, string>
  assertEquals(Object.keys(en).sort(), Object.keys(tr).sort())
  for (const k of Object.keys(en)) {
    const vars = (s: string) => (s.match(/%\{(\w+)\}/g) ?? []).sort()
    assertEquals(vars(en[k]), vars(tr[k]), k)
    assert(en[k].trim().length > 0 && tr[k].trim().length > 0, k)
  }
})

Deno.test('analitik: dokuz olay adi, hicbiri ham metin tasimaz, serbest metin guard atar', () => {
  assertEquals(MOOD_GAUNTLET_EVENT_NAMES.length, 9)
  const evs = [
    startedEvent('quick', 'cozy'),
    startedEvent('free_text', 'cozy'), // free_text'te quick_mood_id girmez
    firstFourVisibleEvent(1234.6, true),
    matchChosenEvent(2),
    noneOfTheseEvent(1),
    completedEvent(5000),
    pickActionEvent('where'),
    anotherFourEvent(),
    intensityEvent('lighter'),
    pipelineFallbackEvent('rerank'),
  ]
  for (const e of evs) {
    assert((MOOD_GAUNTLET_EVENT_NAMES as readonly string[]).includes(e.name), e.name)
    assertNoFreeText(e)
  }
  assertEquals(startedEvent('free_text', 'cozy').props, { entry: 'free_text' })
  assertEquals(firstFourVisibleEvent(1234.6, true).props, { ms: 1235, cache_hit: true })
  let threw = false
  try {
    assertNoFreeText({ name: 'mood_gauntlet_started', props: { entry: 'quick', mood: 'rainy day with my cat' } })
  } catch {
    threw = true
  }
  assert(threw, 'serbest metin guard calismadi')
})

Deno.test('analitik cagri noktalari: ham metin degiskeni (text/moodText/profileName/reason) olaya girmez', () => {
  const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
  assert(!/posthogAnalytics\.track\([^)]*(text|moodText|profileName|reason|title)/i.test(hook))
  const deps = read('services/moodGauntletDeps.ts')
  assertMatch(deps, /posthogAnalytics\.track\('mood_pipeline_fallback', \{ stage \}\)/)
})

Deno.test('ESKI olay adlari yeniden kullanilmaz (North Star gauntlet_completed ile karismaz)', () => {
  for (const f of ['components/MoodGauntlet/useMoodGauntlet.ts', 'components/MoodGauntlet/ResultStage.tsx', 'utils/moodGauntletAnalytics.ts']) {
    const src = read(f)
    assert(!/['"]gauntlet_completed['"]/.test(src), f)
    assert(!/['"]watch_now_tapped['"]/.test(src), f)
  }
})

Deno.test('submit-mood-choice deploy edilmemis: yalniz platform NOT_FOUND atlanir; kendi 404 kodlari gercek hata', () => {
  assert(isFunctionNotDeployed(404, { code: 'NOT_FOUND', message: 'Requested function was not found' }))
  assert(!isFunctionNotDeployed(404, { code: 'SEARCH_NOT_FOUND' }))
  assert(!isFunctionNotDeployed(500, { code: 'NOT_FOUND' }))
  assert(!isFunctionNotDeployed(404, null))
  const api = read('services/moodChoiceApi.ts')
  assertMatch(api, /Sentry\.addBreadcrumb\(/)
  assertMatch(api, /return 'not_deployed'/)
  // kullaniciya hata gosterilmez: Alert / throw yok
  assert(!/Alert\./.test(api) && !/throw /.test(api))
})

Deno.test('GauntletFilm eslemesi: eksik veri uydurulmaz', () => {
  const f = toGauntletFilm(
    { id: 'a', title: 'T', year: null, runtime: null, poster_url: null },
    (u) => u ?? '',
  )
  assertEquals(f, { id: 'a', title: 'T', year: 0, runtime: 0, posterUrl: '' })
  assert(!hasMeta(f))
  assert(hasMeta({ year: 1999, runtime: 0 }))
})

Deno.test('types/gauntlet.ts bu is icin degismedi: mood kodu kilitli sozlesmeyi yalniz import eder', () => {
  for (const f of ['utils/moodGauntletFilm.ts']) {
    assertMatch(read(f), /import type \{ GauntletFilm \} from '\.\.\/types\/gauntlet'/)
  }
})
