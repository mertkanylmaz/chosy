/** TMDb API istek fonksiyonları */

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY ?? '';

/** TMDB language parametresi — her zaman İngilizce (posterler + açıklamalar EN olmalı) */
function tmdbLanguage(): string {
  return 'en-US';
}

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
 * Dil parametresi uygulamanın aktif diline göre dinamik olarak belirlenir.
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
    `&language=${tmdbLanguage()}` +
    `&include_image_language=en,null` +
    `&query=${encodeURIComponent(query.trim())}` +
    `&page=1`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDb arama başarısız (${res.status})`);

  const data = (await res.json()) as { results: TmdbSearchResult[] };
  return (data.results ?? []).slice(0, 10);
}

// ─── Film Detay ───────────────────────────────────────────────────────────────

/** TMDb film detay yanıtındaki ilgili alanlar */
export interface TmdbMovieDetails {
  title: string;
  overview: string;
  poster_path: string | null;
  runtime: number | null;
  vote_average: number | null;
  release_date: string | null;
  genres?: Array<{ id: number; name: string }>;
  production_countries?: Array<{ iso_3166_1: string; name: string }>;
  /** append_to_response=videos ile gelen video listesi */
  videos?: { results: TmdbVideo[] };
  /** append_to_response=credits ile gelen cast/crew */
  credits?: TmdbCredits;
}

// ─── Credits ──────────────────────────────────────────────────────────────────

/** TMDb credits cast üyesi */
export interface TmdbCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

/** TMDb credits crew üyesi */
export interface TmdbCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

/** TMDb /credits yanıtı */
export interface TmdbCredits {
  cast: TmdbCastMember[];
  crew: TmdbCrewMember[];
}

// ─── Videos ──────────────────────────────────────────────────────────────────

/** TMDb video (fragman vb.) objesi */
export interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
}

// ─── Watch Providers ──────────────────────────────────────────────────────────

/** Tek bir streaming platform objesi */
export interface TmdbProvider {
  logo_path: string;
  provider_id: number;
  provider_name: string;
  display_priority: number;
}

/** Bölgeye özel watch provider sonucu */
export interface TmdbWatchProviders {
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
  /**
   * TMDB'nin bölgeye özel "nerede izlenir" sayfası. TMDB yanıtında ZATEN
   * geliyordu, tipte eksikti (C.9b-2'de eklendi). Sağlayıcı logolarının
   * dokunulabilir olması için tek meşru hedef budur: TMDB attribution
   * koşulları doğrudan derin bağlantı kurmayı değil bu sayfaya yönlendirmeyi
   * öngörür. Yoksa (`undefined`) logolar dokunulamaz kalır — çalışmayan bir
   * dokunma alanı sunulmaz.
   */
  link?: string;
}

/**
 * TMDb film detaylarını EN dilinde getirir.
 * Film detay sayfasında DB'deki Türkçe overview'u override etmek için kullanılır.
 *
 * @param tmdbId - TMDb film ID'si (films.tmdb_id)
 * @returns EN title + overview + poster_path, veya null (hata/not found durumunda)
 */
export async function fetchMovieDetails(tmdbId: number): Promise<TmdbMovieDetails | null> {
  if (!tmdbId) return null;

  try {
    const url =
      `${TMDB_BASE_URL}/movie/${tmdbId}` +
      `?api_key=${TMDB_API_KEY}` +
      `&language=${tmdbLanguage()}` +
      `&include_image_language=en,null` +
      `&append_to_response=videos,credits`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as TmdbMovieDetails;
    return {
      title: data.title ?? '',
      overview: data.overview ?? '',
      poster_path: data.poster_path ?? null,
      runtime: data.runtime ?? null,
      vote_average: data.vote_average ?? null,
      release_date: data.release_date ?? null,
      genres: data.genres ?? [],
      production_countries: data.production_countries ?? [],
      videos: data.videos,
      credits: data.credits,
    };
  } catch {
    return null;
  }
}

/**
 * Film oyuncu ve ekip bilgilerini (credits) TMDB'den çeker.
 *
 * @param tmdbId - TMDb film ID'si
 * @returns Cast + crew listesi, veya null (hata durumunda)
 */
export async function fetchMovieCredits(tmdbId: number): Promise<TmdbCredits | null> {
  if (!tmdbId) return null;
  try {
    const url =
      `${TMDB_BASE_URL}/movie/${tmdbId}/credits` +
      `?api_key=${TMDB_API_KEY}` +
      `&language=${tmdbLanguage()}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as TmdbCredits;
    return { cast: data.cast ?? [], crew: data.crew ?? [] };
  } catch {
    return null;
  }
}

/**
 * Film video listesini (fragmanlar, klipler) TMDB'den çeker.
 *
 * @param tmdbId - TMDb film ID'si
 * @returns Video listesi (boş dizi = veri yok)
 */
export async function fetchMovieVideos(tmdbId: number): Promise<TmdbVideo[]> {
  if (!tmdbId) return [];
  try {
    // İngilizce video yoksa null döner; fallback TR/diğer dil trailerları da yüklenir
    const url =
      `${TMDB_BASE_URL}/movie/${tmdbId}/videos` +
      `?api_key=${TMDB_API_KEY}` +
      `&language=${tmdbLanguage()}` +
      `&include_video_language=en,null`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { results: TmdbVideo[] };
    return data.results ?? [];
  } catch {
    return [];
  }
}

/**
 * Film streaming platform bilgilerini (watch/providers) TMDB'den çeker.
 * Belirtilen ülke bölgesine göre filtreler.
 *
 * @param tmdbId  - TMDb film ID'si
 * @param region  - ISO 3166-1 alpha-2 ülke kodu (varsayılan: 'US')
 * @returns Flatrate / rent / buy provider'ları, veya null
 */
export async function fetchMovieWatchProviders(
  tmdbId: number,
  region = 'US',
): Promise<TmdbWatchProviders | null> {
  const result = await fetchWatchProvidersResult(tmdbId, region);
  return result.status === 'ok' ? result.providers : null;
}

/**
 * `fetchMovieWatchProviders`'ın AYRIMLI hâli — C.9b-UI C2e.
 *
 * Eski imza "bu bölgede sağlayıcı yok" ile "istek başarısız" durumlarının
 * İKİSİNE de `null` dönüyordu. Champion ekranında "Nerede izlenir" BİRİNCİL
 * eylem olunca bu ayrım zorunlu hâle geldi: boşta kullanıcıya dürüst bir
 * bilgi ("bölgende akışta yok") verilir, hatada ise "yeniden dene" sunulur.
 * İkisini karıştırmak ya var olmayan bir arızayı bildirmek ya da gerçek bir
 * arızayı sessizce yutmaktır — K-44'ün iki yönü.
 *
 * Eski fonksiyon SİLİNMEDİ, bunun üzerine ince bir sarmalayıcı oldu:
 * `app/film/[id].tsx` onu kullanmaya devam ediyor, davranışı değişmedi.
 */
export type WatchProvidersResult =
  /** İstek başarılı ve bölgede en az bir sağlayıcı var. */
  | { status: 'ok'; providers: TmdbWatchProviders }
  /** İstek BAŞARILI ama bu bölgede sağlayıcı yok. Hata değil, veri durumu. */
  | { status: 'empty' }
  /** İstek başarısız (ağ, 4xx/5xx, bozuk gövde). Tekrar denenebilir. */
  | { status: 'error' };

export async function fetchWatchProvidersResult(
  tmdbId: number,
  region = 'US',
): Promise<WatchProvidersResult> {
  // Geçersiz kimlik bir ağ hatası değil — sorulacak bir şey yok.
  if (!tmdbId) return { status: 'empty' };
  try {
    const url =
      `${TMDB_BASE_URL}/movie/${tmdbId}/watch/providers` +
      `?api_key=${TMDB_API_KEY}`;
    const res = await fetch(url);
    if (!res.ok) return { status: 'error' };
    const data = (await res.json()) as { results: Record<string, TmdbWatchProviders> };
    const providers = data.results?.[region];
    return providers ? { status: 'ok', providers } : { status: 'empty' };
  } catch {
    return { status: 'error' };
  }
}
