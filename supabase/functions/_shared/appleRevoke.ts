/**
 * Sign in with Apple — hesap silmede token revoke (App Store 5.1.1(v)).
 *
 * Token SAKLANMAZ. Silme anında istemci Apple ile yeniden doğrular, bir
 * `authorizationCode` gönderir; burada code → refresh_token değişimi yapılır
 * ve refresh_token hemen revoke edilir.
 *
 * Sözleşme:
 *   - Revoke başarısızlığı SİLMEYİ ENGELLEMEZ. Her başarısızlık `report` ile
 *     Sentry'ye gider (kod: APPLE_*), çağıran silmeye devam eder.
 *   - code, refresh_token, id_token, client_secret ve private key ASLA
 *     raporlanmaz/loglanmaz. Raporlanan tek Apple verisi HTTP durumu ve
 *     Apple'ın `error` kodudur (ör. invalid_grant).
 *   - Her Apple çağrısı tek deneme, 10 sn timeout.
 *
 * `fetch`, saat ve rapor bağımlılıkları enjekte edilir (test için).
 *
 * ENV (supabase secrets): APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_CLIENT_ID,
 * APPLE_PRIVATE_KEY (literal "\n" içerebilir).
 * APPLE_CLIENT_ID = bundle id (com.chosy.ai); Services ID DEĞİL — native
 * akışta authorization code, signInAsync'in client'ına bağlıdır.
 */

import { importPKCS8, SignJWT } from 'npm:jose@5.9.6'

export const APPLE_AUDIENCE = 'https://appleid.apple.com'
export const APPLE_TOKEN_URL = 'https://appleid.apple.com/auth/token'
export const APPLE_REVOKE_URL = 'https://appleid.apple.com/auth/revoke'
export const APPLE_TIMEOUT_MS = 10_000
export const CLIENT_SECRET_TTL_SEC = 300

export type AppleRevokeCode =
  | 'APPLE_REVOKE_FAILED'
  | 'APPLE_SECRETS_MISSING'
  | 'APPLE_REVOKE_SKIPPED_OLD_CLIENT'
  | 'APPLE_REVOKE_SUB_MISMATCH'

export interface AppleRevokeReport {
  code: AppleRevokeCode
  level: 'error' | 'warning'
  /** Yalnız secret/token İÇERMEYEN alanlar. */
  detail: Record<string, unknown>
}

export type AppleRevokeOutcome =
  | 'revoked'
  | 'none'
  | 'skipped_old_client'
  | 'secrets_missing'
  | 'sub_mismatch'
  | 'failed'

export interface AppleIdentityLike {
  provider: string
  provider_id?: string
  identity_data?: Record<string, unknown> | null
}

export interface AppleEnv {
  teamId?: string
  keyId?: string
  clientId?: string
  privateKey?: string
}

export interface AppleRevokeDeps {
  fetchFn: typeof fetch
  /** Unix saniye. */
  nowSec: () => number
  report: (r: AppleRevokeReport) => Promise<void> | void
  timeoutMs?: number
}

// ─── Karar ────────────────────────────────────────────────────────────────────

export type AppleGate =
  | { action: 'none' }
  | { action: 'skip_old_client' }
  | { action: 'revoke'; providerId: string | null }

/**
 * Apple identity kararı (sunucu `getUser().identities`'ten verir):
 *   Apple identity yok            → none
 *   Apple identity var, code yok  → skip_old_client
 *   Apple identity var, code var  → revoke
 */
export function decideAppleRevoke(
  identities: AppleIdentityLike[] | null | undefined,
  appleAuthorizationCode: unknown,
): AppleGate {
  const apple = (identities ?? []).find((i) => i.provider === 'apple')
  if (!apple) return { action: 'none' }

  const hasCode = typeof appleAuthorizationCode === 'string' &&
    appleAuthorizationCode.length > 0
  if (!hasCode) return { action: 'skip_old_client' }

  const fromData = apple.identity_data?.sub
  const providerId = apple.provider_id ??
    (typeof fromData === 'string' ? fromData : null)
  return { action: 'revoke', providerId }
}

// ─── client_secret ────────────────────────────────────────────────────────────

/** Secret'ta literal "\n" olarak saklanan PEM'i gerçek satır sonlarına çevirir. */
export function normalizePrivateKey(raw: string): string {
  return raw.replace(/\\n/g, '\n')
}

/** ES256 client_secret JWT'si. Header kid=keyId; exp = iat + 300 sn. */
export async function buildClientSecret(
  env: Required<AppleEnv>,
  nowSec: number,
): Promise<string> {
  const key = await importPKCS8(normalizePrivateKey(env.privateKey), 'ES256')
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: env.keyId })
    .setIssuer(env.teamId)
    .setSubject(env.clientId)
    .setAudience(APPLE_AUDIENCE)
    .setIssuedAt(nowSec)
    .setExpirationTime(nowSec + CLIENT_SECRET_TTL_SEC)
    .sign(key)
}

/** id_token payload'ından `sub` (imza doğrulaması YOK — token Apple'dan TLS ile geldi). */
export function decodeIdTokenSub(idToken: string): string | null {
  const part = idToken.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(new TextDecoder().decode(
      Uint8Array.from(atob(padded), (c) => c.charCodeAt(0)),
    )) as { sub?: unknown }
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

// ─── Apple çağrıları ──────────────────────────────────────────────────────────

interface AppleCallResult {
  ok: boolean
  status: number
  body: Record<string, unknown>
}

async function postForm(
  deps: AppleRevokeDeps,
  url: string,
  form: Record<string, string>,
): Promise<AppleCallResult> {
  const res = await deps.fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(deps.timeoutMs ?? APPLE_TIMEOUT_MS),
  })
  // /auth/revoke başarıda boş gövde döner.
  const body = await res.json().catch(() => ({})) as Record<string, unknown>
  return { ok: res.ok, status: res.status, body }
}

function errName(err: unknown): string {
  return err instanceof Error ? err.name : 'unknown'
}

function appleErrorCode(body: Record<string, unknown>): string | undefined {
  return typeof body.error === 'string' ? body.error : undefined
}

// ─── Ana akış ─────────────────────────────────────────────────────────────────

/**
 * Karar `revoke` ise code → refresh_token → sub kontrolü → revoke.
 * Asla fırlatmaz; sonuç `AppleRevokeOutcome` olarak döner, hata yolları
 * `deps.report` ile raporlanır.
 */
export async function revokeAppleSignIn(
  gate: AppleGate,
  appleAuthorizationCode: string | undefined,
  env: AppleEnv,
  deps: AppleRevokeDeps,
): Promise<AppleRevokeOutcome> {
  if (gate.action === 'none') return 'none'

  if (gate.action === 'skip_old_client') {
    await deps.report({
      code: 'APPLE_REVOKE_SKIPPED_OLD_CLIENT',
      level: 'warning',
      detail: {},
    })
    return 'skipped_old_client'
  }

  const missing = (['teamId', 'keyId', 'clientId', 'privateKey'] as const)
    .filter((k) => !env[k])
  if (missing.length > 0 || !appleAuthorizationCode) {
    await deps.report({
      code: 'APPLE_SECRETS_MISSING',
      level: 'error',
      detail: { missing },
    })
    return 'secrets_missing'
  }
  const fullEnv = env as Required<AppleEnv>

  const fail = async (
    step: string,
    extra: Record<string, unknown> = {},
  ): Promise<AppleRevokeOutcome> => {
    await deps.report({
      code: 'APPLE_REVOKE_FAILED',
      level: 'error',
      detail: { step, ...extra },
    })
    return 'failed'
  }

  try {
    let clientSecret: string
    try {
      clientSecret = await buildClientSecret(fullEnv, deps.nowSec())
    } catch (err) {
      return await fail('client_secret', { error: errName(err) })
    }

    // 1. code → refresh_token
    const tokenRes = await postForm(deps, APPLE_TOKEN_URL, {
      client_id: fullEnv.clientId,
      client_secret: clientSecret,
      code: appleAuthorizationCode,
      grant_type: 'authorization_code',
    })
    const refreshToken = tokenRes.body.refresh_token
    if (!tokenRes.ok || typeof refreshToken !== 'string' || !refreshToken) {
      return await fail('token_exchange', {
        status: tokenRes.status,
        apple_error: appleErrorCode(tokenRes.body),
      })
    }

    // 2. Yeniden doğrulanan Apple hesabı, silinen hesabın Apple kimliği mi?
    const idToken = tokenRes.body.id_token
    const tokenSub = typeof idToken === 'string' ? decodeIdTokenSub(idToken) : null
    if (!tokenSub || !gate.providerId || tokenSub !== gate.providerId) {
      await deps.report({
        code: 'APPLE_REVOKE_SUB_MISMATCH',
        level: 'warning',
        detail: {
          has_token_sub: tokenSub !== null,
          has_identity_provider_id: gate.providerId !== null,
        },
      })
      return 'sub_mismatch'
    }

    // 3. Revoke
    const revokeRes = await postForm(deps, APPLE_REVOKE_URL, {
      client_id: fullEnv.clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    })
    if (!revokeRes.ok) {
      return await fail('revoke', {
        status: revokeRes.status,
        apple_error: appleErrorCode(revokeRes.body),
      })
    }
    return 'revoked'
  } catch (err) {
    // Timeout (TimeoutError), ağ hatası. Mesaj raporlanmaz: URL/gövde taşıyabilir.
    return await fail('network', { error: errName(err) })
  }
}
