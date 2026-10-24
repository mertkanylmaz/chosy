/**
 * Birim testleri — `subscriptions.status` kararı (MONEY-1A). Saf mantık.
 * Run: cd supabase/functions && deno test _shared/rcSubscriptionStatus.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
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
