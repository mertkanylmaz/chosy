/**
 * Subscription Service — Supabase abonelik CRUD işlemleri.
 *
 * RevenueCat ödeme yönetir, bu servis Supabase'deki
 * subscriptions tablosunu senkronize tutar.
 *
 * Yazma YOK: `subscriptions`'a yalnız sunucu yazar (webhook / sync-entitlement,
 * migration 135). Bu dosya yalnız okur.
 *
 * Kullanım:
 *   - Durum sorgusu: getUserSubscription()
 *   - Context init: getOrCreateSubscription()
 */

import { supabase } from './supabase';
import type { LegacyPlanId, SubscriptionStatus } from '@/constants/subscriptionPlans';
import { logger } from '@/utils/logger';

// ─── Yardımcı ────────────────────────────────────────────────────────────────

/** Migration 012 henüz deploy edilmemiş olabilir — tablo yoksa sessizce geç */
function isTableMissing(error: { message?: string; code?: string }): boolean {
  return (error.message?.includes('not find the table') ?? false) ||
    error.code === '42P01';
}

// ─── Tipler ───────────────────────────────────────────────────────────────────

/**
 * Supabase subscriptions tablosu satiri.
 * plan alani eski kayitlarda 'weekly'/'yearly' olabilir — LegacyPlanId kullanilir.
 */
export interface SubscriptionRow {
  id: string;
  user_id: string;
  plan: LegacyPlanId;
  status: SubscriptionStatus;
  trial_used: boolean;
  started_at: string;
  expires_at: string | null;
  rc_customer_id: string | null;
  created_at: string;
}

// ─── Sorgular ────────────────────────────────────────────────────────────────

/**
 * Kullanıcının aktif aboneliğini döndürür.
 * Yoksa null döner (free kullanıcı).
 */
export async function getUserSubscription(
  userId: string,
): Promise<SubscriptionRow | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isTableMissing(error)) {
      logger.error('[subscription] Abonelik sorgu hatası:', error.message);
    }
    return null;
  }

  return data as SubscriptionRow | null;
}

/**
 * Kullanıcının daha önce trial kullanıp kullanmadığını kontrol eder.
 * Supabase subscriptions tablosundan bakılır.
 */
export async function hasUserUsedTrial(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('trial_used', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isTableMissing(error)) logger.error('[subscription] Trial kontrol hatası:', error.message);
    return false;
  }

  return data !== null;
}
