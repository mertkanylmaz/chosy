/**
 * Mood aramasında yeniden deneme / idempotency mantığı (MONEY-1C Faz 2b-g). Saf — React/RN yok.
 *
 * 1) `client_search_id`: AYNI metinle yapılan, henüz başarıyla bitmemiş denemeler (yeniden dene,
 *    409 IN_PROGRESS, timeout, satın alma sonrası otomatik arama) AYNI kimliği taşır → sunucu
 *    kotayı en fazla bir kez düşer. Başarılı aramadan sonra kimlik bırakılır; yeni arama yeni kimlik alır.
 * 2) 429 ayrımı (bayraktan bağımsız): paywall YALNIZ günlük kota kodunda (`QUOTA_EXCEEDED`).
 * 3) Satın alma sonrası kota duvarı: sunucu tier'ı webhook/sync gecikmesiyle geç görebilir; duvar
 *    kodu gelirse ~30 sn boyunca 3 sn arayla AYNI kimlikle yeniden denenir.
 */

export type MoodErrorClass =
  /** Günlük arama hakkı bitti → Pro teklifi. Başka hiçbir kod paywall açmaz. */
  | 'paywall'
  /** Aynı kimlik sunucuda sürüyor → `retry_after` sonra AYNI kimlikle dene. */
  | 'retry_same_id'
  /** Kısa süreli hız sınırı → "biraz bekle" mesajı, paywall YOK, hak harcanmadı. */
  | 'rate_limited'
  /** Kota/yapılandırma/LLM servisi geçici yok → "tekrar dene", paywall YOK. */
  | 'unavailable'
  | 'other'

export function classifyMoodSearchError(code: string): MoodErrorClass {
  switch (code) {
    case 'QUOTA_EXCEEDED':
      return 'paywall'
    case 'IN_PROGRESS':
      return 'retry_same_id'
    case 'RATE_LIMIT_EXCEEDED':
      return 'rate_limited'
    case 'SERVICE_UNAVAILABLE':
    case 'QUOTA_UNAVAILABLE':
    case 'TIER_NOT_CONFIGURED':
      return 'unavailable'
    default:
      return 'other'
  }
}

// ── client_search_id ────────────────────────────────────────────────────────

export interface SearchAttempts {
  /** Bu metin için kimlik: önceki başarısız/bitmemiş deneme varsa AYNISI, yoksa yeni. */
  idFor(text: string): { id: string; isRetry: boolean }
  /** Arama başarıyla bitti → kimlik bırakılır. */
  succeeded(): void
}

export function createSearchAttempts(makeId: () => string): SearchAttempts {
  let current: { text: string; id: string } | null = null
  return {
    idFor(text) {
      if (current && current.text === text) return { id: current.id, isRetry: true }
      current = { text, id: makeId() }
      return { id: current.id, isRetry: false }
    },
    succeeded() {
      current = null
    },
  }
}

// ── Satın alma sonrası etkinleşme bekleme ──────────────────────────────────

export const ACTIVATION_RETRY_MS = 3_000
export const ACTIVATION_MAX_ATTEMPTS = 10 // ≈ 30 sn

export type ActivationStep =
  /** Hak duvarı yine geldi (sunucu tier'ı henüz görmedi) → `waitMs` sonra aynı kimlikle yeniden dene. */
  | { kind: 'retry'; waitMs: number }
  /** Süre doldu: kullanıcıya "etkinleşiyor, birazdan tekrar dene" mesajı; paywall YENİDEN açılmaz. */
  | { kind: 'give_up' }
  /** Başka sonuç (başarı ya da farklı hata): normal akış sürsün. */
  | { kind: 'proceed' }

/**
 * @param code    son denemenin hata kodu; başarıda `null`
 * @param attempt kaçıncı deneme bitti (1 tabanlı)
 * @param retryAfterMs sunucu `retry_after` verdiyse (rate limit / IN_PROGRESS), bekleme bundan kısa olmaz
 */
export function nextActivationStep(
  code: string | null,
  attempt: number,
  retryAfterMs: number | null = null,
): ActivationStep {
  if (code === null) return { kind: 'proceed' }
  const cls = classifyMoodSearchError(code)
  if (cls !== 'paywall' && cls !== 'rate_limited' && cls !== 'retry_same_id') return { kind: 'proceed' }
  if (attempt >= ACTIVATION_MAX_ATTEMPTS) return { kind: 'give_up' }
  return { kind: 'retry', waitMs: Math.max(ACTIVATION_RETRY_MS, retryAfterMs ?? 0) }
}

// ── 409 IN_PROGRESS otomatik yeniden deneme (tasteParser) ───────────────────

export const IN_PROGRESS_MAX_RETRIES = 3
export const IN_PROGRESS_MAX_WAIT_MS = 8_000

/** `retry_after` (sn) → bekleme (ms), 1..8 sn arası; geçersizse 5 sn. */
export function inProgressWaitMs(retryAfterSeconds: unknown): number {
  const s = typeof retryAfterSeconds === 'number' && retryAfterSeconds > 0 ? retryAfterSeconds : 5
  return Math.min(Math.max(s * 1000, 1000), IN_PROGRESS_MAX_WAIT_MS)
}
