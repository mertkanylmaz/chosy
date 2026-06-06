/**
 * Taste Signal Service
 *
 * Sprint 2 TASK 2.1: Personalization katmanı için event-sourcing.
 * Tüm taste sinyallerini user_taste_signals tablosuna append-only yazar.
 *
 * Architecture:
 * - Public API: her signal type için ayrı typed function (recordWatchlistAdd, vs.)
 * - Private generic: recordSignal() — tek yazma noktası
 * - Offline: network fail → AsyncStorage queue (offlineQueue.ts pattern)
 * - Debouncing: detail_view aynı film için 30s'de tekrar yazılmaz
 * - Non-blocking: fire-and-forget, UI thread'i bekletmez
 * - Errors: yakalanır, console.error + (gelecekte) Sentry — sessiz yutulmaz
 *
 * Strength scale: [-1, 1]
 * - Pozitif: pozitif sinyal (ilgi, beğeni)
 * - Negatif: kaçınma sinyali (uzun film detail view 3s = ilgisizlik)
 *
 * Usage (UI):
 *   import { tasteSignals } from '@/services/tasteSignalService';
 *   await tasteSignals.recordWatchlistAdd(filmId);
 *   tasteSignals.recordDetailView(filmId, durationMs); // fire-and-forget
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getAppUserId } from './auth-utils';
import { logger } from '../utils/logger';

// ─── Type Definitions ────────────────────────────────────────────────────────

/** Backend ENUM ile birebir uyumlu. Migration 036'da tanımlandı. */
export type TasteSignalType =
  | 'watchlist_add'
  | 'watchlist_remove'
  | 'detail_view'
  | 'swipe_right'
  | 'swipe_left'
  | 'pick_clicked'
  | 'mood_search_completed';

interface SignalPayload {
  user_id: string;
  film_id: string | null;
  signal_type: TasteSignalType;
  strength: number;  // [-1, 1] CHECK constraint
  metadata: Record<string, unknown>;
}

// ─── Strength Formulas ───────────────────────────────────────────────────────

/**
 * Detail view strength formula.
 * - <5s: negatif (-0.15) — hızlı çıkış = ilgisizlik sinyali
 * - 5-15s: nötr (0.0) — geçici bakış
 * - 15-30s: orta pozitif (0.5)
 * - 30-60s: güçlü pozitif (0.7)
 * - 60s+: çok güçlü pozitif (0.85, max 0.85 cap)
 *
 * Cap 0.85: watchlist_add'i (0.9) geçmesin — kasıtlı action > pasif view.
 */
function detailViewStrength(durationMs: number): number {
  const seconds = durationMs / 1000;
  if (seconds < 5) return -0.15;
  if (seconds < 15) return 0.0;
  if (seconds < 30) return 0.5;
  if (seconds < 60) return 0.7;
  return 0.85;
}

// ─── Static Strength Map ─────────────────────────────────────────────────────

const STATIC_STRENGTHS: Partial<Record<TasteSignalType, number>> = {
  watchlist_add: 0.9,        // En güçlü pozitif — kasıtlı save
  watchlist_remove: -0.6,    // Güçlü negatif — eklemiş, sonra çıkardı = pişman
  swipe_right: 0.4,          // Orta pozitif — feed'de hızlı beğeni
  swipe_left: -0.2,          // Hafif negatif — "şimdi değil" mi "asla" mı belirsiz
  pick_clicked: 0.3,         // Hafif pozitif — ilgilendi ama henüz commit yok
  mood_search_completed: 0.1, // Çok hafif pozitif — başarılı search session
};

// ─── Detail View Debouncing ──────────────────────────────────────────────────

/** 30 saniyelik pencerede aynı film için detail_view tekrar yazılmaz. */
const DETAIL_VIEW_DEBOUNCE_MS = 30 * 1000;
const recentDetailViews = new Map<string, number>(); // filmId -> timestamp

function shouldDebounceDetailView(filmId: string): boolean {
  const last = recentDetailViews.get(filmId);
  if (last === undefined) return false;
  return Date.now() - last < DETAIL_VIEW_DEBOUNCE_MS;
}

function markDetailViewRecorded(filmId: string): void {
  recentDetailViews.set(filmId, Date.now());
  // Memory leak prevention: 100'den fazla entry varsa eski olanları temizle
  if (recentDetailViews.size > 100) {
    const cutoff = Date.now() - DETAIL_VIEW_DEBOUNCE_MS;
    for (const [id, ts] of recentDetailViews.entries()) {
      if (ts < cutoff) recentDetailViews.delete(id);
    }
  }
}

// ─── Offline Queue ───────────────────────────────────────────────────────────

const OFFLINE_QUEUE_KEY = 'taste_signal_offline_queue';
const MAX_QUEUE_SIZE = 200;  // Disk dolmasın

interface QueuedSignal extends SignalPayload {
  queued_at: string;
}

async function enqueueOffline(payload: SignalPayload): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedSignal[] = raw ? JSON.parse(raw) : [];

    if (queue.length >= MAX_QUEUE_SIZE) {
      // FIFO: en eski sinyali at, yenisini ekle
      queue.shift();
    }

    queue.push({ ...payload, queued_at: new Date().toISOString() });
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    logger.error('[tasteSignals] Offline queue write failed:', err);
  }
}

/**
 * Offline queue'daki tüm bekleyen sinyalleri Supabase'e flush eder.
 * App açılışında veya network reconnect'te çağrılır.
 * Başarılı insert'lerden sonra queue temizlenir.
 */
async function flushOfflineQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;

    const queue: QueuedSignal[] = JSON.parse(raw);
    if (queue.length === 0) return;

    logger.warn(`[tasteSignals] Flushing ${queue.length} offline signals`);

    // Tek batch insert — performans
    const inserts: SignalPayload[] = queue.map(({ queued_at, ...rest }) => rest);
    const { error } = await supabase.from('user_taste_signals').insert(inserts);

    if (error) {
      logger.error('[tasteSignals] Flush failed, keeping queue:', error.message);
      return;
    }

    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    logger.warn(`[tasteSignals] Flushed ${queue.length} signals successfully`);
  } catch (err) {
    logger.error('[tasteSignals] Flush exception:', err);
  }
}

// ─── Core Write Function ─────────────────────────────────────────────────────

/**
 * Private generic write. Public API'lar bunu çağırır.
 * Network fail durumunda offline queue'ya düşer.
 */
async function recordSignal(
  signalType: TasteSignalType,
  filmId: string | null,
  strength: number,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    // Strength clamp — backend CHECK constraint için defensive
    const clamped = Math.max(-1, Math.min(1, strength));

    const userId = await getAppUserId();
    if (!userId) {
      logger.warn('[tasteSignals] No user_id, signal dropped:', signalType);
      return;
    }

    const payload: SignalPayload = {
      user_id: userId,
      film_id: filmId,
      signal_type: signalType,
      strength: clamped,
      metadata,
    };

    const { error } = await supabase.from('user_taste_signals').insert(payload);

    if (error) {
      // Network/Supabase fail → offline queue
      logger.warn('[tasteSignals] Insert failed, queuing offline:', error.message);
      await enqueueOffline(payload);
    }
  } catch (err) {
    logger.error('[tasteSignals] recordSignal exception:', err);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Type-safe public API. UI bunları çağırır.
 * Hepsi non-blocking — await edilebilir ama gerekli değil.
 */
export const tasteSignals = {
  /**
   * Kullanıcı bir filmi watchlist'e ekledi.
   * En güçlü pozitif sinyal (kasıtlı save).
   */
  recordWatchlistAdd(filmId: string): Promise<void> {
    return recordSignal('watchlist_add', filmId, STATIC_STRENGTHS.watchlist_add!);
  },

  /**
   * Kullanıcı bir filmi watchlist'ten çıkardı.
   * Güçlü negatif (pişman ekleme).
   */
  recordWatchlistRemove(filmId: string): Promise<void> {
    return recordSignal('watchlist_remove', filmId, STATIC_STRENGTHS.watchlist_remove!);
  },

  /**
   * Detail sayfası dwell time tamamlandı.
   * Strength duration'a göre hesaplanır (formula yukarıda).
   * 30s debounce: aynı film için tekrar yazılmaz.
   */
  recordDetailView(filmId: string, durationMs: number): Promise<void> {
    if (shouldDebounceDetailView(filmId)) {
      return Promise.resolve();
    }
    markDetailViewRecorded(filmId);
    const strength = detailViewStrength(durationMs);
    return recordSignal('detail_view', filmId, strength, { duration_ms: durationMs });
  },

  /**
   * Feed/discover'da sağa swipe (beğeni).
   * Orta pozitif.
   */
  recordSwipeRight(filmId: string, deckIndex?: number): Promise<void> {
    return recordSignal('swipe_right', filmId, STATIC_STRENGTHS.swipe_right!,
      deckIndex !== undefined ? { deck_index: deckIndex } : {});
  },

  /**
   * Feed/discover'da sola swipe (atlama).
   * Hafif negatif — kesin değil ama veri.
   */
  recordSwipeLeft(filmId: string, deckIndex?: number): Promise<void> {
    return recordSignal('swipe_left', filmId, STATIC_STRENGTHS.swipe_left!,
      deckIndex !== undefined ? { deck_index: deckIndex } : {});
  },

  /**
   * Öneri kartına tıkladı (detail'e gitti).
   * Hafif pozitif — ilgi belirtisi.
   */
  recordPickClicked(filmId: string): Promise<void> {
    return recordSignal('pick_clicked', filmId, STATIC_STRENGTHS.pick_clicked!);
  },

  /**
   * Mood search başarıyla tamamlandı (kullanıcı sonuçları gördü).
   * Çok hafif pozitif — engagement sinyali.
   */
  recordMoodSearchCompleted(searchId: string): Promise<void> {
    return recordSignal('mood_search_completed', null,
      STATIC_STRENGTHS.mood_search_completed!, { search_id: searchId });
  },

  /**
   * App açılışında veya network reconnect'te çağrılır.
   * Offline queue'daki tüm bekleyen sinyalleri Supabase'e flush eder.
   */
  flushOfflineQueue,
};
