/**
 * Subscription Service — Supabase abonelik CRUD işlemleri.
 *
 * RevenueCat ödeme yönetir, bu servis Supabase'deki
 * subscriptions tablosunu senkronize tutar.
 *
 * Kullanım:
 *   - Satın alma sonrası: upsertSubscription()
 *   - Durum sorgusu: getUserSubscription()
 *   - Context init: getOrCreateSubscription()
 */

import { supabase } from './supabase';
import type { LegacyPlanId, PlanId, SubscriptionStatus } from '@/constants/subscriptionPlans';
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
 * Abonelik oluşturur veya günceller.
 * RevenueCat satın alma başarılı olduktan sonra çağrılır.
 */
export async function upsertSubscription(params: {
  userId: string;
  plan: PlanId;
  status: SubscriptionStatus;
  trialUsed?: boolean;
  expiresAt?: string | null;
  rcCustomerId?: string | null;
}): Promise<SubscriptionRow | null> {
  const { userId, plan, status, trialUsed, expiresAt, rcCustomerId } = params;

  // Mevcut aktif abonelik var mı?
  const existing = await getUserSubscription(userId);

  if (existing) {
    // Güncelle
    const { data, error } = await supabase
      .from('subscriptions')
      .update({
        plan,
        status,
        trial_used: trialUsed ?? existing.trial_used,
        expires_at: expiresAt ?? existing.expires_at,
        rc_customer_id: rcCustomerId ?? existing.rc_customer_id,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      if (!isTableMissing(error)) logger.error('[subscription] Abonelik güncelleme hatası:', error.message);
      return null;
    }

    return data as SubscriptionRow;
  }

  // Yeni oluştur
  const { data, error } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan,
      status,
      trial_used: trialUsed ?? false,
      expires_at: expiresAt ?? null,
      rc_customer_id: rcCustomerId ?? null,
    })
    .select()
    .single();

  if (error) {
    if (!isTableMissing(error)) logger.error('[subscription] Abonelik oluşturma hatası:', error.message);
    return null;
  }

  return data as SubscriptionRow;
}

/**
 * Abonelik durumunu günceller (expire, cancel vb.).
 */
export async function updateSubscriptionStatus(
  subscriptionId: string,
  status: SubscriptionStatus,
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ status })
    .eq('id', subscriptionId);

  if (error) {
    if (!isTableMissing(error)) logger.error('[subscription] Durum güncelleme hatası:', error.message);
  }
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
