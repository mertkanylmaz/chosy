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

/**
 * Rozet için asgari tasarruf (%). Altında "SAVE x%" rozeti gösterilmez
 * (R-5 madde 10): küçük bir yüzde teklifi satmaz, yalnız gürültü olur.
 * Karşılaştırma yuvarlanmış yüzde üzerinden yapılır.
 */
export const MIN_SAVINGS_PERCENT = 10;

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
 * Tasarruf `MIN_SAVINGS_PERCENT` altındaysa, girdi geçersizse veya iki ürünün para birimi
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
  if (percent < MIN_SAVINGS_PERCENT) return null;

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

// ─── Teklif durumu (CTA + açıklama + fiyat satırı, TEK kaynak) ──────────────

/** Ekranda satılan planlar. Lifetime satılmıyor (D-08, §7.3). */
export type OfferPlan = 'annual' | 'monthly';

/** `trial`: ücretsiz deneme vaadi · `paid`: bugün ücret · `unavailable`: ürün/fiyat yok */
export type OfferKind = 'trial' | 'paid' | 'unavailable';

/** `PurchasesStoreProduct`'ın teklif için okunan alanları. */
export interface OfferProduct {
  priceString: string;
  introPrice: PricedProduct['introPrice'];
}

/** i18n anahtarı + parametreleri. Çeviriyi çağıran yapar; bu modül saf kalır. */
export interface OfferCopy {
  key: string;
  params: Record<string, string | number>;
}

export interface Offer {
  plan: OfferPlan;
  kind: OfferKind;
  /** 0 = deneme vaadi yok. */
  trialDays: number;
  /** false = fiyat bilinmiyor; CTA devre dışı olmalı, fiyat UYDURULMAZ. */
  canPurchase: boolean;
  cta: OfferCopy;
  /** Fiyat/yenileme açıklaması. Ürün yoksa null. */
  description: OfferCopy | null;
  /** Plan kartındaki fiyat: `priceString` + `paywall.<unitKey>`. Ürün yoksa null. */
  priceLine: { price: string; unitKey: 'perYear' | 'perMonth' } | null;
}

/**
 * Seçili planın teklifi. 6 durum: {annual, monthly} × {eligible, ineligible,
 * unknown}. CTA, açıklama ve fiyat satırı AYNI girdiden çıkar; birbirleriyle
 * çelişemezler.
 *
 * Deneme kararı (R-5 D):
 *  - Deneme YALNIZ annual üründe. Monthly'de intro offer olsa bile vaat edilmez.
 *  - Deneme metni yalnız (a) ürün için ücretsiz intro offer gerçekten
 *    tanımlıysa (`freeTrialDays > 0`) VE (b) uygunluk KESİN 'eligible' ise.
 *    'unknown' ve 'ineligible' denemesiz akışa düşer — asla vaat edilmez.
 */
export function buildOffer(
  plan: OfferPlan,
  product: OfferProduct | null | undefined,
  eligibility: TrialEligibility,
): Offer {
  const unitKey = plan === 'annual' ? 'perYear' : 'perMonth';
  const continueKey =
    plan === 'annual' ? 'paywall.ctaContinueAnnual' : 'paywall.ctaContinueMonthly';
  const paidKey =
    plan === 'annual' ? 'paywall.offerPaidDescAnnual' : 'paywall.offerPaidDescMonthly';

  if (!product || !product.priceString) {
    return {
      plan,
      kind: 'unavailable',
      trialDays: 0,
      canPurchase: false,
      cta: { key: continueKey, params: {} },
      description: null,
      priceLine: null,
    };
  }

  const price = product.priceString;
  const trialDays = plan === 'annual' ? trialDaysFor(eligibility, product) : 0;

  if (trialDays > 0) {
    return {
      plan,
      kind: 'trial',
      trialDays,
      canPurchase: true,
      cta: { key: 'paywall.ctaTrial', params: { days: trialDays } },
      description: { key: 'paywall.offerTrialDesc', params: { price } },
      priceLine: { price, unitKey },
    };
  }

  return {
    plan,
    kind: 'paid',
    trialDays: 0,
    canPurchase: true,
    cta: { key: continueKey, params: {} },
    description: { key: paidKey, params: { price } },
    priceLine: { price, unitKey },
  };
}
