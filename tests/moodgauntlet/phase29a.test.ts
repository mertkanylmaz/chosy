/**
 * Faz 2-9a: Pro Mode akış anlaşılırlığı (kaynak sözleşmesi + saf fonksiyonlar). Animasyon/geçişler
 * cihazda doğrulanır; burada yalnız koddan ispatlanabilenler.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { assertNoFreeText, fourStartTappedEvent, fourViewedEvent } from '../../utils/moodGauntletAnalytics.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

Deno.test('Your four olaylari: set_id + mood + surface; dwell_ms yuvarlanir; film_ids dizisi YOK; serbest metin guard', () => {
  const setId = '123e4567-e89b-12d3-a456-426614174000'
  const v = fourViewedEvent(setId, 'cozy')
  assertEquals(v, { name: 'mood_four_viewed', props: { set_id: setId, mood: 'cozy', surface: 'your_four' } })
  assertNoFreeText(v)
  assertNoFreeText(fourViewedEvent(setId, 'free_text'))
  assertEquals(fourStartTappedEvent(setId, 2345.6).props, { set_id: setId, dwell_ms: 2346 })
  assertEquals(fourStartTappedEvent(setId, -5).props.dwell_ms, 0)
  assertNoFreeText(fourStartTappedEvent(setId, 100))
  let threw = false
  try {
    assertNoFreeText(fourViewedEvent(setId, 'rainy sunday with my ex'))
  } catch {
    threw = true
  }
  assert(threw, 'ham mood metni olaya giremez')
  assert(!('film_ids' in v.props), 'Props tipi genisletilmedi, dizi gonderilmez')
})

Deno.test('hook: Your four olaylari mood anahtari yalniz quick id ya da free_text', () => {
  const hook = strip(read('components/MoodGauntlet/useMoodGauntlet.ts'))
  assertMatch(hook, /last\.entry === 'quick' && last\.quickMoodId \? last\.quickMoodId : 'free_text'/)
  assertMatch(hook, /fourViewedEvent\(set\.setId, moodKey\(\)\)/)
  assertMatch(hook, /fourStartTappedEvent\(set\.setId, dwellMs\)/)
})

const gauntlet = strip(read('components/MoodGauntlet/GauntletStage.tsx'))
const intro = strip(read('components/MoodGauntlet/FourIntro.tsx'))
const en = JSON.parse(read('locales/en.json'))
const tr = JSON.parse(read('locales/tr.json'))

Deno.test('Your four: otomatik gecis YOK (timer/effect/animasyon callback), Round 1 yalniz CTA ile', () => {
  assert(!/setTimeout|setInterval|runOnJS|withTiming|withDelay/.test(intro), 'FourIntro zamanlayici/animasyon callbacki tasimaz')
  // setIntroDoneFor yalniz CTA handler'inda cagrilir
  const calls = gauntlet.match(/setIntroDoneFor\(/g) ?? []
  assertEquals(calls.length, 1)
  assertMatch(gauntlet, /const handleFourStart = useCallback\(\s*\(dwellMs: number\) => \{\s*onFourStart\(dwellMs\);\s*setIntroDoneFor\(set\.setId\);/)
  assert(!/useEffect\([^)]*setIntroDoneFor/.test(gauntlet))
  // tum ekran dokunusu kalkti: kok TouchableOpacity yok
  assert(!/TouchableOpacity/.test(gauntlet) && !/TouchableOpacity/.test(intro))
  assertMatch(intro, /label=\{t\('moodGauntlet\.fourIntroCta'\)\}\s+onPress=\{handleStart\}/)
})

Deno.test('Your four: CTA cift dokunusta tek acilis/tek olay; yapay gecikme yok; poster etiketli', () => {
  assertMatch(intro, /if \(started\.current\) return/)
  assertMatch(intro, /started\.current = true;\s*hapticSelection\(\);\s*onStart\(Date\.now\(\) - shownAt\.current\)/)
  assertMatch(intro, /interactive=\{false\}/)
  assertMatch(read('components/gauntlet/PosterTile/index.tsx'), /accessibilityRole=\{interactive \? 'button' : 'image'\}/)
  assertMatch(read('components/gauntlet/PosterTile/index.tsx'), /gauntlet\.posterAccessibilityLabel/)
  assertMatch(intro, /accessibilityLabel=\{t\('moodGauntlet\.yourFourA11y'\)\}/)
  // CTA alt guvenli alana sabit, posterler olculen kutuya gore kuculur
  assertMatch(intro, /paddingBottom: Math\.max\(insets\.bottom, space\.base\)/)
  assertMatch(intro, /fourCellWidth\(box\.w, box\.h\)/)
})

Deno.test('Your four: sureler token; Reduce Motion hareketi kaldirir', () => {
  assertMatch(intro, /MOOD_MOTION\.posterStagger/)
  assertMatch(intro, /MOOD_MOTION\.stageTransition/)
  assertMatch(intro, /entering=\{reduced \? undefined :/)
  assert(!/duration\(\s*\d/.test(intro) && !/delay\(\s*\d/.test(intro), 'hardcode sure yok')
  const m = read('constants/design/motion.ts')
  assertMatch(m, /stageTransition: 300/)
  assertMatch(m, /posterStagger: 100/)
})

Deno.test('Your four metinleri en+tr', () => {
  assertEquals(en.moodGauntlet.fourIntroTitle, 'Four films. Three quick choices. One winner.')
  assertEquals(en.moodGauntlet.fourIntroCta, 'Start choosing')
  assertEquals(tr.moodGauntlet.fourIntroTitle, 'Dört film. Üç hızlı seçim. Bir kazanan.')
  assertEquals(tr.moodGauntlet.fourIntroCta, 'Seçmeye başla')
})

import { remainingLoadingHold } from '../../utils/moodLoadingHold.ts'

Deno.test('yukleme: asama satiri yok, tek durum satiri; Reading/Matching/Picking anahtarlari silindi', () => {
  const status = strip(read('components/MoodGauntlet/StatusStage.tsx'))
  assert(!/PHASES|PHASE_KEYS|phaseRow|phaseDot/.test(status))
  assertMatch(status, /moodGauntlet\.loadingFinding/)
  assertEquals(en.moodGauntlet.loadingFinding, 'Finding films that fit your mood…')
  assertEquals(tr.moodGauntlet.loadingFinding, 'Ruh haline uyan filmler bulunuyor…')
  for (const k of ['phaseReading', 'phaseMatching', 'phasePicking']) {
    assert(!(k in en.moodGauntlet) && !(k in tr.moodGauntlet), k)
  }
  // poster yer tutucular kalir
  assertMatch(status, /SILHOUETTES\.map/)
  // servis aşama sınırı gözlemlemiyor: hook yalnız başlığı günceller
  const hook = strip(read('components/MoodGauntlet/useMoodGauntlet.ts'))
  assert(!/setLoadingPhase|'picking'|'matching'/.test(hook))
})

Deno.test('yukleme minimum gorunur sure: kalan sure hesabi (saf)', () => {
  assertEquals(remainingLoadingHold(1000, 1100, 400), 300) // 100 ms görüldü → 300 kaldı
  assertEquals(remainingLoadingHold(1000, 1400, 400), 0)
  assertEquals(remainingLoadingHold(1000, 5000, 400), 0) // yavaş yanıt: gecikme yok
  assertEquals(remainingLoadingHold(0, 1000, 400), 0) // iskelet hiç gösterilmediyse bekletme yok
  assertEquals(remainingLoadingHold(2000, 1900, 400), 400) // saat geriye kaçarsa tam süre, negatif değil
})

Deno.test('yukleme: reveal minimum sure tokenindan, iptalde eski sonuc uygulanmaz', () => {
  const hook = strip(read('components/MoodGauntlet/useMoodGauntlet.ts'))
  assertMatch(hook, /remainingLoadingHold\(loadingShownAt\.current, Date\.now\(\), MOOD_MOTION\.loadingMinVisible\)/)
  assertMatch(hook, /setTimeout\(\(\) => \{\s*if \(id !== runId\.current \|\| !mounted\.current\) return;\s*applySet\(sess, nextSet\);/)
  assertEquals((hook.match(/applySet\(res\./g) ?? []).length, 0, 'dogrudan applySet kalmadi, hepsi revealSet')
  assertMatch(read('constants/design/motion.ts'), /loadingMinVisible: 400/)
})
