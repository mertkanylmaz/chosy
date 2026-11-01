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

const TEMPLATES: Readonly<Record<number, string>> = {
  // Netflix (+ Standard with Ads, Kids)
  8: 'https://www.netflix.com/search?q={t}',
  1796: 'https://www.netflix.com/search?q={t}',
  175: 'https://www.netflix.com/search?q={t}',
  // Prime Video (US/GB: 9, TR: 119) + Amazon Video (mağaza) + reklamlı varyantlar
  9: 'https://www.primevideo.com/search/?phrase={t}',
  119: 'https://www.primevideo.com/search/?phrase={t}',
  10: 'https://www.primevideo.com/search/?phrase={t}',
  613: 'https://www.primevideo.com/search/?phrase={t}',
  2100: 'https://www.primevideo.com/search/?phrase={t}',
  // Disney+
  337: 'https://www.disneyplus.com/search/{t}',
  // HBO Max (TMDB'de "HBO Max", eski "Max")
  1899: 'https://play.hbomax.com/search?q={t}',
  384: 'https://play.hbomax.com/search?q={t}',
  // Apple TV (abonelik) + Apple TV Store (kiralık / satın alma)
  350: 'https://tv.apple.com/search?term={t}',
  2: 'https://tv.apple.com/search?term={t}',
  // Google Play Filmler
  3: 'https://play.google.com/store/search?q={t}&c=movies',
  // YouTube (film mağazası + ücretsiz)
  192: 'https://www.youtube.com/results?search_query={t}',
  235: 'https://www.youtube.com/results?search_query={t}',
  // Hulu
  15: 'https://www.hulu.com/search?q={t}',
  // Paramount+
  531: 'https://www.paramountplus.com/search/?q={t}',
  2303: 'https://www.paramountplus.com/search/?q={t}',
  2616: 'https://www.paramountplus.com/search/?q={t}',
  2304: 'https://www.paramountplus.com/search/?q={t}',
  // Peacock
  386: 'https://www.peacocktv.com/search?q={t}',
  387: 'https://www.peacocktv.com/search?q={t}',
  // MUBI
  11: 'https://mubi.com/en/search/films?query={t}',
};

/** Sağlayıcı için resmî arama URL'si; tabloda yoksa null (çağıran JustWatch'a düşer). */
export function providerSearchUrl(providerId: number, title: string): string | null {
  const tpl = TEMPLATES[providerId];
  const t = title.trim();
  if (tpl === undefined || t.length === 0) return null;
  return tpl.replace('{t}', encodeURIComponent(t));
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
