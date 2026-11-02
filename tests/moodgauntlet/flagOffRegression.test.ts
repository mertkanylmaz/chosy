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
  justPickEvent,
  intensityEvent,
  MOOD_GAUNTLET_EVENT_NAMES,
  matchChosenEvent,
  noneOfTheseEvent,
  pickActionEvent,
  returnedAfterTrailerEvent,
  trailerClickedEvent,
  pipelineFallbackEvent,
  pipelineTimingEvent,
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
  // Faz 2-3: iç içe gruplar (chipPace, chipEnergy, insight) düzleştirilir: 'chipPace.slow' gibi.
  const flat = (o: Record<string, unknown>, p = ''): Record<string, string> =>
    Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
      if (v !== null && typeof v === 'object') Object.assign(acc, flat(v as Record<string, unknown>, `${p}${k}.`))
      else acc[`${p}${k}`] = String(v)
      return acc
    }, {})
  const en = flat(JSON.parse(read('locales/en.json')).moodGauntlet)
  const tr = flat(JSON.parse(read('locales/tr.json')).moodGauntlet)
  assertEquals(Object.keys(en).sort(), Object.keys(tr).sort())
  for (const k of Object.keys(en)) {
    const vars = (s: string) => (s.match(/%\{(\w+)\}/g) ?? []).sort()
    assertEquals(vars(en[k]), vars(tr[k]), k)
    assert(en[k].trim().length > 0 && tr[k].trim().length > 0, k)
  }
})

Deno.test('analitik: on olay adi, hicbiri ham metin tasimaz, serbest metin guard atar', () => {
  assertEquals(MOOD_GAUNTLET_EVENT_NAMES.length, 16) // Faz 2-9c: + mood_four_poster_tapped; Faz 2-9a: + mood_four_viewed, mood_four_start_tapped; Faz 2-3: + mood_just_pick_tapped; 2-4d: + trailer_clicked, app_returned_after_trailer
  const evs = [
    startedEvent('quick', 'cozy'),
    startedEvent('free_text', 'cozy'), // free_text'te quick_mood_id girmez
    firstFourVisibleEvent(1234.6, true, 'quick', 'combined'),
    justPickEvent(1),
    matchChosenEvent(2),
    noneOfTheseEvent(1),
    completedEvent(5000),
    pickActionEvent('where'),
    anotherFourEvent(),
    intensityEvent('lighter'),
    pipelineFallbackEvent('rerank'),
    pipelineFallbackEvent('reasons'),
    pipelineTimingEvent('parse', 4012.4),
    pipelineTimingEvent('reasons', 0),
    trailerClickedEvent({ filmId: '123e4567-e89b-12d3-a456-426614174000', setIndex: 1, hasProviderCta: true, lang: 'tr' }),
    returnedAfterTrailerEvent(42.4),
  ]
  for (const e of evs) {
    assert((MOOD_GAUNTLET_EVENT_NAMES as readonly string[]).includes(e.name), e.name)
    assertNoFreeText(e)
  }
  assertEquals(startedEvent('free_text', 'cozy').props, { entry: 'free_text' })
  assertEquals(firstFourVisibleEvent(1234.6, true, 'quick', 'combined').props, {
    ms: 1235, cache_hit: true, entry: 'quick', path: 'combined',
  })
  assertEquals(firstFourVisibleEvent(900, false, 'free_text', 'legacy').props.entry, 'free_text')
  assertEquals(justPickEvent(1), { name: 'mood_just_pick_tapped', props: { round: 1 } })
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

// ─── Faz 2-1b ────────────────────────────────────────────────────────────────

Deno.test('profil satiri: yeni alt metin YALNIZ bayrak aciksa; kapaliyken eski anahtar aynen', () => {
  const profile = read('app/(tabs)/profile.tsx')
  assertMatch(profile, /import \{ useMoodGauntletEnabled \} from '@\/hooks\/useMoodGauntletEnabled'/)
  assertMatch(profile, /t\(moodGauntletOn \? 'profile\.proModeSubtitleGauntlet' : 'profile\.proModeSubtitle'\)/)
  const en = JSON.parse(read('locales/en.json')).profile
  const tr = JSON.parse(read('locales/tr.json')).profile
  assertEquals(en.proModeSubtitle, 'Describe a mood, get a matching film') // eski metin degismedi
  assertEquals(en.proModeSubtitleGauntlet, 'Pick a mood — four films, three choices, one pick')
  assert(tr.proModeSubtitle.length > 0 && tr.proModeSubtitleGauntlet.length > 0)
})

Deno.test('rerank cagrisi uygulama modunda: bolge sabitleme + reason bayragi parametreden', () => {
  const deps = read('services/moodGauntletDeps.ts')
  assertMatch(deps, /rerank-films\?forceFunctionRegion=\$\{GAUNTLET_EDGE_REGION\}/)
  assertMatch(deps, /'x-region': GAUNTLET_EDGE_REGION/)
  assertMatch(deps, /reason: input\.withReasons,/)
  // parse-mood zaten uygulama modundaydi: client_search_id + bolge
  assertMatch(deps, /parse-mood\?forceFunctionRegion=\$\{GAUNTLET_EDGE_REGION\}/)
  assertMatch(deps, /client_search_id: input\.clientSearchId/)
  // poster prefetch hata yutmaz: breadcrumb
  assertMatch(deps, /Image\.prefetch\(urls\)\.catch\(/)
  assertMatch(deps, /Sentry\.addBreadcrumb\(/)
})

Deno.test('yogunluk: parse CAGRILMAZ (kaynak), eski metin-modifier yolu kalmadi', () => {
  const svc = read('services/moodGauntlet.ts')
  const body = svc.slice(svc.indexOf('export async function intensifyMoodGauntlet'))
  assert(!/deps\.parse/.test(body.slice(0, body.indexOf('\n}\n'))), 'intensify parse cagirmamali')
  assert(!/withModifier/.test(svc))
  const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
  assert(!/withModifier|modLighter|modStronger/.test(hook))
  assertMatch(hook, /intensifyMoodGauntlet\(deps, session, direction/)
  assertMatch(hook, /trackMoodEvent\(intensityEvent\(direction\)\)/)
  for (const l of ['en', 'tr']) {
    const blk = JSON.parse(read(`locales/${l}.json`)).moodGauntlet
    assert(!('modLighter' in blk) && !('modStronger' in blk))
  }
})

Deno.test('hiz: dortlu gosterilince 4 filmin nerede-izlenir verisi on-cekilir, gerekce arkadan', () => {
  const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
  assertMatch(hook, /prefetchWatchProviders\(f\.id, region\)/)
  assertMatch(hook, /void fetchReasons\(deps, sess, nextSet\)\.then\(/)
  assertMatch(hook, /pipelineTimingEvent\('reasons'/)
})

Deno.test('gorsel: giris izgarasi tasar, CTA metin varken altin; yukleme spinnersiz; sonuc altin + sabit slot + cipler', () => {
  const entry = read('components/MoodGauntlet/EntryStage.tsx')
  assertMatch(entry, /<View style=\{styles\.gridBleed\}>/)
  assertMatch(entry, /\{canSubmit && \(\s*<View style=\{styles\.ctaSlot\}>[\s\S]*?variant="gold"/)
  const st = read('components/MoodGauntlet/styles.ts')
  assertMatch(st, /gridBleed: \{ marginHorizontal: -space\.base \}/)
  assertMatch(st, /providersSlot: \{ minHeight: 56/)
  const status = read('components/MoodGauntlet/StatusStage.tsx')
  assert(!/ActivityIndicator/.test(status), 'minik spinner kalkti')
  assert(!/PHASE_KEYS/.test(status), 'Faz 2-9a: asama satiri kalkti, tek durum satiri')
  const result = read('components/MoodGauntlet/ResultStage.tsx')
  assertMatch(result, /label=\{t\('moodGauntlet\.whereToWatch'\)\}\s+onPress=\{handleWatchNow\}\s+variant="gold"/)
  assertMatch(result, /disabled=\{!canLighter\}/)
  assertMatch(result, /disabled=\{!canStronger\}/)
  assertMatch(result, /<View style=\{styles\.providersSlot\}>/)
  const gauntlet = read('components/MoodGauntlet/GauntletStage.tsx')
  assertMatch(gauntlet, /id === picked \? 'remaining' : 'eliminated'/)
  assertMatch(gauntlet, /<OutlineAction label=\{t\('moodGauntlet\.noneCta'\)\}/)
  assertMatch(gauntlet, /moodChip/)
})

Deno.test('gerekce satiri en fazla 2 satir (gauntlet + sonuc)', () => {
  // Faz 2-4: gauntlet gerekçesi <=4 satır, taşarsa kuyrukta "…" (tail); kelime ortasında kesme (clip) yok.
  const g = read('components/MoodGauntlet/GauntletStage.tsx')
  assertMatch(g, /style=\{styles\.reason\}\s+numberOfLines=\{4\}\s+ellipsizeMode="tail"/)
  assert(!/ellipsizeMode="clip"|adjustsFontSizeToFit/.test(g), 'gauntlet gerekçesi clip / küçültme kullanmamalı')
  const st = read('components/MoodGauntlet/styles.ts')
  assertMatch(st, /reason: \{[^}]*fontSize: 14/)
  assertMatch(st, /reasonSlot: \{ minHeight: 76 \}/) // 4 satır x 19pt taban; Dynamic Type'ta büyür
  const r = read('components/MoodGauntlet/ResultStage.tsx')
  const reasonEl = r.slice(r.indexOf('style={styles.resultReason}'), r.indexOf('style={styles.resultReason}') + 120)
  assert(!/numberOfLines|ellipsizeMode/.test(reasonEl), 'sonuç gerekçesi kesilmemeli')
})
