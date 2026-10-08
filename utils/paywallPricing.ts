/**
 * Paywall fiyat/trial hesapları — saf fonksiyonlar (R-C-1).
 *
 * Girdi RevenueCat `PurchasesStoreProduct`'ın yapısal alt kümesidir; RC'yi
 * import etmez, böylece Deno testi native modül çekmeden koşar.
 *
 * İlke: ekranda görünen her fiyat/gün/yüzde mağaza verisinden hesaplanır.
 * Sabit "$" veya "%50" yoktur; para birimi `currencyCode`'dan gelir.
 */

/** RC `checkTrialOrIntroductoryPriceEligibility` sonucunun sadeleşmiş hali. */
export type TrialEligibility = 'eligible' | 'ineligible' | 'unknown';

/** `PurchasesStoreProduct`'ın bu modülün okuduğu alanları. */
export interface PricedProduct {
  price: number;
  priceString: string;
  currencyCode: string;
  introPrice: {
    price: number;
    periodUnit: string;
    periodNumberOfUnits: number;
  } | null;
}

/** Yıllık planın aylık eşdeğeri ve aylığa göre tasarrufu — gösterime hazır. */
export interface AnnualPricing {
  /** Örn. "$2.50" — `Intl.NumberFormat` + `currencyCode` */
  monthlyEquivalent: string;
  /** Örn. "50%" (en) / "%50" (tr) — locale'e göre */
  savingsPercent: string;
}

/**
 * Ürünün ÜCRETSİZ deneme süresi (gün). Ücretli intro fiyat, ay/yıl birimli
 * intro ve tanımsız birim 0 döner — bunlar "N gün ücretsiz" diye gösterilemez.
 */
export function freeTrialDays(product: Pick<PricedProduct, 'introPrice'>): number {
  const intro = product.introPrice;
  if (!intro || intro.price !== 0) return 0;
  const n = intro.periodNumberOfUnits;
  if (!Number.isInteger(n) || n <= 0) return 0;
  switch (intro.periodUnit.toUpperCase()) {
    case 'DAY': return n;
    case 'WEEK': return n * 7;
    default: return 0;
  }
}

/** Trial yalnız uygunluk KESİN 'eligible' ise vaat edilir; 'unknown' vaat etmez. */
export function trialDaysFor(
  eligibility: TrialEligibility,
  product: Pick<PricedProduct, 'introPrice'>,
): number {
  return eligibility === 'eligible' ? freeTrialDays(product) : 0;
}

/**
 * Yıllık fiyatın aylık eşdeğeri ve aylığa göre tasarruf yüzdesi.
 * Tasarruf yoksa (yüzde ≤ 0), girdi geçersizse veya iki ürünün para birimi
 * farklıysa null: ekran "tasarruf" satırını göstermez, uydurmaz.
 *
 * `Intl.NumberFormat` geçersiz para kodunda RangeError fırlatır — YUTULMAZ,
 * çağıran yakalayıp raporlar.
 */
export function buildAnnualPricing(
  monthly: Pick<PricedProduct, 'price' | 'currencyCode'>,
  annual: Pick<PricedProduct, 'price' | 'currencyCode'>,
  locale: string,
): AnnualPricing | null {
  if (!(monthly.price > 0) || !(annual.price > 0)) return null;
  if (monthly.currencyCode !== annual.currencyCode) return null;

  const percent = Math.round((1 - annual.price / (monthly.price * 12)) * 100);
  if (percent <= 0) return null;

  const money = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: annual.currencyCode,
  });
  const pct = new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 0,
  });
  return {
    monthlyEquivalent: money.format(annual.price / 12),
    savingsPercent: pct.format(percent / 100),
  };
}
