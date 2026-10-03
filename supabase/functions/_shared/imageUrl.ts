/**
 * Görsel URL geçerliliği — P-1c A (3 Eki 2026).
 *
 * `films.poster_url` / `backdrop_url` iki biçimde yaşıyor: tam TMDb URL'i ve
 * `scripts/seed-database.ts` kaynaklı ham `poster_path` (`/abc.jpg`). Ham yol
 * istemcide geçerli bir URI değildir; Spotlight bu alanları normalize etmeden
 * `puzzle_data.backdrop_url`'e ve `revealed_solution.poster_url`'e taşır.
 * Bu yüzden Spotlight çözüm havuzu yalnız mutlak `http(s)` URL'li filmleri
 * kabul eder.
 *
 * İstemcideki karşılığı `utils/posterUrl.ts` → `resultPosterUrl`
 * (`invalid_uri`): aynı kural, iki uç.
 *
 * Saf: ağ/DB yok. Raporlama çağıranın işi.
 */

/** Boşluksuz, `http://` ya da `https://` ile başlayan mutlak URL mi. */
export function isAbsoluteHttpUrl(value: string | null | undefined): boolean {
  if (value == null) return false
  const v = value.trim()
  if (v === '' || /\s/.test(v)) return false
  return /^https?:\/\/[^/]+\/.+/i.test(v)
}
