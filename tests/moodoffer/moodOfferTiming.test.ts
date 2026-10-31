/**
 * Teklif uygunluğu ve slot muafiyeti (MONEY-1C). Deste sonu/çıkış defteri kaldırıldı.
 * Run: npm run test:mood-offer
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { isFreeSearchDeckSlotExempt, isOfferEligible } from '../../utils/moodOfferTiming'

Deno.test('uygunluk: bayrak kapalı, onboarding, yükleniyor, yetkili → hiçbiri', () => {
  const base = { offerEnabled: true, isOnboarding: false, accessLoading: false, entitled: false }
  assertEquals(isOfferEligible(base), true)
  assertEquals(isOfferEligible({ ...base, offerEnabled: false }), false)
  assertEquals(isOfferEligible({ ...base, isOnboarding: true }), false)
  assertEquals(isOfferEligible({ ...base, accessLoading: true }), false)
  assertEquals(isOfferEligible({ ...base, entitled: true }), false) // premium / trial / legacy
})

Deno.test('slot muafiyeti (C8): yalnız bayrak açık ve onboarding dışı', () => {
  assertEquals(isFreeSearchDeckSlotExempt({ offerEnabled: true, isOnboarding: false }), true)
  assertEquals(isFreeSearchDeckSlotExempt({ offerEnabled: false, isOnboarding: false }), false)
  assertEquals(isFreeSearchDeckSlotExempt({ offerEnabled: true, isOnboarding: true }), false)
})
