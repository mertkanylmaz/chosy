/**
 * Unit tests — parse-mood kalan-hak alanları (MONEY-1C).
 * Run: cd supabase/functions && deno test _shared/quotaFields.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { quotaFields } from './quotaFields.ts'

Deno.test('ücretsiz 1/gün, ilk tüketim → remaining 0, limit 1', () => {
  assertEquals(quotaFields({ allowed: true, used: 1, limit: 1, tier: 'free' }), { remaining: 0, limit: 1 })
})

Deno.test('3 haklı tier, 1 kullanıldı → remaining 2', () => {
  assertEquals(quotaFields({ used: 1, limit: 3 }), { remaining: 2, limit: 3 })
})

Deno.test('sınırsız (999999) → remaining ve limit null', () => {
  assertEquals(quotaFields({ used: 57, limit: 999999 }), { remaining: null, limit: null })
})

Deno.test('QUOTA_EXCEEDED sonucu (used == limit) → remaining 0', () => {
  assertEquals(quotaFields({ allowed: false, error: 'QUOTA_EXCEEDED', used: 1, limit: 1 }), { remaining: 0, limit: 1 })
})

Deno.test('iade sonrası: used bir azalır → remaining 1', () => {
  assertEquals(quotaFields({ used: 1, limit: 1 }, true), { remaining: 1, limit: 1 })
})

Deno.test('iade, used 0 iken eksiye inmez', () => {
  assertEquals(quotaFields({ used: 0, limit: 3 }, true), { remaining: 3, limit: 3 })
})

Deno.test('sınırsızda iade → yine null', () => {
  assertEquals(quotaFields({ used: 5, limit: 999999 }, true), { remaining: null, limit: null })
})

Deno.test('used aşan değer (limit < used) → remaining 0, negatif değil', () => {
  assertEquals(quotaFields({ used: 4, limit: 3 }), { remaining: 0, limit: 3 })
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
