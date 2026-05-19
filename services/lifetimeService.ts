/**
 * Lifetime Service — Founding Member program frontend API.
 *
 * Kullanim:
 *   - Counter: getLifetimeCounter()
 *   - Founding member kontrol: isFoundingMember(userId)
 *   - Satin alma sonrasi: claimLifetimeSpot(userId, price)
 */

import { supabase } from './supabase';
import { logger } from '@/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Lifetime counter response */
export interface LifetimeCounter {
  sold: number;
  remaining: number;
  total: number;
  percent: number;
  soldOut: boolean;
}

/** Founding member info */
export interface FoundingMemberInfo {
  isMember: boolean;
  saleNumber?: number;
  purchasedAt?: string;
}

/** Claim result */
export interface ClaimResult {
  success: boolean;
  error?: 'SOLD_OUT' | 'ALREADY_LIFETIME';
  saleNumber?: number;
  totalSold?: number;
}

// ─── API ────────────────────────────────────────────────────────────────────

/**
 * Lifetime counter'i doner (public, auth gerekmez).
 * Edge Function uzerinden cache'li response.
 */
export async function getLifetimeCounter(): Promise<LifetimeCounter> {
  try {
    const { data, error } = await supabase.rpc('get_lifetime_counter');

    if (error) {
      logger.error('[lifetime] Counter RPC error:', error.message);
      return { sold: 0, remaining: 1000, total: 1000, percent: 0, soldOut: false };
    }

    const result = data as Record<string, unknown>;
    return {
      sold: (result.sold as number) ?? 0,
      remaining: (result.remaining as number) ?? 1000,
      total: (result.total as number) ?? 1000,
      percent: (result.percent as number) ?? 0,
      soldOut: (result.sold_out as boolean) ?? false,
    };
  } catch (err) {
    logger.error('[lifetime] Counter fetch error:', err);
    return { sold: 0, remaining: 1000, total: 1000, percent: 0, soldOut: false };
  }
}

/**
 * Kullanicinin founding member olup olmadigini kontrol eder.
 */
export async function isFoundingMember(userId: string): Promise<FoundingMemberInfo> {
  try {
    const { data, error } = await supabase.rpc('is_founding_member', {
      p_user_id: userId,
    });

    if (error) {
      logger.error('[lifetime] Founding member check error:', error.message);
      return { isMember: false };
    }

    const result = data as Record<string, unknown>;
    return {
      isMember: (result.is_member as boolean) ?? false,
      saleNumber: result.sale_number as number | undefined,
      purchasedAt: result.purchased_at as string | undefined,
    };
  } catch (err) {
    logger.error('[lifetime] Founding member check error:', err);
    return { isMember: false };
  }
}

/**
 * Lifetime spot claim eder (satin alma sonrasi).
 * Normalde Edge Function (process-lifetime-purchase) uzerinden tetiklenir,
 * ama frontend'den de cagrilabilir (fallback).
 */
export async function claimLifetimeSpot(
  userId: string,
  price: number = 89.99,
  rcTransactionId?: string,
): Promise<ClaimResult> {
  try {
    const { data, error } = await supabase.rpc('claim_lifetime_spot', {
      p_user_id: userId,
      p_price: price,
      p_rc_transaction_id: rcTransactionId ?? null,
    });

    if (error) {
      logger.error('[lifetime] Claim error:', error.message);
      return { success: false, error: 'SOLD_OUT' };
    }

    const result = data as Record<string, unknown>;
    return {
      success: (result.success as boolean) ?? false,
      error: result.error as ClaimResult['error'],
      saleNumber: result.sale_number as number | undefined,
      totalSold: result.total_sold as number | undefined,
    };
  } catch (err) {
    logger.error('[lifetime] Claim error:', err);
    return { success: false, error: 'SOLD_OUT' };
  }
}
