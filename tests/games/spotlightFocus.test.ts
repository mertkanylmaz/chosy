/**
 * Unit tests — Spotlight ilerleyen odak: blurForProgress (saf hesap).
 *
 * Run: npm run test:spotlight-layout
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { SPOTLIGHT_MAX_BLUR } from '../../components/games/Spotlight/constants.ts'
import { blurForProgress } from '../../components/games/Spotlight/focus.ts'

const MAX = SPOTLIGHT_MAX_BLUR

Deno.test('hiç pozisyon açık değil → maxBlur', () => {
  assertEquals(blurForProgress(0, 10, MAX), MAX)
})

Deno.test('tüm pozisyonlar açık → 0', () => {
  assertEquals(blurForProgress(10, 10, MAX), 0)
})

Deno.test('yarı açık → yarı bulanık (doğrusal)', () => {
  assertEquals(blurForProgress(5, 10, 24), 12)
})

Deno.test('monoton: açılan her pozisyon bulanıklığı artırmaz', () => {
  for (const total of [1, 3, 7, 13, 40]) {
    let prev = Infinity
    for (let opened = 0; opened <= total; opened++) {
      const b = blurForProgress(opened, total, MAX)
      assert(b <= prev, `total=${total} opened=${opened}`)
      prev = b
    }
  }
})

Deno.test('kenetleme: toplamdan fazla açık → 0, negatif → maxBlur', () => {
  assertEquals(blurForProgress(99, 10, MAX), 0)
  assertEquals(blurForProgress(-5, 10, MAX), MAX)
})

Deno.test('toplam 0 veya negatif → 0 (bölme yok, NaN yok)', () => {
  assertEquals(blurForProgress(0, 0, MAX), 0)
  assertEquals(blurForProgress(3, 0, MAX), 0)
  assertEquals(blurForProgress(3, -4, MAX), 0)
})

Deno.test('NaN / Infinity girdileri NaN üretmez ve aralıkta kalır', () => {
  for (const [o, t, m] of [
    [NaN, 10, MAX],
    [3, NaN, MAX],
    [3, 10, NaN],
    [Infinity, 10, MAX],
    [3, Infinity, MAX],
  ]) {
    const b = blurForProgress(o, t, m)
    assert(!Number.isNaN(b))
    assert(b >= 0 && b <= MAX)
  }
})

Deno.test('SPOTLIGHT_MAX_BLUR başlangıç değeri 24 (kalibrasyon düğmesi)', () => {
  assertEquals(SPOTLIGHT_MAX_BLUR, 24)
})
