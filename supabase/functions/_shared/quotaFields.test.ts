/**
 * Unit tests — parse-mood kalan-hak alanları (MONEY-1C).
 * Run: cd supabase/functions && deno test _shared/quotaFields.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { classifyQuotaResult, nextUtcMidnight, quotaFields } from './quotaFields.ts'

const NOW = new Date('2026-10-24T21:30:00Z')
const NEXT = '2026-10-25T00:00:00.000Z'

Deno.test('ücretsiz 1/gün, ilk tüketim → remaining 0, limit 1', () => {
  assertEquals(quotaFields({ allowed: true, used: 1, limit: 1, tier: 'free' }, false, NOW), { remaining: 0, limit: 1, resets_at: NEXT })
})

Deno.test('3 haklı tier, 1 kullanıldı → remaining 2', () => {
  assertEquals(quotaFields({ used: 1, limit: 3 }, false, NOW), { remaining: 2, limit: 3, resets_at: NEXT })
})

Deno.test('sınırsız (999999) → remaining ve limit null', () => {
  assertEquals(quotaFields({ used: 57, limit: 999999 }, false, NOW), { remaining: null, limit: null, resets_at: null })
})

Deno.test('QUOTA_EXCEEDED sonucu (used == limit) → remaining 0', () => {
  assertEquals(quotaFields({ allowed: false, error: 'QUOTA_EXCEEDED', used: 1, limit: 1 }, false, NOW), { remaining: 0, limit: 1, resets_at: NEXT })
})

Deno.test('iade sonrası: used bir azalır → remaining 1', () => {
  assertEquals(quotaFields({ used: 1, limit: 1 }, true, NOW), { remaining: 1, limit: 1, resets_at: NEXT })
})

Deno.test('iade, used 0 iken eksiye inmez', () => {
  assertEquals(quotaFields({ used: 0, limit: 3 }, true, NOW), { remaining: 3, limit: 3, resets_at: NEXT })
})

Deno.test('sınırsızda iade → yine null', () => {
  assertEquals(quotaFields({ used: 5, limit: 999999 }, true, NOW), { remaining: null, limit: null, resets_at: null })
})

Deno.test('used aşan değer (limit < used) → remaining 0, negatif değil', () => {
  assertEquals(quotaFields({ used: 4, limit: 3 }, false, NOW), { remaining: 0, limit: 3, resets_at: NEXT })
})

Deno.test('kota sonucu yok (fail-open) → alan yok', () => {
  assertEquals(quotaFields(undefined), {})
})

Deno.test('hatalı sonuç (USER_NOT_FOUND, used/limit yok) → alan yok', () => {
  assertEquals(quotaFields({ allowed: false, error: 'USER_NOT_FOUND' }), {})
})

Deno.test('string sayılar sayı sayılmaz → alan yok', () => {
  assertEquals(quotaFields({ used: '1', limit: '3' }), {})
})

Deno.test('classify: allowed:true → allowed', () => {
  assertEquals(classifyQuotaResult({ allowed: true, used: 1, limit: 3 }), 'allowed')
})

Deno.test('classify: QUOTA_EXCEEDED → exceeded', () => {
  assertEquals(classifyQuotaResult({ allowed: false, error: 'QUOTA_EXCEEDED', used: 3, limit: 3 }), 'exceeded')
})

Deno.test('classify: TIER_NOT_CONFIGURED → tier_not_configured (429 değil)', () => {
  assertEquals(classifyQuotaResult({ allowed: false, error: 'TIER_NOT_CONFIGURED', tier: 'trial' }), 'tier_not_configured')
})

Deno.test('classify: USER_NOT_FOUND / INVALID_QUOTA_TYPE → unavailable', () => {
  assertEquals(classifyQuotaResult({ allowed: false, error: 'USER_NOT_FOUND' }), 'unavailable')
  assertEquals(classifyQuotaResult({ allowed: false, error: 'INVALID_QUOTA_TYPE' }), 'unavailable')
})

Deno.test('classify: allowed alanı yok / null / string allowed → unavailable (izin verilmez)', () => {
  assertEquals(classifyQuotaResult({}), 'unavailable')
  assertEquals(classifyQuotaResult(null), 'unavailable')
  assertEquals(classifyQuotaResult(undefined), 'unavailable')
  assertEquals(classifyQuotaResult({ allowed: 'true' }), 'unavailable')
})

Deno.test('classify: allowed:false ama hata kodu yok → unavailable', () => {
  assertEquals(classifyQuotaResult({ allowed: false }), 'unavailable')
})

Deno.test('resets_at: gün ortası → ertesi gün 00:00 UTC', () => {
  assertEquals(nextUtcMidnight(new Date('2026-10-24T12:00:00Z')), '2026-10-25T00:00:00.000Z')
})

Deno.test('resets_at: 23:59:59.999 UTC → hâlâ ertesi gün', () => {
  assertEquals(nextUtcMidnight(new Date('2026-10-24T23:59:59.999Z')), '2026-10-25T00:00:00.000Z')
})

Deno.test('resets_at: tam 00:00:00 UTC → +24 sa (yeni gün başladı)', () => {
  assertEquals(nextUtcMidnight(new Date('2026-10-25T00:00:00.000Z')), '2026-10-26T00:00:00.000Z')
})

Deno.test('resets_at: ay ve yıl sınırı', () => {
  assertEquals(nextUtcMidnight(new Date('2026-10-31T10:00:00Z')), '2026-11-01T00:00:00.000Z')
  assertEquals(nextUtcMidnight(new Date('2026-12-31T10:00:00Z')), '2027-01-01T00:00:00.000Z')
})

Deno.test('resets_at: Türkiye 02:59 (23:59 UTC) → 1 dk sonra yenilenir', () => {
  // UTC+3 kullanıcısı için gün sınırı 03:00 yerel; hak 00:00 UTC'de yenilenir
  assertEquals(nextUtcMidnight(new Date('2026-10-24T23:59:00Z')), '2026-10-25T00:00:00.000Z')
})

Deno.test('resets_at: kota sonucu yoksa alan da yok', () => {
  assertEquals('resets_at' in quotaFields(undefined, false, NOW), false)
})
