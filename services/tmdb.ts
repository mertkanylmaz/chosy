/** TMDb API istek fonksiyonları */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '';

export { TMDB_BASE_URL, TMDB_API_KEY };

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** TMDb film arama sonucu */
export interface TmdbSearchResult {
  id: number;
  title: string;
  /** "YYYY-MM-DD" formatında çıkış tarihi */
  release_date: string;
  poster_path: string | null;
  overview: string;
}

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/**
 * TMDb poster path'ini tam URL'e dönüştürür.
 *
 * @param posterPath - TMDb'den gelen "/abc123.jpg" formatındaki path
 * @param size       - TMDb görsel boyutu. Varsayılan: 'w185'
 * @returns Tam poster URL'i veya path null ise boş string
 */
export function getPosterUrl(posterPath: string | null, size = 'w185'): string | null {
  if (!posterPath) return null;
  if (posterPath.startsWith('http')) return posterPath;
  return `https://image.tmdb.org/t/p/${size}${posterPath}`;
}

// ─── API Fonksiyonları ────────────────────────────────────────────────────────

/**
 * TMDb film arama uç noktasını sorgular.
 * Sonuçları Türkçe dil tercihiyle döndürür.
 *
 * @param query - Arama terimi
 * @returns İlk 10 arama sonucu
 * @throws Ağ hatası veya API hata kodu durumunda
 */
export async function searchMovies(query: string): Promise<TmdbSearchResult[]> {
  if (!query.trim()) return [];

  const url =
    `${TMDB_BASE_URL}/search/movie` +
    `?api_key=${TMDB_API_KEY}` +
    `&language=tr-TR` +
    `&query=${encodeURIComponent(query.trim())}` +
    `&page=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb arama başarısız (${res.status})`);

  const data = (await res.json()) as { results: TmdbSearchResult[] };
  return (data.results ?? []).slice(0, 10);
}
