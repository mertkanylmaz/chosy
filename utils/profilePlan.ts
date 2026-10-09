/**
 * Profil plan satırı — "bilinmeyen premium plan" kararı (saf fonksiyon).
 *
 * REACT-NATIVE-J (PROFILE_UNKNOWN_PLAN): koşul çok genişti; `premiumStatus ===
 * 'premium'` iken `tier` 'free' + `planId` null kalan GEÇİCİ durumlar (RC aktif,
 * `subscriptions` satırı henüz yok ya da abonelik bitmiş/free'ye dönüyor) hata
 * sayılıyordu. Gerçek "bilinmeyen plan" yalnız şunların HEPSİ doğruysa:
 *
 *  1. entitlement premium,
 *  2. abonelik durumu aktif (`active` veya `trial` — deneme de aktif entitlement),
 *  3. `planId` null DEĞİL (DB plan kimliği var),
 *  4. `weekly_legacy` değil (bilinen eski plan),
 *  5. plan tanınmıyor (annual / monthly / lifetime eşleşmedi).
 *
 * expired / cancelled / free / `planId === null` → hata YOK, free gibi davranılır.
 * `RC_ACTIVE_DB_MISSING` (SubscriptionContext) bu kararın dışındadır, ayrı kalır.
 *
 * Girdi tipleri bilerek yapısal (string): modül hiçbir şey import etmez,
 * Deno testi native/RN modülü çekmeden koşar (`paywallPricing.ts` deseni).
 */

export interface UnknownPlanInput {
  /** `useSubscription().premiumStatus` */
  premiumStatus: string;
  /** `useSubscription().status`: free | trial | active | expired | cancelled */
  status: string;
  /** DB plan kimliği; yoksa null. */
  planId: string | null;
  /** `useSubscription().tier` */
  tier: string;
  /** annual / monthly / lifetime eşleşmesi bulundu mu (`knownPlanTitle !== null`). */
  planKnown: boolean;
}

export function isUnknownPremiumPlan(input: UnknownPlanInput): boolean {
  const { premiumStatus, status, planId, tier, planKnown } = input;
  if (premiumStatus !== 'premium') return false;
  if (status !== 'active' && status !== 'trial') return false;
  if (planId === null) return false;
  if (tier === 'weekly_legacy') return false;
  return !planKnown;
}
