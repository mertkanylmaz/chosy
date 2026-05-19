/**
 * Conversion Funnel — shared type definitions.
 *
 * Trigger event'leri, paywall variant tipleri ve orchestrator
 * arabirimi burada tanimlanir.
 */

// ─── Trigger Events ─────────────────────────────────────────────────────────

/** Paywall gosterimini tetikleyen olay tipleri */
export type TriggerType =
  | 'quota_exhausted'
  | 'watchlist_full'
  | 'streak_milestone'
  | 'game_perfect_streak'
  | 'mood_history_tap'
  | 'streaming_link_tap'
  | 'custom_list_attempt'
  | 'share_card_generated';

/** Paywall gosterimini tetikleyen olay */
export type TriggerEvent =
  | { type: 'quota_exhausted'; quota: 'search' | 'slot' | 'refine' }
  | { type: 'watchlist_full' }
  | { type: 'streak_milestone'; days: number }
  | { type: 'game_perfect_streak'; count: number }
  | { type: 'mood_history_tap' }
  | { type: 'streaming_link_tap'; filmId: number }
  | { type: 'custom_list_attempt' }
  | { type: 'share_card_generated'; count: number };

// ─── Paywall Variants ────────────────────────────────────────────────────────

/** Paywall variant isimleri */
export type PaywallVariantName =
  | 'quota_exhausted'
  | 'streak_milestone'
  | 'watchlist_full'
  | 'mood_history'
  | 'streaming_link';

/** Paywall gosterim kararinin sonucu */
export interface PaywallVariant {
  /** Variant component adi */
  name: PaywallVariantName;
  /** Tetikleyen olay */
  trigger: TriggerEvent;
  /** A/B test grubu (atanmissa) */
  abTestGroup: string | null;
}

// ─── Paywall Event DB ────────────────────────────────────────────────────────

/** paywall_events tablosu icin insert tipi */
export interface PaywallEventInsert {
  user_id: string;
  variant: string;
  trigger_type: string;
  trigger_context: Record<string, unknown>;
  action: 'shown' | 'dismissed' | 'converted' | 'trial_started';
  ab_test_group: string | null;
}
