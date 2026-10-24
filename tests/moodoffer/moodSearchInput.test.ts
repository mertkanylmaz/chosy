/**
 * Mood girdi sınırı + hata mesajı eşlemesi (MONEY-1C).
 * Run: npm run test:mood-offer
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { isMoodInputSubmittable, MOOD_MIN_CHARS, moodErrorMessageKey } from '../../utils/moodSearchInput.ts'

Deno.test('min girdi: bayraktan bağımsız 2 karakter (sunucu 1 karakteri 400 yapar)', () => {
  assertEquals(MOOD_MIN_CHARS, 2)
  assertEquals(isMoodInputSubmittable('a'), false)
  assertEquals(isMoodInputSubmittable(' a '), false)
  assertEquals(isMoodInputSubmittable('ab'), true)
  assertEquals(isMoodInputSubmittable('😭'), true)
  assertEquals(isMoodInputSubmittable('   '), false)
  assertEquals(isMoodInputSubmittable(''), false)
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
