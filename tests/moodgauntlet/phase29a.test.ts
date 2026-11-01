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
