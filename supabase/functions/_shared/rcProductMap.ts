/**
 * revenuecat-webhook — RevenueCat `product_id` → tier → `subscriptions.plan`.
 *
 * Sprint 7'de `revenuecat-webhook/index.ts`'ten BİREBİR taşındı: TRANSFER
 * dalı (`rcTransfer.ts`) da aynı eşlemeye ihtiyaç duyuyor ve iki kopya,
 * ileride yalnız birinin güncellenmesi demekti. İçerik değişmedi.
 *
 * Saf modül: import yok. Deno testi doğrudan okur.
 */

// ─── Product ID → Tier Mapping ─────────────────────────────────────────────────

export function mapProductToTier(productId: string): string {
  // Lifetime
  if (productId === 'com.chosy.lifetime') return 'lifetime'

  // Annual (yeni + eski)
  if (productId === 'com.chosy.annual') return 'annual'
  if (productId === 'chosyai_yearly') return 'annual'

  // Monthly (yeni + eski)
  if (productId === 'com.chosy.monthly') return 'monthly'
  if (productId === 'chosyai_monthly') return 'monthly'

  // Weekly (eski — sadece legacy)
  if (productId === 'chosyai_weekly') return 'weekly_legacy'

  return 'free'
}

// ─── Tier → subscriptions.plan Mapping ─────────────────────────────────────────

/**
 * `mapProductToTier` çıktısını `subscriptions.plan` kelime dağarcığına çevirir.
 *
 * Kaynak sözleşme İSTEMCİDE: `constants/subscriptionPlans.ts`
 *   PlanId       = 'monthly' | 'annual' | 'lifetime'
 *   LegacyPlanId = PlanId | 'weekly' | 'yearly'
 * Migration 104 `subscriptions_plan_check` kısıtını tam olarak LegacyPlanId'e
 * eşitler. Buradaki değerler o listenin DIŞINA ÇIKAMAZ.
 *
 * `free` bilerek YOK: `mapProductToTier` tanımadığı bir `product_id` için
 * 'free' döner. Bu bir abonelik planı değil, eşleme boşluğudur — satıra
 * yazılırsa "ödeme yapan kullanıcı ücretsiz plana düştü" verisi üretir.
 * Çağıran taraf bunu Sentry'ye rapor eder ve satıra DOKUNMAZ.
 *
 * `weekly_legacy` → 'weekly': tier adı 021'de yenilendi, plan kolonundaki
 * tarihsel değer 'weekly' olarak kaldı (021:20 veri göçü bu değeri okuyor).
 */
export const TIER_TO_PLAN: Record<string, string | undefined> = {
  weekly_legacy: 'weekly',
  monthly: 'monthly',
  annual: 'annual',
  lifetime: 'lifetime',
}
