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

const ready = (state: 'not_started' | 'in_progress' | 'solved' | 'failed', max = 6): SpotlightCardData => ({
  status: 'ready',
  state,
  backdropUrl: 'https://image.tmdb.org/t/p/w1280/x.jpg',
  maxAttempts: max,
})

const keys = (segs: { key: string }[] | null) => (segs ?? []).map((s) => s.key)

Deno.test('oynanabilir: kare + PLAY (altın), oyun ekranı, ipucu var, 72pt', () => {
  const p = spotlightCardPresentation(ready('not_started'))
  assertEquals(p.kind, 'playable')
  assertEquals(keys(p.main), ['gauntlet.bonus.title', 'gauntlet.bonus.nameTheFilm'])
  assertEquals(p.secondary, [{ key: 'gauntlet.bonus.chancesFromFrame', count: 6 }])
  assertEquals([p.image, p.cta, p.gold, p.target, p.chevron, p.height], ['frame', 'play', true, 'game', false, 'tall'])
  assertEquals(p.hintKey, 'gauntlet.bonus.a11yHint')
  assertEquals(p.eyebrowDone, false)
})

Deno.test('devam: kare + CONTINUE (altın), oyun ekranı', () => {
  const p = spotlightCardPresentation(ready('in_progress'))
  assertEquals([p.kind, p.image, p.cta, p.gold, p.target, p.height], ['continue', 'frame', 'continue', true, 'game', 'tall'])
  assertEquals(p.hintKey, 'gauntlet.bonus.a11yHint')
})

Deno.test('bulundu / haklar bitti: görsel yok, CTA yok, altın yok, sonuç ekranı, chevron, 56pt, ipucu yok', () => {
  for (const [state, key] of [
    ['solved', 'games.spotlight.result_found'],
    ['failed', 'games.spotlight.result_out_of_chances'],
  ] as const) {
    const p = spotlightCardPresentation(ready(state))
    assertEquals(p.kind, state)
    assertEquals(keys(p.main), [key, 'games.spotlight.result_next_film'])
    assert(p.main.every((s) => s.sentence === true))
    assertEquals(
      [p.image, p.cta, p.gold, p.target, p.chevron, p.height, p.eyebrowDone],
      ['none', null, false, 'result', true, 'compact', true],
    )
    assertEquals(p.hintKey, null)
    assertEquals(p.secondary, null)
  }
})

Deno.test('loading: dokunulamaz, oynanabilir yükseklikte, altın yok, nötr kutu', () => {
  const p = spotlightCardPresentation({ status: 'loading', backdropUrl: 'https://x/y.jpg' })
  assertEquals(
    [p.kind, p.target, p.height, p.gold, p.cta, p.image, p.chevron],
    ['loading', null, 'tall', false, null, 'placeholder', false],
  )
  assertEquals(p.secondary, null)
})

Deno.test("error: yüklenemedi + tekrar dene, dokununca yalnız yeniden okuma, altın yok", () => {
  const p = spotlightCardPresentation({ status: 'error' })
  assertEquals(p.kind, 'error')
  assertEquals(keys(p.secondary), ['gauntlet.bonus.loadError', 'gauntlet.retry'])
  assertEquals([p.target, p.gold, p.cta, p.image, p.height, p.hintKey], ['retry', false, null, 'none', 'tall', null])
})

Deno.test('unavailable: kart gizli', () => {
  const p = spotlightCardPresentation({ status: 'unavailable' })
  assertEquals([p.kind, p.target, p.cta], ['hidden', null, null])
})

Deno.test('altın yalnız CTA ile birlikte; CTA yalnız oyun hedefiyle; kare yalnız oynanabilir/devam', () => {
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
    assertEquals(p.gold, p.cta !== null, p.kind)
    if (p.cta !== null) assertEquals(p.target, 'game', p.kind)
    if (p.image === 'frame') assert(p.cta !== null, `${p.kind}: kare yalnız oynanabilir/devam`)
  }
})

Deno.test('kilitli sözlük: eski "tries"/"frame"/"Not this time" anahtarları kartta kullanılmaz', () => {
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
    return [...keys(p.main), ...keys(p.secondary)]
  })
  for (const banned of ['subtitle', 'subtitleNeutral', 'solvedHint', 'failedHint', 'continueHint']) {
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
  if (v.ok) assertEquals([v.state, v.maxAttempts, v.backdropUrl], ['not_started', 6, 'https://x/y.jpg'])
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
