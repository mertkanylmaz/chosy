/**
 * Birim testleri — `subscriptions.status` kararı (MONEY-1A). Saf mantık.
 * Run: cd supabase/functions && deno test _shared/rcSubscriptionStatus.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  buildSubscriptionUpsertRow,
  decidePurchaseStatus,
  decideTerminalWrite,
  OPEN_SUBSCRIPTION_STATUSES,
  parseRcPeriodType,
} from './rcSubscriptionStatus.ts'

Deno.test('parseRcPeriodType: bilinen değerler, yok/tanınmayan → null', () => {
  assertEquals(parseRcPeriodType('TRIAL'), 'TRIAL')
  assertEquals(parseRcPeriodType('NORMAL'), 'NORMAL')
  assertEquals(parseRcPeriodType('INTRO'), 'INTRO')
  assertEquals(parseRcPeriodType('trial'), null)
  assertEquals(parseRcPeriodType(undefined), null)
  assertEquals(parseRcPeriodType(null), null)
  assertEquals(parseRcPeriodType(7), null)
})

Deno.test('INITIAL_PURCHASE + TRIAL → trial', () => {
  assertEquals(decidePurchaseStatus('INITIAL_PURCHASE', 'TRIAL'), {
    status: 'trial', label: 'trial_started', warn: false,
  })
})

Deno.test('INITIAL_PURCHASE + NORMAL → active (denemesiz ilk alım)', () => {
  assertEquals(decidePurchaseStatus('INITIAL_PURCHASE', 'NORMAL'), {
    status: 'active', label: 'paid_started', warn: false,
  })
})

Deno.test('INITIAL_PURCHASE + INTRO → active (ücretli intro, trial değil)', () => {
  assertEquals(decidePurchaseStatus('INITIAL_PURCHASE', 'INTRO').status, 'active')
})

Deno.test('RENEWAL → active (trial sonrası ilk RENEWAL dahil)', () => {
  assertEquals(decidePurchaseStatus('RENEWAL', 'NORMAL'), {
    status: 'active', label: 'trial_converted_or_renewed', warn: false,
  })
  // period_type eksik gelse bile RENEWAL ücretli dönemdir, uyarı da gerekmez.
  assertEquals(decidePurchaseStatus('RENEWAL', undefined).status, 'active')
  assertEquals(decidePurchaseStatus('RENEWAL', undefined).warn, false)
})

Deno.test('PRODUCT_CHANGE: trial içindeyse trial kalır, değilse active', () => {
  assertEquals(decidePurchaseStatus('PRODUCT_CHANGE', 'TRIAL'), {
    status: 'trial', label: 'trial_continued', warn: false,
  })
  assertEquals(decidePurchaseStatus('PRODUCT_CHANGE', 'NORMAL').status, 'active')
})

Deno.test('UNCANCELLATION: trial içindeyse trial kalır, değilse active', () => {
  assertEquals(decidePurchaseStatus('UNCANCELLATION', 'TRIAL').status, 'trial')
  assertEquals(decidePurchaseStatus('UNCANCELLATION', 'NORMAL').status, 'active')
})

Deno.test('period_type yok/tanınmayan (INITIAL_PURCHASE) → active + warn (sessiz değil)', () => {
  for (const v of [undefined, null, 'WHATEVER', '']) {
    assertEquals(decidePurchaseStatus('INITIAL_PURCHASE', v), {
      status: 'active', label: 'period_type_missing', warn: true,
    })
  }
})

Deno.test('CANCELLATION gönüllü → subscriptions yazımı yok: trial ve expires_at korunur', () => {
  assertEquals(decideTerminalWrite('CANCELLATION', false), null)
})

Deno.test('CANCELLATION refund → cancelled, active VE trial satırından', () => {
  const w = decideTerminalWrite('CANCELLATION', true)
  assertEquals(w?.status, 'cancelled')
  assertEquals(w?.label, 'refund_cancelled')
  assertEquals([...(w?.fromStatuses ?? [])], ['active', 'trial'])
})

Deno.test('EXPIRATION → expired, active VE trial satırından (trial ödemeye dönmediyse)', () => {
  const w = decideTerminalWrite('EXPIRATION', false)
  assertEquals(w?.status, 'expired')
  assertEquals(w?.label, 'expired')
  assertEquals([...(w?.fromStatuses ?? [])], ['active', 'trial'])
})

Deno.test('EXPIRATION: revokeNow bayrağından bağımsız', () => {
  assertEquals(decideTerminalWrite('EXPIRATION', true)?.status, 'expired')
})

Deno.test('OPEN_SUBSCRIPTION_STATUSES erişim veren iki durum', () => {
  assertEquals([...OPEN_SUBSCRIPTION_STATUSES], ['active', 'trial'])
})

Deno.test('buildSubscriptionUpsertRow: INITIAL_PURCHASE trial → yalnız sözleşme kolonları (started_at/trial_used yok)', () => {
  const d = decidePurchaseStatus('INITIAL_PURCHASE', 'TRIAL')
  const row = buildSubscriptionUpsertRow({
    userId: 'u1', plan: 'annual', status: d.status, expiresAt: '2026-11-01T00:00:00.000Z',
    entitlementId: 'chosy_plus', environment: 'PRODUCTION',
  })
  assertEquals(row, {
    user_id: 'u1', plan: 'annual', status: 'trial', expires_at: '2026-11-01T00:00:00.000Z',
    entitlement_id: 'chosy_plus', environment: 'PRODUCTION',
  })
  assertEquals(Object.keys(row).sort(), ['entitlement_id', 'environment', 'expires_at', 'plan', 'status', 'user_id'])
})

Deno.test('buildSubscriptionUpsertRow: RENEWAL (trial sonrası ilk) → active, expires_at güncellenir', () => {
  const d = decidePurchaseStatus('RENEWAL', 'NORMAL')
  const row = buildSubscriptionUpsertRow({
    userId: 'u1', plan: 'annual', status: d.status, expiresAt: '2027-11-01T00:00:00.000Z',
    entitlementId: 'chosy_plus', environment: 'SANDBOX',
  })
  assertEquals(row.status, 'active')
  assertEquals(row.expires_at, '2027-11-01T00:00:00.000Z')
})

Deno.test('buildSubscriptionUpsertRow: lifetime → expires_at null, active', () => {
  const row = buildSubscriptionUpsertRow({
    userId: 'u1', plan: 'lifetime', status: 'active', expiresAt: null,
    entitlementId: 'chosy_plus', environment: 'PRODUCTION',
  })
  assertEquals(row.expires_at, null)
  assertEquals(row.plan, 'lifetime')
})

Deno.test('buildSubscriptionUpsertRow: onConflict anahtarı user_id satırda mevcut ve dolu', () => {
  const row = buildSubscriptionUpsertRow({
    userId: 'u1', plan: 'monthly', status: 'active', expiresAt: null,
    entitlementId: 'chosy_plus', environment: 'SANDBOX',
  })
  assertEquals(typeof row.user_id, 'string')
  assertEquals(row.user_id.length > 0, true)
})
