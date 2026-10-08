/**
 * F2.3 — heroHeight(screenH, contentH, tabInset) saf fonksiyonu.
 * Run: npm run test:champion
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  HERO_MAX_RATIO,
  HERO_MIN_HEIGHT,
  heroHeight,
} from '../../components/gauntlet/ChampionReveal/heroHeight.ts'

Deno.test('sabitler: alt sınır 160pt, üst sınır %42', () => {
  assertEquals(HERO_MIN_HEIGHT, 160)
  assertEquals(HERO_MAX_RATIO, 0.42)
})

Deno.test("üst sınır: içerik kısaysa hero %42'de durur", () => {
  assertEquals(heroHeight(852, 300, 107), Math.round(852 * 0.42)) // 358
})

Deno.test('alt sınır: içerik çok uzunsa hero 160pt', () => {
  assertEquals(heroHeight(667, 600, 73), 160)
})

Deno.test('aralık içinde: pencere − içerik − alt pay', () => {
  assertEquals(heroHeight(667, 332, 73), 262)
})

Deno.test('ölçülmemiş içerik (0) → üst sınır', () => {
  assertEquals(heroHeight(852, 0, 107), 358)
})

Deno.test('sınırda tam değerler', () => {
  assertEquals(heroHeight(1000, 400, 180), 420) // = %42
  assertEquals(heroHeight(800, 480, 160), 160) // avail 160
})
