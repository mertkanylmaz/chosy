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

// ─── Tasarruf rozeti eşiği (R-5 madde 10) ────────────────────────────────────

Deno.test('buildAnnualPricing: tasarruf < %10 → null (rozet gizli)', () => {
  // 1 - 108/120 = %10 → eşikte, rozet çıkar
  assertEquals(
    buildAnnualPricing({ price: 10, currencyCode: 'USD' }, { price: 108, currencyCode: 'USD' }, 'en')
      ?.savingsPercent,
    '10%',
  )
  // 1 - 110/120 = %8.3 → 8 → gizli
  assertEquals(
    buildAnnualPricing({ price: 10, currencyCode: 'USD' }, { price: 110, currencyCode: 'USD' }, 'en'),
    null,
  )
})

Deno.test('buildAnnualPricing: fiyat yok (0 / NaN) → null', () => {
  assertEquals(
    buildAnnualPricing({ price: 4.99, currencyCode: 'USD' }, { price: 0, currencyCode: 'USD' }, 'en'),
    null,
  )
  assertEquals(
    buildAnnualPricing({ price: NaN, currencyCode: 'USD' }, { price: 29.99, currencyCode: 'USD' }, 'en'),
    null,
  )
})

// ─── buildOffer: 6 durum + fiyat yok ─────────────────────────────────────────

import en from '../../locales/en.json' with { type: 'json' }
import tr from '../../locales/tr.json' with { type: 'json' }
import { buildOffer, type OfferCopy, type TrialEligibility } from '../../utils/paywallPricing.ts'

type Dict = Record<string, unknown>

/** i18n-js `%{x}` enterpolasyonunun test karşılığı. */
function render(dict: Dict, copy: OfferCopy): string {
  const [ns, key] = copy.key.split('.')
  const template = (dict[ns] as Dict)[key] as string
  return template.replace(/%\{(\w+)\}/g, (_m, name: string) => String(copy.params[name]))
}

const ANNUAL = { priceString: '$29.99', introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 7 } }
const ANNUAL_NO_INTRO = { priceString: '$29.99', introPrice: null }
// Kurucu ASC'den monthly intro'yu kaldırıyor; kaldırılmamış olsa bile vaat edilmez.
const MONTHLY = { priceString: '$4.99', introPrice: null }
const MONTHLY_WITH_INTRO = { priceString: '$4.99', introPrice: { price: 0, periodUnit: 'DAY', periodNumberOfUnits: 3 } }

Deno.test('buildOffer: annual + eligible → deneme (7 gün)', () => {
  const o = buildOffer('annual', ANNUAL, 'eligible')
  assertEquals(o.kind, 'trial')
  assertEquals(o.trialDays, 7)
  assertEquals(render(en, o.cta), 'Start 7-day free trial')
  assertEquals(
    render(en, o.description!),
    'Nothing due today. Then $29.99/year. Auto-renews unless canceled. Cancel anytime in your App Store account settings.',
  )
  assertEquals(o.priceLine, { price: '$29.99', unitKey: 'perYear' })
})

Deno.test('buildOffer: annual + ineligible → denemesiz, bugün ücret', () => {
  const o = buildOffer('annual', ANNUAL, 'ineligible')
  assertEquals(o.kind, 'paid')
  assertEquals(o.trialDays, 0)
  assertEquals(render(en, o.cta), 'Continue with Annual')
  assertEquals(
    render(en, o.description!),
    '$29.99 billed today. Auto-renews at $29.99/year. Cancel anytime in your App Store account settings.',
  )
})

Deno.test('buildOffer: annual + unknown → denemesiz (ASLA deneme vaadi yok)', () => {
  const o = buildOffer('annual', ANNUAL, 'unknown')
  assertEquals(o.kind, 'paid')
  assertEquals(o.trialDays, 0)
  assertEquals(render(en, o.cta), 'Continue with Annual')
  assertEquals(render(en, o.description!).includes('Nothing due today'), false)
})

Deno.test('buildOffer: annual + eligible ama intro offer tanımsız → denemesiz', () => {
  const o = buildOffer('annual', ANNUAL_NO_INTRO, 'eligible')
  assertEquals(o.kind, 'paid')
  assertEquals(o.trialDays, 0)
})

for (const elig of ['eligible', 'ineligible', 'unknown'] as TrialEligibility[]) {
  Deno.test(`buildOffer: monthly + ${elig} → denemesiz`, () => {
    for (const product of [MONTHLY, MONTHLY_WITH_INTRO]) {
      const o = buildOffer('monthly', product, elig)
      assertEquals(o.kind, 'paid')
      assertEquals(o.trialDays, 0)
      assertEquals(render(en, o.cta), 'Continue with Monthly')
      assertEquals(
        render(en, o.description!),
        '$4.99 billed today. Auto-renews at $4.99/month. Cancel anytime in your App Store account settings.',
      )
      assertEquals(o.priceLine, { price: '$4.99', unitKey: 'perMonth' })
    }
  })
}

Deno.test('buildOffer: fiyat yok → unavailable, satın alma kapalı, metin uydurulmaz', () => {
  for (const product of [null, undefined, { priceString: '', introPrice: null }]) {
    for (const plan of ['annual', 'monthly'] as const) {
      const o = buildOffer(plan, product, 'eligible')
      assertEquals(o.kind, 'unavailable')
      assertEquals(o.canPurchase, false)
      assertEquals(o.description, null)
      assertEquals(o.priceLine, null)
      assertEquals(o.trialDays, 0)
    }
  }
})

Deno.test('buildOffer: tr metinleri aynı parametrelerle render olur', () => {
  const o = buildOffer('annual', ANNUAL, 'eligible')
  assertEquals(render(tr, o.cta), '7 günlük ücretsiz denemeyi başlat')
  assertEquals(render(tr, o.description!).startsWith('Bugün ödeme yok. Sonra $29.99/yıl.'), true)
})
