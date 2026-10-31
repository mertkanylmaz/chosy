/**
 * parse-mood kota iadesi politikası (MONEY-1C). Saf fonksiyon.
 *
 * Hak YALNIZ LLM'den sonuç alınamayan hatalarda iade edilir: sağlayıcı 5xx/529,
 * sağlayıcı rate limit (429), zaman aşımı, ağ hatası, kredi/billing tükenmesi.
 *
 * İade EDİLMEZ: LLM yanıt verdi ama JSON ayrıştırılamadı (PARSE_FAILED) ve
 * sınıflandırılamayan her hata. Gerekçe: ücret LLM çağrısı yapılınca doğar;
 * kullanıcı girdiyle modeli JSON üretmemeye yönlendirebilir ve PARSE_FAILED
 * iadesi, kotayı düşürmeden sınırsız ücretli çağrı demek olurdu
 * (migration-guard bulgusu, 24 Eki 2026).
 */

const CREDIT_MARKERS = ['credit balance is too low', 'billing', 'insufficient_quota', 'rate_limit']

/** Bağlantı/zaman aşımı hatası (Anthropic SDK APIConnection*Error, fetch AbortError/TypeError). */
const NETWORK_NAME = /connection|timeout|abort|network/i

/** Deno/undici ağ hatası: `TypeError: fetch failed` / `error sending request`. */
const NETWORK_MESSAGE = /fetch failed|error sending request|network/i

export function shouldRefundOnError(err: unknown): boolean {
  if (!(err instanceof Error)) return false

  const status = (err as { status?: unknown }).status
  if (typeof status === 'number') {
    // 529 overloaded dahil tüm 5xx; 429 sağlayıcı limiti; 408 istek zaman aşımı.
    return status >= 500 || status === 429 || status === 408
  }

  const ctorName = err.constructor?.name ?? ''
  if (NETWORK_NAME.test(err.name) || NETWORK_NAME.test(ctorName)) return true

  if (err instanceof TypeError && NETWORK_MESSAGE.test(err.message)) return true

  if (CREDIT_MARKERS.some((m) => err.message.includes(m))) return true

  return false
}
