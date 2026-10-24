/**
 * Unit tests — RC ürün / DB plan → SubscriptionTier eşlemesi, lifetime dahil (MONEY-SEC-1).
 * Run: deno test tests/subscription/tierMapping.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { isTierPremium, planIdToTier, productIdToTier } from '../../constants/subscriptionPlans.ts'

Deno.test('productIdToTier: com.chosy.lifetime → lifetime (eskiden free)', () => {
  assertEquals(productIdToTier('com.chosy.lifetime'), 'lifetime')
  assertEquals(isTierPremium(productIdToTier('com.chosy.lifetime')), true)
})

Deno.test('planIdToTier: lifetime → lifetime', () => {
  assertEquals(planIdToTier('lifetime'), 'lifetime')
})

Deno.test('mevcut eşlemeler değişmedi', () => {
  assertEquals(productIdToTier('com.chosy.annual'), 'annual')
  assertEquals(productIdToTier('com.chosy.monthly'), 'monthly')
  assertEquals(productIdToTier('chosyai_weekly'), 'weekly_legacy')
  assertEquals(productIdToTier('chosyai_yearly'), 'annual')
  assertEquals(planIdToTier('weekly'), 'weekly_legacy')
  assertEquals(planIdToTier('yearly'), 'annual')
})

Deno.test('bilinmeyen ürün/plan ve null → free', () => {
  assertEquals(productIdToTier('com.chosy.mystery'), 'free')
  assertEquals(productIdToTier(null), 'free')
  assertEquals(planIdToTier('mystery'), 'free')
  assertEquals(planIdToTier(null), 'free')
})
