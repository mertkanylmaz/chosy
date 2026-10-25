/**
 * parse-mood idempotency yardımcıları (MONEY-1C, migration 139). Saf fonksiyonlar.
 *
 * İstemci aynı aramayı `client_search_id` ile yeniden gönderir; sunucu
 * `claim_mood_search` RPC'siyle kotayı BİR KEZ tüketir. Bu modül RPC dönüşünü
 * tipli bir sonuca çevirir ve istek gövdesindeki kimliği doğrular.
 */

/** Bayat-pending eşiği: Anthropic timeout'u (25 sn) + pay. Migration 139 tasarımı. */
export const STALE_SECONDS = 45

/** Anthropic istemci zaman aşımı. `maxRetries: 0` ile birlikte kullanılır. */
export const ANTHROPIC_TIMEOUT_MS = 25_000

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ClientSearchIdResult = { ok: true; value: string | null } | { ok: false }

/**
 * `client_search_id` yoksa (eski istemci) `value: null` — bugünkü akış. Varsa UUID
 * olmak zorunda; değilse istek `INVALID_INPUT` ile kotadan ÖNCE reddedilir.
 */
export function parseClientSearchId(raw: unknown): ClientSearchIdResult {
  if (raw === undefined || raw === null) return { ok: true, value: null }
  if (typeof raw !== 'string' || !UUID_RE.test(raw)) return { ok: false }
  return { ok: true, value: raw.toLowerCase() }
}

type Quota = Record<string, unknown>

export type ClaimOutcome =
  /** Bu istek sahiplendi: LLM çağrılabilir. `quota` = tüketim sonucu (veya bedava yeniden sahiplenmede anlık görüntü). */
  | { kind: 'claimed'; searchId: string; claimedAt: string; quota: Quota }
  /** Daha önce tamamlanmış: kayıtlı profil, kota/LLM yok. */
  | { kind: 'replay'; searchId: string; profile: Record<string, unknown>; quota: Quota | null }
  /** Aynı kimlik taze `pending`: başka istek çalışıyor. */
  | { kind: 'in_progress'; searchId: string | null; retryAfter: number }
  /** Kota tüketilemedi (QUOTA_EXCEEDED / TIER_NOT_CONFIGURED / bilinmeyen) — `quota` ham RPC sonucu. */
  | { kind: 'quota_denied'; searchId: string | null; quota: Quota }
  /** RPC anlaşılmaz / invalid_args / user_not_found: fail-closed. */
  | { kind: 'unavailable'; detail: string }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** `claim_mood_search` jsonb dönüşünü sınıflandırır. Bilinmeyen şekil → `unavailable` (tahmin edilmez). */
export function interpretClaim(raw: unknown): ClaimOutcome {
  if (!isRecord(raw) || typeof raw.result !== 'string') {
    return { kind: 'unavailable', detail: `claim cevabi anlasilmaz: ${JSON.stringify(raw)}` }
  }
  const searchId = typeof raw.search_id === 'string' ? raw.search_id : null

  switch (raw.result) {
    case 'claimed': {
      if (!searchId || typeof raw.claimed_at !== 'string') {
        return { kind: 'unavailable', detail: `claimed cevabinda search_id/claimed_at yok: ${JSON.stringify(raw)}` }
      }
      return {
        kind: 'claimed',
        searchId,
        claimedAt: raw.claimed_at,
        quota: isRecord(raw.quota) ? raw.quota : {},
      }
    }
    case 'replay': {
      if (!searchId || !isRecord(raw.profile)) {
        return { kind: 'unavailable', detail: `replay cevabinda search_id/profile yok: ${JSON.stringify(raw)}` }
      }
      return { kind: 'replay', searchId, profile: raw.profile, quota: isRecord(raw.quota) ? raw.quota : null }
    }
    case 'in_progress': {
      const retry = typeof raw.retry_after === 'number' && raw.retry_after > 0 ? raw.retry_after : 5
      return { kind: 'in_progress', searchId, retryAfter: retry }
    }
    case 'quota_denied': {
      if (!isRecord(raw.quota)) {
        return { kind: 'unavailable', detail: `quota_denied cevabinda quota yok: ${JSON.stringify(raw)}` }
      }
      return { kind: 'quota_denied', searchId, quota: raw.quota }
    }
    default:
      return { kind: 'unavailable', detail: `claim sonucu: ${raw.result}` }
  }
}
