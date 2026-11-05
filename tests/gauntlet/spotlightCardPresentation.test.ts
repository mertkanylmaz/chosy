/**
 * Home-B1: Spotlight kartı durum → içerik eşlemesi, doğrulanmış bulmaca, analitik kuralı.
 * Gerçek render cihazda doğrulanır. Run: npm run test:champion
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  sentenceCase,
  shouldTrackViewed,
  spotlightCardPresentation,
  spotlightPuzzleVerified,
  spotlightStateLabel,
  type SpotlightCardData,
  type SpotlightChallengeShape,
} from '../../components/gauntlet/SpotlightBonusCard/cardPresentation.ts'

const ready = (
  state: 'not_started' | 'in_progress' | 'solved' | 'failed',
  max = 6,
  title: string | null = state === 'solved' || state === 'failed' ? 'Minari' : null,
): SpotlightCardData => ({
  status: 'ready',
  state,
  backdropUrl: 'https://image.tmdb.org/t/p/w1280/x.jpg',
  maxAttempts: max,
  title,
})

const keys = (segs: { key: string }[] | null) => (segs ?? []).map((s) => s.key)

Deno.test('oynanabilir: bulanık kare + PLAY hapı (altın), oyun ekranı, ipucu var, 72pt', () => {
  const p = spotlightCardPresentation(ready('not_started'))
  assertEquals(p.kind, 'playable')
  assertEquals(p.eyebrow, { key: 'gauntlet.bonus.spotlightEyebrow', check: false })
  assertEquals(keys(p.main), ['gauntlet.bonus.guessTheFilm'])
  assertEquals(p.secondary, [{ key: 'gauntlet.bonus.chancesFromFrame', count: 6 }])
  assertEquals(
    [p.image, p.blur, p.cta, p.gold, p.target, p.chevron, p.height],
    ['frame', true, 'play', 'cta', 'game', false, 'tall'],
  )
  assertEquals(p.hintKey, 'gauntlet.bonus.a11yHint')
})

Deno.test('devam: aynı kart, hapta CONTINUE', () => {
  const p = spotlightCardPresentation(ready('in_progress'))
  assertEquals(
    [p.kind, p.image, p.blur, p.cta, p.gold, p.target, p.height],
    ['continue', 'frame', true, 'continue', 'cta', 'game', 'tall'],
  )
  assertEquals(keys(p.main), ['gauntlet.bonus.guessTheFilm'])
  assertEquals(p.hintKey, 'gauntlet.bonus.a11yHint')
})

Deno.test('bulundu: NET kare, ✓ FOUND IT (altın eyebrow), film adı, yarın yeni film, chevron, 72pt, ipucu yok', () => {
  const p = spotlightCardPresentation(ready('solved'))
  assertEquals(p.kind, 'solved')
  assertEquals(p.eyebrow, { key: 'games.spotlight.result_found', check: true })
  assertEquals(p.main, [{ key: '', literal: 'Minari' }])
  assertEquals(p.secondary, [{ key: 'games.spotlight.result_next_film', sentence: true }])
  assertEquals(
    [p.image, p.blur, p.cta, p.gold, p.target, p.chevron, p.height, p.titleMissing],
    ['frame', false, null, 'eyebrow', 'result', true, 'tall', false],
  )
  assertEquals(p.hintKey, null)
})

Deno.test('haklar bitti: NET kare, REVEALED (altın YOK, ikon yok), film adı, chevron, 72pt', () => {
  const p = spotlightCardPresentation(ready('failed'))
  assertEquals(p.kind, 'failed')
  assertEquals(p.eyebrow, { key: 'gauntlet.bonus.revealedEyebrow', check: false })
  assertEquals(p.main, [{ key: '', literal: 'Minari' }])
  assertEquals(p.secondary, [{ key: 'games.spotlight.result_next_film', sentence: true }])
  assertEquals(
    [p.image, p.blur, p.cta, p.gold, p.target, p.chevron, p.height],
    ['frame', false, null, null, 'result', true, 'tall'],
  )
  assertEquals(p.hintKey, null)
})

Deno.test('eksik veri: bitmişte title yoksa B1 metni (sentenceCase) + titleMissing', () => {
  const solved = spotlightCardPresentation(ready('solved', 6, null))
  assertEquals(solved.main, [{ key: 'games.spotlight.result_found', sentence: true }])
  assertEquals(solved.titleMissing, true)
  const failed = spotlightCardPresentation(ready('failed', 6, null))
  assertEquals(failed.main, [{ key: 'games.spotlight.result_out_of_chances', sentence: true }])
  assertEquals(failed.titleMissing, true)
})

Deno.test('loading: dokunulamaz, 72pt, altın yok, yenilemede bulanık kare, ilk okumada iskelet (ikincil satır yok)', () => {
  const p = spotlightCardPresentation({ status: 'loading', backdropUrl: 'https://x/y.jpg' })
  assertEquals(
    [p.kind, p.target, p.height, p.gold, p.cta, p.image, p.blur, p.chevron],
    ['loading', null, 'tall', null, null, 'placeholder', true, false],
  )
  assertEquals(p.eyebrow, { key: 'gauntlet.bonus.spotlightEyebrow', check: false })
  assertEquals(p.main, [])
  assertEquals(p.secondary, null)
})

Deno.test('error: koyu zemin, yüklenemedi + tekrar dene, dokununca yalnız yeniden okuma, altın yok', () => {
  const p = spotlightCardPresentation({ status: 'error' })
  assertEquals(p.kind, 'error')
  assertEquals(keys(p.main), ['gauntlet.bonus.loadError', 'gauntlet.retry'])
  assertEquals([p.target, p.gold, p.cta, p.image, p.height, p.hintKey], ['retry', null, null, 'none', 'tall', null])
})

Deno.test('unavailable: kart gizli', () => {
  const p = spotlightCardPresentation({ status: 'unavailable' })
  assertEquals([p.kind, p.target, p.cta], ['hidden', null, null])
})

Deno.test("altın: PLAY/CONTINUE hapında ya da yalnız ✓ FOUND IT eyebrow'unda; haklar bitti/loading/error'da yok", () => {
  const all: SpotlightCardData[] = [
    { status: 'loading' },
    { status: 'error' },
    { status: 'unavailable' },
    ready('not_started'),
    ready('in_progress'),
    ready('solved'),
    ready('failed'),
  ]
  for (const d of all) {
    const p = spotlightCardPresentation(d)
    assertEquals(p.gold === 'cta', p.cta !== null, p.kind)
    assertEquals(p.gold === 'eyebrow', p.kind === 'solved', p.kind)
    if (p.cta !== null) assertEquals(p.target, 'game', p.kind)
    // Net kare yalnız bitmişte; bulanık kare yalnız oynanabilir/devam/loading'de.
    assertEquals(p.image === 'frame' && !p.blur, p.kind === 'solved' || p.kind === 'failed', p.kind)
    // Kart hiçbir durumda 72 pt dışına çıkmaz (zıplama yok).
    assertEquals(p.height, 'tall', p.kind)
  }
})

Deno.test('cevap sızmaz: oynanabilir/devamda title kartta yok (veri title taşısa bile)', () => {
  for (const state of ['not_started', 'in_progress'] as const) {
    const p = spotlightCardPresentation(ready(state, 6, 'Minari'))
    const all = JSON.stringify([p.main, p.secondary, p.eyebrow])
    assert(!all.includes('Minari'), state)
  }
})

Deno.test('kilitli sözlük: eski anahtarlar kartta kullanılmaz (nameTheFilm, doneEyebrow kullanım dışı)', () => {
  const all: SpotlightCardData[] = [
    ready('not_started'),
    ready('in_progress'),
    ready('solved'),
    ready('failed'),
    { status: 'error' },
    { status: 'loading' },
  ]
  const used = all.flatMap((d) => {
    const p = spotlightCardPresentation(d)
    return [p.eyebrow.key, ...keys(p.main), ...keys(p.secondary)]
  })
  for (const banned of ['subtitle', 'subtitleNeutral', 'solvedHint', 'failedHint', 'continueHint', 'nameTheFilm', 'doneEyebrow', 'title', 'label']) {
    assert(!used.includes(`gauntlet.bonus.${banned}`), banned)
  }
})

Deno.test('sentenceCase: EN ve TR (i/İ)', () => {
  assertEquals(sentenceCase('FOUND IT', 'en'), 'Found it')
  assertEquals(sentenceCase('A NEW FILM TOMORROW', 'en'), 'A new film tomorrow')
  assertEquals(sentenceCase('OUT OF CHANCES', 'en'), 'Out of chances')
  assertEquals(sentenceCase('BULDUN', 'tr'), 'Buldun')
  assertEquals(sentenceCase('HAKLARIN BİTTİ', 'tr'), 'Hakların bitti')
  assertEquals(sentenceCase('YARIN YENİ BİR FİLM', 'tr'), 'Yarın yeni bir film')
})

// ── Doğrulanmış bulmaca ─────────────────────────────────────────────────────

const mask = [{ t: 'slot' as const }, { t: 'slot' as const }, { t: 'sep' as const }, { t: 'slot' as const }]
const challenge = (
  over: Record<string, unknown> = {},
  progress: SpotlightChallengeShape['progress'] = null,
  puzzle: Partial<SpotlightChallengeShape['puzzle']> = {},
): SpotlightChallengeShape => ({
  puzzle: {
    id: 'p-1',
    max_attempts: 6,
    puzzle_data: { v: 3, title_mask: mask, letter_count: 3, backdrop_url: 'https://x/y.jpg', ...over },
    ...puzzle,
  },
  progress,
})

Deno.test('doğrulama: geçerli taze bulmaca → ok, not_started', () => {
  const v = spotlightPuzzleVerified(challenge())
  assertEquals(v.ok, true)
  if (v.ok) assertEquals([v.state, v.maxAttempts, v.backdropUrl, v.title], ['not_started', 6, 'https://x/y.jpg', null])
})

Deno.test('doğrulama: bitmişte revealed_solution.title taşınır; oynanabilirde gelse bile null; boş/yanlış tip → null', () => {
  const done = { completed: true, won: true, attempts: 2, spotlight_letters: ['a'], spotlight_revealed: [{ pos: 0, ch: 'a' }] }
  const withTitle = (t: unknown) => ({ ...challenge({}, done), revealed_solution: { title: t } })
  const ok = spotlightPuzzleVerified(withTitle('  Minari '))
  assert(ok.ok && ok.title === 'Minari')
  for (const bad of ['', '   ', 5, null, undefined]) {
    const v = spotlightPuzzleVerified(withTitle(bad))
    assert(v.ok && v.title === null, String(bad))
  }
  const noSolution = spotlightPuzzleVerified(challenge({}, done))
  assert(noSolution.ok && noSolution.title === null)
  const fresh = spotlightPuzzleVerified({ ...challenge(), revealed_solution: { title: 'Minari' } })
  assert(fresh.ok && fresh.title === null, 'oynanabilirde cevap taşınmaz')
})

Deno.test('doğrulama: kimlik yok / V3 öncesi / hak geçersiz / letter_count / kare yok → ok:false + kod', () => {
  const emptyId = spotlightPuzzleVerified(challenge({}, null, { id: '' }))
  assert(!emptyId.ok && emptyId.code === 'SPOTLIGHT_CARD_PUZZLE_ID_MISSING')
  const noId = spotlightPuzzleVerified(challenge({}, null, { id: undefined }))
  assert(!noId.ok && noId.code === 'SPOTLIGHT_CARD_PUZZLE_ID_MISSING')
  const stale = spotlightPuzzleVerified(challenge({ v: 2 }))
  assert(!stale.ok && stale.code === 'SPOTLIGHT_CARD_FORMAT_STALE')
  const noMask = spotlightPuzzleVerified(challenge({ title_mask: undefined }))
  assert(!noMask.ok && noMask.code === 'SPOTLIGHT_CARD_FORMAT_STALE')
  const max = spotlightPuzzleVerified(challenge({}, null, { max_attempts: 0 }))
  assert(!max.ok && max.code === 'SPOTLIGHT_CARD_MAX_ATTEMPTS_INVALID')
  const lc = spotlightPuzzleVerified(challenge({ letter_count: 5 }))
  assert(!lc.ok && lc.code === 'SPOTLIGHT_LETTER_COUNT_INVALID')
  const bd = spotlightPuzzleVerified(challenge({ backdrop_url: '' }))
  assert(!bd.ok && bd.code === 'SPOTLIGHT_CARD_BACKDROP_MISSING')
})

Deno.test('doğrulama: bitmiş durumda kare gerekmez; tutarsız resume reddedilir', () => {
  const done = spotlightPuzzleVerified(
    challenge(
      { backdrop_url: '' },
      { completed: true, won: true, attempts: 2, spotlight_letters: ['a'], spotlight_revealed: [{ pos: 0, ch: 'a' }] },
    ),
  )
  assert(done.ok && done.state === 'solved')
  const broken = spotlightPuzzleVerified(challenge({}, { completed: false, won: false, attempts: 1 }))
  assert(!broken.ok && broken.code === 'SPOTLIGHT_PROGRESS_FIELDS_MISSING')
})

// ── Analitik kuralı ─────────────────────────────────────────────────────────

Deno.test('viewed: ilk çözülmede atılır; loading/unavailable atılmaz; aynı etiket tekrar atılmaz; durum değişince atılır', () => {
  assertEquals(shouldTrackViewed(null, { status: 'loading' }), false)
  assertEquals(shouldTrackViewed(null, { status: 'unavailable' }), false)
  assertEquals(shouldTrackViewed(null, ready('not_started')), true)
  assertEquals(shouldTrackViewed('not_started', ready('not_started')), false)
  assertEquals(shouldTrackViewed('not_started', ready('solved')), true)
  assertEquals(shouldTrackViewed('in_progress', ready('failed')), true)
  assertEquals(shouldTrackViewed(null, { status: 'error' }), true) // 'unknown'
  assertEquals(shouldTrackViewed('unknown', { status: 'error' }), false)
  assertEquals(shouldTrackViewed('unknown', ready('not_started')), true) // retry sonrası
})

Deno.test('durum etiketi: viewed ve visible ile aynı değer kümesi', () => {
  assertEquals(spotlightStateLabel(ready('solved')), 'solved')
  assertEquals(spotlightStateLabel({ status: 'error' }), 'unknown')
  assertEquals(spotlightStateLabel({ status: 'loading' }), 'unknown')
})

// ── Kaynak kilitleri (Home-B1 A tasarımı) ───────────────────────────────────

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

Deno.test('kart stilleri: altın yalnız verbGold (marquee token), gölge/cam yok, yükseklikler 72/56', () => {
  const styles = stripComments(read('components/gauntlet/SpotlightBonusCard/styles.ts'))
  assertEquals((styles.match(/color\.reward\.primary/g) ?? []).length, 1)
  assert(/verbGold: \{\s*color: color\.reward\.primary/.test(styles))
  assert(!/shadow|elevation|BlurView|#[0-9a-fA-F]{3,8}/.test(styles), 'gölge/cam/hardcoded renk yok')
  assert(/cardTall: \{\s*minHeight: FRAME_SIZE \+ space\.sm \* 2/.test(styles))
  assert(/cardCompact: \{\s*minHeight: FRAME_SIZE/.test(styles))
  assert(/FRAME_SIZE = size\.touchTarget \+ space\.md/.test(styles))
})

Deno.test('kart bileşeni: eyebrow sarılabilir, görsel gizli, chevron Phosphor, ipucu duruma göre', () => {
  const src = stripComments(read('components/gauntlet/SpotlightBonusCard/index.tsx'))
  assert(/<Text style=\{styles\.kicker\}>/.test(src), 'kicker numberOfLines yok')
  assert(src.includes('accessible={false}'))
  assert(src.includes("from 'phosphor-react-native'") && !src.includes('Ionicons'))
  assert(src.includes('accessibilityHint={presentation.hintKey !== null ? t(presentation.hintKey) : undefined}'))
  assert(src.includes("presentation.gold === 'cta' && styles.verbGold"))
  assert(!/gauntlet\.bonus\.(subtitle|solvedHint|failedHint|continueHint)/.test(src))
})

Deno.test('kart dokunma: loading pasif, error yalnız onRetry (oyuna gitmez, pressed atılmaz), oyun/sonuç aynı rota', () => {
  const src = stripComments(read('components/gauntlet/SpotlightBonusCard/index.tsx'))
  assert(src.includes('disabled={target === null}'))
  const press = src.slice(src.indexOf('const handlePress'), src.indexOf('// ── Metin'))
  const retryBranch = press.slice(press.indexOf("target === 'retry'"), press.indexOf("posthogAnalytics.track('spotlight_card_pressed'"))
  assert(retryBranch.includes('onRetry?.()') && retryBranch.includes('return;'))
  assert(!retryBranch.includes('router.push'))
  assertEquals((press.match(/router\.push/g) ?? []).length, 1)
})

Deno.test('hook: doğrulanmış bulmaca kapısı, tek uçuş, error → loading, doğrulama hatası Sentry\'ye', () => {
  const src = stripComments(read('components/gauntlet/SpotlightBonusCard/useSpotlightCardState.ts'))
  assert(src.includes('spotlightPuzzleVerified(challenge)'))
  assert(/if \(!verified\.ok\) \{[\s\S]*logger\.error\([\s\S]*setData\(\{ status: 'error' \}\)/.test(src))
  assert(src.includes('if (inFlightRef.current === date) return'))
  assert(/prev\.status === 'error'[\s\S]{0,40}setData\(\{ status: 'loading' \}\)/.test(src))
  // gün/odak değişiminde eski sonuç uygulanmaz
  assert(src.includes('tokenRef.current += 1'))
  // boş catch yok
  assert(!/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(src))
})

Deno.test("hook: ön plana dönüşte (AppState active) yalnız odaktayken, tek uçuş korumasıyla yeniden okur", () => {
  const src = stripComments(read('components/gauntlet/SpotlightBonusCard/useSpotlightCardState.ts'))
  const focusBlock = src.slice(src.indexOf('useFocusEffect('), src.indexOf('const refresh'))
  assert(focusBlock.includes("AppState.addEventListener('change'"))
  assert(focusBlock.includes("if (next === 'active') load(cycleDate)"))
  assert(focusBlock.includes('appStateSub.remove()'))
  // dinleme yalnız odak efektinin içinde; tek `load` girişi (tek uçuş) paylaşılır
  assertEquals((src.match(/AppState\.addEventListener/g) ?? []).length, 1)
  assert(src.includes('if (inFlightRef.current === date) return'))
})

Deno.test('sentenceCase: dil duyarlı — gerçek locale değerleri, aktif dil ile; yanlış dil farklı sonuç verir', () => {
  const en = JSON.parse(read('locales/en.json')).games.spotlight
  const tr = JSON.parse(read('locales/tr.json')).games.spotlight
  // EN değerleri değişmez kurala göre: yalnız harf boyu
  assertEquals(
    ['result_found', 'result_out_of_chances', 'result_next_film'].map((k) => sentenceCase(en[k], 'en')),
    ['Found it', 'Out of chances', 'A new film tomorrow'],
  )
  // TR: i/İ doğru (yerelleştirilmiş küçük harf)
  assertEquals(
    ['result_found', 'result_out_of_chances', 'result_next_film'].map((k) => sentenceCase(tr[k], 'tr')),
    ['Buldun', 'Hakların bitti', 'Yarın yeni bir film'],
  )
  // dil duyarlılığının kanıtı: TR metni EN kuralıyla dönüşse "i̇" (birleşik nokta) çıkar
  assert(sentenceCase(tr.result_out_of_chances, 'en') !== sentenceCase(tr.result_out_of_chances, 'tr'))
})

Deno.test("sentenceCase: bileşen aktif arayüz dilini (useLanguage().language) geçirir, sabit locale yok", () => {
  const src = stripComments(read('components/gauntlet/SpotlightBonusCard/index.tsx'))
  assert(src.includes('const { t, language } = useLanguage()'))
  assert(src.includes('sentenceCase(raw, language)'))
  assert(!/sentenceCase\([^)]*['"](en|tr)['"]/.test(src), 'hardcoded locale yok')
})

Deno.test('analitik: visible state taşır, viewed durum değişiminde tekrar atılır, yeni olay adı yok', () => {
  const visible = stripComments(read('components/gauntlet/GauntletShell/useSpotlightVisible.ts'))
  assert(visible.includes("posthogAnalytics.track('spotlight_card_visible', { source: now.source, state: now.state })"))
  const shell = stripComments(read('components/gauntlet/GauntletShell/index.tsx'))
  assert(shell.includes('state: spotlightStateLabel(spotlightCard)'))
  const card = stripComments(read('components/gauntlet/SpotlightBonusCard/index.tsx'))
  assert(card.includes('if (!shouldTrackViewed(lastViewedRef.current, data)) return'))
  assert(card.includes('lastViewedRef.current = stateLabel'))
  assert(!card.includes('viewedTrackedRef'))
  const events = [...(card + visible).matchAll(/track\('([a-z_]+)'/g)].map((m) => m[1]).sort()
  assertEquals(events, ['spotlight_card_pressed', 'spotlight_card_viewed', 'spotlight_card_visible'])
})
