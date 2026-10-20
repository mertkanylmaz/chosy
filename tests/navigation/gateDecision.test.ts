/**
 * Gate karar mantığı — gate-bitti bayrağı ve minimum splash atlama.
 * Run: npm run test:gate
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { createGateDoneFlag, isGateReadyToNavigate } from '../../utils/gateDecision.ts'

Deno.test('gate bayrağı: başta bitmedi, markDone sonrası bitti', () => {
  const flag = createGateDoneFlag()
  assertEquals(flag.isDone(), false)
  flag.markDone()
  assertEquals(flag.isDone(), true)
})

Deno.test('gate bayrağı: örnekler bağımsız (cold start = yeni örnek)', () => {
  const a = createGateDoneFlag()
  a.markDone()
  assertEquals(createGateDoneFlag().isDone(), false)
})

const cases: Array<[string, Parameters<typeof isGateReadyToNavigate>[0], boolean]> = [
  ['karar yok, süre doldu', { decisionReady: false, minTimePassed: true, skipMinSplash: false }, false],
  ['karar yok, atlama bayrağı da olsa bekler', { decisionReady: false, minTimePassed: false, skipMinSplash: true }, false],
  ['yeni kullanıcı: karar var, süre dolmadı → bekler', { decisionReady: true, minTimePassed: false, skipMinSplash: false }, false],
  ['yeni kullanıcı: karar var, süre doldu → geçer', { decisionReady: true, minTimePassed: true, skipMinSplash: false }, true],
  ['dönen kullanıcı: karar var, süre dolmadı → hemen geçer', { decisionReady: true, minTimePassed: false, skipMinSplash: true }, true],
  ['dönen kullanıcı: karar var, süre doldu → geçer', { decisionReady: true, minTimePassed: true, skipMinSplash: true }, true],
]

for (const [name, input, expected] of cases) {
  Deno.test(`isGateReadyToNavigate: ${name}`, () => {
    assertEquals(isGateReadyToNavigate(input), expected)
  })
}
