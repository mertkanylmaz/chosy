/**
 * appleRevoke — karar tablosu, client_secret claim'leri, hata yolları.
 * Apple uç noktaları fetch mock'uyla taklit edilir; ağa çıkılmaz.
 *
 * Koşum:  npm run test:apple-revoke
 *         (cd supabase/functions && deno test _shared/appleRevoke.test.ts)
 */

import { assert, assertEquals, assertFalse } from 'jsr:@std/assert@1'
import {
  decodeProtectedHeader,
  exportPKCS8,
  generateKeyPair,
  jwtVerify,
} from 'npm:jose@5.9.6'

import {
  APPLE_AUDIENCE,
  APPLE_REVOKE_URL,
  APPLE_TOKEN_URL,
  type AppleEnv,
  type AppleRevokeDeps,
  type AppleRevokeReport,
  buildClientSecret,
  decideAppleRevoke,
  decodeIdTokenSub,
  normalizePrivateKey,
  revokeAppleSignIn,
} from './appleRevoke.ts'

const NOW = 1_800_000_000
const SUB = '001234.abcdef.5678'
const CODE = 'c_secret_auth_code'
const REFRESH = 'r_secret_refresh_token'

const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true })
const pem = await exportPKCS8(privateKey)
/** Supabase secret'ında saklanan biçim: gerçek satır sonları yerine literal "\n". */
const literalPem = pem.trim().replace(/\n/g, '\\n')

const ENV: AppleEnv = {
  teamId: 'TEAM123456',
  keyId: 'KEY1234567',
  clientId: 'com.chosy.ai',
  privateKey: literalPem,
}

function b64url(obj: unknown): string {
  return btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}
const idToken = (sub: string) => `${b64url({ alg: 'none' })}.${b64url({ sub })}.sig`

interface Call {
  url: string
  form: URLSearchParams
}

function makeDeps(
  responder: (url: string) => Response | Promise<Response>,
): { deps: AppleRevokeDeps; calls: Call[]; reports: AppleRevokeReport[] } {
  const calls: Call[] = []
  const reports: AppleRevokeReport[] = []
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, form: new URLSearchParams(String(init?.body ?? '')) })
    return await responder(url)
  }) as typeof fetch
  return {
    deps: { fetchFn, nowSec: () => NOW, report: (r) => void reports.push(r) },
    calls,
    reports,
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const happy = (url: string) =>
  url === APPLE_TOKEN_URL
    ? json({ refresh_token: REFRESH, id_token: idToken(SUB) })
    : new Response('', { status: 200 })

const REVOKE_GATE = { action: 'revoke', providerId: SUB } as const

// ─── Karar tablosu ────────────────────────────────────────────────────────────

Deno.test('gate: Apple identity yok → none (anonim / e-posta)', () => {
  assertEquals(decideAppleRevoke([], CODE), { action: 'none' })
  assertEquals(decideAppleRevoke(null, CODE), { action: 'none' })
  assertEquals(decideAppleRevoke([{ provider: 'email' }], CODE), { action: 'none' })
})

Deno.test('gate: Apple identity var, code yok → skip_old_client', () => {
  const ids = [{ provider: 'apple', provider_id: SUB }]
  assertEquals(decideAppleRevoke(ids, undefined), { action: 'skip_old_client' })
  assertEquals(decideAppleRevoke(ids, ''), { action: 'skip_old_client' })
  assertEquals(decideAppleRevoke(ids, 42), { action: 'skip_old_client' })
})

Deno.test('gate: Apple identity + code → revoke; providerId provider_id ya da identity_data.sub', () => {
  assertEquals(
    decideAppleRevoke([{ provider: 'apple', provider_id: SUB }], CODE),
    { action: 'revoke', providerId: SUB },
  )
  assertEquals(
    decideAppleRevoke([{ provider: 'apple', identity_data: { sub: SUB } }], CODE),
    { action: 'revoke', providerId: SUB },
  )
  assertEquals(
    decideAppleRevoke([{ provider: 'apple' }], CODE),
    { action: 'revoke', providerId: null },
  )
})

// ─── client_secret ────────────────────────────────────────────────────────────

Deno.test('normalizePrivateKey: literal \\n gerçek satır sonuna döner', () => {
  assertFalse(literalPem.includes('\n'))
  assertEquals(normalizePrivateKey(literalPem), pem.trim())
})

Deno.test('client_secret: ES256, kid, iss/sub/aud/iat/exp doğru', async () => {
  const jwt = await buildClientSecret(ENV as Required<AppleEnv>, NOW)

  const header = decodeProtectedHeader(jwt)
  assertEquals(header.alg, 'ES256')
  assertEquals(header.kid, 'KEY1234567')

  // currentDate ile exp doğrulaması dahil imza kontrolü.
  const { payload } = await jwtVerify(jwt, publicKey, {
    audience: APPLE_AUDIENCE,
    issuer: 'TEAM123456',
    subject: 'com.chosy.ai',
    currentDate: new Date((NOW + 10) * 1000),
  })
  assertEquals(payload.iat, NOW)
  assertEquals(payload.exp, NOW + 300)
})

Deno.test('decodeIdTokenSub: sub okunur, bozuk token null', () => {
  assertEquals(decodeIdTokenSub(idToken(SUB)), SUB)
  assertEquals(decodeIdTokenSub('bozuk'), null)
  assertEquals(decodeIdTokenSub('a.%%%.c'), null)
})

// ─── Mutlu yol ────────────────────────────────────────────────────────────────

Deno.test('revoke: token → revoke sırası, doğru form alanları', async () => {
  const { deps, calls, reports } = makeDeps(happy)
  const outcome = await revokeAppleSignIn(REVOKE_GATE, CODE, ENV, deps)

  assertEquals(outcome, 'revoked')
  assertEquals(reports.length, 0)
  assertEquals(calls.map((c) => c.url), [APPLE_TOKEN_URL, APPLE_REVOKE_URL])

  const [tokenCall, revokeCall] = calls
  assertEquals(tokenCall.form.get('client_id'), 'com.chosy.ai')
  assertEquals(tokenCall.form.get('code'), CODE)
  assertEquals(tokenCall.form.get('grant_type'), 'authorization_code')
  assert(tokenCall.form.get('client_secret')!.split('.').length === 3)

  assertEquals(revokeCall.form.get('client_id'), 'com.chosy.ai')
  assertEquals(revokeCall.form.get('token'), REFRESH)
  assertEquals(revokeCall.form.get('token_type_hint'), 'refresh_token')
})

// ─── Hata yolları: hiçbiri fırlatmaz, hepsi raporlanır ────────────────────────

Deno.test('none / skip_old_client: Apple\'a çağrı yok', async () => {
  const a = makeDeps(happy)
  assertEquals(await revokeAppleSignIn({ action: 'none' }, undefined, ENV, a.deps), 'none')
  assertEquals(a.calls.length, 0)
  assertEquals(a.reports.length, 0)

  const b = makeDeps(happy)
  assertEquals(
    await revokeAppleSignIn({ action: 'skip_old_client' }, undefined, ENV, b.deps),
    'skipped_old_client',
  )
  assertEquals(b.calls.length, 0)
  assertEquals(b.reports, [
    { code: 'APPLE_REVOKE_SKIPPED_OLD_CLIENT', level: 'warning', detail: {} },
  ])
})

Deno.test('secret eksik → APPLE_SECRETS_MISSING (error), çağrı yok', async () => {
  const { deps, calls, reports } = makeDeps(happy)
  const outcome = await revokeAppleSignIn(
    REVOKE_GATE,
    CODE,
    { ...ENV, keyId: undefined, privateKey: '' },
    deps,
  )
  assertEquals(outcome, 'secrets_missing')
  assertEquals(calls.length, 0)
  assertEquals(reports.length, 1)
  assertEquals(reports[0].code, 'APPLE_SECRETS_MISSING')
  assertEquals(reports[0].level, 'error')
  assertEquals(reports[0].detail, { missing: ['keyId', 'privateKey'] })
})

Deno.test('bozuk private key → APPLE_REVOKE_FAILED(client_secret), çağrı yok', async () => {
  const { deps, calls, reports } = makeDeps(happy)
  const outcome = await revokeAppleSignIn(
    REVOKE_GATE,
    CODE,
    { ...ENV, privateKey: 'not-a-pem' },
    deps,
  )
  assertEquals(outcome, 'failed')
  assertEquals(calls.length, 0)
  assertEquals(reports[0].code, 'APPLE_REVOKE_FAILED')
  assertEquals(reports[0].detail.step, 'client_secret')
})

Deno.test('token alma HTTP hatası → FAILED(token_exchange), revoke çağrılmaz', async () => {
  const { deps, calls, reports } = makeDeps(() => json({ error: 'invalid_grant' }, 400))
  const outcome = await revokeAppleSignIn(REVOKE_GATE, CODE, ENV, deps)
  assertEquals(outcome, 'failed')
  assertEquals(calls.map((c) => c.url), [APPLE_TOKEN_URL])
  assertEquals(reports[0].code, 'APPLE_REVOKE_FAILED')
  assertEquals(reports[0].detail, {
    step: 'token_exchange',
    status: 400,
    apple_error: 'invalid_grant',
  })
})

Deno.test('token yanıtında refresh_token yok → FAILED(token_exchange)', async () => {
  const { deps, reports } = makeDeps(() => json({ id_token: idToken(SUB) }))
  assertEquals(await revokeAppleSignIn(REVOKE_GATE, CODE, ENV, deps), 'failed')
  assertEquals(reports[0].detail.step, 'token_exchange')
})

Deno.test('sub uyuşmazlığı → SUB_MISMATCH (warning), revoke ÇAĞRILMAZ', async () => {
  const { deps, calls, reports } = makeDeps((url) =>
    url === APPLE_TOKEN_URL
      ? json({ refresh_token: REFRESH, id_token: idToken('baska.hesap') })
      : new Response('', { status: 200 })
  )
  const outcome = await revokeAppleSignIn(REVOKE_GATE, CODE, ENV, deps)
  assertEquals(outcome, 'sub_mismatch')
  assertEquals(calls.map((c) => c.url), [APPLE_TOKEN_URL])
  assertEquals(reports[0].code, 'APPLE_REVOKE_SUB_MISMATCH')
  assertEquals(reports[0].level, 'warning')
})

Deno.test('identity provider_id yok → sub karşılaştırılamaz, revoke YOK', async () => {
  const { deps, calls, reports } = makeDeps(happy)
  const outcome = await revokeAppleSignIn(
    { action: 'revoke', providerId: null },
    CODE,
    ENV,
    deps,
  )
  assertEquals(outcome, 'sub_mismatch')
  assertEquals(calls.length, 1)
  assertEquals(reports[0].detail, { has_token_sub: true, has_identity_provider_id: false })
})

Deno.test('revoke HTTP hatası → FAILED(revoke)', async () => {
  const { deps, calls, reports } = makeDeps((url) =>
    url === APPLE_TOKEN_URL
      ? json({ refresh_token: REFRESH, id_token: idToken(SUB) })
      : json({ error: 'invalid_client' }, 401)
  )
  assertEquals(await revokeAppleSignIn(REVOKE_GATE, CODE, ENV, deps), 'failed')
  assertEquals(calls.length, 2)
  assertEquals(reports[0].detail, { step: 'revoke', status: 401, apple_error: 'invalid_client' })
})

Deno.test('ağ hatası fırlatır → FAILED(network), fonksiyon fırlatmaz', async () => {
  const { deps, reports } = makeDeps(() => {
    throw new TypeError('connection reset')
  })
  assertEquals(await revokeAppleSignIn(REVOKE_GATE, CODE, ENV, deps), 'failed')
  assertEquals(reports[0].detail, { step: 'network', error: 'TypeError' })
})

Deno.test('timeout: yanıt vermeyen Apple 10 sn sınırıyla kesilir', async () => {
  const { deps, reports } = makeDeps((url) => {
    void url
    return new Promise<Response>(() => {}) // hiç dönmez; signal ile kesilmeli
  })
  // fetch mock'u signal'i dinlemediği için sınırı gerçek fetch gibi uygula.
  const slowFetch = ((_u: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_res, rej) => {
      init?.signal?.addEventListener('abort', () => rej(init.signal!.reason))
    })) as typeof fetch
  const outcome = await revokeAppleSignIn(
    REVOKE_GATE,
    CODE,
    ENV,
    { ...deps, fetchFn: slowFetch, timeoutMs: 20 },
  )
  assertEquals(outcome, 'failed')
  assertEquals(reports[0].detail, { step: 'network', error: 'TimeoutError' })
})

Deno.test('hiçbir rapor code / refresh_token / secret / private key sızdırmaz', async () => {
  const scenarios: Array<(url: string) => Response> = [
    () => json({ error: 'invalid_grant', code: CODE, refresh_token: REFRESH }, 400),
    (url) =>
      url === APPLE_TOKEN_URL
        ? json({ refresh_token: REFRESH, id_token: idToken('baska') })
        : new Response(''),
    (url) =>
      url === APPLE_TOKEN_URL
        ? json({ refresh_token: REFRESH, id_token: idToken(SUB) })
        : json({ error: 'x' }, 500),
  ]
  for (const responder of scenarios) {
    const { deps, reports } = makeDeps(responder)
    await revokeAppleSignIn(REVOKE_GATE, CODE, ENV, deps)
    const dump = JSON.stringify(reports)
    assertFalse(dump.includes(CODE))
    assertFalse(dump.includes(REFRESH))
    assertFalse(dump.includes('BEGIN'))
    assertFalse(dump.includes(literalPem.slice(30, 60)))
  }
})
