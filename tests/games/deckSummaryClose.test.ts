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

Deno.test('discover: onClose ve Try New Mood Pro Mode girdisine dismissTo ile döner (Home değil)', () => {
  assertMatch(discover, /onClose=\{handleClose\}/)
  assertMatch(discover, /const inputRoute = isOnboarding \? '\/\(tabs\)' : '\/pro-mode'/)
  assertMatch(discover, /handleClose = useCallback\(\(\) => \{\s*router\.dismissTo\(inputRoute as never\)/)
  assertMatch(discover, /handleNewMood = useCallback\(\(\) => \{\s*clearMood\(\);\s*router\.dismissTo\(inputRoute as never\)/)
})

Deno.test('bu akşamın filmi: yalnız beğeni varken hero + Watch now / Where to watch; yüzde ve TOP MATCH yok', () => {
  assertMatch(summary, /const heroFilm = hasLiked\s*\?/)
  assertMatch(summary, /\{heroFilm && \(\s*<Animated\.View entering=\{enter\(75\)\} style=\{styles\.pickActions\}>/)
  assertMatch(summary, /onPress=\{handleWatchNow\}/)
  assertMatch(summary, /onPress=\{handleWhereToWatch\}/)
  assertMatch(summary, /components\/gauntlet\/WatchProviders/)
  assert(!/matchScore\}%|% match|topMatch|tonightsPick/.test(summary))
  for (const a of ['watch_now', 'where_to_watch', 'new_mood', 'watchlist']) assert(summary.includes(`'${a}'`), a)
  assertMatch(discover, /onWatchNow=\{handleWatchNow\}/)
  assertMatch(discover, /router\.push\(`\/film\/\$\{film\.id\}`\)/)
})

Deno.test('B10: slot paywall açılmazsa deste donmaz; Sentry yazılır', () => {
  assertMatch(discover, /const shown = await triggerPaywall\(\{ type: 'quota_exhausted', quota: 'slot' \}\);\s*if \(shown\) \{\s*setDeckFrozen\(true\);/)
  assertMatch(discover, /SLOT_PAYWALL_NOT_SHOWN/)
})

Deno.test('deckSummary yeni anahtarlar en + tr parite (tekil/çoğul dahil)', () => {
  for (const l of ['en', 'tr']) {
    const d = JSON.parse(read(`locales/${l}.json`)).deckSummary
    for (const k of ['pickTitle', 'watchNow', 'whereToWatch']) assert(typeof d[k] === 'string' && d[k].length > 0, `${l}.${k}`)
    assert(d.pickSubtitle.one.length > 0 && d.pickSubtitle.other.includes('%{count}'), `${l}.pickSubtitle`)
  }
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
