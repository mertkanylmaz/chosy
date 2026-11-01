/**
 * "Nerede izlenir" bölgesi — tek çözümleyici (Faz 2-4). Saf: RN / ağ / depo yok.
 *
 * Öncelik (üstteki kazanır):
 *   1. user       — kullanıcının "Değiştir" ile seçtiği ülke (AsyncStorage)
 *   2. storefront — App Store hesabının ülkesi (RevenueCat `getStorefront()`)
 *   3. device     — cihaz bölgesi (`getLocales()[0].regionCode`)
 *   4. none       — hiçbiri → `null`; başka bölgeye DÜŞÜLMEZ ('US' yok — V-2 Tur D)
 *
 * Neden storefront cihaz bölgesinden önce: iOS "Bölge" ayarı çoğu kullanıcıda ABD'de kalır
 * (EN dil + ABD bölgesi), oysa katalog hakları hesabın bulunduğu mağazaya bağlıdır.
 *
 * Girdi alpha-2 ya da alpha-3 olabilir (iOS storefront "TUR" döner); çıktı hep alpha-2 BÜYÜK harf.
 */

import { WATCH_REGIONS, type WatchRegionLanguage } from '../constants/watchRegions';

export type WatchRegionSource = 'user' | 'storefront' | 'device' | 'none';

export const WATCH_REGION_STORAGE_KEY = 'chosy_watch_region';

/** ISO 3166-1 alpha-3 → alpha-2 (TMDB watch provider bölgeleri). */
const ALPHA3_TO_ALPHA2: Readonly<Record<string, string>> = {
  AND: 'AD', ARE: 'AE', ATG: 'AG', ALB: 'AL', AGO: 'AO', ARG: 'AR', AUT: 'AT', AUS: 'AU',
  AZE: 'AZ', BIH: 'BA', BRB: 'BB', BEL: 'BE', BFA: 'BF', BGR: 'BG', BHR: 'BH', BMU: 'BM',
  BOL: 'BO', BRA: 'BR', BHS: 'BS', BLR: 'BY', BLZ: 'BZ', CAN: 'CA', COD: 'CD', CHE: 'CH',
  CIV: 'CI', CHL: 'CL', CMR: 'CM', COL: 'CO', CRI: 'CR', CUB: 'CU', CPV: 'CV', CYP: 'CY',
  CZE: 'CZ', DEU: 'DE', DNK: 'DK', DOM: 'DO', DZA: 'DZ', ECU: 'EC', EST: 'EE', EGY: 'EG',
  ESP: 'ES', FIN: 'FI', FJI: 'FJ', FRA: 'FR', GBR: 'GB', GUF: 'GF', GHA: 'GH', GIB: 'GI',
  GLP: 'GP', GNQ: 'GQ', GRC: 'GR', GTM: 'GT', GUY: 'GY', HKG: 'HK', HND: 'HN', HRV: 'HR',
  HUN: 'HU', IDN: 'ID', IRL: 'IE', ISR: 'IL', IND: 'IN', IRQ: 'IQ', ISL: 'IS', ITA: 'IT',
  JAM: 'JM', JOR: 'JO', JPN: 'JP', KEN: 'KE', KOR: 'KR', KWT: 'KW', LBN: 'LB', LCA: 'LC',
  LIE: 'LI', LTU: 'LT', LUX: 'LU', LVA: 'LV', LBY: 'LY', MAR: 'MA', MCO: 'MC', MDA: 'MD',
  MNE: 'ME', MDG: 'MG', MKD: 'MK', MLI: 'ML', MLT: 'MT', MUS: 'MU', MWI: 'MW', MEX: 'MX',
  MYS: 'MY', MOZ: 'MZ', NER: 'NE', NGA: 'NG', NIC: 'NI', NLD: 'NL', NOR: 'NO', NZL: 'NZ',
  OMN: 'OM', PAN: 'PA', PER: 'PE', PYF: 'PF', PNG: 'PG', PHL: 'PH', PAK: 'PK', POL: 'PL',
  PSE: 'PS', PRT: 'PT', PRY: 'PY', QAT: 'QA', ROU: 'RO', SRB: 'RS', RUS: 'RU', SAU: 'SA',
  SYC: 'SC', SWE: 'SE', SGP: 'SG', SVN: 'SI', SVK: 'SK', SMR: 'SM', SEN: 'SN', SLV: 'SV',
  TCA: 'TC', TCD: 'TD', THA: 'TH', TUN: 'TN', TUR: 'TR', TTO: 'TT', TWN: 'TW', TZA: 'TZ',
  UKR: 'UA', UGA: 'UG', USA: 'US', URY: 'UY', VAT: 'VA', VEN: 'VE', XKX: 'XK', YEM: 'YE',
  ZAF: 'ZA', ZMB: 'ZM', ZWE: 'ZW',
};

/**
 * Ham ülke kodunu (alpha-2 ya da alpha-3, herhangi bir harf boyu) alpha-2 BÜYÜK harfe çevirir.
 * Tanınmayan / geçersiz değer (null, "419", bilinmeyen alpha-3) → null.
 */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(code)) return code;
  if (/^[A-Z]{3}$/.test(code)) return ALPHA3_TO_ALPHA2[code] ?? null;
  return null;
}

export interface WatchRegionInputs {
  /** Kullanıcının seçimi (AsyncStorage'dan okunan ham değer). */
  chosen: string | null;
  /** `Purchases.getStorefront()?.countryCode` ham değeri. */
  storefront: string | null;
  /** `getLocales()[0].regionCode` ham değeri. */
  device: string | null;
}

export interface ResolvedWatchRegion {
  region: string | null;
  source: WatchRegionSource;
}

export function resolveWatchRegion(inputs: WatchRegionInputs): ResolvedWatchRegion {
  const tiers: ReadonlyArray<readonly [WatchRegionSource, string | null]> = [
    ['user', inputs.chosen],
    ['storefront', inputs.storefront],
    ['device', inputs.device],
  ];
  for (const [source, raw] of tiers) {
    const region = normalizeCountryCode(raw);
    if (region !== null) return { region, source };
  }
  return { region: null, source: 'none' };
}

// ─── Ülke seçici listesi ──────────────────────────────────────────────────────

export interface WatchRegionOption {
  code: string;
  name: string;
}

/** Ad (seçili dilde), İngilizce ad ya da kod içinde arar; ada göre sıralı döner. */
export function listWatchRegions(language: WatchRegionLanguage, query: string): WatchRegionOption[] {
  const locale = language === 'tr' ? 'tr' : 'en';
  const q = query.trim().toLocaleLowerCase(locale);
  return Object.entries(WATCH_REGIONS)
    .map(([code, names]) => ({ code, name: names[language], en: names.en }))
    .filter(
      (r) =>
        q.length === 0 ||
        r.name.toLocaleLowerCase(locale).includes(q) ||
        r.en.toLocaleLowerCase('en').includes(q) ||
        r.code.toLocaleLowerCase('en') === q,
    )
    .sort((a, b) => a.name.localeCompare(b.name, locale))
    .map(({ code, name }) => ({ code, name }));
}
