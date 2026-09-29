/**
 * revenuecat-webhook — public.users yokken Sentry seviyesi.
 *
 * Koşum:  npm run test:rc-webhook
 *         (cd supabase/functions && deno test _shared/rcMissingUserSeverity.test.ts)
 */

import { assertEquals } from 'jsr:@std/assert@1'

import { missingUserSeverity } from './rcMissingUserSeverity.ts'

Deno.test('ilk satın alma niteliğindekiler error, etiket yok', () => {
  for (const type of ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']) {
    assertEquals(missingUserSeverity(type), { level: 'error', expectedDeletedUser: false }, type)
  }
})

// CHOSY-EDGE-FUNCTIONS-Y: 12 olayın hepsi RENEWAL (silinmiş sandbox hesapları).
Deno.test('abonelik yaşam döngüsü warning + expected_deleted_user', () => {
  for (const type of [
    'RENEWAL',
    'CANCELLATION',
    'EXPIRATION',
    'BILLING_ISSUE',
    'PRODUCT_CHANGE',
    'UNCANCELLATION',
  ]) {
    assertEquals(missingUserSeverity(type), { level: 'warning', expectedDeletedUser: true }, type)
  }
})

Deno.test('bilinmeyen tip güvenli yönde error', () => {
  assertEquals(missingUserSeverity('SOME_NEW_EVENT'), { level: 'error', expectedDeletedUser: false })
  assertEquals(missingUserSeverity(''), { level: 'error', expectedDeletedUser: false })
})
