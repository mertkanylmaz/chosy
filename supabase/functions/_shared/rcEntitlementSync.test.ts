/**
 * Birim testleri — sync-entitlement çekirdeği (MONEY-SEC-1). Saf mantık, sahte yazıcı.
 * Run: cd supabase/functions && deno test _shared/rcEntitlementSync.test.ts
 */
import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { syncEntitlementFromRc } from './rcEntitlementSync.ts'
import type {
  EntitlementWriter,
  RcSubscriberInfo,
  SubscriptionUpsertRow,
  UserTierFields,
} from './rcTransfer.ts'

const NOW = Date.parse('2026-10-24T12:00:00Z')
const FUTURE = '2026-11-24T12:00:00Z'

function fakeWriter(over: Partial<EntitlementWriter> = {}) {
  const calls = { users: [] as UserTierFields[], subs: [] as SubscriptionUpsertRow[] }
  const writer: EntitlementWriter = {
    updateUserTier: (_id, fields) => {
      calls.users.push(fields)
      return Promise.resolve({ error: null, count: 1 })
    },
    upsertSubscription: (row) => {
      calls.subs.push(row)
      return Promise.resolve({ error: null })
    },
    ...over,
  }
  return { writer, calls }
}

function subInfo(periodType: string | undefined, sandbox: boolean | undefined = false): RcSubscriberInfo {
  return {
    entitlements: { chosy_plus: { product_identifier: 'com.chosy.annual', expires_date: FUTURE } },
    subscriptions: {
      'com.chosy.annual': { period_type: periodType, is_sandbox: sandbox, unsubscribe_detected_at: null },
    },
  }
}

Deno.test('trial (period_type trial, küçük harf) → subscriptions.status trial, tier yazılır', async () => {
  const { writer, calls } = fakeWriter()
  const r = await syncEntitlementFromRc(subInfo('trial'), writer, 'app-1', NOW)
  assertEquals(r.kind, 'synced')
  assertEquals(calls.subs[0].status, 'trial')
  assertEquals(calls.subs[0].plan, 'annual')
  assertEquals(calls.subs[0].environment, 'PRODUCTION')
  assertEquals(calls.users[0].subscription_tier, 'annual')
  assertEquals(calls.users[0].subscription_will_renew, true)
})

Deno.test('normal ücretli dönem → active', async () => {
  const { writer, calls } = fakeWriter()
  await syncEntitlementFromRc(subInfo('normal'), writer, 'app-1', NOW)
  assertEquals(calls.subs[0].status, 'active')
})

Deno.test('sandbox aboneliği SANDBOX yazılır (varsayılana düşmez)', async () => {
  const { writer, calls } = fakeWriter()
  await syncEntitlementFromRc(subInfo('normal', true), writer, 'app-1', NOW)
  assertEquals(calls.subs[0].environment, 'SANDBOX')
})

Deno.test('period_type yok → active + warnPeriodType (sessiz değil)', async () => {
  const { writer } = fakeWriter()
  const r = await syncEntitlementFromRc(subInfo(undefined), writer, 'app-1', NOW)
  assertEquals(r.kind === 'synced' && r.warnPeriodType, true)
  assertEquals(r.kind === 'synced' && r.status, 'active')
})

Deno.test('lifetime (non_subscriptions) → tier lifetime, plan lifetime, expires_at null, environment non_subscriptions\'tan', async () => {
  const info: RcSubscriberInfo = {
    entitlements: { chosy_plus: { product_identifier: 'com.chosy.lifetime', expires_date: null } },
    subscriptions: {},
    non_subscriptions: { 'com.chosy.lifetime': [{ is_sandbox: true }] },
  }
  const { writer, calls } = fakeWriter()
  const r = await syncEntitlementFromRc(info, writer, 'app-1', NOW)
  assertEquals(r.kind, 'synced')
  assertEquals(calls.users[0].subscription_tier, 'lifetime')
  assertEquals(calls.users[0].subscription_active_until, null)
  assertEquals(calls.subs[0].plan, 'lifetime')
  assertEquals(calls.subs[0].status, 'active')
  assertEquals(calls.subs[0].expires_at, null)
  assertEquals(calls.subs[0].environment, 'SANDBOX')
})

Deno.test('lifetime: environment hiçbir yerden okunamazsa YAZILMAZ', async () => {
  const info: RcSubscriberInfo = {
    entitlements: { chosy_plus: { product_identifier: 'com.chosy.lifetime', expires_date: null } },
    subscriptions: {},
  }
  const { writer, calls } = fakeWriter()
  const r = await syncEntitlementFromRc(info, writer, 'app-1', NOW)
  assertEquals(r, { kind: 'environment_missing', productId: 'com.chosy.lifetime' })
  assertEquals(calls.users.length + calls.subs.length, 0)
})

Deno.test('aktif entitlement yok → hiçbir şey yazılmaz (downgrade yapılmaz)', async () => {
  const { writer, calls } = fakeWriter()
  const empty: RcSubscriberInfo = { entitlements: {}, subscriptions: {} }
  assertEquals((await syncEntitlementFromRc(empty, writer, 'app-1', NOW)).kind, 'no_active_entitlement')
  // süresi dolmuş entitlement de aktif sayılmaz
  const expired = subInfo('normal')
  expired.entitlements.chosy_plus.expires_date = '2026-10-01T00:00:00Z'
  assertEquals((await syncEntitlementFromRc(expired, writer, 'app-1', NOW)).kind, 'no_active_entitlement')
  assertEquals(calls.users.length + calls.subs.length, 0)
})

Deno.test('tanınmayan ürün → unmapped_product, yazım yok', async () => {
  const info = subInfo('normal')
  info.entitlements.chosy_plus.product_identifier = 'com.chosy.mystery'
  info.subscriptions['com.chosy.mystery'] = { period_type: 'normal', is_sandbox: false }
  const { writer, calls } = fakeWriter()
  const r = await syncEntitlementFromRc(info, writer, 'app-1', NOW)
  assertEquals(r, { kind: 'unmapped_product', productId: 'com.chosy.mystery' })
  assertEquals(calls.users.length + calls.subs.length, 0)
})

Deno.test('users UPDATE hatası → db_error(users), subscriptions yazılmaz', async () => {
  const { writer, calls } = fakeWriter({
    updateUserTier: () => Promise.resolve({ error: { message: 'boom', code: 'XX000' }, count: null }),
  })
  const r = await syncEntitlementFromRc(subInfo('normal'), writer, 'app-1', NOW)
  assertEquals(r.kind, 'db_error')
  assertEquals(r.kind === 'db_error' && r.step, 'users')
  assertEquals(calls.subs.length, 0)
})

Deno.test('users satırı 0 → users_row_vanished', async () => {
  const { writer } = fakeWriter({
    updateUserTier: () => Promise.resolve({ error: null, count: 0 }),
  })
  assertEquals((await syncEntitlementFromRc(subInfo('normal'), writer, 'app-1', NOW)).kind, 'users_row_vanished')
})

Deno.test('subscriptions upsert hatası → db_error(subscriptions)', async () => {
  const { writer } = fakeWriter({
    upsertSubscription: () => Promise.resolve({ error: { message: 'nope', code: '42501' } }),
  })
  const r = await syncEntitlementFromRc(subInfo('normal'), writer, 'app-1', NOW)
  assertEquals(r.kind === 'db_error' && r.step, 'subscriptions')
})
