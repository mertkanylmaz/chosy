/**
 * Quota Engine — mood arama hakkı yönetimi.
 *
 * Plan bazlı günlük/haftalık limit kontrolü yapar.
 * Supabase mood_searches tablosundan sayaç okur.
 *
 * Kurallar:
 *   - Free: toplam 1 arama (onboarding bedava, sonrası paywall)
 *   - Weekly trial (ilk 10 gün): toplam 20 arama
 *   - Weekly (sonraki): 14/hafta (2/gün)
 *   - Monthly / Yearly: 3/gün, 21/hafta cap
 */

import { supabase } from './supabase';
import {
  FREE_DAILY_LIMIT,
  PLANS,
  TRIAL_FIRST_PERIOD_DAYS,
  TRIAL_FIRST_PERIOD_QUOTA,
  type PlanId,
  type SubscriptionStatus,
} from '@/constants/subscriptionPlans';
import { logger } from '@/utils/logger';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Kota kontrolü sonucu */
export interface QuotaCheckResult {
  /** Mood arama yapabilir mi? */
  allowed: boolean;
  /** Kalan arama hakkı */
  remaining: number;
  /** Kota ne zaman sıfırlanır (reset zamanı) */
  resetAt: Date | null;
  /** Günlük limit */
  dailyLimit: number;
  /** Haftalık limit */
  weeklyLimit: number;
}

// ─── Yardımcı — Tarih Hesaplama ──────────────────────────────────────────────

/** Bugünün başlangıcı (UTC 00:00) */
function startOfToday(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Bu haftanın Pazartesi günü (UTC 00:00) */
function startOfThisWeek(): string {
  const d = new Date();
  const day = d.getUTCDay();
  // Pazartesi = 1, Pazar = 0 (Pazar'ı 7 olarak say)
  const diff = day === 0 ? 6 : day - 1;
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Yarın UTC 00:00 */
function startOfTomorrow(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Gelecek Pazartesi UTC 00:00 */
function startOfNextWeek(): Date {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = day === 0 ? 1 : 8 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

// ─── Supabase Sorguları ──────────────────────────────────────────────────────

/**
 * Belirli tarihten itibaren yapılan mood arama sayısını döndürür.
 */
async function countSearchesSince(userId: string, since: string): Promise<number> {
  const { count, error } = await supabase
    .from('mood_searches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('searched_at', since);

  if (error) {
    // Fail-closed: hata durumunda limiti dolu say — paywall bypass'i engelle.
    // Kullanıcı deneyimi: "kota doldu" overlay gösterir, paywall'a yönlendirir.
    logger.warn('[quota] Arama sayısı sorgu hatası (fail-closed):', error.code, error.message ?? JSON.stringify(error));
    return FREE_DAILY_LIMIT;
  }

  return count ?? 0;
}

/**
 * Trial başlangıcından itibaren toplam arama sayısını döndürür.
 */
async function countSearchesSinceTrialStart(
  userId: string,
  trialStartDate: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('mood_searches')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('searched_at', trialStartDate);

  if (error) {
    // Fail-closed: hata durumunda limiti dolu say
    logger.warn('[quota] Trial arama sayısı sorgu hatası (fail-closed):', error.code, error.message ?? JSON.stringify(error));
    return FREE_DAILY_LIMIT;
  }

  return count ?? 0;
}

// ─── Ana Kota Kontrol Fonksiyonu ─────────────────────────────────────────────

/**
 * Kullanıcının mood arama yapıp yapamayacağını kontrol eder.
 *
 * @param userId Supabase users tablosundaki UUID
 * @param subscriptionStatus Kullanıcının abonelik durumu
 * @param planId Aktif plan (null = free)
 * @param trialStartDate Trial başlangıç tarihi (ISO string, null = trial yok)
 */
export async function canSearchMood(
  userId: string,
  subscriptionStatus: SubscriptionStatus,
  planId: PlanId | null,
  trialStartDate: string | null,
): Promise<QuotaCheckResult> {
  // ─── Free Kullanıcı ─────────────────────────────────────────────────────
  // Toplam 1 arama hakkı (onboarding'deki ilk arama kayıt edilmez — bedava).
  // İlk arama sonrası her "Find Movies" → QuotaExhausted → paywall.
  if (subscriptionStatus === 'free' || subscriptionStatus === 'expired' || !planId) {
    const totalCount = await countSearchesSince(userId, '1970-01-01T00:00:00Z');
    return {
      allowed: totalCount < FREE_DAILY_LIMIT,
      remaining: Math.max(0, FREE_DAILY_LIMIT - totalCount),
      resetAt: null,
      dailyLimit: FREE_DAILY_LIMIT,
      weeklyLimit: FREE_DAILY_LIMIT,
    };
  }

  const plan = PLANS[planId];

  // ─── Weekly Plan — Trial Dönemi ─────────────────────────────────────────
  if (planId === 'weekly' && subscriptionStatus === 'trial' && trialStartDate) {
    const trialStart = new Date(trialStartDate);
    const daysSinceTrialStart = Math.floor(
      (Date.now() - trialStart.getTime()) / (1000 * 60 * 60 * 24),
    );

    // İlk 10 gün (trial 3 gün + ilk hafta 7 gün): toplam 20 hak
    if (daysSinceTrialStart < TRIAL_FIRST_PERIOD_DAYS) {
      const totalUsed = await countSearchesSinceTrialStart(userId, trialStartDate);
      const remaining = Math.max(0, TRIAL_FIRST_PERIOD_QUOTA - totalUsed);
      return {
        allowed: remaining > 0,
        remaining,
        resetAt: new Date(trialStart.getTime() + TRIAL_FIRST_PERIOD_DAYS * 24 * 60 * 60 * 1000),
        dailyLimit: plan.dailyLimit,
        weeklyLimit: TRIAL_FIRST_PERIOD_QUOTA,
      };
    }

    // Trial bitti ama abonelik aktif — normal weekly kurallarına geç
  }

  // ─── Weekly Plan — Normal ───────────────────────────────────────────────
  if (planId === 'weekly') {
    const weeklyCount = await countSearchesSince(userId, startOfThisWeek());
    const remaining = Math.max(0, plan.weeklyLimit - weeklyCount);
    return {
      allowed: remaining > 0,
      remaining,
      resetAt: startOfNextWeek(),
      dailyLimit: plan.dailyLimit,
      weeklyLimit: plan.weeklyLimit,
    };
  }

  // ─── Monthly / Yearly ──────────────────────────────────────────────────
  const dailyCount = await countSearchesSince(userId, startOfToday());
  const weeklyCount = await countSearchesSince(userId, startOfThisWeek());

  if (dailyCount >= plan.dailyLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: startOfTomorrow(),
      dailyLimit: plan.dailyLimit,
      weeklyLimit: plan.weeklyLimit,
    };
  }

  if (weeklyCount >= plan.weeklyLimit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: startOfNextWeek(),
      dailyLimit: plan.dailyLimit,
      weeklyLimit: plan.weeklyLimit,
    };
  }

  const dailyRemaining = plan.dailyLimit - dailyCount;
  const weeklyRemaining = plan.weeklyLimit - weeklyCount;

  return {
    allowed: true,
    remaining: Math.min(dailyRemaining, weeklyRemaining),
    resetAt: dailyRemaining <= weeklyRemaining ? startOfTomorrow() : startOfNextWeek(),
    dailyLimit: plan.dailyLimit,
    weeklyLimit: plan.weeklyLimit,
  };
}

// ─── Arama Kaydı ─────────────────────────────────────────────────────────────

/**
 * Mood arama kaydını Supabase'e yazar.
 * mood.tsx'te handleFindMovies başarılı olduktan sonra çağrılır.
 */
export async function recordMoodSearch(userId: string): Promise<void> {
  const { error } = await supabase
    .from('mood_searches')
    .insert({ user_id: userId });

  if (error) {
    logger.error('[quota] Arama kaydı hatası:', error.code, error.message ?? JSON.stringify(error));
    // Hata durumunda bile devam et — kullanıcı deneyimini engelleme.
    // Ama log'a yaz ki sorun tespit edilebilsin.
  }
}

// ─── Trial Kontrol ───────────────────────────────────────────────────────────

/**
 * Verilen email'in daha önce free trial kullanıp kullanmadığını kontrol eder.
 */
export async function hasUsedFreeTrial(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('trial_claims')
    .select('email')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (error) {
    if (!error.message?.includes('not find the table') && error.code !== '42P01') {
      logger.error('[quota] Trial kontrol hatası:', error.message);
    }
    return false;
  }

  return data !== null;
}

/**
 * Email'i trial_claims tablosuna kaydeder.
 * Trial satın alımından hemen sonra çağrılır.
 */
export async function claimFreeTrial(email: string): Promise<void> {
  const { error } = await supabase
    .from('trial_claims')
    .upsert({ email: email.toLowerCase() }, { onConflict: 'email' });

  if (error) {
    if (!error.message?.includes('not find the table') && error.code !== '42P01') {
      logger.error('[quota] Trial kayıt hatası:', error.message);
    }
  }
}
