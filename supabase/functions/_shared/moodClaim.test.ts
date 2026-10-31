/**
 * parse-mood idempotency yardımcıları + index.ts sözleşme testleri (MONEY-1C, 139).
 * Run: npm run test:mood-claim
 */
import { assert, assertEquals, assertMatch } from 'https://deno.land/std@0.208.0/assert/mod.ts'
import { ANTHROPIC_TIMEOUT_MS, interpretClaim, parseClientSearchId, STALE_SECONDS } from './moodClaim.ts'

const ID = '3f2b8c1e-9d4a-4e6f-8a10-2b7c5d9e0f11'

Deno.test('parseClientSearchId: yok → null (eski istemci); UUID → küçük harf; bozuk → red', () => {
  assertEquals(parseClientSearchId(undefined), { ok: true, value: null })
  assertEquals(parseClientSearchId(null), { ok: true, value: null })
  assertEquals(parseClientSearchId(ID.toUpperCase()), { ok: true, value: ID })
  for (const bad of ['', 'abc', 123, {}, [], true, `${ID}x`, ID.replaceAll('-', '')]) {
    assertEquals(parseClientSearchId(bad), { ok: false })
  }
})

Deno.test('interpretClaim: dört sonuç + fail-closed', () => {
  const claimed = interpretClaim({
    result: 'claimed', search_id: 's1', claimed_at: '2026-10-25T10:00:00.123456+00:00',
    quota: { allowed: true, used: 1, limit: 3 },
  })
  assertEquals(claimed.kind, 'claimed')
  if (claimed.kind === 'claimed') assertEquals([claimed.searchId, claimed.quota.used], ['s1', 1])

  const replay = interpretClaim({ result: 'replay', search_id: 's1', profile: { a: 1 }, quota: { used: 1, limit: 3 } })
  assertEquals(replay.kind, 'replay')

  const prog = interpretClaim({ result: 'in_progress', search_id: 's1', retry_after: 5 })
  assertEquals(prog, { kind: 'in_progress', searchId: 's1', retryAfter: 5 })
  assertEquals(interpretClaim({ result: 'in_progress' }), { kind: 'in_progress', searchId: null, retryAfter: 5 })

  const denied = interpretClaim({ result: 'quota_denied', search_id: 's1', quota: { allowed: false, error: 'QUOTA_EXCEEDED' } })
  assertEquals(denied.kind, 'quota_denied')
})

Deno.test('interpretClaim: eksik/bilinmeyen şekil → unavailable (tahmin yok)', () => {
  for (const bad of [null, undefined, 'x', [], {}, { result: 5 }, { result: 'invalid_args' }, { result: 'user_not_found' },
    { result: 'claimed' }, { result: 'claimed', search_id: 's' }, { result: 'replay', search_id: 's' },
    { result: 'replay', profile: {} }, { result: 'quota_denied' }]) {
    assertEquals(interpretClaim(bad).kind, 'unavailable', JSON.stringify(bad))
  }
})

Deno.test('sabitler: bayat eşiği Anthropic timeout\'undan büyük', () => {
  assert(STALE_SECONDS * 1000 > ANTHROPIC_TIMEOUT_MS)
  assertEquals(ANTHROPIC_TIMEOUT_MS, 25_000)
})

// ── index.ts sözleşmesi (kaynak okuma) ──────────────────────────────────────
const src = Deno.readTextFileSync(new URL('../parse-mood/index.ts', import.meta.url)).replaceAll('\r\n', '\n')

Deno.test('index.ts: claim LLM çağrısından ÖNCE; LLM yalnız claimed yolunda', () => {
  const claimAt = src.indexOf("rpc('claim_mood_search'")
  const llmAt = src.indexOf('client.messages.create')
  assert(claimAt > 0 && llmAt > claimAt, 'claim, LLM çağrısından önce olmalı')
  // replay / in_progress / quota_denied dönüşleri LLM satırından ÖNCE döner
  const before = src.slice(0, llmAt)
  assertMatch(before, /kind === 'replay'/)
  assertMatch(before, /kind === 'in_progress'/)
  assertMatch(before, /code: 'IN_PROGRESS'/)
})

Deno.test('index.ts: Anthropic zaman aşımı + maxRetries 0', () => {
  assertMatch(src, /new Anthropic\(\{ apiKey, timeout: ANTHROPIC_TIMEOUT_MS, maxRetries: 0 \}\)/)
})

Deno.test('index.ts: finish kendi try/catch\'inde — finish hatası LLM hatası sayılıp iade tetiklemez', () => {
  const fn = src.slice(src.indexOf('async function finishSearch'), src.indexOf('// ─── CORS'))
  assertMatch(fn, /try \{[\s\S]*finish_mood_search[\s\S]*\} catch/)
  assertMatch(fn, /sentryCapture/)
  assert(!/catch\s*\{\s*\}/.test(src), 'bos catch yasak')
})

Deno.test('index.ts: client_search_id yoksa legacy akış (kota → LLM → logMoodSearch) korunur', () => {
  assertMatch(src, /check_and_consume_quota/)
  assertMatch(src, /logMoodSearch\(\{/)
  assertMatch(src, /input\.clientSearchId/)
})

Deno.test('index.ts: sağlayıcı hatasında iade; PARSE_FAILED iadesiz politika (refundPolicy) korunur', () => {
  assertMatch(src, /shouldRefundOnError\(err\)/)
})
