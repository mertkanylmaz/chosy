/**
 * Subscription plan sabitleri.
 *
 * RevenueCat product ID'leri ve her planin kota kurallari burada tanimlanir.
 * Fiyatlar App Store Connect / Google Play Console'dan gelir —
 * buradaki degerler yalnizca UI gosterim amaclidir.
 *
 * V2: 4-tier sistem (free, monthly, annual, lifetime) + weekly_legacy
 */

// ─── Plan Tipleri ─────────────────────────────────────────────────────────────

/** Yeni abonelik plan turleri */
export type SubscriptionTier = 'free' | 'weekly_legacy' | 'monthly' | 'annual' | 'lifetime';

/** Aktif satista olan yeni plan ID'leri */
export type PlanId = 'monthly' | 'annual' | 'lifetime';

/**
 * DB'de mevcut olabilecek tum plan ID'leri (eski + yeni).
 * Supabase subscriptions tablosunda eski kayitlar 'weekly'/'yearly' olabilir.
 * Frontend okumalari bu tipi kullanmali — crash onler.
 */
export type LegacyPlanId = PlanId | 'weekly' | 'yearly';

/** Kullanici abonelik durumu */
export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'expired' | 'cancelled';

/** Tek bir plan tanimi */
export interface PlanDefinition {
  /** RevenueCat product identifier */
  readonly rcProductId: string;
  /** UI'da gosterilecek varsayilan fiyat (Gerçek fiyat RevenueCat'ten gelir) */
  readonly displayPrice: string;
  /** Faturalama periyodu (gun), Lifetime için 99999 */
  readonly periodDays: number;
  /** Free trial suresi (gun), 0 = trial yok */
  readonly trialDays: number;
}

/** Quota status response from RPC */
export interface QuotaStatus {
  allowed: boolean;
  used: number;
  limit: number;
  tier: SubscriptionTier;
  remaining: number;
  resetAt?: Date;
}

// ─── Plan Tanimlari ──────────────────────────────────────────────────────────

/** Canlıda satışa sunulacak YENİ plan tanımları */
export const PLANS: Record<PlanId, PlanDefinition> = {
  monthly: {
    rcProductId: 'com.chosy.monthly',
    displayPrice: '$6.99',
    periodDays: 30,
    trialDays: 0,
  },
  annual: {
    rcProductId: 'com.chosy.annual',
    displayPrice: '$39.99',
    periodDays: 365,
    trialDays: 0,
  },
  lifetime: {
    rcProductId: 'com.chosy.lifetime',
    displayPrice: '$89.99',
    periodDays: 99999, // Sınırsız / Ömür boyu
    trialDays: 0,
  },
} as const;

/** Yeni tier bazli limitler (DB'deki subscription_limits tablosuyla tam sync) */
export const TIER_LIMITS: Record<SubscriptionTier, {
  dailySearchLimit: number;
  dailyRefineLimit: number;  // -1 = sinirsiz
  dailySlotLimit: number;
  dailyGameLimitPerGame: number;
  watchlistMaxFilms: number; // -1 = sinirsiz
}> = {
  free: {
    dailySearchLimit: 3,
    dailyRefineLimit: 1,
    dailySlotLimit: 1,
    dailyGameLimitPerGame: 1,
    watchlistMaxFilms: 30,
  },
  weekly_legacy: {
    dailySearchLimit: 14,
    dailyRefineLimit: -1,
    dailySlotLimit: 5,
    dailyGameLimitPerGame: -1,
    watchlistMaxFilms: -1,
  },
  monthly: {
    dailySearchLimit: 15,
    dailyRefineLimit: -1,
    dailySlotLimit: -1,
    dailyGameLimitPerGame: -1,
    watchlistMaxFilms: -1,
  },
  annual: {
    dailySearchLimit: 25,
    dailyRefineLimit: -1,
    dailySlotLimit: -1,
    dailyGameLimitPerGame: -1,
    watchlistMaxFilms: -1,
  },
  lifetime: {
    dailySearchLimit: 50,
    dailyRefineLimit: -1,
    dailySlotLimit: -1,
    dailyGameLimitPerGame: -1,
    watchlistMaxFilms: -1,
  },
} as const;

// ─── Free Tier ───────────────────────────────────────────────────────────────

/** Free kullanicilar icin gunluk mood arama limiti */
export const FREE_DAILY_LIMIT = 3;

// ─── RevenueCat ──────────────────────────────────────────────────────────────

/** RevenueCat master entitlement identifier (V1'de 'premium' idi) */
export const RC_ENTITLEMENT_ID = 'chosy_plus';

/** RevenueCat offering identifier */
export const RC_OFFERING_ID = 'default';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** RevenueCat'ten gelen eski veya yeni product_id'yi bizim DB tier'larımıza eşler */
export function productIdToTier(productId: string | null): SubscriptionTier {
  if (!productId) return 'free';
  
  switch (productId) {
    // Yeni Planlar
    case 'com.chosy.monthly': return 'monthly';
    case 'com.chosy.annual': return 'annual';
    case 'com.chosy.lifetime': return 'lifetime';
    
    // Eski/Miras Planlar (Eski kullanıcılar için geriye uyumluluk)
    case 'chosyai_weekly': return 'weekly_legacy';
    case 'chosyai_monthly': return 'monthly';
    case 'chosyai_yearly': return 'annual';
    
    default: return 'free';
  }
}

/**
 * DB'deki plan string'ini (eski veya yeni) SubscriptionTier'a esler.
 * SubscriptionContext bu fonksiyonu kullanir — legacy kayitlar icin guvenli.
 *
 * Ornek: 'weekly' → 'weekly_legacy', 'yearly' → 'annual', 'monthly' → 'monthly'
 */
export function planIdToTier(planId: string | null): SubscriptionTier {
  if (!planId) return 'free';

  switch (planId) {
    case 'monthly': return 'monthly';
    case 'annual': return 'annual';
    case 'lifetime': return 'lifetime';
    // Eski plan ID'leri — geriye uyumluluk
    case 'weekly': return 'weekly_legacy';
    case 'yearly': return 'annual';
    default: return 'free';
  }
}

/** Tier premium mi? */
export function isTierPremium(tier: SubscriptionTier): boolean {
  return tier !== 'free';
}