/**
 * Result-1: sonuç ekranı üst bölümü sözleşmeleri.
 * Run: npm run test:mood-gauntlet
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { buildMetaLine } from '../../utils/moodFilmFacts.ts'

Deno.test('buildMetaLine: yıl · süre, eksik alanda ayraç boşta kalmaz', () => {
  assertEquals(buildMetaLine(2019, 121), '2019 · 2h 1m')
  assertEquals(buildMetaLine(2019, null), '2019')
  assertEquals(buildMetaLine(null, 95), '1h 35m')
  assertEquals(buildMetaLine(0, 0), null)
  assertEquals(buildMetaLine(undefined, undefined), null)
  assertEquals(buildMetaLine(NaN, -5), null)
})
