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
  /**
   * ⚠️ Olu varyant temizligi (26 Eyl 2026): `streak_milestone` ve
   * `game_perfect_streak` **tip olarak korunur** ama varyant uretmez
   * (`triggerToVariant` → null). Cagiranlari dondurulmus 4 oyun oldugu icin
   * oyun kodu degistirilmedi. `watchlist_full` + `custom_list_attempt`
   * hicbir yerden gonderilmedigi icin tamamen kaldirildi.
   */
  | 'streak_milestone'
  | 'game_perfect_streak'
  | 'mood_history_tap'
  | 'streaming_link_tap'
  | 'share_card_generated'
  | 'profile_upgrade'
  | 'roulette_limit'
  | 'lifetime_soldout'
  /** K-46: 2. kaçırılan gün → arşiv. v1'in TEK gauntlet tetikleyicisi. */
  | 'missed_day_archive';

/** Paywall gosterimini tetikleyen olay */
export type TriggerEvent =
  | { type: 'quota_exhausted'; quota: 'search' | 'slot' | 'refine' }
  | { type: 'streak_milestone'; days: number }
  | { type: 'game_perfect_streak'; count: number }
  | { type: 'mood_history_tap' }
  | { type: 'streaming_link_tap'; filmId: number }
  | { type: 'share_card_generated'; count: number }
  | { type: 'profile_upgrade' }
  | { type: 'roulette_limit' }
  | { type: 'lifetime_soldout' }
  /**
   * K-46. `missedDayCount` sunucudan gelir (`get-archive-status`), istemci
   * saymaz. Uygunluk kararı da sunucuda: `archiveEligible` false ise bu olay
   * hiç gönderilmez.
   */
  | { type: 'missed_day_archive'; missedDayCount: number };

// ─── Paywall Variants ────────────────────────────────────────────────────────

/** Paywall variant isimleri */
export type PaywallVariantName =
  | 'quota_exhausted'
  | 'mood_history'
  | 'streaming_link'
  | 'profile_upgrade'
  | 'lifetime_soldout'
  | 'missed_day_archive';

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

/**
 * Paywall'ın nasıl kapatıldığı (E-09 `dismiss_method`).
 *
 * Üçü de "dismissed" sayılır ama aynı şey DEĞİLDİR: `dismiss_button` bilinçli
 * bir ret, `drag_handle` refleks kapatma, `system_back` çoğu zaman paywall'a
 * hiç bakılmadığının işareti. Ayrım olmadan dönüşmeyen bir paywall'ın nedeni
 * ölçülemez.
 */
export type PaywallDismissMethod = 'drag_handle' | 'dismiss_button' | 'system_back';
