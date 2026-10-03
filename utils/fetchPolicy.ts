/**
 * Ağ isteği zaman aşımı / yeniden deneme kararı — saf mantık (Sprint 10c).
 *
 * `services/supabase.ts` → `supabaseFetch` bunu çağırır. Burada fetch, saat,
 * Sentry veya React Native bağımlılığı YOKTUR; yalnız (metot, URL) →
 * `{ timeoutMs, retries }` kararı verilir (`tests/net/fetchPolicy.test.ts`).
 *
 * ── Kurallar ─────────────────────────────────────────────────────────────────
 * - REST GET/HEAD (idempotent): 5 sn, TEK yeniden deneme.
 * - REST POST/PATCH/PUT/DELETE: 15 sn, yeniden deneme YOK.
 * - Edge Function: 20 sn; LLM çağıranlar (explain-match, parse-mood) 40 sn;
 *   yeniden deneme YOK.
 * - Auth: yalnız GET /auth/v1/user 5 sn + 1 deneme. Diğer tüm /auth/v1/
 *   istekleri (token yenileme dahil) politikasızdır — auth-js kendi
 *   mantığını yönetir.
 * - Bilinmeyen yol: politika yok (`null`) → istek olduğu gibi gider.
 */

export interface FetchPolicy {
  timeoutMs: number;
  retries: number;
}

const REST_READ: FetchPolicy = { timeoutMs: 5_000, retries: 1 };
const REST_WRITE: FetchPolicy = { timeoutMs: 15_000, retries: 0 };
const EDGE_DEFAULT: FetchPolicy = { timeoutMs: 20_000, retries: 0 };
const EDGE_LLM: FetchPolicy = { timeoutMs: 40_000, retries: 0 };

/** LLM çağıran Edge Function'lar — uzun zaman aşımı. */
const LLM_FUNCTIONS: ReadonlySet<string> = new Set(['explain-match', 'parse-mood']);

const RETRY_JITTER_MIN_MS = 250;
const RETRY_JITTER_SPAN_MS = 250;

/** URL'nin yolu — sorgu ve parça atılır (PII/arama metni içerebilir). */
export function urlPath(url: string): string {
  const afterScheme = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, '');
  const end = afterScheme.search(/[?#]/);
  return end === -1 ? afterScheme : afterScheme.slice(0, end);
}

export function decideFetchPolicy(method: string, url: string): FetchPolicy | null {
  const m = method.toUpperCase();
  const path = urlPath(url);
  const isRead = m === 'GET' || m === 'HEAD';

  if (path === '/auth/v1/user') {
    return m === 'GET' ? REST_READ : null;
  }
  if (path.startsWith('/auth/v1/')) {
    return null;
  }
  if (path.startsWith('/rest/v1/')) {
    return isRead ? REST_READ : REST_WRITE;
  }
  if (path.startsWith('/functions/v1/')) {
    const name = path.slice('/functions/v1/'.length).split('/')[0] ?? '';
    return LLM_FUNCTIONS.has(name) ? EDGE_LLM : EDGE_DEFAULT;
  }
  return null;
}

/** Yeniden deneme öncesi bekleme: 250-500 ms. `random` ∈ [0, 1). */
export function retryDelayMs(random: number): number {
  return RETRY_JITTER_MIN_MS + Math.floor(random * RETRY_JITTER_SPAN_MS);
}
