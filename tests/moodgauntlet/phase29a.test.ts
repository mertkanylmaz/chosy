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
  const v = fourViewedEvent(setId, 'cozy', 2)
  assertEquals(v, { name: 'mood_four_viewed', props: { set_id: setId, mood: 'cozy', surface: 'your_four', set_index: 2 } })
  assertNoFreeText(v)
  assertNoFreeText(fourViewedEvent(setId, 'free_text', 1))
  assertEquals(fourStartTappedEvent(setId, 2345.6).props, { set_id: setId, dwell_ms: 2346 })
  assertEquals(fourStartTappedEvent(setId, -5).props.dwell_ms, 0)
  assertNoFreeText(fourStartTappedEvent(setId, 100))
  let threw = false
  try {
    assertNoFreeText(fourViewedEvent(setId, 'rainy sunday with my ex', 1))
  } catch {
    threw = true
  }
  assert(threw, 'ham mood metni olaya giremez')
  assert(!('film_ids' in v.props), 'Props tipi genisletilmedi, dizi gonderilmez')
})

Deno.test('hook: Your four olaylari mood anahtari yalniz quick id ya da free_text', () => {
  const hook = strip(read('components/MoodGauntlet/useMoodGauntlet.ts'))
  assertMatch(hook, /last\.entry === 'quick' && last\.quickMoodId \? last\.quickMoodId : 'free_text'/)
  assertMatch(hook, /fourViewedEvent\(set\.setId, moodKey\(\), set\.setIndex \+ 1\)/)
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

Deno.test('poster dokunusu: senkron kilit (hizli/cift dokunus), sari kontur anlik, sure token', () => {
  const g = strip(read('components/MoodGauntlet/GauntletStage.tsx'))
  assertMatch(g, /const pickLock = useRef\(false\)/)
  assertMatch(g, /if \(pickLock\.current\) return;[^\n]*\n\s*pickLock\.current = true;\s*hapticSelection\(\);\s*setPicked\(id\);/)
  // kilit yalniz yeni tur/set anahtarinda acilir
  assertMatch(g, /pickLock\.current = false;\s*setPicked\(null\);[\s\S]*?\}, \[roundKey\]\)/)
  assertEquals((g.match(/pickLock\.current = false/g) ?? []).length, 1)
  // onay butonu YOK: poster dokunusu secimin kendisi
  assert(!/confirm|Choose \$\{|chooseFilmCta/i.test(g))
  assertMatch(g, /selected=\{id === picked\}/)
  assertMatch(g, /MOOD_MOTION\.pickSettle/)
  assert(!/PICK_SETTLE_MS/.test(g))
  assertMatch(g, /reduced \? 0 : MOOD_MOTION\.pickSettle/) // Reduce Motion'da bekleme yok
  assertMatch(read('constants/design/motion.ts'), /pickSettle: DISSOLVE_DURATION\.remainingPoster/)
  assertEquals(read('constants/design/motion.ts').match(/remainingPoster: (\d+)/)![1], '280')
  // gecis sirasinda diger eylemler de kapali
  assertMatch(g, /label=\{t\('moodGauntlet\.noneCta'\)\} onPress=\{onNone\} disabled=\{picked !== null\}/)
  // ilerleme gostergesi
  assertMatch(g, /<RoundIndicator current=\{pair\.round\} \/>/)
})

Deno.test('scroll: turdan tura sifirlanir (GauntletStage), yeni oturumda EntryStage en ustten; sonuc ekrani korunur', () => {
  const g = strip(read('components/MoodGauntlet/GauntletStage.tsx'))
  assertMatch(g, /const scrollRef = useRef<ScrollView>\(null\)/)
  assertMatch(g, /scrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);\s*\}, \[roundKey\]\)/)
  assertMatch(g, /<ScrollView ref=\{scrollRef\}/)
  const e = strip(read('components/MoodGauntlet/EntryStage.tsx'))
  assertMatch(e, /scrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\);\s*\}, \[\]\)/)
  assertMatch(e, /<ScrollView ref=\{scrollRef\}/)
  // film detayindan donus: sonuc ekraninin Faz 2-6 davranisi degismedi (ayni sonuc -> konum korunur)
  assertMatch(strip(read('components/MoodGauntlet/ResultStage.tsx')), /shouldScrollToTop\(lastResultKey\.current, resultKey\)/)
})

Deno.test('oturumlar arasi temiz durum: reset tum aday/oturum state\'ini siler ve uctaki istegi birakir; yeni aramada yarisan sonuc uygulanmaz', () => {
  const hook = strip(read('components/MoodGauntlet/useMoodGauntlet.ts'))
  const m = hook.match(/const reset = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[\]\);/)
  assert(m !== null, 'reset bulunamadi')
  const body = m[0]
  for (const re of [
    /runId\.current \+= 1/, /reasonsRun\.current \+= 1/, /dimsRun\.current \+= 1/,
    /setSession\(null\)/, /setSet\(null\)/, /setReasons\(\{\}\)/, /setReasonsLoading\(false\)/,
    /setFlow\(null\)/, /setNotices\(\[\]\)/, /setDims\(\{\}\)/, /setMoodLabel\(null\)/, /setStage\('entry'\)/,
  ]) assertMatch(body, re)
  // her uzun islem runId ile korunur (iptal / yeni arama sonrasi eski sonuc uygulanmaz)
  assert((hook.match(/id !== runId\.current \|\| !mounted\.current/g) ?? []).length >= 7)
  // Your four tamamlanma isareti set kimligine bagli: yeni dortlu yeniden Your four ile baslar
  assertMatch(strip(read('components/MoodGauntlet/GauntletStage.tsx')), /introDoneFor !== set\.setId/)
})

Deno.test('UUID izni yalniz film_id/set_id anahtarina ve kati UUID regex\'ine bagli; baska alanda UUID bicimli metin reddedilir', () => {
  const uuid = '123e4567-e89b-12d3-a456-426614174000'
  const rejects = (props: Record<string, string>) => {
    let threw = false
    try {
      assertNoFreeText({ name: 'x', props })
    } catch {
      threw = true
    }
    return threw
  }
  assert(!rejects({ set_id: uuid }) && !rejects({ film_id: uuid }))
  assert(rejects({ mood: uuid }), 'mood alaninda UUID bicimli metin reddedilir')
  assert(rejects({ surface: uuid }))
  assert(rejects({ note: uuid }))
  assert(rejects({ set_id: `${uuid} rainy sunday` }), 'UUID + metin (ankrajli regex) reddedilir')
  assert(rejects({ set_id: 'serbest metin' }))
  const src = strip(read('utils/moodGauntletAnalytics.ts'))
  assertMatch(src, /\(k === 'film_id' \|\| k === 'set_id'\) && typeof v === 'string' && UUID_RE\.test\(v\)/)
  assertMatch(src, /UUID_RE = \/\^\[0-9a-f\]\{8\}[^\n]*\$\/i/)
})

Deno.test('Another four / None sonrasi yeni dortlu: set_index artar, Your four yeniden acilir', () => {
  assertEquals(fourViewedEvent('123e4567-e89b-12d3-a456-426614174000', 'cozy', 3).props.set_index, 3)
  assertMatch(strip(read('components/MoodGauntlet/GauntletStage.tsx')), /introDoneFor !== set\.setId/)
  assertMatch(strip(read('components/MoodGauntlet/useMoodGauntlet.ts')), /set\.setIndex \+ 1/)
})
