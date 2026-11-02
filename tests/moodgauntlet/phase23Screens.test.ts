/**
 * Faz 2-3 ekran sözleşmesi (kaynak taraması): gauntlet / sonuç / yükleme / giriş / kopya sözlüğü /
 * analitik. Cihaz testi öncesi regresyonu yakalar; görsel doğrulama cihazdadır.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const gauntlet = read('components/MoodGauntlet/GauntletStage.tsx')
const result = read('components/MoodGauntlet/ResultStage.tsx')
const hook = read('components/MoodGauntlet/useMoodGauntlet.ts')
const status = read('components/MoodGauntlet/StatusStage.tsx')
const en = JSON.parse(read('locales/en.json'))
const tr = JSON.parse(read('locales/tr.json'))

Deno.test('gauntlet: soru posterlerin USTUNDE; dortlu ilk turdan once; ipucu yalniz 1. tur + ilk kullanim', () => {
  const q = gauntlet.indexOf("t('moodGauntlet.question')")
  const posters = gauntlet.indexOf('<PosterTile')
  assert(q > 0 && posters > q, 'soru poster satırından önce gelmeli')
  assertMatch(gauntlet, /showIntro = pair !== null && pair\.round === 1 && introDoneFor !== set\.setId/)
  // Faz 2-9a: Your four kalıcı durak (FourIntro); zamanlayıcı kalktı — bkz. phase29a.test.ts
  assertMatch(read('components/MoodGauntlet/FourIntro.tsx'), /t\('moodGauntlet\.yourFour'\)/)
  assert(!/FOUR_INTRO_MS/.test(gauntlet))
  assertMatch(gauntlet, /isFirstRound && tapHint && <Text style=\{styles\.tapHint\}>/)
  // ipucu kalici isaretlenir (yalniz ilk kullanimda)
  assertMatch(hook, /TAP_HINT_KEY = 'chosy_mood_tap_hint_seen_v1'/)
  assertMatch(hook, /AsyncStorage\.setItem\(TAP_HINT_KEY, '1'\)/)
  assertMatch(gauntlet, /hapticSelection\(\)/) // dokunusta haptic
})

Deno.test('gauntlet: ikincil "Sen sec" yalniz 1. turda; "Hicbiri" + tek satir aciklama', () => {
  // Faz 2-4: "Sen seç" metin linki değil, "Hiçbiri" ile AYNI bileşen/boy (OutlineAction)
  assertMatch(gauntlet, /isFirstRound && \(\s*<OutlineAction label=\{t\('moodGauntlet\.justPick'\)\}/)
  assert(!/styles\.justPick/.test(gauntlet))
  assertMatch(gauntlet, /<OutlineAction label=\{t\('moodGauntlet\.noneCta'\)\}/)
  assertMatch(gauntlet, /t\('moodGauntlet\.noneSub'\)/)
  assertEquals(en.moodGauntlet.noneSub, '4 new films, same mood')
  assertEquals(tr.moodGauntlet.noneSub, 'Aynı mood, 4 yeni film')
  assertEquals(en.moodGauntlet.justPick, 'Just pick for me')
  assertEquals(tr.moodGauntlet.justPick, 'Sen seç')
})

Deno.test('Sen sec: rerank 1. film sampiyon, sonuca gider, submit-mood-choice CAGRILMAZ, olay mood_just_pick_tapped {round}', () => {
  const m = hook.match(/const justPick = useCallback\(\(\) => \{[\s\S]*?\n  \}, \[flow, session, set, tapHint, dismissTapHint\]\);/)
  assert(m !== null, 'justPick bulunamadi')
  const body = strip(m[0])
  assertMatch(body, /pair\.round !== 1\) return/)
  assertMatch(body, /trackMoodEvent\(justPickEvent\(1\)\)/)
  assertMatch(body, /champion: flow\.four\[0\]/)
  assertMatch(body, /setStage\('result'\)/)
  assert(!/record\(|recordMoodChoice/.test(body), 'Sen seç seçim kaydı yazmamalı')
})

Deno.test('gauntlet ekraninda gercek veriden cipler (tempo/yogunluk/sure); LLM metnine sayi yasagi dokunulmadi', () => {
  assertMatch(gauntlet, /<FilmChips dims=\{dims\[id\]\} runtimeMinutes=\{runtimes\.get\(id\)\}/)
  assertMatch(read('services/filmDims.ts'), /\.from\('film_profiles'\)\s+\.select\('film_id, dimensions_json'\)/)
  assertMatch(read('supabase/functions/rerank-films/index.ts'), /enforceNoDigits\(lengthPass\.reasons\)/)
})

Deno.test('sonuc ekrani hiyerarsisi: CTA → saglayicilar → Kaydet+Paylas(ikon) → Not quite right (3 cip) → yedekler', () => {
  const idx = (s: string) => {
    const i = result.indexOf(s)
    assert(i >= 0, s)
    return i
  }
  const order = [
    'styles.resultMood', 'styles.hero', 'styles.resultTitle', 'styles.resultReason', '<FilmChips', 'styles.insight',
    "label={t('moodGauntlet.whereToWatch')}", '<WatchProvidersRow', 'styles.secondaryRow', "t('moodGauntlet.adjustTitle')", "t('moodGauntlet.backupsTitle')",
  ].map(idx)
  assertEquals(order, [...order].sort((a, b) => a - b))
  // Another four ayri buyuk dugme degil, ucuncu cip; tek birincil CTA
  assertMatch(result, /<AdjustChip label=\{t\('moodGauntlet\.anotherFour'\)\} onPress=\{onAnotherFour\} \/>/)
  assert(!/OutlineAction/.test(result), 'ayrı Another four / outline dugmesi kalmamali')
  assertEquals((result.match(/<PrimaryAction/g) ?? []).length, 1)
  // Save durumu dugmede: "✓ Saved", ek satir yok; hata icin sabit yer
  assertMatch(result, /saved \? t\('moodGauntlet\.savedShort'\) : t\('moodGauntlet\.save'\)/)
  assertMatch(result, /<View style=\{styles\.noticeSlot\}>/)
  assert(!/setNotice\(t\('moodGauntlet\.saved'\)\)/.test(result), 'basari bildirimi ek satir olarak eklenmemeli')
  assertEquals(en.moodGauntlet.savedShort, '✓ Saved')
  // Share ikon dugmesi
  assertMatch(result, /<ShareNetwork /)
  assert(!/Wind|Lightning/.test(result), 'cip ikonlari kalkti')
})

Deno.test('"Why this fits you": desen saf fonksiyondan; desen yoksa satir yok; LLM kullanilmaz', () => {
  assertMatch(result, /insight !== null && <Text style=\{styles\.insight\}>\{t\(INSIGHT_KEYS\[insight\]\)\}<\/Text>/)
  assertMatch(result, /visibleInsight\(pattern, dims\)/)
  assertMatch(hook, /detectPickPattern\(roundPicks\(flow\), dims, Object\.fromEntries/)
  assert(!/fetch\(|supabase\.functions|rerank/.test(read('utils/moodFilmFacts.ts')), 'desen hesabı ağ/LLM çağırmaz')
  assertEquals(en.moodGauntlet.insight.calmerAll, 'You picked the quieter film every time')
  assertEquals(tr.moodGauntlet.insight.calmerAll, 'Her turda daha sakin olanı seçtin')
  assertEquals(en.moodGauntlet.insight.calmerTwo, 'You leaned toward the quieter films')
  assertEquals(tr.moodGauntlet.insight.calmerTwo, 'Daha sakin filmlere yöneldin')
  assertEquals(en.moodGauntlet.insight.shorterAll, 'You picked the shorter film every time')
  assertEquals(tr.moodGauntlet.insight.shorterTwo, 'Daha kısa filmlere yöneldin')
  assertEquals(en.moodGauntlet.insight.intenseTwo, 'You leaned toward the more intense films')
  assertEquals(tr.moodGauntlet.insight.intenseAll, 'Her turda daha yoğun olanı seçtin')
})

Deno.test('yukleme: quick mood ADI kalir (profile_name yalniz serbest metin); another four tek satir', () => {
  assertMatch(hook, /e\.profileName && lastStart\.current\?\.entry !== 'quick'/)
  assertMatch(hook, /setLoadingKind\('another'\)/)
  assertMatch(status, /kind === 'another' \? 'moodGauntlet\.loadingAnother' : 'moodGauntlet\.loadingFinding'/) // Faz 2-9a: tek satir
  assertEquals(en.moodGauntlet.loadingAnother, 'Picking another four…')
  assertEquals(tr.moodGauntlet.loadingAnother, 'Başka bir dörtlü seçiliyor…')
})

Deno.test('kopya sozlugu en/tr (tek yer: locales)', () => {
  const m = en.moodGauntlet
  const t = tr.moodGauntlet
  assertEquals(
    [m.startCta, m.yourFour, m.question, m.justPick, m.noneCta, m.resultKicker, m.anotherFour, m.lighter, m.stronger],
    ['Find my four', 'Your four', 'Which one tonight?', 'Just pick for me', 'None of these', "TONIGHT'S FILM", 'Another four', 'Lighter', 'More intense'],
  )
  assertEquals(t.yourFour, 'Dörtlün')
  assertEquals(t.question, 'Bu akşam hangisi?')
  assertEquals(
    en.moodGauntlet.entrySubtitle,
    'Tap a mood to start, or describe your night. We pick four, you choose one.',
  )
  assertEquals(
    tr.moodGauntlet.entrySubtitle,
    "Başlamak için bir mood'a dokun ya da akşamını anlat. Biz dört film seçeriz, sen birini seçersin.",
  )
  assertEquals(en.moodGauntlet.tapHint, "Tap the one you'd rather watch")
  assertEquals(tr.moodGauntlet.tapHint, 'İzlemeyi tercih ettiğine dokun')
  // Giris alt basligi artik eski "Four films, three choices, one pick" degil
  assert(!/three choices/.test(en.moodGauntlet.entrySubtitle))
})

Deno.test('analitik: first_four_visible entry+path, timing exclusions/four, mood_four yedek olayi izinli', async () => {
  assertMatch(hook, /firstFourVisibleEvent\(\s*elapsedMs\(startedAt\.current, Date\.now\(\)\),\s*res\.session\.parsed\.cacheHit,\s*input\.entry,\s*res\.path \?\? 'legacy',\s*\)/)
  const a = await import('../../utils/moodGauntletAnalytics.ts')
  for (const e of [
    a.pipelineTimingEvent('exclusions', 300),
    a.pipelineTimingEvent('four', 2500),
    a.pipelineFallbackEvent('mood_four'),
    a.pickActionEvent('watch_now', true, { providerId: 8, offerType: 'flatrate' }),
  ]) a.assertNoFreeText(e)
})

Deno.test('mood-four istemci baglantisi: bolge sabitli, rizasiz cagrilmaz, hata → eski yol; Edge Function mevcut', () => {
  const deps = read('services/moodGauntletDeps.ts')
  assertMatch(deps, /functions\/v1\/mood-four\?forceFunctionRegion=\$\{GAUNTLET_EDGE_REGION\}/)
  assertMatch(deps, /async function moodFour\(input: MoodFourInput\)[\s\S]*?hasAiConsent\(\)/)
  assertMatch(deps, /\n    moodFour,\n/)
  const svc = read('services/moodGauntlet.ts')
  assertMatch(svc, /deps\.onError\('mood_four', err\)/)
  assertMatch(svc, /deps\.onFallback\('mood_four'\)/)
  assertMatch(read('supabase/functions/mood-four/index.ts'), /Deno\.serve\(/)
  // Eski yollar duruyor
  assertMatch(deps, /async function matchV4\(/)
  assertMatch(deps, /functions\/v1\/rerank-films\?forceFunctionRegion/)
})

Deno.test('gunluk gauntlet\'e dokunulmadi: types/gauntlet.ts ve ChampionReveal degismedi', () => {
  // Kaynak taramasi: mood ekranlari kilitli sozlesmeyi degistirmez, yalniz kullanir.
  const film = read('utils/moodGauntletFilm.ts')
  assertMatch(film, /import type \{ GauntletFilm \} from '\.\.\/types\/gauntlet'/)
})

Deno.test('Faz 2-9c: karsilastirma kartlarinda baslik 2 satirlik sabit yukseklik, erisilebilirlik etiketi tam baslik', () => {
  const pairBlock = gauntlet.slice(gauntlet.indexOf('styles.pairRow'), gauntlet.indexOf('styles.gBottom'))
  assertMatch(pairBlock, /<PosterTile[\s\S]*?metaMode="yearOnly"\s*titleLines=\{2\}/)
  const tile = read('components/gauntlet/PosterTile/index.tsx')
  assertMatch(tile, /numberOfLines=\{2\}\s*ellipsizeMode="tail"/)
  assertMatch(tile, /titleLines === 2 && styles\.titleTwoLines/)
  // a11y etiketi kesilmemis film.title'dan kurulur (kesme yalniz gorsel)
  assertMatch(tile, /accessibilityLabel=\{t\('gauntlet\.posterAccessibilityLabel', \{\s*title: film\.title,/)
  // Just pick yalniz 1. tur: gerekce yorumu kayitta
  assertMatch(gauntlet, /sonraki turlarda elenen film olur \*\/\}\n\s*\{isFirstRound && \(/)
})

Deno.test('Faz 2-9c: bos metinde CTA yok; return tuşu go ve ayni gonderim yolu; bos gonderim yok', () => {
  const entry = read('components/MoodGauntlet/EntryStage.tsx')
  assertMatch(entry, /returnKeyType="go"/)
  assertMatch(entry, /onSubmitEditing=\{\(\) => void submitFreeText\(\)\}/)
  assertMatch(entry, /\{canSubmit && \(\s*<View style=\{styles\.ctaSlot\}>/)
  assert(!/disabled=\{!canSubmit\}/.test(entry), 'pasif CTA kalmamali')
  // submitFreeText kirpilmis metni dogrular -> bos / cok kisa metin ne return ile ne CTA ile gider
  assertMatch(entry, /const trimmed = text\.trim\(\);\s*if \(!isMoodInputSubmittable\(trimmed\)\) return;/)
  // CTA etiketi (erisilebilirlik adi) mevcut anahtarlardan
  assertMatch(entry, /t\('moodGauntlet\.startCta'\)/)
})
