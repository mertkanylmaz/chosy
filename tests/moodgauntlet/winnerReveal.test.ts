/**
 * Winner Reveal: sonuç açılış sırası + hızlı dokunuş koruması.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { revealDelays } from '../../utils/resultReveal.ts'

const read = (p: string) =>
  Deno.readTextFileSync(new URL(`../../${p}`, import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('revealDelays: poster → başlık → meta → detaylar, sıkı artan', () => {
  const d = revealDelays(200, 200, false)
  assertEquals(d, { title: 200, meta: 400, details: 600 })
  assert(d.title < d.meta && d.meta < d.details)
})

Deno.test('revealDelays: Reduce Motion — gecikme yok', () => {
  assertEquals(revealDelays(200, 200, true), { title: 0, meta: 0, details: 0 })
})

Deno.test('ResultStage: detaylar kendi opaklığıyla, gecikmeler tokenlardan; dokunuş engeli yok', () => {
  const src = read('components/MoodGauntlet/ResultStage.tsx')
  assertMatch(src, /revealDelays\(BLACKOUT_SEQUENCE\.titleDelay, BLACKOUT_SEQUENCE\.metaDelay, false\)/)
  assertMatch(src, /detailsOpacity\.value = withDelay\(delays\.details/)
  assertMatch(src, /<Animated\.View style=\{detailsStyle\}>/)
  assert(!/pointerEvents/.test(src), 'açılış sırasında dokunuş engellenmez')
  assert(!/setTimeout/.test(src), 'yapay bekleme yok')
})

Deno.test('GauntletStage: Hiçbiri / Sen seç seçim geçişinde ref kilidine bakar, kilidi kurmaz', () => {
  const src = read('components/MoodGauntlet/GauntletStage.tsx')
  assertMatch(src, /const guardedNone = \(\): void => \{\s*if \(!pickLock\.current\) onNone\(\)/)
  assertMatch(src, /const guardedJustPick = \(\): void => \{\s*if \(!pickLock\.current\) onJustPick\(\)/)
  assertMatch(src, /onPress=\{guardedJustPick\}/)
  assertMatch(src, /onPress=\{guardedNone\}/)
  assertEquals((src.match(/pickLock\.current = true/g) ?? []).length, 1)
})
