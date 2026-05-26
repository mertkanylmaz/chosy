/**
 * Offline Queue — cihaz offline iken basarisiz olan Supabase
 * write islemlerini AsyncStorage'da kuyruga alir ve internet
 * geldiginde otomatik olarak isler.
 *
 * Kullanim:
 *   - Onboarding: archetype_id + preferences_vector yazilamazsa enqueue
 *   - Home: getCachedArchetypeId() ile local fallback
 *   - _layout.tsx: processOfflineQueue() ile reconnect'te sync
 *
 * BUG-003 fix: offline onboarding tamamlandiginda archetype kaybolmuyordu.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { getAppUserId } from './watchlist';
import { logger } from '@/utils/logger';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Archetype ID local cache key — anlik UI erisimi icin */
const ARCHETYPE_CACHE_KEY = 'chosy_cached_archetype_id';

/** Calibration vector local cache key */
const CALIBRATION_VECTOR_CACHE_KEY = 'chosy_cached_calibration_vector';

/** Offline islem kuyrugu */
const OFFLINE_QUEUE_KEY = 'chosy_offline_queue';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Kuyruga alinabilecek islem tipleri */
interface QueuedOperation {
  type: 'save_archetype' | 'save_calibration_vector';
  /** Supabase users.id (internal UUID) */
  userId: string;
  /** islem verisi — archetype_id veya vector JSON string */
  payload: string;
  /** Kuyruga alinma zamani (ISO 8601) */
  enqueuedAt: string;
}

// ─── Local Cache (Optimistic UI) ──────────────────────────────────────────────

/**
 * Archetype ID'yi yerel cache'e yazar.
 * Network durumu farketmeksizin hemen cagirilir — UI aninda guncellenir.
 */
export async function cacheArchetypeId(archetypeId: number): Promise<void> {
  try {
    await AsyncStorage.setItem(ARCHETYPE_CACHE_KEY, String(archetypeId));
  } catch (err) {
    logger.warn('[offlineQueue] cacheArchetypeId AsyncStorage yazma hatasi:', err);
  }
}

/**
 * Yerel cache'ten archetype ID okur.
 * Home ekrani DB'den null aldiginda fallback olarak kullanilir.
 */
export async function getCachedArchetypeId(): Promise<number | null> {
  try {
    const val = await AsyncStorage.getItem(ARCHETYPE_CACHE_KEY);
    if (val) {
      const parsed = parseInt(val, 10);
      return isNaN(parsed) ? null : parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Calibration vector'u yerel cache'e yazar.
 */
export async function cacheCalibrationVector(vectorJson: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CALIBRATION_VECTOR_CACHE_KEY, vectorJson);
  } catch (err) {
    logger.warn('[offlineQueue] cacheCalibrationVector yazma hatasi:', err);
  }
}

/**
 * Yerel cache'ten calibration vector okur.
 */
export async function getCachedCalibrationVector(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CALIBRATION_VECTOR_CACHE_KEY);
  } catch {
    return null;
  }
}

// ─── Queue Yonetimi ──────────────────────────────────────────────────────────

/**
 * Basarisiz islemi kuyruga ekler.
 * Supabase write hata verdikten sonra cagirilir.
 */
export async function enqueueOperation(op: Omit<QueuedOperation, 'enqueuedAt'>): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedOperation[] = raw ? JSON.parse(raw) : [];

    // Ayni tip + userId icin eski girisi guncelle (duplicate onleme)
    const existingIdx = queue.findIndex(
      (q) => q.type === op.type && q.userId === op.userId,
    );
    const entry: QueuedOperation = {
      ...op,
      enqueuedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      queue[existingIdx] = entry;
    } else {
      queue.push(entry);
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    logger.log('[offlineQueue] Islem kuyruga alindi:', op.type);
  } catch (err) {
    logger.error('[offlineQueue] Kuyruga ekleme hatasi:', err);
  }
}

/**
 * Kuyruktaki tum bekleyen islemleri Supabase'e yazmaya calisir.
 * Basarili olanlar kuyruktan cikarilir; basarisizlar kalir.
 *
 * Cagrilma noktalari:
 *   - _layout.tsx: app acilisinda
 *   - _layout.tsx: auth state degistiginde (SIGNED_IN, TOKEN_REFRESHED)
 */
export async function processOfflineQueue(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;

    const queue: QueuedOperation[] = JSON.parse(raw);
    if (queue.length === 0) return;

    logger.log('[offlineQueue] Kuyruk isleniyor:', queue.length, 'islem');

    const remaining: QueuedOperation[] = [];

    for (const op of queue) {
      const success = await processOperation(op);
      if (!success) {
        remaining.push(op);
      }
    }

    if (remaining.length === 0) {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
      logger.log('[offlineQueue] Tum islemler basariyla senkronize edildi');
    } else {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
      logger.warn('[offlineQueue] Kalan islemler:', remaining.length);
    }
  } catch (err) {
    logger.error('[offlineQueue] Kuyruk isleme hatasi:', err);
  }
}

/**
 * Tek bir kuyruk islemini calistirir.
 * @returns true basarili, false tekrar denenecek
 */
async function processOperation(op: QueuedOperation): Promise<boolean> {
  try {
    switch (op.type) {
      case 'save_archetype': {
        const archetypeId = parseInt(op.payload, 10);
        if (isNaN(archetypeId)) return true; // gecersiz veri — sil

        const { error } = await supabase
          .from('users')
          .update({ archetype_id: archetypeId })
          .eq('id', op.userId);

        if (error) {
          logger.warn('[offlineQueue] archetype_id sync hatasi:', error.message);
          return false;
        }

        logger.log('[offlineQueue] archetype_id basariyla senkronize edildi');
        return true;
      }

      case 'save_calibration_vector': {
        const { error } = await supabase
          .from('users')
          .update({ preferences_vector: op.payload })
          .eq('id', op.userId);

        if (error) {
          logger.warn('[offlineQueue] preferences_vector sync hatasi:', error.message);
          return false;
        }

        logger.log('[offlineQueue] preferences_vector basariyla senkronize edildi');
        return true;
      }

      default:
        logger.warn('[offlineQueue] Bilinmeyen islem tipi:', op.type);
        return true; // bilinmeyen tip — kuyruktan cikar
    }
  } catch (err) {
    logger.error('[offlineQueue] Islem calistirma hatasi:', err);
    return false;
  }
}

/**
 * Sync basarili oldugunda local cache'i temizler.
 * processQueue basariliysa archetype artik DB'de — cache gereksiz.
 * Ancak cache'i silmiyoruz: home ekrani her durumda hizli yuklesin.
 */
