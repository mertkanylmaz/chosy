/**
 * Bugünkü deste kurtarma (MONEY-1C P0): anlık görüntü doğrulama + bayrak/kapsam sözleşmesi.
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  createTodayDeckSnapshot,
  isSameSearchText,
  localDateKey,
  parseTodayDeck,
  TODAY_DECK_MAX_FILMS,
} from '../../utils/todayDeck.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

const film = (id: string) => ({ id, title: `T${id}`, year: 2000, posterUrl: '', matchScore: 80, moodTags: [], whyThisFilm: '' })
const NOW = new Date(2026, 9, 25, 14, 0, 0) // yerel 25 Eki
const snap = (n = 8) =>
  createTodayDeckSnapshot({
    now: NOW,
    ownerId: 'u1',
    searchId: 's1',
    moodText: 'rainy sunday',
    profile: {} as never,
    filters: { yearRange: null, minRating: null, regions: [], directors: [] },
    films: Array.from({ length: n }, (_, i) => film(`f${i}`)),
  })

Deno.test('yerel gün anahtarı ve snapshot: sıra korunur, ≤8, clientSearchId henüz null', () => {
  assertEquals(localDateKey(NOW), '2026-10-25')
  const s = snap(12)
  assertEquals(s.films.length, TODAY_DECK_MAX_FILMS)
  assertEquals(s.films.map((f) => f.id), ['f0', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'])
  assertEquals(s.clientSearchId, null)
})

Deno.test('parse: bugün + aynı hesap → geçer; başka gün / başka hesap / bozuk / boş → null', () => {
  const raw = JSON.stringify(snap())
  assertEquals(parseTodayDeck(raw, '2026-10-25', 'u1')?.searchId, 's1')
  assertEquals(parseTodayDeck(raw, '2026-10-26', 'u1'), null) // dün kaldı
  assertEquals(parseTodayDeck(raw, '2026-10-25', 'u2'), null) // hesap değişti
  assertEquals(parseTodayDeck('{bozuk', '2026-10-25', 'u1'), null)
  assertEquals(parseTodayDeck(null, '2026-10-25', 'u1'), null)
  assertEquals(parseTodayDeck(JSON.stringify({ ...snap(), films: [] }), '2026-10-25', 'u1'), null)
  assertEquals(parseTodayDeck(JSON.stringify({ ...snap(), v: 2 }), '2026-10-25', 'u1'), null)
})

Deno.test('son aramalar eşlemesi: metin kırpılarak karşılaştırılır', () => {
  assertEquals(isSameSearchText(snap(), '  rainy sunday '), true)
  assertEquals(isSameSearchText(snap(), 'rainy monday'), false)
})

Deno.test('kapsam: sunucu çağrısı yok, bayrak arkasında, mood metni yalnız cihazda', () => {
  const store = read('services/todayDeckStore.ts')
  assert(!/supabase|fetch\(|parse-mood|rerank|posthog/i.test(store.replace(/\/\*[\s\S]*?\*\//g, '')))
  const d = read('app/discover.tsx')
  assertMatch(d, /if \(!offerEnabled \|\| isOnboarding \|\| searchMode !== 'ai'\) return;/)
  const m = read('components/Home/MoodSearchScreen/index.tsx')
  assertMatch(m, /if \(!offerEnabled \|\| isOnboarding\) \{\s*setTodayDeck\(null\);\s*return;/)
  // kurtarma yolunda arama/rerank yok: yalnız seedPreload + route
  const open = m.slice(m.indexOf('const openTodayDeck'), m.indexOf('const handleRecentTap'))
  assertMatch(open, /seedPreload\(todayDeck\.films\)/)
  assert(!/parseMood|startPreload|getRecommendations|runSearch/.test(open))
  // olay yükünde mood metni yok
  assert(!/mood_text|moodText/.test(open.slice(open.indexOf('track('), open.indexOf('track(') + 160)))
  // son aramalardan bugünkü aramaya dokunmak deste açar
  assertMatch(m, /isSameSearchText\(todayDeck, item\.mood_text\)\s*\) \{\s*openTodayDeck\(\);\s*return;/)
})

Deno.test('locales: todayCard anahtarları en/tr parite', () => {
  for (const l of ['en', 'tr']) {
    const m = JSON.parse(read(`locales/${l}.json`)).moodOffer
    assert(typeof m.todayCardTitle === 'string' && typeof m.todayCardCount === 'string', l)
  }
})
