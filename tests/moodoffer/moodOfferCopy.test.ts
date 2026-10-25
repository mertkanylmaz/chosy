/**
 * Teklif üst satırı kopya anahtarı (MONEY-1C F2-5).
 * Run: npm run test:mood-offer
 */
import { assert, assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { moodOfferKickerKey } from '../../utils/moodOfferCopy'

const entries = ['champion_card', 'spotlight_card', 'quota_exhausted', 'lock_card'] as const

Deno.test('her giriş noktası bir kopya anahtarına eşlenir; quota ayrı', () => {
  assertEquals(moodOfferKickerKey('quota_exhausted'), 'moodOffer.paywallKickerQuota')
  for (const e of entries.filter((x) => x !== 'quota_exhausted')) {
    assertEquals(moodOfferKickerKey(e), 'moodOffer.paywallKickerDeck')
  }
})

Deno.test('eşlenen anahtarlar en ve tr locale dosyalarında var', () => {
  for (const lang of ['en', 'tr']) {
    const loc = JSON.parse(Deno.readTextFileSync(new URL(`../../locales/${lang}.json`, import.meta.url)))
    for (const e of entries) {
      const key = moodOfferKickerKey(e).replace('moodOffer.', '')
      assert(typeof loc.moodOffer[key] === 'string' && loc.moodOffer[key].length > 0, `${lang}:${key}`)
    }
  }
})
