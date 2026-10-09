/**
 * Unit tests — profil "bilinmeyen premium plan" kararı (REACT-NATIVE-J).
 * Run: npm run test:profile-plan
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { isUnknownPremiumPlan, type UnknownPlanInput } from '../../utils/profilePlan.ts'

const base: UnknownPlanInput = {
  premiumStatus: 'premium',
  status: 'active',
  planId: 'quarterly_x',
  tier: 'free',
  planKnown: false,
}

Deno.test('active + bilinmeyen plan → true (gerçek hata)', () => {
  assertEquals(isUnknownPremiumPlan(base), true)
})

Deno.test('trial + bilinmeyen plan → true (deneme de aktif entitlement)', () => {
  assertEquals(isUnknownPremiumPlan({ ...base, status: 'trial' }), true)
})

Deno.test('active + bilinen plan → false', () => {
  assertEquals(
    isUnknownPremiumPlan({ ...base, planId: 'annual', tier: 'annual', planKnown: true }),
    false,
  )
})

Deno.test('expired + planId null → false (hata yok, free gibi)', () => {
  assertEquals(
    isUnknownPremiumPlan({ ...base, status: 'expired', planId: null }),
    false,
  )
})

Deno.test('free + planId null → false', () => {
  assertEquals(
    isUnknownPremiumPlan({ ...base, premiumStatus: 'free', status: 'free', planId: null }),
    false,
  )
})

Deno.test('active + planId null → false (RC aktif, DB satırı yok: ayrı kanal)', () => {
  assertEquals(isUnknownPremiumPlan({ ...base, planId: null }), false)
})

Deno.test('weekly_legacy → false (bilinen eski plan)', () => {
  assertEquals(isUnknownPremiumPlan({ ...base, tier: 'weekly_legacy' }), false)
})

Deno.test('premium değilken tek başına hiçbir durum true olmaz', () => {
  for (const premiumStatus of ['free', 'loading']) {
    assertEquals(isUnknownPremiumPlan({ ...base, premiumStatus }), false)
  }
})

Deno.test('expired / cancelled + dolu planId → false (aktif değil)', () => {
  for (const status of ['expired', 'cancelled', 'free']) {
    assertEquals(isUnknownPremiumPlan({ ...base, status }), false)
  }
})
