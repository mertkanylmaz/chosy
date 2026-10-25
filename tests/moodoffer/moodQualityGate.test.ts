/**
 * Kalite süzgeci tabanı (MONEY-1C Faz 2b-b): taban adayların gerçek max benzerliğinden.
 * Run: npm run test:mood-offer
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { applyQualityGate, FINAL_CAP } from '../../utils/moodQualityGate.ts'

const row = (id: string, similarity: number) => ({ id, similarity })
const ids = (rs: { id: string }[]) => rs.map((r) => r.id)

Deno.test('rerank düşük benzerlikli filmi başa koyar: taban yine gerçek max üzerinden', () => {
  // Rerank sonrası sıra: c(0.30) başta. Eski taban 0.30*0.55=0.165 → hepsi geçerdi.
  // Doğru taban 0.90*0.55=0.495 → c elenir, b(0.50) kalır.
  const out = applyQualityGate([row('c', 0.3), row('a', 0.9), row('b', 0.5)])
  assertEquals(out.bestScore, 0.9)
  assertEquals(ids(out.rows), ['a', 'b'])
})

Deno.test('sıra korunur (süzgeç yeniden sıralamaz)', () => {
  const out = applyQualityGate([row('x', 0.6), row('y', 0.9), row('z', 0.7)])
  assertEquals(ids(out.rows), ['x', 'y', 'z'])
})

Deno.test('8 adaydan az: kesim yok, yalnız taban uygulanır', () => {
  const out = applyQualityGate([row('a', 0.8), row('b', 0.7), row('c', 0.1)])
  assertEquals(ids(out.rows), ['a', 'b'])
})

Deno.test('tek aday: kendi tabanını geçer', () => {
  const out = applyQualityGate([row('a', 0.42)])
  assertEquals(ids(out.rows), ['a'])
  assertEquals(out.bestScore, 0.42)
})

Deno.test('boş sonuç: boş döner (fallback yolu çağırana kalır)', () => {
  const out = applyQualityGate([])
  assertEquals(out.rows, [])
  assertEquals(out.bestScore, 0)
})

Deno.test('FINAL_CAP: 8\'den fazla geçen aday 8\'e kesilir, ilk 8 korunur', () => {
  const many = Array.from({ length: 12 }, (_, i) => row(`f${i}`, 0.9 - i * 0.01))
  const out = applyQualityGate(many)
  assertEquals(out.rows.length, FINAL_CAP)
  assertEquals(out.rows[0].id, 'f0')
  assertEquals(out.rows[7].id, 'f7')
})

Deno.test('fallback yolu: tüm benzerlikler 0 → taban 0, hepsi geçer (RPC dışı satırlar etkilenmez)', () => {
  const out = applyQualityGate([row('a', 0), row('b', 0)])
  assertEquals(ids(out.rows), ['a', 'b'])
})
