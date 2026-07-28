/**
 * Country → Continent mapping for CineMetrics feedback.
 * ISO 3166-1 alpha-2 → continent name.
 * Used for "yellow" proximity in the country column.
 */

const COUNTRY_CONTINENT: Record<string, string> = {
  // North America
  US: 'north_america',
  CA: 'north_america',
  MX: 'north_america',
  CU: 'north_america',
  JM: 'north_america',
  HT: 'north_america',
  DO: 'north_america',
  PR: 'north_america',
  GT: 'north_america',
  HN: 'north_america',
  SV: 'north_america',
  NI: 'north_america',
  CR: 'north_america',
  PA: 'north_america',

  // South America
  BR: 'south_america',
  AR: 'south_america',
  CO: 'south_america',
  CL: 'south_america',
  PE: 'south_america',
  VE: 'south_america',
  EC: 'south_america',
  UY: 'south_america',
  PY: 'south_america',
  BO: 'south_america',

  // Europe
  GB: 'europe',
  FR: 'europe',
  DE: 'europe',
  IT: 'europe',
  ES: 'europe',
  PT: 'europe',
  NL: 'europe',
  BE: 'europe',
  CH: 'europe',
  AT: 'europe',
  SE: 'europe',
  NO: 'europe',
  DK: 'europe',
  FI: 'europe',
  IE: 'europe',
  PL: 'europe',
  CZ: 'europe',
  HU: 'europe',
  RO: 'europe',
  GR: 'europe',
  HR: 'europe',
  RS: 'europe',
  BG: 'europe',
  SK: 'europe',
  UA: 'europe',
  LT: 'europe',
  LV: 'europe',
  EE: 'europe',
  IS: 'europe',
  LU: 'europe',
  SI: 'europe',
  BA: 'europe',
  MK: 'europe',
  AL: 'europe',
  ME: 'europe',
  MT: 'europe',
  CY: 'europe',

  // Asia
  JP: 'asia',
  KR: 'asia',
  CN: 'asia',
  IN: 'asia',
  TW: 'asia',
  HK: 'asia',
  TH: 'asia',
  VN: 'asia',
  PH: 'asia',
  ID: 'asia',
  MY: 'asia',
  SG: 'asia',
  PK: 'asia',
  BD: 'asia',
  LK: 'asia',
  NP: 'asia',
  MM: 'asia',
  KH: 'asia',
  LA: 'asia',
  MN: 'asia',
  KZ: 'asia',
  UZ: 'asia',

  // Middle East
  TR: 'middle_east',
  IR: 'middle_east',
  IL: 'middle_east',
  SA: 'middle_east',
  AE: 'middle_east',
  EG: 'middle_east',
  LB: 'middle_east',
  JO: 'middle_east',
  IQ: 'middle_east',
  SY: 'middle_east',
  QA: 'middle_east',
  KW: 'middle_east',
  BH: 'middle_east',
  OM: 'middle_east',
  YE: 'middle_east',
  PS: 'middle_east',

  // Africa
  ZA: 'africa',
  NG: 'africa',
  KE: 'africa',
  GH: 'africa',
  ET: 'africa',
  TZ: 'africa',
  MA: 'africa',
  TN: 'africa',
  DZ: 'africa',
  SN: 'africa',
  CI: 'africa',
  CM: 'africa',
  UG: 'africa',
  ZW: 'africa',
  MZ: 'africa',
  AO: 'africa',
  RW: 'africa',

  // Oceania
  AU: 'oceania',
  NZ: 'oceania',
  FJ: 'oceania',
  PG: 'oceania',

  // Russia (spans both)
  RU: 'europe',
}

/**
 * Returns the continent for an ISO alpha-2 country code.
 * Falls back to 'other' for unmapped countries.
 */
export function getContinent(countryCode: string): string {
  return COUNTRY_CONTINENT[countryCode.toUpperCase()] ?? 'other'
}

/**
 * Check if two sets of countries share the same continent.
 */
export function shareSameContinent(
  countriesA: string[],
  countriesB: string[],
): boolean {
  const continentsA = new Set(countriesA.map(getContinent))
  const continentsB = new Set(countriesB.map(getContinent))

  for (const c of continentsA) {
    if (c !== 'other' && continentsB.has(c)) return true
  }
  return false
}
