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
  useRef,
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

  // ─── Refs — stale closure sorununu önlemek için ────────────────────────────
  // useCallback closure'ları state güncellemesinden önce çağrılabilir.
  // Ref'ler her zaman güncel değeri tutar.
  const statusRef = useRef<SubscriptionStatus>(status);
  const planIdRef = useRef<PlanId | null>(planId);
  const trialStartRef = useRef<string | null>(trialStartDate);

  // State değiştiğinde ref'leri senkronize et
  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { planIdRef.current = planId; }, [planId]);
  useEffect(() => { trialStartRef.current = trialStartDate; }, [trialStartDate]);

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
        const newStatus: SubscriptionStatus = rcStatus.isInTrial ? 'trial' : 'active';
        setIsPremium(true);
        setPlanId(dbSub.plan);
        setStatus(newStatus);
        setIsInTrial(rcStatus.isInTrial);
        setTrialStartDate(dbSub.started_at);
        setExpiresAt(rcStatus.expiresAt);
        // Ref'leri hemen güncelle — stale closure önlemi
        statusRef.current = newStatus;
        planIdRef.current = dbSub.plan;
        trialStartRef.current = dbSub.started_at;
      } else if (dbSub && dbSub.status === 'active') {
        // RevenueCat henüz sync olmamış olabilir — Supabase'e güven
        const newStatus = dbSub.status as SubscriptionStatus;
        setIsPremium(true);
        setPlanId(dbSub.plan);
        setStatus(newStatus);
        setIsInTrial(false);
        setTrialStartDate(dbSub.started_at);
        setExpiresAt(dbSub.expires_at ? new Date(dbSub.expires_at) : null);
        // Ref'leri hemen güncelle
        statusRef.current = newStatus;
        planIdRef.current = dbSub.plan;
        trialStartRef.current = dbSub.started_at;
      } else {
        setIsPremium(false);
        setPlanId(null);
        setStatus('free');
        setIsInTrial(false);
        setTrialStartDate(null);
        setExpiresAt(null);
        // Ref'leri hemen güncelle
        statusRef.current = 'free';
        planIdRef.current = null;
        trialStartRef.current = null;
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
   * Ref'lerden güncel abonelik durumunu okur — stale closure sorununu önler.
   * Eğer ref'ler hâlâ 'free' ama kullanıcı abone olabilir diye şüphe varsa,
   * RevenueCat + Supabase'den taze veri çeker (defensive fresh-fetch).
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
      let currentStatus = statusRef.current;
      let currentPlanId = planIdRef.current;
      let currentTrialStart = trialStartRef.current;

      // Defensive fresh-fetch: ref hâlâ free/expired ise doğrudan kaynaktan kontrol et.
      // Bu, subscription henüz yüklenmemişken yapılan erken checkQuota çağrılarını yakalar.
      if (currentStatus === 'free' || currentStatus === 'expired' || !currentPlanId) {
        try {
          const [rcStatus, dbSub] = await Promise.all([
            getSubscriptionStatus(),
            getUserSubscription(userId),
          ]);

          if (rcStatus.isPremium && dbSub) {
            currentStatus = rcStatus.isInTrial ? 'trial' : 'active';
            currentPlanId = dbSub.plan;
            currentTrialStart = dbSub.started_at;
            // Ref + state senkronize et
            statusRef.current = currentStatus;
            planIdRef.current = currentPlanId;
            trialStartRef.current = currentTrialStart;
            setStatus(currentStatus);
            setPlanId(currentPlanId);
            setIsPremium(true);
            setIsInTrial(rcStatus.isInTrial);
            setTrialStartDate(currentTrialStart);
          } else if (dbSub && dbSub.status === 'active') {
            currentStatus = dbSub.status as SubscriptionStatus;
            currentPlanId = dbSub.plan;
            currentTrialStart = dbSub.started_at;
            statusRef.current = currentStatus;
            planIdRef.current = currentPlanId;
            trialStartRef.current = currentTrialStart;
            setStatus(currentStatus);
            setPlanId(currentPlanId);
            setIsPremium(true);
            setTrialStartDate(currentTrialStart);
          }
          logger.log('[subscription-ctx] Fresh-fetch sonucu:', currentStatus, currentPlanId);
        } catch (freshErr) {
          logger.warn('[subscription-ctx] Fresh-fetch başarısız, ref değerleri kullanılıyor:', freshErr);
        }
      }

      const result = await canSearchMood(userId, currentStatus, currentPlanId, currentTrialStart);
      setQuota(result);
      return result;
    } catch (err) {
      // Fail-closed: hata durumunda aramayı engelle — paywall bypass'i önle.
      logger.warn('[subscription-ctx] Kota kontrolü başarısız, fallback: engelle', err);
      const fallback: QuotaCheckResult = {
        allowed: false,
        remaining: 0,
        resetAt: null,
        dailyLimit: 1,
        weeklyLimit: 7,
      };
      setQuota(fallback);
      return fallback;
    }
  }, []);

  /**
   * Başarılı mood aramasından sonra sayacı artırır.
   * Ref'lerden güncel abonelik durumunu okur.
   */
  const recordSearch = useCallback(async () => {
    const userId = await getAppUserId();
    if (!userId) return;

    await recordMoodSearch(userId);
    // Kota bilgisini güncelle — ref'lerden oku, stale closure önle
    const result = await canSearchMood(
      userId,
      statusRef.current,
      planIdRef.current,
      trialStartRef.current,
    );
    setQuota(result);
  }, []);

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
