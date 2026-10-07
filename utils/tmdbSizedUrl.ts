/**
 * TMDb görsel boyutu yeniden yazımı — Spotlight kare katmanları (Sprint 5).
 *
 * `puzzle_data.backdrop_url` TMDb `original` boyutunda gelir (birkaç MB, cihazda
 * çözme + bulanıklaştırma maliyeti). Spotlight oynanışta iki kat yığar; boyut
 * yüzeye göre istemcide indirilir. Sunucunun döndürdüğü değişmez.
 *
 * Saf: ağ/RN importu yok, asla fırlatmaz. `utils/posterUrl.ts`'ten ayrı: o
 * poster için "küçültme yok" kuralını taşır; burada kare için boyut AÇIKÇA seçilir.
 */

/**
 * TMDb backdrop boyutları: w300 · w780 · w1280 · original (configuration API).
 * Yüzey başına TEK sabit — render boyutu × 3× ekran hesabıyla seçildi.
 */
export const SPOTLIGHT_IMAGE_SIZE = {
  /** Oynanış katmanları: kutu ≤ ~400pt → ~1200px */
  hero: 'w1280',
  /** Sonuç karesi: oynanış kutusuyla aynı */
  resultStill: 'w1280',
  /** Teaser karesi: 160pt → ~480px */
  teaser: 'w780',
  /** Bonus kartı: 56pt kare, 16:9 kaynak cover → ~300px */
  bonusCard: 'w300',
} as const;

/** Yalnız `https://image.tmdb.org/t/p/<boyut>/<dosya>` — sorgu/parça korunur. */
const TMDB_SIZED_PATTERN =
  /^(https:\/\/image\.tmdb\.org\/t\/p\/)(w\d+|original)(\/[^?#\s]+)([?#].*)?$/;

/**
 * Desene uyan TMDb URL'inde boyut segmentini `size` ile değiştirir.
 * Uymayan her girdi (boş, undefined, başka host, göreli yol) AYNEN döner.
 */
export function tmdbSizedUrl(url: string | null | undefined, size: string): string {
  if (typeof url !== 'string') return '';
  const match = TMDB_SIZED_PATTERN.exec(url);
  if (!match) return url;
  const [, prefix, , file, tail] = match;
  return `${prefix}${size}${file}${tail ?? ''}`;
}
