/**
 * Kişisel tekrar dışlama (MOOD-VEC-2d, yalnız parse-mood v2 yolu). Saf fonksiyon — ağ, DB yok.
 *
 * `mood_searches.recommended_film_ids` istemcide rerank + kalite süzgecinden SONRA, gösterim
 * sırasıyla yazılır; yani ilk 4 eleman kullanıcının ilk gördüğü 4 filmdir.
 */

export const RECENT_SEARCHES = 5
export const SHOWN_PER_SEARCH = 4

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * `rows`: en yeni → en eski sıralı mood_searches satırları. İlk `RECENT_SEARCHES` satırın her
 * birinin ilk `SHOWN_PER_SEARCH` film id'si, tekrarsız, ilk görülme sırasıyla döner.
 * UUID olmayan elemanlar atılır (RPC `uuid[]` bekler; bozuk tek eleman tüm çağrıyı düşürmesin).
 */
export function collectRecentShown(
  rows: ReadonlyArray<{ recommended_film_ids: unknown }>,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const row of rows.slice(0, RECENT_SEARCHES)) {
    const ids = row.recommended_film_ids
    if (!Array.isArray(ids)) continue
    for (const id of ids.slice(0, SHOWN_PER_SEARCH)) {
      if (typeof id !== 'string' || !UUID_RE.test(id)) continue
      const key = id.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(key)
    }
  }
  return out
}
