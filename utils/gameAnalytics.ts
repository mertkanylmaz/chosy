/**
 * Game Analytics — PostHog event helper'lari.
 *
 * Tum oyun funnel event'leri burada tanimlanir.
 * Naming convention: game_* prefix, snake_case (brief'te tanimi var).
 */
import { posthogAnalytics } from '@/services/posthog';

// ─── Funnel Event'leri ────────────────────────────────────────────────────

/** Oyun ekrani acildi */
export function trackGameOpened(gameId: string, puzzleNo: number, source: 'hub' | 'home_widget' | 'push' | 'play_next' = 'hub'): void {
  posthogAnalytics.track('game_daily_opened', { game_id: gameId, puzzle_no: puzzleNo, source });
}

/** Tahmin gonderildi */
export function trackGuessSubmitted(gameId: string, guessNo: number, latencyMs: number): void {
  posthogAnalytics.track('game_guess_submitted', { game_id: gameId, guess_no: guessNo, latency_ms: latencyMs });
}

/** Ipucu kullanildi */
export function trackHintUsed(gameId: string, hintType: string, hintNo: number): void {
  posthogAnalytics.track('game_hint_used', { game_id: gameId, hint_type: hintType, hint_no: hintNo });
}

/** Guven bahsi secildi (Imposter) — submit'ten once */
export function trackConfidenceSet(gameId: string, round: number, confidence: number): void {
  posthogAnalytics.track('game_confidence_set', { game_id: gameId, round, confidence });
}

/** Oyun tamamlandi */
export function trackGameCompleted(params: {
  gameId: string;
  won: boolean;
  guessesUsed: number;
  timeToSolveS: number;
  xp: number;
}): void {
  posthogAnalytics.track('game_daily_completed', {
    game_id: params.gameId,
    won: params.won,
    guesses_used: params.guessesUsed,
    time_to_solve_s: params.timeToSolveS,
    xp: params.xp,
  });
}

// ─── Result Card Downstream ───────────────────────────────────────────────

/** Sonuc karti goruntulenince */
export function trackResultCardViewed(gameId: string, solved: boolean): void {
  posthogAnalytics.track('game_result_card_viewed', { game_id: gameId, solved });
}

/** WhyThisMovie karti goruntulenince */
export function trackWhyThisMovieViewed(gameId: string): void {
  posthogAnalytics.track('game_why_this_movie_viewed', { game_id: gameId });
}

/** Film sayfasina gecis */
export function trackFilmPageOpened(gameId: string, filmId: number): void {
  posthogAnalytics.track('game_film_page_opened', { game_id: gameId, film_id: filmId });
}

/** Watchlist'e ekleme */
export function trackWatchlistAdded(gameId: string, filmId: number): void {
  posthogAnalytics.track('game_watchlist_added', { game_id: gameId, film_id: filmId });
}

/** Play Next tiklanma */
export function trackPlayNextTapped(fromGame: string, toGame: string): void {
  posthogAnalytics.track('game_play_next_tapped', { from_game: fromGame, to_game: toGame });
}

/** Share karti olusturuldu */
export function trackShareRendered(gameId: string): void {
  posthogAnalytics.track('game_share_card_rendered', { game_id: gameId });
}

/** Share tamamlandi */
export function trackShareCompleted(gameId: string, channel: 'image' | 'text'): void {
  posthogAnalytics.track('game_share_completed', { game_id: gameId, channel });
}

// ─── Hub & Progression ──────────────────────────────────────────────────

/** Daily Chest acildi */
export function trackDailyChestOpened(): void {
  posthogAnalytics.track('game_daily_chest_opened', {});
}

/** Hub'da DNA karti goruntulendi */
export function trackHubDnaCardViewed(): void {
  posthogAnalytics.track('game_hub_dna_card_viewed', {});
}

/** Recommended route'tan oyuna gidildi */
export function trackRecommendedRouteTapped(gameId: string): void {
  posthogAnalytics.track('game_recommended_route_tapped', { game_id: gameId });
}

/** Milestone kazanildi */
export function trackMilestoneEarned(milestoneId: string, category: string): void {
  posthogAnalytics.track('game_milestone_earned', { milestone_id: milestoneId, category });
}
