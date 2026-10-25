/**
 * Teklif üst satırı kopya anahtarı (MONEY-1C F2-5).
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { moodOfferTitleKey } from '../../utils/moodOfferCopy'

const entries = ['champion_card', 'spotlight_card', 'quota_exhausted', 'lock_card'] as const

Deno.test('her giriş noktası bir kopya anahtarına eşlenir; quota ayrı', () => {
  assertEquals(moodOfferTitleKey('quota_exhausted'), 'moodOffer.paywallTitleQuota')
  for (const e of entries.filter((x) => x !== 'quota_exhausted')) {
    assertEquals(moodOfferTitleKey(e), 'moodOffer.paywallTitleDeck')
  }
})

Deno.test('eşlenen anahtarlar en ve tr locale dosyalarında var', () => {
  for (const lang of ['en', 'tr']) {
    const loc = JSON.parse(Deno.readTextFileSync(new URL(`../../locales/${lang}.json`, import.meta.url)))
    for (const e of entries) {
      const key = moodOfferTitleKey(e).replace('moodOffer.', '')
      assert(typeof loc.moodOffer[key] === 'string' && loc.moodOffer[key].length > 0, `${lang}:${key}`)
    }
  }
})

Deno.test('teklif kopyasında sabit "8" ve "Unlimited" yok (en + tr); "nightly 4" notu var', () => {
  for (const lang of ['en', 'tr']) {
    const m = JSON.parse(Deno.readTextFileSync(new URL(`../../locales/${lang}.json`, import.meta.url))).moodOffer
    for (const k of ['paywallTitleDeck', 'paywallTitleQuota', 'paywallBenefit1', 'paywallBenefit2', 'paywallBenefit3']) {
      assert(!/8|unlimited|sınırsız/i.test(m[k]), `${lang}:${k}`)
    }
    assert(m.paywallNightly.includes('4'), `${lang}:paywallNightly`)
  }
})
