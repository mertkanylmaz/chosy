/**
 * Unit tests — günlük limit (MONEY-1C).
 * Run: cd supabase/functions && deno test --allow-env _shared/dailyLimit.test.ts
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  checkDailyLimit,
  DailyLimitError,
  RERANK_DAILY_FREE,
  RERANK_DAILY_PREMIUM,
  rerankDailyLimit,
  rerankDailyLimitResponse,
  utcDayStart,
} from './dailyLimit.ts'
import { RateLimitUnavailableError } from './rateLimit.ts'

const NOW = new Date('2026-10-24T21:30:00Z')

Deno.test('limitler: free 15, premium 60', () => {
  assertEquals(RERANK_DAILY_FREE, 15)
  assertEquals(RERANK_DAILY_PREMIUM, 60)
})

Deno.test('tier → limit: free, null, boş, bilinmeyen satır → free', () => {
  assertEquals(rerankDailyLimit('free', false), 15)
  assertEquals(rerankDailyLimit(null, null), 15)
  assertEquals(rerankDailyLimit(undefined, undefined), 15)
  assertEquals(rerankDailyLimit('', false), 15)
})

Deno.test('tier → limit: ücretli tierlar ve weekly_legacy → premium', () => {
  for (const t of ['annual', 'monthly', 'lifetime', 'weekly_legacy']) {
    assertEquals(rerankDailyLimit(t, false), 60)
  }
})

Deno.test('legacy_mood_access free tier\'da bile premium sınırı', () => {
  assertEquals(rerankDailyLimit('free', true), 60)
})

Deno.test('utcDayStart: UTC gün başı', () => {
  assertEquals(utcDayStart(NOW), '2026-10-24T00:00:00.000Z')
  assertEquals(utcDayStart(new Date('2026-10-24T23:59:59.999Z')), '2026-10-24T00:00:00.000Z')
  assertEquals(utcDayStart(new Date('2026-10-25T00:00:00.000Z')), '2026-10-25T00:00:00.000Z')
})

Deno.test('sayaç limitin altında / tam limitte → geçer', async () => {
  await checkDailyLimit('u1', 'rerank-films-daily', 15, { now: NOW, increment: () => Promise.resolve(1) })
  await checkDailyLimit('u1', 'rerank-films-daily', 15, { now: NOW, increment: () => Promise.resolve(15) })
})

Deno.test('sayaç limiti aşınca DailyLimitError (limit + resets_at)', async () => {
  const err = await assertRejects(
    () => checkDailyLimit('u1', 'rerank-films-daily', 15, { now: NOW, increment: () => Promise.resolve(16) }),
    DailyLimitError,
  )
  assertEquals(err.limit, 15)
  assertEquals(err.resetsAt, '2026-10-25T00:00:00.000Z')
})

Deno.test('increment doğru pencereyle çağrılır (UTC gün başı)', async () => {
  let seen: [string, string, string] | null = null
  await checkDailyLimit('u1', 'rerank-films-daily', 15, {
    now: NOW,
    increment: (u, f, w) => {
      seen = [u, f, w]
      return Promise.resolve(1)
    },
  })
  assertEquals(seen, ['u1', 'rerank-films-daily', '2026-10-24T00:00:00.000Z'])
})

Deno.test('FAIL-CLOSED: increment hata fırlatırsa RateLimitUnavailableError', async () => {
  await assertRejects(
    () => checkDailyLimit('u1', 'rerank-films-daily', 15, { now: NOW, increment: () => Promise.reject(new Error('db down')) }),
    RateLimitUnavailableError,
  )
})

Deno.test('FAIL-CLOSED: RPC beklenmeyen dönüş (null / string) → RateLimitUnavailableError', async () => {
  for (const bad of [null, undefined, '3', { count: 3 }]) {
    await assertRejects(
      () => checkDailyLimit('u1', 'rerank-films-daily', 15, { now: NOW, increment: () => Promise.resolve(bad) }),
      RateLimitUnavailableError,
    )
  }
})

Deno.test('FAIL-CLOSED: boş userId → RateLimitUnavailableError', async () => {
  await assertRejects(
    () => checkDailyLimit('', 'rerank-films-daily', 15, { now: NOW, increment: () => Promise.resolve(1) }),
    RateLimitUnavailableError,
  )
})

Deno.test("'-daily' ile bitmeyen ad reddedilir (cleanup 1 saatte silerdi)", async () => {
  await assertRejects(
    () => checkDailyLimit('u1', 'rerank-films', 15, { now: NOW, increment: () => Promise.resolve(1) }),
    Error,
    "'-daily'",
  )
})

Deno.test('429 yanıtı: RERANK_DAILY_LIMIT + limit + resets_at + Retry-After', async () => {
  const res = await rerankDailyLimitResponse(new DailyLimitError(15, '2099-01-01T00:00:00.000Z'), 'u1', { 'X-Test': '1' })
  assertEquals(res.status, 429)
  assertEquals(res.headers.get('X-Test'), '1')
  assertEquals(Number(res.headers.get('Retry-After')) > 0, true)
  assertEquals(await res.json(), {
    error: 'Daily rerank limit reached.',
    code: 'RERANK_DAILY_LIMIT',
    limit: 15,
    resets_at: '2099-01-01T00:00:00.000Z',
  })
})
