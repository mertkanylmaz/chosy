/**
 * Unit tests — parse-mood iade politikası (MONEY-1C).
 * Run: cd supabase/functions && deno test _shared/refundPolicy.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { shouldRefundOnError } from './refundPolicy.ts'

class FakeApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

class APIConnectionTimeoutError extends Error {}
class APIConnectionError extends Error {}

Deno.test('PARSE_FAILED: JSON.parse SyntaxError → iade YOK', () => {
  let err: unknown
  try {
    JSON.parse('Sure! Here is plain text, not JSON')
  } catch (e) {
    err = e
  }
  assertEquals(shouldRefundOnError(err), false)
})

Deno.test('PARSE_FAILED: "Unexpected token" mesajlı Error → iade YOK', () => {
  assertEquals(shouldRefundOnError(new Error('Unexpected token S in JSON at position 0')), false)
})

Deno.test('sağlayıcı 500 / 502 / 503 / 529 → iade', () => {
  for (const s of [500, 502, 503, 529]) {
    assertEquals(shouldRefundOnError(new FakeApiError('upstream', s)), true)
  }
})

Deno.test('sağlayıcı 429 ve 408 → iade', () => {
  assertEquals(shouldRefundOnError(new FakeApiError('rate limited', 429)), true)
  assertEquals(shouldRefundOnError(new FakeApiError('request timeout', 408)), true)
})

Deno.test('sağlayıcı 400 / 401 / 404 (bizim istek/yapılandırma hatamız) → iade YOK', () => {
  for (const s of [400, 401, 403, 404]) {
    assertEquals(shouldRefundOnError(new FakeApiError('bad', s)), false)
  }
})

Deno.test('zaman aşımı ve bağlantı hatası (SDK sınıf adı) → iade', () => {
  assertEquals(shouldRefundOnError(new APIConnectionTimeoutError('Request timed out.')), true)
  assertEquals(shouldRefundOnError(new APIConnectionError('Connection error.')), true)
})

Deno.test('AbortError ve fetch failed → iade', () => {
  const abort = new Error('aborted')
  abort.name = 'AbortError'
  assertEquals(shouldRefundOnError(abort), true)
  assertEquals(shouldRefundOnError(new TypeError('fetch failed')), true)
})

Deno.test('kredi / billing mesajı (status yok) → iade', () => {
  assertEquals(shouldRefundOnError(new Error('Your credit balance is too low to access the API')), true)
  assertEquals(shouldRefundOnError(new Error('billing issue')), true)
})

Deno.test('sınıflandırılamayan hata → iade YOK (konservatif)', () => {
  assertEquals(shouldRefundOnError(new Error('something odd')), false)
  assertEquals(shouldRefundOnError(new TypeError("Cannot read properties of undefined (reading 'x')")), false)
})

Deno.test('Error olmayan değer → iade YOK', () => {
  assertEquals(shouldRefundOnError('boom'), false)
  assertEquals(shouldRefundOnError(null), false)
  assertEquals(shouldRefundOnError(undefined), false)
})
