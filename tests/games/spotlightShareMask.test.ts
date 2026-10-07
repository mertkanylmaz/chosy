/**
 * Spotlight paylaşım maskesi (buildShareMask) — çıktı yalnız sayılar.
 *
 * Run: npm run test:spotlight-share
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { buildShareMask, type ShareMaskToken } from '../../components/ShareCards/spotlightShareMask.ts'

const slots = (n: number): ShareMaskToken[] => Array.from({ length: n }, () => ({ t: 'slot' as const }))
const sep = (c: string): ShareMaskToken & { c: string } => ({ t: 'sep', c })

Deno.test('çok kelimeli başlık → kelime başına slot sayısı', () => {
  // "THE GODFATHER" → [3, 9]
  assertEquals(buildShareMask([...slots(3), sep(' '), ...slots(9)]), [3, 9])
})

Deno.test('tek kelime → tek sayı', () => {
  assertEquals(buildShareMask(slots(5)), [5])
})

Deno.test('tire ayraç: slot sayılmaz ve kelimeyi böler', () => {
  // "SPIDER-MAN" → [6, 3], glyph çıktıda yok
  assertEquals(buildShareMask([...slots(6), sep('-'), ...slots(3)]), [6, 3])
})

Deno.test('rakam slot sayılır; iki nokta ve boşluk ayraçtır', () => {
  assertEquals(buildShareMask(slots(4)), [4]) // "2012"
  assertEquals(buildShareMask([...slots(2), sep(':'), sep(' '), ...slots(1)]), [2, 1])
})

Deno.test('baştaki, sondaki ve ardışık ayraçlar boş kelime üretmez', () => {
  assertEquals(buildShareMask([sep('"'), ...slots(2), sep(' '), sep(' '), ...slots(3), sep('!')]), [2, 3])
})

Deno.test('boş girdi ve yalnız ayraç → boş çıktı', () => {
  assertEquals(buildShareMask([]), [])
  assertEquals(buildShareMask([sep(' '), sep('-')]), [])
})

Deno.test('çıktı yalnız sayı içerir', () => {
  const out = buildShareMask([...slots(3), sep('-'), ...slots(2)])
  assertEquals(out.every((n) => typeof n === 'number'), true)
})
