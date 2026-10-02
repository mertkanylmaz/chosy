/**
 * İzlendi senkronu — açılışta iki iş (B-1 / Fix 6):
 *
 *   1. Bekleyen kuyruk: `chosy_watched_pending_{authId}`. `toggleWatched`
 *      sunucuya yazamadığında işlemi buraya koyar. Yalnızca o anki kimliğin
 *      anahtarı okunur — başka kimliğin kuyruğu bu kimliğe flush edilmez.
 *      Başarılı işlemler kuyruktan çıkar, kuyruk boşalınca anahtar silinir.
 *   2. Eski cihaz-yerel küme: `chosy_watched_films` (Fix 6 öncesi
 *      `toggleWatched`'ın tek deposu). Tek seferlik taşınır: o anki kimliğin
 *      watchlist'ine yazılır, hata yoksa anahtar silinir. Hata varsa anahtar
 *      kalır ve sonraki açılışta yeniden denenir.
 *
 * Var olan `watched_at` DOLU satırlar asla ezilmez — sunucu verisi yerel
 * veriden önceliklidir.
 */
import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { readAppUserId } from './auth-utils';
import {
  LEGACY_WATCHED_KEY,
  WatchedLockedError,
  readPendingWatchedOps,
  removePendingWatchedOps,
  writeWatchedToServer,
  type PendingWatchedOp,
} from './watchlist';
import { logger } from '../utils/logger';

export interface SyncResult {
  /** Sunucuya yazılıp kuyruktan çıkan bekleyen işlem */
  pendingFlushed: number;
  /** Kuyrukta kalan (bir sonraki açılışta yeniden denenecek) işlem */
  pendingRemaining: number;
  /** Eski kümeden taşınan film */
  legacySynced: number;
  /** Eski kümede olup sunucuda zaten izlenmiş film */
  legacySkipped: number;
  errors: string[];
  error?: 'NO_IDENTITY';
}

/**
 * Bekleyen izlendi işlemlerini boşaltır ve eski `chosy_watched_films`
 * anahtarını taşır.
 */
export async function syncWatchedFilms(): Promise<SyncResult> {
  const result: SyncResult = {
    pendingFlushed: 0,
    pendingRemaining: 0,
    legacySynced: 0,
    legacySkipped: 0,
    errors: [],
  };

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const authId = session?.user.id ?? null;

  const pendingOps = authId ? await readPendingWatchedOps(authId) : [];
  const legacyRaw = await AsyncStorage.getItem(LEGACY_WATCHED_KEY);
  const legacyFilmIds = legacyRaw
    ? Array.from(new Set(JSON.parse(legacyRaw) as string[]))
    : [];

  if (pendingOps.length === 0 && legacyFilmIds.length === 0) {
    // Taşınacak eski veri yok ama boş anahtar duruyorsa kaldır.
    if (legacyRaw !== null) await AsyncStorage.removeItem(LEGACY_WATCHED_KEY);
    return result;
  }

  const appUserId = authId ? await readAppUserId() : null;

  if (!authId || !appUserId) {
    Sentry.captureMessage(
      'syncWatchedFilms: app kullanıcı kimliği yok, senkron atlandı',
      {
        level: 'warning',
        tags: { function: 'syncWatchedFilms', error_code: 'NO_IDENTITY' },
        extra: {
          hasAuthId: authId !== null,
          pendingCount: pendingOps.length,
          legacyCount: legacyFilmIds.length,
        },
      },
    );
    return { ...result, pendingRemaining: pendingOps.length, error: 'NO_IDENTITY' };
  }

  await flushPending(authId, appUserId, pendingOps, result);

  if (legacyFilmIds.length > 0) {
    await migrateLegacy(appUserId, legacyFilmIds, result);
  }

  logger.log('[watchSync] tamamlandı:', result);
  return result;
}

/** Bekleyen işlemleri sırayla yazar; yazılanlar ve kilitliler kuyruktan çıkar. */
async function flushPending(
  authId: string,
  appUserId: string,
  ops: PendingWatchedOp[],
  result: SyncResult,
): Promise<void> {
  const done: PendingWatchedOp[] = [];

  for (const op of ops) {
    try {
      await writeWatchedToServer(appUserId, op.filmId, op.watched, op.source);
      done.push(op);
    } catch (err) {
      if (err instanceof WatchedLockedError) {
        // Gauntlet işareti geri alınamaz; işlem uygulanamaz, kuyrukta
        // tutmak her açılışta aynı hatayı üretirdi.
        Sentry.captureMessage('syncWatchedFilms: bekleyen unwatch gauntlet işaretine çarptı', {
          level: 'warning',
          tags: { function: 'syncWatchedFilms', error_code: 'PENDING_LOCKED' },
          extra: { appUserId, filmId: op.filmId },
        });
        done.push(op);
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      logger.error('[watchSync] bekleyen izlendi işlemi yazılamadı:', message, { skipBridge: true });
      Sentry.captureMessage(`syncWatchedFilms: bekleyen işlem yazılamadı — ${message}`, {
        level: 'error',
        tags: { function: 'syncWatchedFilms', error_code: 'PENDING_WRITE_FAILED' },
        extra: { appUserId, filmId: op.filmId, watched: op.watched },
      });
      result.errors.push(message);
    }
  }

  // Kuyruk yeniden okunur: flush sürerken eklenen işlemler korunur.
  result.pendingRemaining = await removePendingWatchedOps(authId, (op) =>
    done.some((d) => d.filmId === op.filmId && d.queuedAt === op.queuedAt),
  );
  result.pendingFlushed = done.length;
}

/**
 * Eski kümeyi taşır. PostgREST'in upsert()'ü ON CONFLICT DO UPDATE'e koşullu
 * WHERE ekleyemez — bu yüzden iki adım: (1) mevcut satırları oku, yalnızca
 * watched_at NULL olanları koşullu UPDATE et, (2) hiç satırı olmayanları
 * ignoreDuplicates upsert ile ekle (race-safe). Hata yoksa anahtar silinir.
 */
async function migrateLegacy(
  appUserId: string,
  filmIds: string[],
  result: SyncResult,
): Promise<void> {
  const errorCountBefore = result.errors.length;

  const { data: existingRows, error: selectError } = await supabase
    .from('watchlist')
    .select('film_id, watched_at')
    .eq('user_id', appUserId)
    .in('film_id', filmIds);

  if (selectError) {
    logger.error('[watchSync] mevcut satırlar okunamadı:', selectError.message, { skipBridge: true });
    Sentry.captureMessage(
      `syncWatchedFilms: watchlist okuma hatası — ${selectError.message}`,
      {
        level: 'error',
        tags: { function: 'syncWatchedFilms', error_code: 'SELECT_FAILED' },
        extra: { appUserId, pg_code: selectError.code },
      },
    );
    result.errors.push(selectError.message);
    return;
  }

  const existingByFilmId = new Map(
    (existingRows ?? []).map((row) => [row.film_id as string, row.watched_at as string | null]),
  );

  const needsUpdate: string[] = [];
  const needsInsert: string[] = [];

  for (const filmId of filmIds) {
    if (!existingByFilmId.has(filmId)) {
      needsInsert.push(filmId);
    } else if (existingByFilmId.get(filmId) === null) {
      needsUpdate.push(filmId);
    } else {
      result.legacySkipped += 1;
    }
  }

  const nowIso = new Date().toISOString();

  // Adım 1 — yalnızca watched_at NULL olanları koşullu güncelle
  if (needsUpdate.length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from('watchlist')
      .update({ watched_at: nowIso, watched_source: 'local_sync' })
      .eq('user_id', appUserId)
      .in('film_id', needsUpdate)
      .is('watched_at', null)
      .select('film_id');

    if (updateError) {
      logger.error('[watchSync] watched_at güncellemesi başarısız:', updateError.message, { skipBridge: true });
      Sentry.captureMessage(
        `syncWatchedFilms: watched_at UPDATE hatası — ${updateError.message}`,
        {
          level: 'error',
          tags: { function: 'syncWatchedFilms', error_code: 'UPDATE_FAILED' },
          extra: { appUserId, pg_code: updateError.code, filmIdCount: needsUpdate.length },
        },
      );
      result.errors.push(updateError.message);
    } else {
      result.legacySynced += updated?.length ?? 0;
    }
  }

  // Adım 2 — hiç satırı olmayanları ekle (ignoreDuplicates: race güvenliği)
  if (needsInsert.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from('watchlist')
      .upsert(
        needsInsert.map((filmId) => ({
          user_id: appUserId,
          film_id: filmId,
          watched_at: nowIso,
          watched_source: 'local_sync' as const,
          added_from_session: null,
        })),
        { onConflict: 'user_id,film_id', ignoreDuplicates: true },
      )
      .select('film_id');

    if (insertError) {
      logger.error('[watchSync] watchlist INSERT başarısız:', insertError.message, { skipBridge: true });
      Sentry.captureMessage(
        `syncWatchedFilms: watchlist INSERT hatası — ${insertError.message}`,
        {
          level: 'error',
          tags: { function: 'syncWatchedFilms', error_code: 'INSERT_FAILED' },
          extra: { appUserId, pg_code: insertError.code, filmIdCount: needsInsert.length },
        },
      );
      result.errors.push(insertError.message);
    } else {
      result.legacySynced += inserted?.length ?? 0;
    }
  }

  // Tek seferlik: bu kimliğe yazıldı, anahtar kaldırılır. Hata varsa kalır
  // ve sonraki açılış yeniden dener (dolu satırlar ezilmediği için güvenli).
  if (result.errors.length === errorCountBefore) {
    await AsyncStorage.removeItem(LEGACY_WATCHED_KEY);
  }
}
