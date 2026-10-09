/**
 * revenuecat-webhook — olayın `environment` alanı (R-B-0e).
 *
 * RC her olayda `environment: "SANDBOX" | "PRODUCTION"` gönderir (TRANSFER'da
 * doküman "opsiyonel" diyor). `subscriptions.environment` (migration 130)
 * sandbox ve prod satırlarını ayırır. Alan yoksa veya tanınmayan bir değerse
 * VARSAYILAN YAZILMAZ: çağıran Sentry error + 500 üretir (CLAUDE.md kural 1).
 * Bunun tek istisnası RC'nin `TEST` olayıdır — o, yazım dalına hiç girmez.
 *
 * Saf modül: import yok.
 */

export type RcEnvironment = 'PRODUCTION' | 'SANDBOX'

/** Tam eşitlik; büyük/küçük harf veya boşluk toleransı YOK (kolon CHECK'iyle aynı küme). */
export function parseRcEnvironment(value: unknown): RcEnvironment | null {
  return value === 'PRODUCTION' || value === 'SANDBOX' ? value : null
}

/**
 * Yazım yapmadan 200 dönülen olay tipi. RC dashboard'undaki "Send test event"
 * düğmesi bunu gönderir; `product_id`/`app_user_id` anlamsızdır.
 */
export function isRcTestEvent(type: unknown): boolean {
  return type === 'TEST'
}
