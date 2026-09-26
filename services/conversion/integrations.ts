/**
 * Conversion Integration Helpers — trigger event'lerini mevcut flow'lara baglar.
 *
 * ⚠️ Olu varyant temizligi (26 Eyl 2026): `isWatchlistFull` ve
 * `isStreakMilestone` **sifir cagirani** olan orphan helper'lardi ve varyantlari
 * `_archive/` altina tasindi — ikisi de kaldirildi. Geri gerekirse git
 * gecmisinde durur.
 *
 * Kullanim:
 *   // Oyun serisi esigi:
 *   if (isPerfectGameMilestone(count)) { ... }
 */

// ─── Game Perfect Streak ─────────────────────────────────────────────────────

/** Arka arkaya mukemmel oyun sayisi */
const PERFECT_GAME_THRESHOLDS = [3, 5, 7, 10];

/** Mukemmel oyun serisi bir esik mi? */
export function isPerfectGameMilestone(perfectCount: number): boolean {
  return PERFECT_GAME_THRESHOLDS.includes(perfectCount);
}
