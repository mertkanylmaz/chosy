/** Mood Gauntlet turnuva durumu testleri. Run: npm run test:mood-gauntlet */
import { assert, assertEquals, assertThrows } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { choose, currentPair, elapsedMs, initFlow, isComplete } from '../../utils/moodGauntletFlow.ts'

Deno.test('1v2, 3v4, final: eslesme sirasi ve sampiyon', () => {
  let f = initFlow(['a', 'b', 'c', 'd'])
  assertEquals(currentPair(f), { round: 1, a: 'a', b: 'b' })
  f = choose(f, 'b')
  assertEquals(currentPair(f), { round: 2, a: 'c', b: 'd' })
  f = choose(f, 'c')
  assertEquals(currentPair(f), { round: 3, a: 'b', b: 'c' })
  assert(!isComplete(f))
  f = choose(f, 'c')
  assert(isComplete(f))
  assertEquals(f.champion, 'c')
  assertEquals(currentPair(f), null)
})

Deno.test('hatali girdi sessiz gecmez', () => {
  assertThrows(() => initFlow(['a', 'b', 'c']))
  assertThrows(() => initFlow(['a', 'a', 'c', 'd']))
  const f = initFlow(['a', 'b', 'c', 'd'])
  assertThrows(() => choose(f, 'c')) // tur 1'de olmayan film
  const done = choose(choose(choose(f, 'a'), 'c'), 'a')
  assertThrows(() => choose(done, 'a'))
})

Deno.test('akis degismez (immutable)', () => {
  const f = initFlow(['a', 'b', 'c', 'd'])
  choose(f, 'a')
  assertEquals(f.completed, 0)
  assertEquals(f.winners.length, 0)
})

Deno.test('elapsedMs negatif olmaz', () => {
  assertEquals(elapsedMs(1000, 1500), 500)
  assertEquals(elapsedMs(2000, 1000), 0)
})
