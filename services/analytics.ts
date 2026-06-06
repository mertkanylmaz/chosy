/**
 * Analytics Service — uygulama icindeki olay takibi.
 *
 * Slot machine event'leri + genel engagement metrikleri.
 * Supabase roulette_picks tablosuna ve logger'a kaydeder (fire-and-forget).
 */
import { supabase } from './supabase';
import { getAppUserId } from './auth-utils';
import { logger } from '../utils/logger';
import type { SlotVariant } from './slotService';

// ─── Event Tipleri ──────────────────────────────────────────────────────────

type AnalyticsEvent =
  | 'slot_spin_initiated'
  | 'slot_spin_completed'
  | 'slot_film_accepted'
  | 'slot_film_rerolled'
  | 'slot_premium_paywall_shown'
  | 'slot_premium_paywall_converted'
  | 'mood_search_requested'
  | 'mood_search_completed'
  | 'mood_search_failed'
  | 'mood_search_zero_results';

interface EventPayload {
  event: AnalyticsEvent;
  variant?: SlotVariant;
  film_id?: string;
  match_score?: number;
  metadata?: Record<string, unknown>;
}

// ─── Tracker ────────────────────────────────────────────────────────────────

/**
 * Analytics event'i fire-and-forget olarak kaydeder.
 *
 * Strateji: slot_spin_completed ve slot_film_accepted event'leri
 * zaten slot_spins tablosunda kaydediliyor (Edge Function tarafindan).
 * Diger event'ler roulette_picks tablosuna outcome olarak kaydedilir.
 * Hata UI'i engellemez.
 */
async function trackEvent(payload: EventPayload): Promise<void> {
  try {
    const userId = await getAppUserId();
    if (!userId) return;

    logger.log(`[analytics] ${payload.event}`, {
      variant: payload.variant,
      filmId: payload.film_id,
      matchScore: payload.match_score,
    });

    // Paywall event'lerini roulette_picks'e kaydet (outcome = 'paywall_shown')
    if (payload.event === 'slot_premium_paywall_shown' && payload.variant) {
      await supabase.from('roulette_picks').insert({
        user_id: userId,
        film_id: null,
        runtime_filter: null,
        excluded_genres: [],
        used_mood: payload.variant === 'mood_filtered',
        outcome: 'paywall_shown',
        candidate_count: 0,
      }).then(
        () => { /* success */ },
        (err) => logger.warn('[analytics] paywall track insert error:', err),
      );
    }

    // Reroll event'ini slot_spins'de guncelle
    if (payload.event === 'slot_film_rerolled' && payload.variant) {
      // slot_spins'teki son spin'i 'rerolled' olarak isaretle
      // (accepted = false zaten default, ek bilgi icin mood_context'e yazalim)
      // Bu zaten roulette.tsx'de updateRouletteOutcome ile yapiliyor — extra log gereksiz
    }

  } catch (err) {
    logger.warn('[analytics] trackEvent error:', err);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/** Slot spin baslatildi */
export function trackSlotSpinInitiated(variant: SlotVariant): void {
  trackEvent({ event: 'slot_spin_initiated', variant });
}

/** Slot spin tamamlandi (film geldi) */
export function trackSlotSpinCompleted(
  variant: SlotVariant,
  filmId: string,
  matchScore?: number,
): void {
  trackEvent({
    event: 'slot_spin_completed',
    variant,
    film_id: filmId,
    match_score: matchScore,
  });
}

/** Kullanici filmi kabul etti */
export function trackSlotFilmAccepted(variant: SlotVariant, filmId: string): void {
  trackEvent({ event: 'slot_film_accepted', variant, film_id: filmId });
}

/** Kullanici tekrar cevirmek istedi */
export function trackSlotFilmRerolled(variant: SlotVariant): void {
  trackEvent({ event: 'slot_film_rerolled', variant });
}

/** Free user premium variant'a tikladi — paywall gosterildi */
export function trackSlotPremiumPaywallShown(variant: SlotVariant): void {
  trackEvent({ event: 'slot_premium_paywall_shown', variant });
}

/** Free user paywall'dan satin alma yapti */
export function trackSlotPremiumPaywallConverted(variant: SlotVariant): void {
  trackEvent({ event: 'slot_premium_paywall_converted', variant });
}

// ─── Mood Search Events (Sprint 1 v4.0) ────────────────────────────────────

/** Kullanici mood arama baslatti */
export function trackMoodSearchRequested(moodLength: number, wordCount: number): void {
  trackEvent({
    event: 'mood_search_requested',
    metadata: { mood_length: moodLength, word_count: wordCount },
  });
}

/** Mood arama basariyla tamamlandi */
export function trackMoodSearchCompleted(params: {
  searchId: string | null;
  resultCount: number;
  rpcVersion: string;
  profileName?: string;
}): void {
  trackEvent({
    event: 'mood_search_completed',
    metadata: {
      search_id: params.searchId,
      result_count: params.resultCount,
      rpc_version: params.rpcVersion,
      profile_name: params.profileName,
    },
  });
}

/** Mood arama hata ile bitti */
export function trackMoodSearchFailed(errorCode: string, moodLength: number): void {
  trackEvent({
    event: 'mood_search_failed',
    metadata: { error_code: errorCode, mood_length: moodLength },
  });
}

/** Mood arama sonuc donmedi (anomali) */
export function trackMoodSearchZeroResults(searchId: string | null, moodTextPreview: string): void {
  trackEvent({
    event: 'mood_search_zero_results',
    metadata: {
      search_id: searchId,
      mood_text_preview: moodTextPreview.slice(0, 50),
    },
  });
}
