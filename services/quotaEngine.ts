/**
 * Quota Engine — Client-side kota yonetimi.
 *
 * V3: RPC bypass — AsyncStorage + RevenueCat tier detection.
 * Supabase'de quota RPC'leri mevcut degil, bu yuzden tum quota logic
 * client-side'a tasindi. Tier tespiti RevenueCat'ten, sayac AsyncStorage'dan.
 *
 * Eski sistem (canSearchMood, countSearchesSince) geriye uyumluluk icin korundu.
 * recordMoodSearch hala mood_searches tablosuna yazar (analytics icin).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Purchases from 'react-native-purchases';
import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import {
  FREE_DAILY_LIMIT,
  TIER_LIMITS,
  RC_ENTITLEMENT_ID,
  planIdToTier,
  type SubscriptionStatus,
  type SubscriptionTier,
  type QuotaStatus,
} from '@/constants/subscriptionPlans';
import { logger } from '@/utils/logger';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Kota kontrolu sonucu (eski interface — geriye uyumluluk) */
export interface QuotaCheckResult {
  /** Mood arama yapabilir mi? */
  allowed: boolean;
  /** Kalan arama hakki */
  remaining: number;
  /** Kota ne zaman sifirlanir (reset zamani) */
  resetAt: Date | null;
  /** Gunluk limit */
  dailyLimit: number;
  /** Haftalik limit */
  weeklyLimit: number;
}

/** Tum quota durumu */
export interface FullQuotaStatus {
  tier: SubscriptionTier;
  searches: { used: number; limit: number; bonus_available: number };
  refines: { used: number; limit: number };
  slots: { used: number; limit: number };
  games: { played: Record<string, number>; limit_per_game: number };
  reset_at: string;
}

// ─── AsyncStorage Helpers ────────────────────────────────────────────────────

/** Bugunun tarihini YYYY-MM-DD formatinda dondurur */
function todayDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

/** AsyncStorage key: quota_{userId}_{type}_{YYYY-MM-DD} */
function storageKey(userId: string, type: string): string {
  return `quota_${userId}_${type}_${todayDateKey()}`;
}

/** Mevcut kullanim sayisini oku */
async function getUsedCount(key: string): Promise<number> {
  try {
    const val = await AsyncStorage.getItem(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/** Kullanim sayisini artir */
async function incrementCount(key: string, current: number): Promise<void> {
  try {
    await AsyncStorage.setItem(key, String(current + 1));
  } catch (err) {
    logger.warn('[quota] AsyncStorage write failed:', err);
  }
}

// ─── RevenueCat Tier Detection ───────────────────────────────────────────────

/**
 * RevenueCat'ten aktif tier'i belirler.
 * RC erisilemedigi durumda 'free' doner (fail-safe).
 */
async function getTierFromRevenueCat(): Promise<SubscriptionTier> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[RC_ENTITLEMENT_ID];

    if (!entitlement) return 'free';

    const productId = entitlement.productIdentifier?.toLowerCase() ?? '';

    if (productId.includes('lifetime')) return 'lifetime';
    if (productId.includes('annual') || productId.includes('yearly')) return 'annual';
    if (productId.includes('weekly')) return 'weekly_legacy';
    if (productId.includes('monthly')) return 'monthly';

    // Entitlement aktif ama product ID tanimsiz — monthly ver (kullaniciyi cezalandirma)
    return 'monthly';
  } catch (err) {
    logger.warn('[quota] RC getCustomerInfo failed — defaulting to free:', err);
    return 'free';
  }
}

// ─── Limit Helpers ───────────────────────────────────────────────────────────

/** Quota type'a gore tier'dan limiti al. -1 = sinirsiz (9999 olarak doner) */
function getLimitForType(tier: SubscriptionTier, quotaType: string): number {
  const limits = TIER_LIMITS[tier];
  switch (quotaType) {
    case 'search': return limits.dailySearchLimit;
    case 'refine': return limits.dailyRefineLimit === -1 ? 9999 : limits.dailyRefineLimit;
    case 'slot': return limits.dailySlotLimit === -1 ? 9999 : limits.dailySlotLimit;
    default: return FREE_DAILY_LIMIT;
  }
}

// ─── Ana Fonksiyonlar (RPC yerine client-side) ──────────────────────────────

/**
 * Atomic quota check + consume — client-side.
 * RPC bypass: AsyncStorage sayac + RevenueCat tier.
 *
 * Fail-open strateji: hata durumunda kullaniciyi kilitlemez.
 *
 * @param userId Supabase users tablosundaki UUID
 * @param quotaType 'search' | 'refine' | 'slot'
 */
export async function checkAndConsumeQuota(
  userId: string,
  quotaType: 'search' | 'refine' | 'slot',
): Promise<QuotaStatus> {
  try {
    const tier = await getTierFromRevenueCat();
    const limit = getLimitForType(tier, quotaType);
    const key = storageKey(userId, quotaType);
    const used = await getUsedCount(key);

    if (used >= limit) {
      return {
        allowed: false,
        used,
        limit,
        tier,
        remaining: 0,
        resetAt: startOfTomorrow(),
      };
    }

    // Consume: sayaci artir
    await incrementCount(key, used);

    // Sprint 1 v4.0: mood_searches INSERT artik parse-mood edge function'da
    // yapiliyor (enriched — mood_text, parsed_profile, latency, tokens).
    // Eski recordMoodSearch cagrisi kaldirildi (double insert onlendi).

    return {
      allowed: true,
      used: used + 1,
      limit,
      tier,
      remaining: Math.max(0, limit - (used + 1)),
      resetAt: startOfTomorrow(),
    };
  } catch (err) {
    logger.error(
      '[quota] checkAndConsumeQuota error:', err,
      {
        skipBridge: true,
        code: 'QUOTA_CONSUME_FAILED',
        sampleRate: 0.2,
      },
    );
    Sentry.captureException(err, { tags: { context: 'quota_fail_open', quota_type: quotaType } });
    // Fail-open: hata durumunda kullaniciyi kilitlemez
    return {
      allowed: true,
      used: 0,
      limit: FREE_DAILY_LIMIT,
      tier: 'free',
      remaining: FREE_DAILY_LIMIT,
      resetAt: startOfTomorrow(),
    };
  }
}

/**
 * Game-specific quota check + consume — client-side.
 *
 * @param userId Supabase users tablosundaki UUID
 * @param gameId 'fadein' | 'imposter' | 'logline' | 'quoted'
 */
export async function checkAndConsumeGameQuota(
  userId: string,
  gameId: string,
): Promise<QuotaStatus> {
  try {
    const tier = await getTierFromRevenueCat();
    const limits = TIER_LIMITS[tier];
    const limit = limits.dailyGameLimitPerGame === -1 ? 9999 : limits.dailyGameLimitPerGame;
    const key = storageKey(userId, `game_${gameId}`);
    const used = await getUsedCount(key);

    if (used >= limit) {
      return {
        allowed: false,
        used,
        limit,
        tier,
        remaining: 0,
        resetAt: startOfTomorrow(),
      };
    }

    await incrementCount(key, used);

    return {
      allowed: true,
      used: used + 1,
      limit,
      tier,
      remaining: Math.max(0, limit - (used + 1)),
      resetAt: startOfTomorrow(),
    };
  } catch (err) {
    logger.error(
      '[quota] checkAndConsumeGameQuota error:', err,
      {
        skipBridge: true,
        code: 'QUOTA_GAME_CONSUME_FAILED',
        sampleRate: 0.2,
      },
    );
    Sentry.captureException(err, { tags: { context: 'quota_fail_open', quota_type: `game_${gameId}` } });
    // Fail-open: oyun engagement oncelikli — hata durumunda izin ver
    return {
      allowed: true,
      used: 0,
      limit: 1,
      tier: 'free',
      remaining: 1,
      resetAt: startOfTomorrow(),
    };
  }
}

/**
 * Tum quota durumunu oku (read-only, consume etmez) — client-side.
 */
export async function getFullQuotaStatus(userId: string): Promise<FullQuotaStatus | null> {
  try {
    const tier = await getTierFromRevenueCat();
    const limits = TIER_LIMITS[tier];
    const today = todayDateKey();

    // Tum quota turlerini paralel oku
    const [searchUsed, refineUsed, slotUsed] = await Promise.all([
      getUsedCount(`quota_${userId}_search_${today}`),
      getUsedCount(`quota_${userId}_refine_${today}`),
      getUsedCount(`quota_${userId}_slot_${today}`),
    ]);

    // Game quota'larini oku
    const gameIds = ['fadein', 'imposter', 'logline', 'quoted'];
    const gameUsedPromises = gameIds.map((gid) =>
      getUsedCount(`quota_${userId}_game_${gid}_${today}`),
    );
    const gameUsedValues = await Promise.all(gameUsedPromises);
    const played: Record<string, number> = {};
    gameIds.forEach((gid, i) => {
      played[gid] = gameUsedValues[i];
    });

    return {
      tier,
      searches: {
        used: searchUsed,
        limit: limits.dailySearchLimit,
        bonus_available: 0,
      },
      refines: {
        used: refineUsed,
        limit: limits.dailyRefineLimit,
      },
      slots: {
        used: slotUsed,
        limit: limits.dailySlotLimit,
      },
      games: {
        played,
        limit_per_game: limits.dailyGameLimitPerGame,
      },
      reset_at: startOfTomorrow().toISOString(),
    };
  } catch (err) {
    logger.error(
      '[quota] getFullQuotaStatus error:', err,
      {
        code: 'QUOTA_STATUS_FAILED',
        sampleRate: 0.2,
      },
    );
    return null;
  }
}

/**
 * Bonus search ver (streak rewards icin).
 * Client-side: mevcut search sayacini negatife cekmek yerine
 * ayri bir bonus key tutar.
 */
export async function grantBonusSearches(
  userId: string,
  amount: number,
  _reason: string,
): Promise<void> {
  try {
    const bonusKey = `quota_bonus_${userId}_search_${todayDateKey()}`;
    const current = await getUsedCount(bonusKey);
    await AsyncStorage.setItem(bonusKey, String(current + amount));
    logger.log('[quota] Bonus granted:', amount, 'for user:', userId);
  } catch (err) {
    logger.error(
      '[quota] grantBonusSearches error:', err,
      {
        code: 'QUOTA_BONUS_GRANT_FAILED',
        sampleRate: 0.2,
      },
    );
  }
}

/**
 * Purchase sonrasi quota cache'ini temizle.
 * Yeni tier ile fresh quota baslar.
 */
export async function clearQuotaCache(userId: string): Promise<void> {
  try {
    const today = todayDateKey();
    const types = ['search', 'refine', 'slot', 'game_fadein', 'game_imposter', 'game_logline', 'game_quoted'];
    const keys = types.map((t) => `quota_${userId}_${t}_${today}`);
    keys.push(`quota_bonus_${userId}_search_${today}`);
    await AsyncStorage.multiRemove(keys);
    logger.log('[quota] Cache cleared for user:', userId);
  } catch (err) {
    logger.warn('[quota] Cache clear failed:', err);
  }
}

// ─── Yardimci — Tarih Hesaplama ──────────────────────────────────────────────

/** Bugunun baslangici (UTC 00:00) */
function startOfToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Yarin UTC 00:00 */
function startOfTomorrow(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── Supabase Sorgulari (Eski — geriye uyumluluk) ───────────────────────────

/**
 * Belirli tarihten itibaren yapilan mood arama sayisini dondurur.
 * @deprecated Yeni kodda checkAndConsumeQuota kullan
 */
async function countSearchesSince(userId: string, since: string): Promise<number> {
  const { count, error } = await supabase
    .from('mood_searches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('searched_at', since);

  if (error) {
    logger.warn('[quota] Arama sayisi sorgu hatasi (fail-closed):', error.code, error.message ?? JSON.stringify(error));
    return FREE_DAILY_LIMIT;
  }

  return count ?? 0;
}

// ─── Eski Kota Kontrol Fonksiyonu (geriye uyumluluk) ────────────────────────

/**
 * Kullanicinin mood arama yapip yapamayacagini kontrol eder.
 *
 * @deprecated Yeni kodda checkAndConsumeQuota('search') kullan.
 * Bu fonksiyon SubscriptionContext.checkQuota tarafindan hala kullaniliyor.
 *
 * V2: TIER_LIMITS bazli — eski PLANS.dailyLimit/weeklyLimit referanslari kaldirildi.
 * planId string olarak gelir, planIdToTier ile tier'a cevirilir (legacy safe).
 */
export async function canSearchMood(
  userId: string,
  subscriptionStatus: SubscriptionStatus,
  planId: string | null,
  _trialStartDate: string | null,
): Promise<QuotaCheckResult> {
  // Tier'i belirle — eski 'weekly'/'yearly' dahil guvenli donusum
  const tier: SubscriptionTier =
    (subscriptionStatus === 'free' || subscriptionStatus === 'expired' || !planId)
      ? 'free'
      : planIdToTier(planId);

  const limits = TIER_LIMITS[tier];
  const dailyLimit = limits.dailySearchLimit;
  // Weekly limit: dailyLimit * 7 (basit hesaplama)
  const weeklyLimit = dailyLimit * 7;

  const dailyCount = await countSearchesSince(userId, startOfToday());

  return {
    allowed: dailyCount < dailyLimit,
    remaining: Math.max(0, dailyLimit - dailyCount),
    resetAt: startOfTomorrow(),
    dailyLimit,
    weeklyLimit,
  };
}

// ─── Arama Kaydi ─────────────────────────────────────────────────────────────

/**
 * Mood arama kaydini Supabase'e yazar.
 * Analytics icin korundu — quota kontrolu artik client-side.
 *
 * CRITICAL: Hata durumunda throw eder — cagiran taraf yakalamalI.
 */
export async function recordMoodSearch(userId: string): Promise<void> {
  const { error } = await supabase
    .from('mood_searches')
    .insert({ user_id: userId });

  if (error) {
    logger.error('[quota] Arama kaydi hatasi:', error, {
      code: 'QUOTA_SEARCH_RECORD_FAILED',
      sampleRate: 0.2,
      extra: { pgCode: error.code, detail: error.message ?? JSON.stringify(error) },
    });
    throw new Error(`[quota] recordMoodSearch failed: ${error.code} — ${error.message}`);
  }

  logger.log('[quota] Mood search recorded', { userId });
}

// ─── Trial Kontrol ───────────────────────────────────────────────────────────

/**
 * Verilen email'in daha once free trial kullanip kullanmadigini kontrol eder.
 */
export async function hasUsedFreeTrial(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('trial_claims')
    .select('email')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) {
    if (!error.message?.includes('not find the table') && error.code !== '42P01') {
      logger.error(
        '[quota] Trial kontrol hatasi:', error.message,
        {
          code: 'QUOTA_TRIAL_CHECK_FAILED',
          sampleRate: 0.2,
        },
      );
    }
    return false;
  }

  return data !== null;
}

/**
 * Email'i trial_claims tablosuna kaydeder.
 * Trial satin alimindan hemen sonra cagrilir.
 */
export async function claimFreeTrial(email: string): Promise<void> {
  const { error } = await supabase
    .from('trial_claims')
    .upsert({ email: email.toLowerCase() }, { onConflict: 'email' });

  if (error) {
    if (!error.message?.includes('not find the table') && error.code !== '42P01') {
      logger.error(
        '[quota] Trial kayit hatasi:', error.message,
        {
          code: 'QUOTA_TRIAL_RECORD_FAILED',
          sampleRate: 0.2,
        },
      );
    }
  }
}
