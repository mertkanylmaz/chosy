/**
 * Subscription Context — global abonelik durumu.
 *
 * RevenueCat + Supabase'den okunan abonelik bilgisini
 * tum ekranlara saglar. Mood arama oncesi kota kontrolu,
 * paywall yonlendirmesi ve UI gostergeleri burayi kullanir.
 *
 * V2: RPC-based quota system + SubscriptionTier support
 *
 * Provider zinciri: ... > MoodProvider > SubscriptionProvider > ThemeProvider
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
  FREE_DAILY_LIMIT,
  type LegacyPlanId,
  type SubscriptionStatus,
  type SubscriptionTier,
  type QuotaStatus,
  planIdToTier,
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
import { productIdToTier } from '@/constants/subscriptionPlans';
import { supabase } from '@/services/supabase';
import {
  canSearchMood,
  recordMoodSearch,
  checkAndConsumeQuota,
  checkAndConsumeGameQuota,
  getFullQuotaStatus,
  clearQuotaCache,
  type QuotaCheckResult,
  type FullQuotaStatus,
} from '@/services/quotaEngine';
import { getAppUserId } from '@/services/watchlist';
import { logger } from '@/utils/logger';

// ─── Context State ───────────────────────────────────────────────────────────

interface SubscriptionState {
  /** Yukleniyor mu? (ilk acilista true) */
  isLoading: boolean;
  /** Premium erisim var mi? */
  isPremium: boolean;
  /** Aktif plan ID (null = free, eski kayitlarda 'weekly'/'yearly' olabilir) */
  planId: LegacyPlanId | null;
  /** Abonelik durumu */
  status: SubscriptionStatus;
  /** Aktif tier */
  tier: SubscriptionTier;
  /** Trial doneminde mi? */
  isInTrial: boolean;
  /** Trial baslangic tarihi */
  trialStartDate: string | null;
  /** Abonelik bitis tarihi */
  expiresAt: Date | null;
  /** Son kota kontrolu sonucu (eski format) */
  quota: QuotaCheckResult | null;
  /** Tum quota durumu (yeni format) */
  fullQuota: FullQuotaStatus | null;

  /**
   * Mood arama oncesi kota kontrolu yapar.
   * true: arama yapilabilir, false: paywall goster.
   */
  checkQuota: () => Promise<QuotaCheckResult>;

  /**
   * RPC-based atomic quota check + consume.
   * Yeni kodda bu tercih edilmeli.
   */
  consumeQuota: (type: 'search' | 'refine' | 'slot') => Promise<QuotaStatus>;

  /**
   * Game-specific quota check + consume.
   */
  consumeGameQuota: (gameId: string) => Promise<QuotaStatus>;

  /**
   * Basarili mood aramasindan sonra sayaci artirir.
   */
  recordSearch: () => Promise<void>;

  /**
   * Abonelik durumunu RevenueCat + Supabase'den yeniler.
   * Satin alma sonrasi, restore sonrasi cagrilir.
   */
  refreshSubscription: () => Promise<void>;

  /**
   * Full quota status'u yeniler.
   */
  refreshQuota: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionState | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

/**
 * Global subscription state provider.
 * _layout.tsx'te MoodProvider'dan sonra sarilir.
 */
export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [planId, setPlanId] = useState<LegacyPlanId | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>('free');
  const [tier, setTier] = useState<SubscriptionTier>('free');
  const [isInTrial, setIsInTrial] = useState(false);
  const [trialStartDate, setTrialStartDate] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [quota, setQuota] = useState<QuotaCheckResult | null>(null);
  const [fullQuota, setFullQuota] = useState<FullQuotaStatus | null>(null);

  // ─── Refs — stale closure sorununu onlemek icin ────────────────────────────
  const statusRef = useRef<SubscriptionStatus>(status);
  const planIdRef = useRef<LegacyPlanId | null>(planId);
  const trialStartRef = useRef<string | null>(trialStartDate);
  const tierRef = useRef<SubscriptionTier>(tier);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { planIdRef.current = planId; }, [planId]);
  useEffect(() => { trialStartRef.current = trialStartDate; }, [trialStartDate]);
  useEffect(() => { tierRef.current = tier; }, [tier]);

  /**
   * RevenueCat + Supabase'den abonelik bilgisini ceker.
   */
  const refreshSubscription = useCallback(async () => {
    try {
      const userId = await getAppUserId();
      if (!userId) {
        setStatus('free');
        setIsPremium(false);
        setPlanId(null);
        setTier('free');
        setIsLoading(false);
        return;
      }

      const rcStatus: SubscriptionInfo = await getSubscriptionStatus();
      const dbSub: SubscriptionRow | null = await getUserSubscription(userId);

      // rcStatus.errorKind doluysa isPremium:false gercek bir cevap DEGIL,
      // fallback'tir. RC'ye dayanan dal atlanir; DB dali calismaya devam
      // eder (offline'da bile dogru premium sonucu verebilir).
      if (!rcStatus.errorKind && rcStatus.isPremium && dbSub) {
        const newStatus: SubscriptionStatus = rcStatus.isInTrial ? 'trial' : 'active';
        const newTier = planIdToTier(dbSub.plan);
        setIsPremium(true);
        setPlanId(dbSub.plan);
        setStatus(newStatus);
        setTier(newTier);
        setIsInTrial(rcStatus.isInTrial);
        setTrialStartDate(dbSub.started_at);
        setExpiresAt(rcStatus.expiresAt);
        statusRef.current = newStatus;
        planIdRef.current = dbSub.plan;
        trialStartRef.current = dbSub.started_at;
        tierRef.current = newTier;
      } else if (dbSub && dbSub.status === 'active') {
        const newStatus = dbSub.status as SubscriptionStatus;
        const newTier = planIdToTier(dbSub.plan);
        setIsPremium(true);
        setPlanId(dbSub.plan);
        setStatus(newStatus);
        setTier(newTier);
        setIsInTrial(false);
        setTrialStartDate(dbSub.started_at);
        setExpiresAt(dbSub.expires_at ? new Date(dbSub.expires_at) : null);
        statusRef.current = newStatus;
        planIdRef.current = dbSub.plan;
        trialStartRef.current = dbSub.started_at;
        tierRef.current = newTier;
      } else if (rcStatus.errorKind) {
        // RC sorgulanamadi ve DB de aktif abonelik gostermiyor.
        // Bu "kullanici free" demek DEGIL — gecici bir ag hatasi odeme
        // yapmis kullaniciyi dusurmesin. Mevcut state korunur.
        logger.warn(
          '[subscription-ctx] RC durumu okunamadi, mevcut state korunuyor:',
          rcStatus.errorKind,
        );
      } else {
        setIsPremium(false);
        setPlanId(null);
        setStatus('free');
        setTier('free');
        setIsInTrial(false);
        setTrialStartDate(null);
        setExpiresAt(null);
        statusRef.current = 'free';
        planIdRef.current = null;
        trialStartRef.current = null;
        tierRef.current = 'free';
      }
    } catch (err) {
      logger.error('[subscription-ctx] Refresh hatasi:', err);
      setStatus('free');
      setIsPremium(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Full quota status'u yeniler.
   */
  const refreshQuota = useCallback(async () => {
    const userId = await getAppUserId();
    if (!userId) return;

    const status = await getFullQuotaStatus(userId);
    if (status) {
      setFullQuota(status);
    }
  }, []);

  /**
   * Mood arama oncesi kota kontrolu (eski yontem — geriye uyumluluk).
   */
  const checkQuota = useCallback(async (): Promise<QuotaCheckResult> => {
    const userId = await getAppUserId();
    if (!userId) {
      const freeResult: QuotaCheckResult = {
        allowed: false,
        remaining: 0,
        resetAt: null,
        dailyLimit: 3,
        weeklyLimit: 21,
      };
      setQuota(freeResult);
      return freeResult;
    }

    try {
      let currentStatus = statusRef.current;
      let currentPlanId = planIdRef.current;
      let currentTrialStart = trialStartRef.current;

      // Defensive fresh-fetch
      if (currentStatus === 'free' || currentStatus === 'expired' || !currentPlanId) {
        try {
          const [rcStatus, dbSub] = await Promise.all([
            getSubscriptionStatus(),
            getUserSubscription(userId),
          ]);

          if (rcStatus.errorKind) {
            // Fresh-fetch RC'den cevap alamadi — ref degerleriyle devam et,
            // asagidaki dallar kullaniciyi free'ye dusurmesin.
            logger.warn(
              '[subscription-ctx] Fresh-fetch RC durumu okunamadi:',
              rcStatus.errorKind,
            );
          } else if (rcStatus.isPremium && dbSub) {
            currentStatus = rcStatus.isInTrial ? 'trial' : 'active';
            currentPlanId = dbSub.plan;
            currentTrialStart = dbSub.started_at;
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
          logger.warn('[subscription-ctx] Fresh-fetch basarisiz, ref degerleri kullaniliyor:', freshErr);
        }
      }

      const result = await canSearchMood(userId, currentStatus, currentPlanId, currentTrialStart);
      setQuota(result);
      return result;
    } catch (err) {
      logger.warn('[subscription-ctx] Kota kontrolu basarisiz, fallback: engelle', err);
      const fallback: QuotaCheckResult = {
        allowed: false,
        remaining: 0,
        resetAt: null,
        dailyLimit: 3,
        weeklyLimit: 21,
      };
      setQuota(fallback);
      return fallback;
    }
  }, []);

  /**
   * RPC-based atomic quota consume.
   *
   * Fail-open strateji: ag hatasi/timeout durumunda kullaniciyi kilitlemez.
   * RPC cevap vermezse allowed: true doner — kotu niyetli kullanim DB
   * seviyesinde yakalanir (subscription_limits tablosu).
   * Boylece gecici ag sorunlari UX'i bozmaz.
   */
  const consumeQuota = useCallback(async (type: 'search' | 'refine' | 'slot'): Promise<QuotaStatus> => {
    const userId = await getAppUserId();
    if (!userId) {
      return {
        allowed: false,
        used: 0,
        limit: FREE_DAILY_LIMIT,
        tier: 'free',
        remaining: 0,
      };
    }

    try {
      const result = await checkAndConsumeQuota(userId, type);

      // Full quota'yi da guncelle (fire-and-forget)
      refreshQuota();

      return result;
    } catch (err) {
      logger.warn('[subscription-ctx] consumeQuota ag hatasi — fail-open:', err);
      // Fail-open: gecici ag sorununda kullaniciya izin ver
      return {
        allowed: true,
        used: 0,
        limit: FREE_DAILY_LIMIT,
        tier: tierRef.current,
        remaining: 1,
      };
    }
  }, [refreshQuota]);

  /**
   * Game-specific quota consume.
   * Fail-open: ag hatasi durumunda oyun baslatilir — engagement oncelikli.
   */
  const consumeGameQuota = useCallback(async (gameId: string): Promise<QuotaStatus> => {
    const userId = await getAppUserId();
    if (!userId) {
      return {
        allowed: false,
        used: 0,
        limit: 1,
        tier: 'free',
        remaining: 0,
      };
    }

    try {
      const result = await checkAndConsumeGameQuota(userId, gameId);

      // Full quota'yi da guncelle (fire-and-forget)
      refreshQuota();

      return result;
    } catch (err) {
      logger.warn('[subscription-ctx] consumeGameQuota ag hatasi — fail-open:', err);
      return {
        allowed: true,
        used: 0,
        limit: 1,
        tier: tierRef.current,
        remaining: 1,
      };
    }
  }, [refreshQuota]);

  /**
   * Basarili mood aramasindan sonra sayaci artirir.
   */
  const recordSearch = useCallback(async () => {
    const userId = await getAppUserId();
    if (!userId) {
      logger.warn('[subscription-ctx] recordSearch: userId bulunamadi');
      return;
    }

    await recordMoodSearch(userId);

    const result = await canSearchMood(
      userId,
      statusRef.current,
      planIdRef.current,
      trialStartRef.current,
    );
    setQuota(result);
    logger.log('[subscription-ctx] Quota guncellendi:', result.remaining, 'kalan');
  }, []);

  // Ilk yuklemede abonelik durumunu cek
  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  // Full quota status'u yukle
  useEffect(() => {
    if (!isLoading) {
      refreshQuota();
    }
  }, [isLoading, refreshQuota]);

  // RevenueCat listener — premium state degisince hemen sync et
  useEffect(() => {
    const cleanup = addSubscriptionListener((rcInfo: SubscriptionInfo) => {
      setIsPremium(rcInfo.isPremium);
      setIsInTrial(rcInfo.isInTrial);
      setExpiresAt(rcInfo.expiresAt);

      if (rcInfo.isPremium) {
        // Hemen premium ref'lerini guncelle — stale quota engelini kaldir
        statusRef.current = rcInfo.isInTrial ? 'trial' : 'active';
        setStatus(rcInfo.isInTrial ? 'trial' : 'active');

        // Defensive: users.subscription_tier'i hemen sync et
        // Quota RPC'leri bu kolonu okuyor — webhook gecikmesini tolere et
        if (rcInfo.activePlanId) {
          const rcTier = productIdToTier(rcInfo.activePlanId);
          if (rcTier !== 'free') {
            setTier(rcTier);
            tierRef.current = rcTier;
            getAppUserId().then((uid) => {
              if (!uid) return;
              supabase
                .from('users')
                .update({
                  subscription_tier: rcTier,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', uid)
                .then(({ error }) => {
                  if (error) logger.warn('[subscription-ctx] RC listener tier sync hatasi:', error.message);
                });
            });
          }
        }
      } else {
        setStatus('expired');
        setPlanId(null);
        setTier('free');
        statusRef.current = 'expired';
        tierRef.current = 'free';
      }

      // Tier degistiginde quota cache'ini temizle
      getAppUserId().then((uid) => {
        if (uid) clearQuotaCache(uid);
      });

      // Tam sync: DB'den plan, tier, quota detaylarini cek
      refreshSubscription().then(() => refreshQuota());
    });

    return cleanup;
  }, [refreshSubscription, refreshQuota]);

  const value = useMemo<SubscriptionState>(
    () => ({
      isLoading,
      isPremium,
      planId,
      status,
      tier,
      isInTrial,
      trialStartDate,
      expiresAt,
      quota,
      fullQuota,
      checkQuota,
      consumeQuota,
      consumeGameQuota,
      recordSearch,
      refreshSubscription,
      refreshQuota,
    }),
    [
      isLoading,
      isPremium,
      planId,
      status,
      tier,
      isInTrial,
      trialStartDate,
      expiresAt,
      quota,
      fullQuota,
      checkQuota,
      consumeQuota,
      consumeGameQuota,
      recordSearch,
      refreshSubscription,
      refreshQuota,
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
 * Subscription context'e erisim hook'u.
 */
export function useSubscription(): SubscriptionState {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return ctx;
}
