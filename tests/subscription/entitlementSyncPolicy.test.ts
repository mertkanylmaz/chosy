/**
 * Unit tests — sync-entitlement istemci politikası (MONEY-SEC-1). Saf fonksiyon.
 * Run: deno test tests/subscription/entitlementSyncPolicy.test.ts
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { LISTENER_SYNC_COOLDOWN_MS, shouldSyncFromListener } from '../../utils/entitlementSyncPolicy.ts'

const none = { lastSyncedKey: null, lastAttemptAtMs: null }

Deno.test('hiç deneme yok → sync', () => {
  assertEquals(shouldSyncFromListener('u1:com.chosy.annual', none, 1_000), true)
})

Deno.test('aynı anahtar daha önce başarılı → sync yok', () => {
  assertEquals(
    shouldSyncFromListener('u1:com.chosy.annual', { lastSyncedKey: 'u1:com.chosy.annual', lastAttemptAtMs: 0 }, 10_000_000),
    false,
  )
})

Deno.test('plan değişti (annual → lifetime) → cooldown dışında sync', () => {
  const st = { lastSyncedKey: 'u1:com.chosy.annual', lastAttemptAtMs: 0 }
  assertEquals(shouldSyncFromListener('u1:com.chosy.lifetime', st, LISTENER_SYNC_COOLDOWN_MS + 1), true)
})

Deno.test('başarısız denemeden sonra cooldown içinde → sync yok, dışında → var', () => {
  const st = { lastSyncedKey: null, lastAttemptAtMs: 100_000 }
  assertEquals(shouldSyncFromListener('u1:p', st, 100_000 + LISTENER_SYNC_COOLDOWN_MS - 1), false)
  assertEquals(shouldSyncFromListener('u1:p', st, 100_000 + LISTENER_SYNC_COOLDOWN_MS), true)
})

Deno.test('farklı kullanıcı aynı planla → ayrı anahtar, sync var', () => {
  const st = { lastSyncedKey: 'u1:com.chosy.annual', lastAttemptAtMs: 0 }
  assertEquals(shouldSyncFromListener('u2:com.chosy.annual', st, LISTENER_SYNC_COOLDOWN_MS + 1), true)
})
