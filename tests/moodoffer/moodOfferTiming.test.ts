/**
 * Teklif zamanlaması — search_id başına bir kez, hangisi önce gelirse (MONEY-1C F2-6).
 * Run: npm run test:mood-offer
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import {
  createOfferLedger,
  isFreeSearchDeckSlotExempt,
  isOfferEligible,
  offerKey,
} from '../../utils/moodOfferTiming'

Deno.test('deste bitimi önce gelirse deck_end; sonraki çıkış bastırılır', () => {
  const ledger = createOfferLedger()
  assertEquals(ledger.claim({ eligible: true, moment: 'deck_end', key: 's1' }), 'deck_end')
  assertEquals(ledger.claim({ eligible: true, moment: 'exit', key: 's1' }), null)
})

Deno.test('çıkış önce gelirse deck_exit; deste bitimi bastırılır', () => {
  const ledger = createOfferLedger()
  assertEquals(ledger.claim({ eligible: true, moment: 'exit', key: 's1' }), 'deck_exit')
  assertEquals(ledger.claim({ eligible: true, moment: 'deck_end', key: 's1' }), null)
})

Deno.test('search_id başına bir kez: yeni arama yeni teklif', () => {
  const ledger = createOfferLedger()
  assertEquals(ledger.claim({ eligible: true, moment: 'deck_end', key: 's1' }), 'deck_end')
  assertEquals(ledger.claim({ eligible: true, moment: 'deck_end', key: 's1' }), null)
  assertEquals(ledger.claim({ eligible: true, moment: 'exit', key: 's2' }), 'deck_exit')
})

Deno.test('uygun değilse defter YAZILMAZ (sonra uygun olursa gösterilebilir)', () => {
  const ledger = createOfferLedger()
  assertEquals(ledger.claim({ eligible: false, moment: 'deck_end', key: 's1' }), null)
  assertEquals(ledger.has('s1'), false)
  assertEquals(ledger.claim({ eligible: true, moment: 'exit', key: 's1' }), 'deck_exit')
})

Deno.test('search_id yoksa ekran örneğine özgü yedek anahtar', () => {
  assertEquals(offerKey('abc', 'x'), 'abc')
  assertEquals(offerKey(null, 'x'), 'deck-x')
})

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
