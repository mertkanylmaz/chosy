/**
 * Sağlayıcı → resmî arama bağlantısı (Faz 2-3). TEK DOSYA: provider_id → URL şablonu.
 * Saf, RN / ağ yok. Şablondaki `{t}` film başlığıdır (`encodeURIComponent`).
 *
 * Bağlantılar sağlayıcının KENDİ alan adındaki arama sayfalarıdır (universal link): uygulama
 * yüklüyse iOS uygulamayı açar, değilse tarayıcıda site açılır. Kimlikler TMDB
 * `/watch/providers/movie` listesinden (1 Kas 2026, TR/US/GB) doğrulandı.
 *
 * Tabloda OLMAYAN sağlayıcı → JustWatch film araması (bkz. moodWatchTarget). TR yerel
 * servislerinden TOD (1826), tabii (2235), Tivibu (1833), D-Smart Go (1905) için doğrulanmış bir
 * arama URL biçimi yok → bilerek tabloda değil. BluTV / Exxen / Gain TMDB TR listesinde YOK.
 */

/**
 * `opensApp` (Faz 2-4): bu sağlayıcının arama URL'sinin uygulamayı (universal link) GERÇEKTEN
 * açtığı kurucu cihaz testiyle doğrulandı mı?
 *   'verified'   → CTA sağlayıcının kendi arama URL'sini açar (link_kind=provider)
 *   'unverified' → CTA JustWatch film aramasını açar (link_kind=justwatch); JustWatch kendi
 *                  derin bağlantılarıyla uygulamayı açar
 * Şimdilik HEPSİ 'unverified'. Cihaz testinden sonra kurucu doğrulananları 'verified' yapar
 * (Netflix, Prime, Disney+, Apple TV, Max, YouTube, Google Play): `entry(url, 'verified')`.
 */
export type OpensApp = 'verified' | 'unverified';

interface ProviderLink {
  readonly url: string;
  readonly opensApp: OpensApp;
}

function entry(url: string, opensApp: OpensApp = 'unverified'): ProviderLink {
  return { url, opensApp };
}

const TEMPLATES: Readonly<Record<number, ProviderLink>> = {
  // Netflix (+ Standard with Ads, Kids)
  8: entry('https://www.netflix.com/search?q={t}'),
  1796: entry('https://www.netflix.com/search?q={t}'),
  175: entry('https://www.netflix.com/search?q={t}'),
  // Prime Video (US/GB: 9, TR: 119) + Amazon Video (mağaza) + reklamlı varyantlar
  9: entry('https://www.primevideo.com/search/?phrase={t}'),
  119: entry('https://www.primevideo.com/search/?phrase={t}'),
  10: entry('https://www.primevideo.com/search/?phrase={t}'),
  613: entry('https://www.primevideo.com/search/?phrase={t}'),
  2100: entry('https://www.primevideo.com/search/?phrase={t}'),
  // Disney+
  337: entry('https://www.disneyplus.com/search/{t}'),
  // HBO Max (TMDB'de "HBO Max", eski "Max")
  1899: entry('https://play.hbomax.com/search?q={t}'),
  384: entry('https://play.hbomax.com/search?q={t}'),
  // Apple TV (abonelik) + Apple TV Store (kiralık / satın alma)
  350: entry('https://tv.apple.com/search?term={t}'),
  2: entry('https://tv.apple.com/search?term={t}'),
  // Google Play Filmler
  3: entry('https://play.google.com/store/search?q={t}&c=movies'),
  // YouTube (film mağazası + ücretsiz)
  192: entry('https://www.youtube.com/results?search_query={t}'),
  235: entry('https://www.youtube.com/results?search_query={t}'),
  // Hulu
  15: entry('https://www.hulu.com/search?q={t}'),
  // Paramount+
  531: entry('https://www.paramountplus.com/search/?q={t}'),
  2303: entry('https://www.paramountplus.com/search/?q={t}'),
  2616: entry('https://www.paramountplus.com/search/?q={t}'),
  2304: entry('https://www.paramountplus.com/search/?q={t}'),
  // Peacock
  386: entry('https://www.peacocktv.com/search?q={t}'),
  387: entry('https://www.peacocktv.com/search?q={t}'),
  // MUBI
  11: entry('https://mubi.com/en/search/films?query={t}'),
};

/** Sağlayıcı için resmî arama URL'si; tabloda yoksa null (çağıran JustWatch'a düşer). */
export function providerSearchUrl(providerId: number, title: string): string | null {
  const link = TEMPLATES[providerId];
  const t = title.trim();
  if (link === undefined || t.length === 0) return null;
  return link.url.replace('{t}', encodeURIComponent(t));
}

/** Tabloda olmayan sağlayıcı 'unverified' sayılır (uygulamayı açtığı kanıtlanmadı). */
export function opensAppOf(providerId: number): OpensApp {
  return TEMPLATES[providerId]?.opensApp ?? 'unverified';
}

/**
 * JustWatch arama yolları — ülkeye göre YEREL ADLI (`/tr/search` 404 verir). Yalnız cihaz/
 * kurucu tarafından doğrulanmış ülkeler; başka ülke EKLENMEZ, adres tahmin edilmez.
 * GB'nin slug'ı "uk".
 */
const JUSTWATCH_SEARCH_PATH: Readonly<Record<string, string>> = {
  US: 'us/search',
  GB: 'uk/search',
  CA: 'ca/search',
  TR: 'tr/arama',
  DE: 'de/Suche',
  FR: 'fr/recherche',
  ES: 'es/buscar',
  MX: 'mx/buscar',
  IT: 'it/cerca',
  BR: 'br/busca',
};

/** Doğrulanmış ülke için JustWatch film araması; ülke listede yoksa / bölge null / başlık boşsa null. */
export function justWatchSearchUrl(region: string | null, title: string): string | null {
  const t = title.trim();
  if (region === null || t.length === 0) return null;
  const path = JUSTWATCH_SEARCH_PATH[region.trim().toUpperCase()];
  if (path === undefined) return null;
  return `https://www.justwatch.com/${path}?q=${encodeURIComponent(t)}`;
}

/**
 * TMDB `watch/providers` yanıtındaki `results[region].link` (themoviedb.org/movie/{id}/watch?locale=XX).
 * Yalnız themoviedb.org https adresi kabul edilir; yoksa / başka alan adıysa null.
 */
export function tmdbWatchLink(link: string | undefined | null): string | null {
  if (typeof link !== 'string') return null;
  return /^https:\/\/www\.themoviedb\.org\//.test(link) ? link : null;
}

/** Eşlemesi olan kimlikler (rapor / test). */
export function mappedProviderIds(): number[] {
  return Object.keys(TEMPLATES).map(Number);
}

/** Düğme metninde gösterilecek ad: TMDB'nin mağaza/kanal adları sadeleştirilir. */
export function providerDisplayName(name: string): string {
  const n = name.trim();
  if (n === 'Apple TV Store') return 'Apple TV';
  if (n === 'Amazon Video' || n === 'Amazon Prime Video') return 'Prime Video';
  return n;
}
