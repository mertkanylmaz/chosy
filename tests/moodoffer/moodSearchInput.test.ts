/**
 * Mood girdi sınırı + hata mesajı eşlemesi (MONEY-1C).
 * Run: npm run test:mood-offer
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { isMoodInputSubmittable, minMoodChars, moodErrorMessageKey } from '../../utils/moodSearchInput.ts'

Deno.test('min girdi: bayrak açık 2, kapalı 1 (bugünkü kural)', () => {
  assertEquals(minMoodChars(true), 2)
  assertEquals(minMoodChars(false), 1)
  assertEquals(isMoodInputSubmittable('a', true), false)
  assertEquals(isMoodInputSubmittable(' a ', true), false)
  assertEquals(isMoodInputSubmittable('ab', true), true)
  assertEquals(isMoodInputSubmittable('😭', true), true)
  assertEquals(isMoodInputSubmittable('a', false), true)
  assertEquals(isMoodInputSubmittable('   ', false), false)
  assertEquals(isMoodInputSubmittable('', true), false)
})

Deno.test('hata mesajı: bayrak kapalıyken hiçbir kod eşlenmez', () => {
  for (const code of ['QUOTA_UNAVAILABLE', 'TIER_NOT_CONFIGURED', 'INVALID_INPUT', 'PARSE_FAILED']) {
    assertEquals(moodErrorMessageKey(code, false), null)
  }
})

Deno.test('hata mesajı: bayrak açıkken 503 ve 400 kodları', () => {
  assertEquals(moodErrorMessageKey('QUOTA_UNAVAILABLE', true), 'moodOffer.errorQuotaUnavailable')
  assertEquals(moodErrorMessageKey('TIER_NOT_CONFIGURED', true), 'moodOffer.errorQuotaUnavailable')
  assertEquals(moodErrorMessageKey('INVALID_INPUT', true), 'moodOffer.errorInvalidInput')
  assertEquals(moodErrorMessageKey('PARSE_FAILED', true), null)
  assertEquals(moodErrorMessageKey('QUOTA_EXCEEDED', true), null)
})
