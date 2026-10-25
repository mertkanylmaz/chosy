/**
 * Gevşetme zinciri sözleşmesi (PRO-0 F0-1): kullanıcı filtresi gevşemez, yalnız min_similarity gevşer;
 * filtre yokken zincir eski değerlerle aynıdır. Run: npm run test:mood-offer
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { buildRelaxationSteps } from '../../utils/relaxationChain.ts'

const ERA = { from: 2010, to: 2019 }

Deno.test('minRating=8: tüm denemelerde min_rating=8, similarity 0.45→0.38', () => {
  const steps = buildRelaxationSteps(8, null)
  assertEquals(steps.map((s) => s.minRating), [8, 8, 8, 8])
  assertEquals(steps.map((s) => s.minSimilarity), [0.45, 0.42, 0.4, 0.38])
})

Deno.test('dönem seçili: tüm denemelerde era korunur', () => {
  const steps = buildRelaxationSteps(null, ERA)
  assertEquals(steps.map((s) => s.era), [ERA, ERA, ERA, ERA])
  // puan filtresi yok → puan eski zincirle gevşer
  assertEquals(steps.map((s) => s.minRating), [6.5, 6.0, 5.5, null])
})

Deno.test('puan + dönem birlikte: ikisi de sabit', () => {
  const steps = buildRelaxationSteps(8.5, ERA)
  assertEquals(steps.map((s) => s.minRating), [8.5, 8.5, 8.5, 8.5])
  assertEquals(steps.map((s) => s.era), [ERA, ERA, ERA, ERA])
})

Deno.test('filtre yok: zincir eski değerlerle birebir aynı', () => {
  assertEquals(buildRelaxationSteps(null, null), [
    { minSimilarity: 0.45, minRating: 6.5, era: null },
    { minSimilarity: 0.42, minRating: 6.0, era: null },
    { minSimilarity: 0.4, minRating: 5.5, era: null },
    { minSimilarity: 0.38, minRating: null, era: null },
  ])
})
