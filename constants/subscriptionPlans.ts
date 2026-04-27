/**
 * Subscription plan sabitleri.
 *
 * RevenueCat product ID'leri ve her planın kota kuralları burada tanımlanır.
 * Fiyatlar App Store Connect / Google Play Console'dan gelir —
 * buradaki değerler yalnızca UI gösterim amaçlıdır.
 */

// ─── Plan Tipleri ─────────────────────────────────────────────────────────────

/** Uygulama abonelik plan türleri */
export type PlanId = 'weekly' | 'monthly' | 'yearly';

/** Kullanıcı abonelik durumu */
export type SubscriptionStatus = 'free' | 'trial' | 'active' | 'expired' | 'cancelled';

/** Tek bir plan tanımı */
export interface PlanDefinition {
  /** RevenueCat product identifier */
  readonly rcProductId: string;
  /** UI'da gösterilecek fiyat (gerçek fiyat RevenueCat'ten gelir) */
  readonly displayPrice: string;
  /** Faturalama periyodu (gün) */
  readonly periodDays: number;
  /** Free trial süresi (gün), 0 = trial yok */
  readonly trialDays: number;
  /** Günlük mood arama limiti */
  readonly dailyLimit: number;
  /** Haftalık mood arama limiti */
  readonly weeklyLimit: number;
}

// ─── Plan Tanımları ──────────────────────────────────────────────────────────

export const PLANS: Record<PlanId, PlanDefinition> = {
  weekly: {
    rcProductId: 'chosyai_weekly',
    displayPrice: '$1.99',
    periodDays: 7,
    trialDays: 3,
    dailyLimit: 2,      // 2/gün → trial+1.hafta (10 gün) = 20, sonra 14/hafta
    weeklyLimit: 14,
  },
  monthly: {
    rcProductId: 'chosyai_monthly',
    displayPrice: '$4.99',
    periodDays: 30,
    trialDays: 0,
    dailyLimit: 3,
    weeklyLimit: 21,    // 3/gün × 7 = 21/hafta cap
  },
  yearly: {
    rcProductId: 'chosyai_yearly',
    displayPrice: '$39.99',
    periodDays: 365,
    trialDays: 0,
    dailyLimit: 3,
    weeklyLimit: 21,    // Aylıkla aynı kurallar
  },
} as const;

// ─── Free Tier ───────────────────────────────────────────────────────────────

/** Free kullanıcılar için günlük mood arama limiti */
export const FREE_DAILY_LIMIT = 1;

/** Trial ilk periyodu (trial + ilk hafta) toplam gün */
export const TRIAL_FIRST_PERIOD_DAYS = 10;

/** Trial ilk periyodundaki toplam mood hakkı (10 gün × 2) */
export const TRIAL_FIRST_PERIOD_QUOTA = 20;

// ─── RevenueCat ──────────────────────────────────────────────────────────────

/** RevenueCat entitlement identifier */
export const RC_ENTITLEMENT_ID = 'premium';

/** RevenueCat offering identifier */
export const RC_OFFERING_ID = 'default';
