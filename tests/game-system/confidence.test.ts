/**
 * Unit tests — Imposter güven bahsi + FadeIn ipucu kredisi.
 *
 * Saf fonksiyonlar; ağ/DB gerektirmez.
 * Run: deno test tests/game-system/confidence.test.ts
 */

import { assertEquals, assert, assertFalse } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  applyConfidenceFactor,
  hasHintCredit,
  isValidConfidence,
  meanXpFactor,
  resolveXpFactor,
  type ImposterConfidenceConfig,
} from '../../supabase/functions/_shared/confidence.ts'

/** Migration 062'deki seed ile birebir aynı */
const CONFIG: ImposterConfidenceConfig = {
  levels: [50, 75, 100],
  correct_factor: { '50': 1.0, '75': 1.5, '100': 2.0 },
  wrong_factor: { '50': 1.0, '75': 0.5, '100': 0.0 },
}

// ─── resolveXpFactor ─────────────────────────────────────────────────────────

Deno.test('resolveXpFactor — %100 doğru 2x, yanlış 0x', () => {
  assertEquals(resolveXpFactor(CONFIG, 100, true), 2.0)
  assertEquals(resolveXpFactor(CONFIG, 100, false), 0.0)
})

Deno.test('resolveXpFactor — %75 doğru 1.5x, yanlış 0.5x', () => {
  assertEquals(resolveXpFactor(CONFIG, 75, true), 1.5)
  assertEquals(resolveXpFactor(CONFIG, 75, false), 0.5)
})

Deno.test('resolveXpFactor — %50 nötr: her iki durumda 1x', () => {
  assertEquals(resolveXpFactor(CONFIG, 50, true), 1.0)
  assertEquals(resolveXpFactor(CONFIG, 50, false), 1.0)
})

Deno.test('resolveXpFactor — tanımsız seviye nötre düşer, XP kaybı olmaz', () => {
  assertEquals(resolveXpFactor(CONFIG, 999, true), 1)
  assertEquals(resolveXpFactor(CONFIG, 999, false), 1)
})

// ─── isValidConfidence ───────────────────────────────────────────────────────

Deno.test('isValidConfidence — yalnızca config seviyeleri kabul edilir', () => {
  assert(isValidConfidence(CONFIG, 50))
  assert(isValidConfidence(CONFIG, 75))
  assert(isValidConfidence(CONFIG, 100))
  assertFalse(isValidConfidence(CONFIG, 60))
  assertFalse(isValidConfidence(CONFIG, 0))
  assertFalse(isValidConfidence(CONFIG, -100))
})

// ─── meanXpFactor ────────────────────────────────────────────────────────────

Deno.test('meanXpFactor — 3 round ortalaması', () => {
  // %100 doğru, %100 yanlış, %50 doğru → (2 + 0 + 1) / 3 = 1
  assertEquals(meanXpFactor([{ xp_factor: 2 }, { xp_factor: 0 }, { xp_factor: 1 }]), 1)
})

Deno.test('meanXpFactor — hepsi %100 doğru → 2x', () => {
  assertEquals(meanXpFactor([{ xp_factor: 2 }, { xp_factor: 2 }, { xp_factor: 2 }]), 2)
})

Deno.test('meanXpFactor — hepsi %100 yanlış → 0x (XP sıfırlanır)', () => {
  assertEquals(meanXpFactor([{ xp_factor: 0 }, { xp_factor: 0 }, { xp_factor: 0 }]), 0)
})

Deno.test('meanXpFactor — xp_factor taşımayan eski kayıt nötr sayılır', () => {
  assertEquals(meanXpFactor([{}, {}, {}]), 1)
  assertEquals(meanXpFactor([{ xp_factor: 2 }, {}, {}]), (2 + 1 + 1) / 3)
})

Deno.test('meanXpFactor — boş liste nötr', () => {
  assertEquals(meanXpFactor([]), 1)
})

// ─── applyConfidenceFactor ───────────────────────────────────────────────────

Deno.test('applyConfidenceFactor — nötr bahis bugünkü XP ile birebir aynı (regresyon)', () => {
  // guess_ladder[0] = 100 (migration 055)
  assertEquals(applyConfidenceFactor(100, 1), 100)
  assertEquals(applyConfidenceFactor(55, 1), 55)
  assertEquals(applyConfidenceFactor(10, 1), 10)
})

Deno.test('applyConfidenceFactor — 3/3 + hep %100 → tam 2x baz', () => {
  assertEquals(applyConfidenceFactor(100, 2), 200)
})

Deno.test('applyConfidenceFactor — hep %100 yanlış → 0 XP', () => {
  assertEquals(applyConfidenceFactor(10, 0), 0)
})

Deno.test('applyConfidenceFactor — küsuratlı çarpan yuvarlanır', () => {
  // (2 + 1.5 + 0.5) / 3 = 1.333... × 70 = 93.33 → 93
  assertEquals(applyConfidenceFactor(70, (2 + 1.5 + 0.5) / 3), 93)
})

// ─── hasHintCredit ───────────────────────────────────────────────────────────

Deno.test('hasHintCredit — tahmin yokken ipucu açılamaz', () => {
  assertFalse(hasHintCredit(0, 0))
})

Deno.test('hasHintCredit — 1 yanlış tahmin = 1 ipucu, ikincisi reddedilir', () => {
  assert(hasHintCredit(0, 1))
  assertFalse(hasHintCredit(1, 1))
})

Deno.test('hasHintCredit — kredi yanlış tahmin sayısıyla birlikte artar', () => {
  assert(hasHintCredit(1, 2))
  assert(hasHintCredit(2, 3))
  assertFalse(hasHintCredit(3, 3))
})
