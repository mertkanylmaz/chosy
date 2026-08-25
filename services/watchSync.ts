/**
 * chosy_watched_films (AsyncStorage) → watchlist.watched_at senkronu.
 *
 * ── Neden var ──────────────────────────────────────────────────────────────
 * toggleWatched() watchlist üyeliğinden bağımsız çalışır — kullanıcı bir
 * filmi watchlist'e hiç eklemeden "izledim" işaretleyebilir. AsyncStorage bu
 * yüzden watched_at'in tarihsel tek kaynağı ve sunucudan tamamen kopuk.
 * Bu modül cihazdaki mevcut veriyi tek seferlik kurtarır; "dün izledin mi?"
 * akışını veya gauntlet ekranını implemente ETMEZ.
 *
 * Var olan `watched_at` DOLU satırlar asla ezilmez — sunucu verisi yerel
 * veriden önceliklidir. Bkz. syncWatchedFilms() içindeki iki adımlı strateji.
 */
import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { readAppUserId } from './auth-utils';
import { WATCHED_KEY } from './watchlist';
import { logger } from '../utils/logger';

export interface SyncResult {
  synced: number;
  skipped: number;
  errors: string[];
  error?: 'NO_IDENTITY';
}

/**
 * AsyncStorage'daki izlenmiş film ID'lerini watchlist tablosuna senkronlar.
 *
 * PostgREST'in upsert()'ü ON CONFLICT DO UPDATE'e koşullu WHERE ekleyemez —
 * ignoreDuplicates:true conflict'te hiç dokunmaz, false ise doluyu da ezer.
 * Bu yüzden iki adımlı: (1) mevcut satırları oku, (2) yalnızca watched_at
 * NULL olanları `&watched_at=is.null` filtresiyle koşullu UPDATE et, (3)
 * hiç satırı olmayanları ignoreDuplicates upsert ile ekle (race-safe).
 */
export async function syncWatchedFilms(): Promise<SyncResult> {
  const raw = await AsyncStorage.getItem(WATCHED_KEY);
  const filmIds = raw ? Array.from(new Set(JSON.parse(raw) as string[])) : [];

  if (filmIds.length === 0) {
    return { synced: 0, skipped: 0, errors: [] };
  }

  const appUserId = await readAppUserId();

  if (!appUserId) {
    Sentry.captureMessage(
      'syncWatchedFilms: app kullanıcı kimliği yok, senkron atlandı',
      {
        level: 'warning',
        tags: { function: 'syncWatchedFilms', error_code: 'NO_IDENTITY' },
        extra: { filmIdCount: filmIds.length },
      },
    );
    return { synced: 0, skipped: 0, errors: [], error: 'NO_IDENTITY' };
  }

  const errors: string[] = [];

  // Adım 0 — mevcut satırları oku
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
    return { synced: 0, skipped: 0, errors: [selectError.message] };
  }

  const existingByFilmId = new Map(
    (existingRows ?? []).map((row) => [row.film_id as string, row.watched_at as string | null]),
  );

  const alreadyWatched: string[] = [];
  const needsUpdate: string[] = [];
  const needsInsert: string[] = [];

  for (const filmId of filmIds) {
    if (!existingByFilmId.has(filmId)) {
      needsInsert.push(filmId);
    } else if (existingByFilmId.get(filmId) === null) {
      needsUpdate.push(filmId);
    } else {
      alreadyWatched.push(filmId);
    }
  }

  let synced = 0;
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
      errors.push(updateError.message);
    } else {
      synced += updated?.length ?? 0;
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
      errors.push(insertError.message);
    } else {
      synced += inserted?.length ?? 0;
    }
  }

  const result: SyncResult = { synced, skipped: alreadyWatched.length, errors };
  logger.log('[watchSync] tamamlandı:', result);
  return result;
}
