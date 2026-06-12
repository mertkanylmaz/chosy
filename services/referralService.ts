/**
 * Referral Service — davet programi frontend API.
 *
 * Kullanim:
 *   - Istatistikler: getReferralStats(userId)
 *   - Davet kodu uygula: applyInviteCode(userId, code)
 *   - Paylasim linki: getShareLink(inviteCode)
 */

import { Share, Platform } from 'react-native';

import { supabase } from './supabase';
import { logger } from '@/utils/logger';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Referral reward record */
export interface ReferralReward {
  type: 'free_month' | 'slot_tokens' | 'lifetime_upgrade' | 'ambassador_badge';
  count: number;
  grantedAt: string;
}

/** Full referral stats */
export interface ReferralStats {
  inviteCode: string;
  totalReferrals: number;
  activatedReferrals: number;
  pendingReferrals: number;
  rewards: ReferralReward[];
  nextMilestone: number | null;
  nextReward: string | null;
  progress: number;
}

/** Apply invite code result */
export interface ApplyInviteResult {
  success: boolean;
  error?: 'INVALID_CODE' | 'SELF_REFERRAL' | 'ALREADY_REFERRED' | 'DUPLICATE';
  referrerId?: string;
}

// ─── Milestone definitions (UI display) ──────────────────────────────────────

export interface ReferralMilestone {
  count: number;
  rewardKey: string;
  iconName: string;
  achieved: boolean;
}

/** Tum milestone'lar — UI'da progress bar icin */
export function getReferralMilestones(activatedCount: number): ReferralMilestone[] {
  return [
    {
      count: 1,
      rewardKey: 'referral.reward1',
      iconName: 'gift-outline',
      achieved: activatedCount >= 1,
    },
    {
      count: 3,
      rewardKey: 'referral.reward3',
      iconName: 'rocket-outline',
      achieved: activatedCount >= 3,
    },
    {
      count: 5,
      rewardKey: 'referral.reward5',
      iconName: 'diamond-outline',
      achieved: activatedCount >= 5,
    },
    {
      count: 10,
      rewardKey: 'referral.reward10',
      iconName: 'trophy-outline',
      achieved: activatedCount >= 10,
    },
  ];
}

// ─── API ────────────────────────────────────────────────────────────────────

/**
 * Kullanicinin referral istatistiklerini doner.
 */
export async function getReferralStats(userId: string): Promise<ReferralStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_referral_stats', {
      p_user_id: userId,
    });

    if (error) {
      logger.error('[referral] Stats RPC error:', error.message);
      return null;
    }

    const result = data as Record<string, unknown>;
    const rawRewards = (result.rewards as Array<Record<string, unknown>>) ?? [];

    return {
      inviteCode: (result.invite_code as string) ?? '',
      totalReferrals: (result.total_referrals as number) ?? 0,
      activatedReferrals: (result.activated_referrals as number) ?? 0,
      pendingReferrals: (result.pending_referrals as number) ?? 0,
      rewards: rawRewards.map((r) => ({
        type: r.type as ReferralReward['type'],
        count: r.count as number,
        grantedAt: r.granted_at as string,
      })),
      nextMilestone: result.next_milestone as number | null,
      nextReward: result.next_reward as string | null,
      progress: (result.progress as number) ?? 0,
    };
  } catch (err) {
    logger.error('[referral] Stats error:', err);
    return null;
  }
}

/**
 * Invite kodu uygular (referee signup sonrasi).
 */
export async function applyInviteCode(
  inviteCode: string,
): Promise<ApplyInviteResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return { success: false, error: 'INVALID_CODE' };
    }

    const { data, error } = await supabase.rpc('apply_invite_code', {
      p_referee_id: session.user.id,
      p_invite_code: inviteCode.toUpperCase(),
    });

    if (error) {
      logger.error('[referral] Apply invite code error:', error.message);
      return { success: false, error: 'INVALID_CODE' };
    }

    const result = data as Record<string, unknown>;
    return {
      success: (result.success as boolean) ?? false,
      error: result.error as ApplyInviteResult['error'],
      referrerId: result.referrer_id as string | undefined,
    };
  } catch (err) {
    logger.error('[referral] Apply invite code error:', err);
    return { success: false, error: 'INVALID_CODE' };
  }
}

/**
 * Share link olusturur.
 */
export function getShareLink(inviteCode: string): string {
  return `https://chosy.vercel.app?ref=${inviteCode}`;
}

/**
 * Native share dialog acar.
 */
export async function shareInviteLink(
  inviteCode: string,
  message: string,
): Promise<boolean> {
  try {
    const link = getShareLink(inviteCode);
    const result = await Share.share(
      Platform.OS === 'ios'
        ? { message, url: link }
        : { message: `${message}\n${link}` },
    );

    return result.action === Share.sharedAction;
  } catch (err) {
    logger.error('[referral] Share error:', err);
    return false;
  }
}
