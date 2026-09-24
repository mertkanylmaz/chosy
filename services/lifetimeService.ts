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

/**
 * `claim_lifetime_spot` sonucunun ayırt edilen kodları.
 *
 * ⚠️ `SOLD_OUT` ve `ALREADY_LIFETIME` yalnızca RPC'nin KENDİ döndürdüğü iş
 * kuralı reddleridir. Ağ/DB/izin hataları bunlara GENELLENMEZ — eskiden her
 * hata `SOLD_OUT` dönüyordu ve çağıran, ödeme alınmış kullanıcıyı sessizce
 * annual plana yazıyordu.
 */
export type ClaimErrorCode =
  /** RPC: 1.000 kontenjan dolu */
  | 'SOLD_OUT'
  /** RPC: kullanıcının zaten lifetime kaydı var (idempotent tekrar) */
  | 'ALREADY_LIFETIME'
  /** Migration 109 guard'ı: kimlik eşleşmedi (42501) */
  | 'FORBIDDEN'
  /** Taşıma/DB/bilinmeyen — İŞ KURALI DEĞİL, kontenjan hakkında bilgi vermez */
  | 'RPC_FAILED';

/** Claim result */
export interface ClaimResult {
  success: boolean;
  error?: ClaimErrorCode;
  /**
   * true → hata RPC'nin iş kuralından değil, taşıma/izin katmanından geldi.
   * Çağıran bu durumda kontenjan hakkında HİÇBİR çıkarım yapmamalıdır.
   */
  transportFailure?: boolean;
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
      // 109 guard'i 42501 ile RAISE ediyor; digerleri tasima/DB hatasi.
      const forbidden =
        error.code === '42501' || /FORBIDDEN/i.test(error.message ?? '');
      logger.error(
        '[lifetime] claim_lifetime_spot RPC hatasi', error,
        {
          code: forbidden ? 'LIFETIME_CLAIM_FORBIDDEN' : 'LIFETIME_CLAIM_RPC_FAILED',
          extra: { userId, pgCode: error.code ?? null },
        },
      );
      return {
        success: false,
        error: forbidden ? 'FORBIDDEN' : 'RPC_FAILED',
        transportFailure: true,
      };
    }

    const result = (data ?? {}) as Record<string, unknown>;
    if (result.success === true) {
      return {
        success: true,
        saleNumber: result.sale_number as number | undefined,
        totalSold: result.total_sold as number | undefined,
      };
    }

    // RPC'nin kendi is kurali reddi — yalnizca tanidigimiz iki kod gecerli.
    const rpcError = result.error as string | undefined;
    if (rpcError === 'SOLD_OUT' || rpcError === 'ALREADY_LIFETIME') {
      return { success: false, error: rpcError, totalSold: result.sold as number | undefined };
    }

    // Tanimadigimiz bir sekil geldi: SOLD_OUT diye yorumlamak yasak.
    logger.error(
      '[lifetime] claim_lifetime_spot beklenmeyen yanit', new Error('unexpected claim shape'),
      { code: 'LIFETIME_CLAIM_UNEXPECTED_SHAPE', extra: { userId, rpcError: rpcError ?? null } },
    );
    return { success: false, error: 'RPC_FAILED', transportFailure: true };
  } catch (err) {
    logger.error(
      '[lifetime] claim_lifetime_spot istisnasi', err,
      { code: 'LIFETIME_CLAIM_EXCEPTION', extra: { userId } },
    );
    return { success: false, error: 'RPC_FAILED', transportFailure: true };
  }
}
