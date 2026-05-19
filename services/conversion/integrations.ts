/**
 * Conversion Integration Helpers — trigger event'lerini mevcut flow'lara baglar.
 *
 * Bu moduldeki fonksiyonlar mevcut servislerden cagirilarak
 * uygun trigger event'lerini orchestrator'a iletir.
 *
 * Kullanim:
 *   // Watchlist add sonrasi:
 *   await checkWatchlistFullTrigger(userId);
 *
 *   // Streak milestone sonrasi:
 *   checkStreakMilestoneTrigger(streakDays);
 */

import { supabase } from '@/services/supabase';
import { TIER_LIMITS } from '@/constants/subscriptionPlans';
import { logger } from '@/utils/logger';

// ─── Watchlist Full Check ────────────────────────────────────────────────────

/** Watchlist limitine ulasildi mi? Free tier 30 film. */
export async function isWatchlistFull(userId: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from('watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      logger.warn('[conversion] Watchlist count hatasi:', error.message);
      return false;
    }

    const freeLimit = TIER_LIMITS.free.watchlistMaxFilms;
    return (count ?? 0) >= freeLimit;
  } catch (err) {
    logger.warn('[conversion] isWatchlistFull exception:', err);
    return false;
  }
}

// ─── Streak Milestone Check ──────────────────────────────────────────────────

/** Streak milestone'lari */
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

/** Streak sayisi bir milestone mi? */
export function isStreakMilestone(streakDays: number): boolean {
  return STREAK_MILESTONES.includes(streakDays);
}

// ─── Game Perfect Streak ─────────────────────────────────────────────────────

/** Arka arkaya mukemmel oyun sayisi */
const PERFECT_GAME_THRESHOLDS = [3, 5, 7, 10];

/** Mukemmel oyun serisi bir esik mi? */
export function isPerfectGameMilestone(perfectCount: number): boolean {
  return PERFECT_GAME_THRESHOLDS.includes(perfectCount);
}
