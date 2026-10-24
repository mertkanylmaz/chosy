/**
 * parse-mood yanıtına eklenen kalan-hak alanları (MONEY-1C). Saf fonksiyon.
 *
 * İstemci ücretsiz hakkı göstermek için okur; eski istemciler bilinmeyen alanı
 * görmezden gelir (geriye uyumlu).
 *   remaining / limit = number → o günün kalan hakkı / toplam hakkı
 *   remaining / limit = null   → sınırsız (premium, legacy_mood_access)
 *   alanlar yok                → kota okunamadı (fail-open yolu) — tahmin edilmez
 */

/** `check_and_consume_quota` sınırsız tier/legacy için bu değeri döndürür (115). */
export const UNLIMITED_LIMIT = 999999

export interface QuotaFields {
  remaining?: number | null
  limit?: number | null
}

/**
 * @param quotaResult `check_and_consume_quota` dönüşü (`used`, `limit`)
 * @param refunded    iade yapıldıysa `used` bir azaltılır (iade sonrası kalan hak)
 */
export function quotaFields(
  quotaResult: Record<string, unknown> | undefined,
  refunded = false,
): QuotaFields {
  const used = quotaResult?.used
  const limit = quotaResult?.limit
  if (typeof used !== 'number' || typeof limit !== 'number') return {}
  if (limit >= UNLIMITED_LIMIT) return { remaining: null, limit: null }
  const usedNow = refunded ? Math.max(used - 1, 0) : used
  return { remaining: Math.max(limit - usedNow, 0), limit }
}
