/**
 * revenuecat-webhook — public.users yokken karar kuralı.
 *
 * Koşum:  npm run test:rc-webhook
 */

import { assertEquals } from 'jsr:@std/assert@1'

import { authUserExists } from './rcAuthUser.ts'
import { decideMissingUser } from './rcMissingUserDecision.ts'

const UUID = '3f0c1c52-8a4e-4b7e-9d1a-2b6f5c7e8a90'

const exists = (v: boolean) => () => Promise.resolve(v)
const boom = () => Promise.reject(new Error('getUserById düştü — 503'))

Deno.test('(a) UUID olmayan id → 500, auth sorgusu yapılmaz', async () => {
  let called = false
  const d = await decideMissingUser('INITIAL_PURCHASE', '$RCAnonymousID:abc', () => {
    called = true
    return Promise.resolve(false)
  })
  assertEquals(called, false)
  assertEquals(d.kind, 'unresolvable_id')
  assertEquals(d.status, 500)
  assertEquals(d.retryable, true)
  assertEquals(d.errorCode, 'APP_USER_NOT_FOUND')
  assertEquals(d.level, 'error')
})

Deno.test('(b) auth.users yok + ilk satın alma → 200, error, refund_review', async () => {
  for (const type of ['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE']) {
    const d = await decideMissingUser(type, UUID, exists(false))
    assertEquals(d.kind, 'deleted_account', type)
    assertEquals(d.status, 200, type)
    assertEquals(d.level, 'error', type)
    assertEquals(d.refundReview, true, type)
    assertEquals(d.expectedDeletedUser, false, type)
    assertEquals(d.retryable, false, type)
  }
})

Deno.test('(b) auth.users yok + yaşam döngüsü → 200, warning, expected_deleted_user', async () => {
  for (const type of ['RENEWAL', 'CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE', 'PRODUCT_CHANGE', 'UNCANCELLATION']) {
    const d = await decideMissingUser(type, UUID, exists(false))
    assertEquals(d.kind, 'deleted_account', type)
    assertEquals(d.status, 200, type)
    assertEquals(d.level, 'warning', type)
    assertEquals(d.expectedDeletedUser, true, type)
    assertEquals(d.refundReview, false, type)
  }
})

Deno.test('(b) bilinmeyen tip + auth yok → 200, error, refund_review yok', async () => {
  const d = await decideMissingUser('SOME_NEW_EVENT', UUID, exists(false))
  assertEquals(d.status, 200)
  assertEquals(d.level, 'error')
  assertEquals(d.refundReview, false)
})

Deno.test('(c) auth.users var → 500 giriş yarışı, seviye severity ile aynı', async () => {
  const first = await decideMissingUser('INITIAL_PURCHASE', UUID, exists(true))
  assertEquals(first.kind, 'login_race')
  assertEquals(first.status, 500)
  assertEquals(first.retryable, true)
  assertEquals(first.level, 'error')
  const renewal = await decideMissingUser('RENEWAL', UUID, exists(true))
  assertEquals(renewal.status, 500)
  assertEquals(renewal.level, 'warning')
  assertEquals(renewal.expectedDeletedUser, true)
})

Deno.test('(d) varlık sorgusu düştü → 500 + error, "yok" sayılmaz', async () => {
  const d = await decideMissingUser('RENEWAL', UUID, boom)
  assertEquals(d.kind, 'lookup_failed')
  assertEquals(d.status, 500)
  assertEquals(d.errorCode, 'AUTH_USER_LOOKUP_FAILED')
  assertEquals(d.retryable, true)
  assertEquals(d.level, 'error')
})

// ─── authUserExists yardımcısı ───────────────────────────────────────────────

const clientWith = (result: {
  data: { user: unknown } | null
  error: { status?: number; code?: string; message: string } | null
}) => ({ auth: { admin: { getUserById: () => Promise.resolve(result) } } })

Deno.test('authUserExists: bulundu → true', async () => {
  assertEquals(await authUserExists(clientWith({ data: { user: { id: UUID } }, error: null }), UUID), true)
})

Deno.test('authUserExists: 404 ve user_not_found → false', async () => {
  assertEquals(await authUserExists(clientWith({ data: null, error: { status: 404, message: 'x' } }), UUID), false)
  assertEquals(
    await authUserExists(clientWith({ data: null, error: { code: 'user_not_found', message: 'x' } }), UUID),
    false,
  )
})

Deno.test('authUserExists: diğer hata fırlatır', async () => {
  let threw = false
  try {
    await authUserExists(clientWith({ data: null, error: { status: 500, message: 'down' } }), UUID)
  } catch {
    threw = true
  }
  assertEquals(threw, true)
})
