/**
 * Subscription Context — global abonelik durumu.
 *
 * RevenueCat + Supabase'den okunan abonelik bilgisini
 * tüm ekranlara sağlar. Mood arama öncesi kota kontrolü,
 * paywall yönlendirmesi ve UI göstergeleri burayı kullanır.
 *
 * Provider zinciri: ... → MoodProvider → SubscriptionProvider → ThemeProvider
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  type PlanId,
  type SubscriptionStatus,
} from '@/constants/subscriptionPlans';
import {
  getSubscriptionStatus,
  addSubscriptionListener,
  type SubscriptionInfo,
} from '@/services/purchaseService';
import {
  getUserSubscription,
  type SubscriptionRow,
} from '@/services/subscriptionService';
import {
  canSearchMood,
  recordMoodSearch,
  type QuotaCheckResult,
} from '@/services/quotaEngine';
import { getAppUserId } from '@/services/watchlist';
import { logger } from '@/utils/logger';

// ─── Context State ───────────────────────────────────────────────────────────

interface SubscriptionState {
  /** Yükleniyor mu? (ilk açılışta true) */
  isLoading: boolean;
  /** Premium erişim var mı? */
  isPremium: boolean;
  /** Aktif plan ID (null = free) */
  planId: PlanId | null;
  /** Abonelik durumu */
  status: SubscriptionStatus;
  /** Trial döneminde mi? */
  isInTrial: boolean;
  /** Trial başlangıç tarihi */
  trialStartDate: string | null;
  /** Abonelik bitiş tarihi */
  expiresAt: Date | null;
  /** Son kota kontrolü sonucu */
  quota: QuotaCheckResult | null;

  /**
   * Mood arama öncesi kota kontrolü yapar.
   * true: arama yapılabilir, false: paywall göster.
   */
  checkQuota: () => Promise<QuotaCheckResult>;

  /**
   * Başarılı mood aramasından sonra sayacı artırır.
   */
  recordSearch: () => Promise<void>;

  /**
   * Abonelik durumunu RevenueCat + Supabase'den yeniler.
   * Satın alma sonrası, restore sonrası çağrılır.
   */
  refreshSubscription: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Global subscription state provider.
 * _layout.tsx'te MoodProvider'dan sonra sarılır.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('free');
  const [isInTrial, setIsInTrial] = useState(false);
  const [trialStartDate, setTrialStartDate] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [quota, setQuota] = useState<QuotaCheckResult | null>(null);

  /**
   * RevenueCat + Supabase'den abonelik bilgisini çeker.
   */
  const refreshSubscription = useCallback(async () => {
    try {
      const userId = await getAppUserId();
      if (!userId) {
        setStatus('free');
        setIsPremium(false);
        setPlanId(null);
        setIsLoading(false);
        return;
      }

      // RevenueCat'ten durum al
      const rcStatus: SubscriptionInfo = await getSubscriptionStatus();

      // Supabase'den detay al
      const dbSub: SubscriptionRow | null = await getUserSubscription(userId);

      if (rcStatus.isPremium && dbSub) {
        setIsPremium(true);
        setPlanId(dbSub.plan);
        setStatus(rcStatus.isInTrial ? 'trial' : 'active');
        setIsInTrial(rcStatus.isInTrial);
        setTrialStartDate(dbSub.started_at);
        setExpiresAt(rcStatus.expiresAt);
      } else if (dbSub && dbSub.status === 'active') {
        // RevenueCat henüz sync olmamış olabilir — Supabase'e güven
        setIsPremium(true);
        setPlanId(dbSub.plan);
        setStatus(dbSub.status as SubscriptionStatus);
        setIsInTrial(false);
        setTrialStartDate(dbSub.started_at);
        setExpiresAt(dbSub.expires_at ? new Date(dbSub.expires_at) : null);
      } else {
        setIsPremium(false);
        setPlanId(null);
        setStatus('free');
        setIsInTrial(false);
        setTrialStartDate(null);
        setExpiresAt(null);
      }
    } catch (err) {
      logger.error('[subscription-ctx] Refresh hatası:', err);
      setStatus('free');
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Mood arama öncesi kota kontrolü.
   *
   * Offline/hata durumunda graceful fallback: aramaya izin ver.
   * Kullanıcı deneyimini ağ hatası nedeniyle engelleme.
   */
  const checkQuota = useCallback(async (): Promise<QuotaCheckResult> => {
    const userId = await getAppUserId();
    if (!userId) {
      const freeResult: QuotaCheckResult = {
        allowed: false,
        remaining: 0,
        resetAt: null,
        dailyLimit: 1,
        weeklyLimit: 7,
      };
      setQuota(freeResult);
      return freeResult;
    }

    try {
      const result = await canSearchMood(userId, status, planId, trialStartDate);
      setQuota(result);
      return result;
    } catch (err) {
      // Offline veya Supabase hatası — kullanıcıyı engelleme, izin ver
      logger.warn('[subscription-ctx] Kota kontrolü başarısız, fallback: izin ver', err);
      const fallback: QuotaCheckResult = {
        allowed: true,
        remaining: 1,
        resetAt: null,
        dailyLimit: 1,
        weeklyLimit: 7,
      };
      setQuota(fallback);
      return fallback;
    }
  }, [status, planId, trialStartDate]);

  /**
   * Başarılı mood aramasından sonra sayacı artırır.
   */
  const recordSearch = useCallback(async () => {
    const userId = await getAppUserId();
    if (!userId) return;

    await recordMoodSearch(userId);
    // Kota bilgisini güncelle
    const result = await canSearchMood(userId, status, planId, trialStartDate);
    setQuota(result);
  }, [status, planId, trialStartDate]);

  // İlk yüklemede abonelik durumunu çek
  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  // RevenueCat listener — abonelik değişikliklerini dinle (expire, renew, cancel)
  useEffect(() => {
    const cleanup = addSubscriptionListener((rcInfo: SubscriptionInfo) => {
      setIsPremium(rcInfo.isPremium);
      setIsInTrial(rcInfo.isInTrial);
      setExpiresAt(rcInfo.expiresAt);

      if (!rcInfo.isPremium) {
        setStatus('expired');
        setPlanId(null);
      }

      // Tam refresh — Supabase'deki verileri de senkronize et
      refreshSubscription();
    });

    return cleanup;
  }, [refreshSubscription]);

  const value = useMemo<SubscriptionState>(
    () => ({
      isLoading,
      isPremium,
      planId,
      status,
      isInTrial,
      trialStartDate,
      expiresAt,
      quota,
      checkQuota,
      recordSearch,
      refreshSubscription,
    }),
    [
      isLoading,
      isPremium,
      planId,
      status,
      isInTrial,
      trialStartDate,
      expiresAt,
      quota,
      checkQuota,
      recordSearch,
      refreshSubscription,
    ],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Subscription context'e erişim hook'u.
 */
export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
