/**
 * Ağ zaman aşımı / yeniden deneme kararı — tablo testleri (Sprint 10c).
 * Run: npm run test:fetch-policy
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import { decideFetchPolicy, retryDelayMs, urlPath } from '../../utils/fetchPolicy.ts'

const BASE = 'https://abc.supabase.co'

const READ = { timeoutMs: 5_000, retries: 1 }
const WRITE = { timeoutMs: 15_000, retries: 0 }
const EDGE = { timeoutMs: 20_000, retries: 0 }
const LLM = { timeoutMs: 40_000, retries: 0 }

const cases: Array<[string, string, string, ReturnType<typeof decideFetchPolicy>]> = [
  // REST
  ['GET', '/rest/v1/films?select=id&title=ilike.*matrix*', 'REST GET', READ],
  ['HEAD', '/rest/v1/watchlist?select=id', 'REST HEAD', READ],
  ['get', '/rest/v1/films', 'metot küçük harf', READ],
  ['POST', '/rest/v1/choice_events', 'REST POST', WRITE],
  ['POST', '/rest/v1/rpc/some_rpc', 'RPC POST', WRITE],
  ['PATCH', '/rest/v1/watchlist?id=eq.1', 'REST PATCH', WRITE],
  ['PUT', '/rest/v1/watchlist', 'REST PUT', WRITE],
  ['DELETE', '/rest/v1/watchlist?id=eq.1', 'REST DELETE', WRITE],
  // Edge
  ['POST', '/functions/v1/submit-choice', 'EF varsayılan', EDGE],
  ['POST', '/functions/v1/generate-gauntlet?forceFunctionRegion=us-west-1', 'EF sorgulu', EDGE],
  ['GET', '/functions/v1/get-archive-status', 'EF GET de yeniden denenmez', EDGE],
  ['POST', '/functions/v1/explain-match', 'LLM explain-match', LLM],
  ['POST', '/functions/v1/parse-mood', 'LLM parse-mood', LLM],
  ['POST', '/functions/v1/explain-match-v2', 'önek eşleşmesi LLM sayılmaz', EDGE],
  // Auth
  ['GET', '/auth/v1/user', 'auth getUser', READ],
  ['POST', '/auth/v1/user', 'auth user POST politikasız', null],
  ['POST', '/auth/v1/token?grant_type=refresh_token', 'token yenileme', null],
  ['POST', '/auth/v1/token?grant_type=id_token', 'id_token girişi', null],
  ['GET', '/auth/v1/session', 'diğer auth GET', null],
  ['POST', '/auth/v1/token?grant_type=password', 'password grant', null],
  ['POST', '/auth/v1/token?grant_type=pkce', 'pkce grant', null],
  ['POST', '/auth/v1/signup', 'signup', null],
  ['POST', '/auth/v1/logout', 'logout', null],
  ['POST', '/auth/v1/logout?scope=local', 'logout sorgulu', null],
  ['POST', '/auth/v1/verify', 'verify', null],
  ['GET', '/auth/v1/verify?token=x&type=signup', 'verify GET', null],
  ['GET', '/auth/v1/admin/users', 'admin GET', null],
  ['POST', '/auth/v1/admin/users', 'admin POST', null],
  ['DELETE', '/auth/v1/admin/users/abc', 'admin DELETE', null],
  ['HEAD', '/auth/v1/user', 'auth user HEAD politikasız', null],
  // Diğer
  ['GET', '/storage/v1/object/x', 'bilinmeyen yol', null],
  ['GET', '/', 'kök', null],
]

for (const [method, path, label, expected] of cases) {
  Deno.test(`${method} ${path} — ${label}`, () => {
    assertEquals(decideFetchPolicy(method, BASE + path), expected)
  })
}

Deno.test('urlPath: sorgu ve parça atılır, kök/göreli girdiler', () => {
  assertEquals(urlPath(`${BASE}/rest/v1/films?title=ilike.*secret*#x`), '/rest/v1/films')
  assertEquals(urlPath('http://localhost:54321/functions/v1/parse-mood'), '/functions/v1/parse-mood')
  assertEquals(urlPath('/rest/v1/films?a=1'), '/rest/v1/films')
  assertEquals(urlPath(BASE), '')
})

Deno.test('retryDelayMs: 250-500 ms aralığı', () => {
  assertEquals(retryDelayMs(0), 250)
  assertEquals(retryDelayMs(0.5), 375)
  assertEquals(retryDelayMs(0.999999), 499)
})
