/**
 * MoodDeckSummary — kapat (X), birincil buton ve footer payı sözleşmesi.
 * Repoda React render altyapısı yok (deno + saf mantık); bu test kaynağı okur.
 * Davranışsal doğrulama cihazda yapılır.
 * Run: npm run test:deck-summary
 */
import { assert, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

const read = (p: string) => Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url))
const summary = read('components/MoodDeckSummary/index.tsx')
const discover = read('app/discover.tsx')

Deno.test('likedFilms=[] iken birincil buton hasLiked koşuluna bağlı değil ve onNewMood tetikler', () => {
  const idx = summary.indexOf('styles.primaryBtn')
  assert(idx > 0)
  const open = summary.lastIndexOf('<TouchableOpacity', idx)
  const before = summary.slice(summary.lastIndexOf('<Animated.View', open), open)
  assert(!/hasLiked\s*&&/.test(before))
  assertMatch(summary.slice(open, idx + 200), /onPress=\{handleNewMood\}/)
  assertMatch(summary, /const handleNewMood = \(\) => \{[\s\S]*?onNewMood\(\)/)
})

Deno.test('X düğmesi onClose tetikler, etiketi i18n anahtarından gelir', () => {
  assertMatch(summary, /const handleClose = \(\) => \{[\s\S]*?onClose\(\)/)
  assertMatch(summary, /styles\.closeBtn[\s\S]*?onPress=\{handleClose\}[\s\S]*?deckSummary\.close/)
})

Deno.test('discover: onClose Home köküne dismissTo ile döner (handleNewMood değil)', () => {
  assertMatch(discover, /onClose=\{handleClose\}/)
  assertMatch(discover, /handleClose = useCallback\(\(\) => \{\s*router\.dismissTo\('\/\(tabs\)'\)/)
})

Deno.test('footer payı tab bar payı içermez (+16)', () => {
  assertMatch(summary, /Math\.max\(insets\.bottom, 20\) \+ 16/)
})

Deno.test('deckSummary.close en + tr parite', () => {
  for (const l of ['en', 'tr']) {
    const j = JSON.parse(read(`locales/${l}.json`))
    assert(typeof j.deckSummary.close === 'string' && j.deckSummary.close.length > 0)
  }
})
