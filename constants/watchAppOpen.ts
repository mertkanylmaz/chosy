/**
 * "Dürüst uygulama açma" allowlist'i (Faz 2-8, Karar 3b).
 *
 * Bir sağlayıcı satırı dışarı YALNIZ burada kayıtlıysa açılır ve etiket filmi değil SERVİSİ
 * vaat eder ("Netflix'i aç" / "Open Netflix"). URL servisin ANA SAYFASIDIR — arama / film
 * adresi YASAK. Girdi, kurucunun cihaz testinde universal link'in uygulamayı GERÇEKTEN açtığı
 * doğrulandıktan sonra eklenir; her girdinin yanına doğrulama tarihi yorum olarak yazılır.
 *
 * Anahtar: `utils/watchProviderBrands.brandOf(p).key` (ör. 'netflix', 'prime').
 *
 * BOŞ BAŞLAR. Örnek (EKLEME — doğrulanmadı):
 *   netflix: { homeUrl: 'https://www.netflix.com/', verifiedOn: '2026-11-xx' },
 */
export interface AppOpenEntry {
  /** Servisin ana sayfası; https zorunlu. */
  readonly homeUrl: string;
  /** Kurucunun cihaz testiyle doğruladığı gün (YYYY-MM-DD). */
  readonly verifiedOn: string;
}

export const APP_OPEN_ALLOWLIST: Readonly<Record<string, AppOpenEntry>> = {};

/** Marka allowlist'teyse girdi; değilse (ya da https değilse) null. */
export function appOpenFor(
  brandKey: string,
  allowlist: Readonly<Record<string, AppOpenEntry>> = APP_OPEN_ALLOWLIST,
): AppOpenEntry | null {
  const entry = allowlist[brandKey];
  if (entry === undefined) return null;
  return /^https:\/\//.test(entry.homeUrl) ? entry : null;
}
