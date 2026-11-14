/**
 * Unit tests — explain-match kullanım sınırları (145, güvenlik P0).
 * Run: cd supabase/functions && deno test --allow-env _shared/explainLimit.test.ts
 */

import { assertEquals, assertRejects } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { checkDailyLimit, DailyLimitError } from './dailyLimit.ts'
import {
  clientIp,
  enforceExplainLimits,
  EXPLAIN_DAILY_IP,
  EXPLAIN_DAILY_USER,
  ExplainDailyLimitError,
  explainDailyLimitResponse,
  explainLimitLog,
  ipBucket,
} from './explainLimit.ts'
import { RateLimitError, RateLimitUnavailableError } from './rateLimit.ts'

const NOW = new Date('2026-11-14T21:30:00Z')
const USER = '11111111-1111-1111-1111-111111111111'

/** Bellek içi sayaç — `increment_rate_limit` RPC'sinin yerine. */
function memoryCounters() {
  const counts = new Map<string, number>()
  const calls: string[] = []
  const bump = (bucket: string, fnName: string) => {
    const key = `${bucket}|${fnName}`
    const next = (counts.get(key) ?? 0) + 1
    counts.set(key, next)
    calls.push(key)
    return next
  }
  return {
    counts,
    calls,
    deps: {
      checkMinute: (bucket: string, fnName: string) => {
        bump(bucket, fnName)
        return Promise.resolve()
      },
      // Gerçek checkDailyLimit: '-daily' son eki ve sayaç → hata dönüşümü de sınanır.
      checkDaily: (bucket: string, fnName: string, max: number) =>
        checkDailyLimit(bucket, fnName, max, {
          now: NOW,
          increment: (u, f) => Promise.resolve(bump(u, f)),
        }),
      onIpMissing: () => Promise.resolve(),
    },
  }
}

Deno.test('tavanlar: kullanıcı 50, IP 200', () => {
  assertEquals(EXPLAIN_DAILY_USER, 50)
  assertEquals(EXPLAIN_DAILY_IP, 200)
})

Deno.test('clientIp: platform başlığı XFF\'ten önce gelir (XFF istemci beyanı olabilir)', () => {
  const h = new Headers({
    'x-forwarded-for': '6.6.6.6, 10.0.0.1',
    'cf-connecting-ip': '203.0.113.7',
    'x-real-ip': '203.0.113.8',
  })
  assertEquals(clientIp(h), { ip: '203.0.113.7', source: 'cf-connecting-ip' })
})

Deno.test('clientIp: x-real-ip, sonra XFF ilk öğe; hiçbiri yoksa null', () => {
  assertEquals(clientIp(new Headers({ 'x-real-ip': ' 203.0.113.8 ', 'x-forwarded-for': '6.6.6.6' })), {
    ip: '203.0.113.8',
    source: 'x-real-ip',
  })
  assertEquals(clientIp(new Headers({ 'x-forwarded-for': ' 198.51.100.4 , 10.0.0.1' })), {
    ip: '198.51.100.4',
    source: 'x-forwarded-for',
  })
  assertEquals(clientIp(new Headers()), null)
  assertEquals(clientIp(new Headers({ 'x-forwarded-for': '  ' })), null)
})

Deno.test('ipBucket: `ip:` önekli, küçük harf (IPv6 yazımı tek kovaya düşer)', () => {
  assertEquals(ipBucket('2001:DB8::1'), 'ip:2001:db8::1')
})

Deno.test('50. istek geçer, 51. istek kullanıcı tavanına takılır', async () => {
  const m = memoryCounters()
  for (let i = 0; i < EXPLAIN_DAILY_USER; i++) {
    await enforceExplainLimits(USER, '203.0.113.7', m.deps)
  }
  const err = await assertRejects(
    () => enforceExplainLimits(USER, '203.0.113.7', m.deps),
    ExplainDailyLimitError,
  )
  assertEquals(err.scope, 'user')
  assertEquals(err.limit, 50)
  assertEquals(err.count, 51)
})

Deno.test('anonim oturum yenileyerek dolanma: farklı kullanıcılar, aynı IP → IP tavanı', async () => {
  const m = memoryCounters()
  for (let i = 0; i < EXPLAIN_DAILY_IP; i++) {
    await enforceExplainLimits(`user-${i}`, '203.0.113.7', m.deps)
  }
  const err = await assertRejects(
    () => enforceExplainLimits('user-yeni', '203.0.113.7', m.deps),
    ExplainDailyLimitError,
  )
  assertEquals(err.scope, 'ip')
  assertEquals(err.limit, 200)
  assertEquals(err.count, 201)
})

Deno.test('farklı IP\'ler birbirinin kovasını tüketmez', async () => {
  const m = memoryCounters()
  await enforceExplainLimits(USER, '203.0.113.7', m.deps)
  await enforceExplainLimits(USER, '203.0.113.8', m.deps)
  assertEquals(m.counts.get('ip:203.0.113.7|explain-match-ip-daily'), 1)
  assertEquals(m.counts.get('ip:203.0.113.8|explain-match-ip-daily'), 1)
  assertEquals(m.counts.get(`${USER}|explain-match-daily`), 2)
})

Deno.test('IP yok: onIpMissing çağrılır, kullanıcı tavanı yine uygulanır, IP sayaçlarına dokunulmaz', async () => {
  const m = memoryCounters()
  let missing = 0
  const deps = { ...m.deps, onIpMissing: () => { missing++; return Promise.resolve() } }
  await enforceExplainLimits(USER, null, deps)
  assertEquals(missing, 1)
  assertEquals(m.calls, [`${USER}|explain-match-daily`])
})

Deno.test('IP dakikalık sınırı günlük sayaçları ARTIRMADAN reddeder', async () => {
  const m = memoryCounters()
  const deps = {
    ...m.deps,
    checkMinute: () => Promise.reject(new RateLimitError(12_000)),
  }
  await assertRejects(() => enforceExplainLimits(USER, '203.0.113.7', deps), RateLimitError)
  assertEquals(m.calls.length, 0)
})

Deno.test('sayaç okunamazsa fail-closed: RateLimitUnavailableError aynen yükselir', async () => {
  const deps = {
    checkMinute: () => Promise.resolve(),
    checkDaily: () => Promise.reject(new RateLimitUnavailableError('rpc down')),
    onIpMissing: () => Promise.resolve(),
  }
  await assertRejects(() => enforceExplainLimits(USER, '203.0.113.7', deps), RateLimitUnavailableError)
})

Deno.test('DailyLimitError sayacı taşır (aşan istek sayısı loglanabilsin)', async () => {
  const err = await assertRejects(
    () => checkDailyLimit(USER, 'x-daily', 2, { now: NOW, increment: () => Promise.resolve(5) }),
    DailyLimitError,
  )
  assertEquals(err.count, 5)
})

Deno.test('log satırı: aşan istek sayısı = sayaç − limit; kimlik/IP içermez', () => {
  const log = explainLimitLog(new ExplainDailyLimitError('user', 50, '2026-11-15T00:00:00.000Z', 53))
  assertEquals(log, {
    event: 'explain_daily_limit_exceeded',
    scope: 'user',
    limit: 50,
    count: 53,
    over: 3,
    resets_at: '2026-11-15T00:00:00.000Z',
  })
})

Deno.test('yanıt: 429 EXPLAIN_DAILY_LIMIT + Retry-After', async () => {
  const res = explainDailyLimitResponse(
    new ExplainDailyLimitError('ip', 200, '2026-11-15T00:00:00.000Z', 201),
    { 'Access-Control-Allow-Origin': '*' },
    NOW,
  )
  assertEquals(res.status, 429)
  assertEquals(res.headers.get('Retry-After'), String(2.5 * 3600))
  assertEquals(await res.json(), {
    error: 'Daily explanation limit reached.',
    code: 'EXPLAIN_DAILY_LIMIT',
    scope: 'ip',
    limit: 200,
    resets_at: '2026-11-15T00:00:00.000Z',
  })
})
