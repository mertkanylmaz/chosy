/**
 * Unit tests — paywall fiyat/trial hesapları (R-C-1).
 * Run: npm run test:paywall-pricing
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  buildAnnualPricing,
  freeTrialDays,
  trialDaysFor,
} from '../../utils/paywallPricing.ts'

const intro = (price: number, periodUnit: string, periodNumberOfUnits: number) => ({
  introPrice: { price, periodUnit, periodNumberOfUnits },
})

Deno.test('freeTrialDays: DAY ve WEEK gün sayısına çevrilir', () => {
  assertEquals(freeTrialDays(intro(0, 'DAY', 3)), 3)
  assertEquals(freeTrialDays(intro(0, 'WEEK', 1)), 7)
  assertEquals(freeTrialDays(intro(0, 'week', 2)), 14)
})

Deno.test('freeTrialDays: ücretli intro, ay/yıl birimi, intro yok → 0', () => {
  assertEquals(freeTrialDays(intro(0.99, 'DAY', 3)), 0)
  assertEquals(freeTrialDays(intro(0, 'MONTH', 1)), 0)
  assertEquals(freeTrialDays(intro(0, 'YEAR', 1)), 0)
  assertEquals(freeTrialDays({ introPrice: null }), 0)
  assertEquals(freeTrialDays(intro(0, 'DAY', 0)), 0)
  assertEquals(freeTrialDays(intro(0, 'DAY', 1.5)), 0)
})

Deno.test('trialDaysFor: yalnız eligible vaat eder (unknown/ineligible → 0)', () => {
  const p = intro(0, 'DAY', 7)
  assertEquals(trialDaysFor('eligible', p), 7)
  assertEquals(trialDaysFor('unknown', p), 0)
  assertEquals(trialDaysFor('ineligible', p), 0)
  assertEquals(trialDaysFor('eligible', { introPrice: null }), 0)
})

Deno.test('buildAnnualPricing: 4.99 / 29.99 USD → $2.50 ve %50 (en)', () => {
  const r = buildAnnualPricing(
    { price: 4.99, currencyCode: 'USD' },
    { price: 29.99, currencyCode: 'USD' },
    'en-US',
  )
  assertEquals(r?.monthlyEquivalent, '$2.50')
  assertEquals(r?.savingsPercent, '50%')
})

Deno.test('buildAnnualPricing: para birimi sabit "$" değil', () => {
  const r = buildAnnualPricing(
    { price: 129.99, currencyCode: 'TRY' },
    { price: 799.99, currencyCode: 'TRY' },
    'tr-TR',
  )
  assertEquals(r !== null, true)
  assertEquals(r!.monthlyEquivalent.includes('$'), false)
  assertEquals(r!.monthlyEquivalent.includes('66,67'), true)
})

Deno.test('buildAnnualPricing: tasarruf yok / geçersiz girdi / karışık para birimi → null', () => {
  assertEquals(
    buildAnnualPricing({ price: 4, currencyCode: 'USD' }, { price: 48, currencyCode: 'USD' }, 'en'),
    null,
  )
  assertEquals(
    buildAnnualPricing({ price: 4, currencyCode: 'USD' }, { price: 60, currencyCode: 'USD' }, 'en'),
    null,
  )
  assertEquals(
    buildAnnualPricing({ price: 0, currencyCode: 'USD' }, { price: 30, currencyCode: 'USD' }, 'en'),
    null,
  )
  assertEquals(
    buildAnnualPricing({ price: 5, currencyCode: 'USD' }, { price: 30, currencyCode: 'EUR' }, 'en'),
    null,
  )
})

Deno.test('buildAnnualPricing: geçersiz para kodu fırlatır (sessiz yutulmaz)', () => {
  let threw = false
  try {
    buildAnnualPricing({ price: 5, currencyCode: 'XX' }, { price: 30, currencyCode: 'XX' }, 'en')
  } catch (e) {
    threw = e instanceof RangeError
  }
  assertEquals(threw, true)
})
