/**
 * Yogunluk kaydirma (Faz 2-1b): saf fonksiyon — energy_level / thematic_depth / pace_preference.
 * Run: npm run test:mood-gauntlet
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  applyIntensity,
  clampIntensityStep,
  INTENSITY_STEP,
  isShiftable,
  MAX_INTENSITY_STEPS,
} from '../../utils/moodIntensity.ts'

const base = {
  emotional_state: { joy: 0.4 },
  energy_level: 0.5,
  pace_preference: 'medium',
  thematic_depth: 0.5,
  avoid_signals: ['gore'],
}

Deno.test('adim 0: profil degismez (esdeger kopya)', () => {
  assertEquals(applyIntensity(base, 0), base)
})

Deno.test('yalniz uc boyut kayar; duygu vektoru ve avoid_signals aynen kalir; girdi mutasyona ugramaz', () => {
  const snapshot = structuredClone(base)
  const up = applyIntensity(base, 1)
  assert(up !== null)
  assertEquals(up.energy_level, 0.5 + INTENSITY_STEP)
  assertEquals(up.thematic_depth, 0.5 + INTENSITY_STEP)
  assertEquals(up.pace_preference, 'fast')
  assertEquals(up.emotional_state, base.emotional_state)
  assertEquals(up.avoid_signals, ['gore'])
  assertEquals(base, snapshot)
})

Deno.test('hafif: negatif adim; pace en fazla bir basamak; sinirlarda sikisir', () => {
  const down = applyIntensity(base, -1)
  assert(down !== null)
  assertEquals(down.pace_preference, 'slow')
  const extreme = applyIntensity({ ...base, energy_level: 0.1, pace_preference: 'slow' }, -3)
  assert(extreme !== null)
  assertEquals(extreme.energy_level, 0)
  assertEquals(extreme.pace_preference, 'slow')
  const top = applyIntensity({ ...base, energy_level: 0.9, thematic_depth: 0.95, pace_preference: 'fast' }, 3)
  assert(top !== null)
  assertEquals([top.energy_level, top.thematic_depth, top.pace_preference], [1, 1, 'fast'])
})

Deno.test('adim sinirlanir (+-MAX); tamsayiya kirpilir', () => {
  assertEquals(clampIntensityStep(99), MAX_INTENSITY_STEPS)
  assertEquals(clampIntensityStep(-99), -MAX_INTENSITY_STEPS)
  assertEquals(clampIntensityStep(1.9), 1)
})

Deno.test('beklenmeyen profil biciminde null (sessiz gecis yok)', () => {
  assertEquals(applyIntensity({ p: 1 }, 1), null)
  assertEquals(applyIntensity(null, 1), null)
  assertEquals(applyIntensity('x', 1), null)
  assert(!isShiftable({ energy_level: 'x', thematic_depth: 1, pace_preference: 'slow' }))
  assert(isShiftable(base))
})

Deno.test('bilinmeyen pace degeri medium kabul edilir ve kayar (cokme yok)', () => {
  const r = applyIntensity({ ...base, pace_preference: 'weird' }, 1)
  assert(r !== null)
  assertEquals(r.pace_preference, 'fast')
})
