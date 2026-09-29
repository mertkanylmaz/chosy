/**
 * revenuecat-webhook — `public.users` satırı YOKKEN Sentry seviyesi.
 *
 * 29 Eyl 2026 Sentry incelemesi: CHOSY-EDGE-FUNCTIONS-Y'deki 12
 * `APP_USER_NOT_FOUND` olayının hepsi sandbox RENEWAL'dı, yani silinmiş test
 * hesaplarının yenilemeleri. Aboneliği iptal edilmeden silinen hesabın
 * mağaza tarafındaki yaşam döngüsü sürer (yenileme, iptal, süre dolumu,
 * ödeme sorunu) ve bu olaylar beklenen gürültüdür, arıza değil.
 *
 * Ayrım olayın NİTELİĞİNE göre:
 *   - İlk satın alma niteliğindekiler (yeni para alındı): `error`.
 *     Satır yoksa ya istemcinin `ensureAppUser()` upsert'i yarışı kaybetti
 *     ya da kalıcı bir orphan var. İkisi de gerçek arıza.
 *   - Var olan aboneliğin yaşam döngüsü: `warning` ve `expected_deleted_user`
 *     etiketi. PRODUCT_CHANGE / UNCANCELLATION da burada, çünkü silinen
 *     hesabın App Store Ayarlar'ından da gelebilirler (kurucu kararı,
 *     29 Eyl 2026).
 *   - Listede olmayan tip: `error` (güvenli yön). RC yeni bir olay tipi
 *     eklerse görünür kalır.
 *
 * YANIT KODUNU BU MODÜL BELİRLEMEZ: her durumda 500 + `retryable: true`
 * (index.ts `appUserMissing`). Seviye yalnız Sentry kanalını ayırır.
 *
 * Saf modül: import yok. Deno testi doğrudan okur.
 */

export type MissingUserSeverity = {
  level: 'error' | 'warning';
  /** true → Sentry'ye `expected_deleted_user: 'true'` etiketi eklenir. */
  expectedDeletedUser: boolean;
};

/** Yeni para alınan, ilk satın alma niteliğindeki olaylar. */
const FIRST_PURCHASE_EVENTS: readonly string[] = [
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
];

/** Var olan aboneliğin yaşam döngüsü; silinen hesapta beklenir. */
const SUBSCRIPTION_LIFECYCLE_EVENTS: readonly string[] = [
  'RENEWAL',
  'CANCELLATION',
  'EXPIRATION',
  'BILLING_ISSUE',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
];

export function missingUserSeverity(eventType: string): MissingUserSeverity {
  if (SUBSCRIPTION_LIFECYCLE_EVENTS.includes(eventType)) {
    return { level: 'warning', expectedDeletedUser: true };
  }
  // FIRST_PURCHASE_EVENTS ve bilinmeyen tipler aynı sonuca düşer; liste
  // niyeti belgelemek ve testte açıkça doğrulamak için ayrı tutuluyor.
  if (FIRST_PURCHASE_EVENTS.includes(eventType)) {
    return { level: 'error', expectedDeletedUser: false };
  }
  return { level: 'error', expectedDeletedUser: false };
}
