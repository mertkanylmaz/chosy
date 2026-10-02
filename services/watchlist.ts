/**
 * Watchlist servisi — Supabase watchlist tablosuna kayıt ekler/çeker/siler.
 * Oturum açmış kullanıcılar için users tablosundaki UUID kullanılır.
 * Tablo şeması: id, user_id (→ users.id), film_id (→ films.id), added_from_session, created_at
 *
 * P4.1: saveSession + getWatchlistGroupedBySessions eklendi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Film } from '../types/film';
import { TasteProfile } from '../types';
import { supabase } from './supabase';
import { updateUserVector } from './userProfile';
import { logger } from '../utils/logger';
import { posthogAnalytics } from './posthog';
import { tasteSignals } from './tasteSignalService';
import { getAppUserId, readAppUserId } from './auth-utils'; // re-export aşağıda, iç kullanım için de import

// ─── Watched Status (sunucu: watchlist.watched_at) ───────────────────────────
//
// B-1 / Fix 6: "izlendi"nin tek kaynağı `watchlist.watched_at` (+
// `watched_source`). AsyncStorage yalnızca sunucuya yazılamayan işaretlerin
// kuyruğudur (`chosy_watched_pending_{authId}`); `syncWatchedFilms` açılışta
// boşaltır. Eski cihaz-yerel küme (`chosy_watched_films`) yalnızca tek seferlik
// taşıma için okunur.

/** Fix 6 öncesi cihaz-yerel izlendi kümesi — yalnızca `watchSync` taşıması okur. */
export const LEGACY_WATCHED_KEY = 'chosy_watched_films';

/** Bekleyen izlendi yazmaları kimliğe bağlıdır: başka kimliğe flush edilmez. */
export function watchedPendingKey(authId: string): string {
  return `chosy_watched_pending_${authId}`;
}

/** `watchlist_watched_source_valid` CHECK'i (072) ile birebir. */
export type WatchedSource = 'manual' | 'gauntlet_feedback' | 'local_sync';

/** Bekleyen (sunucuya yazılamamış) izlendi işlemi — kaynak etiketiyle. */
export interface PendingWatchedOp {
  filmId: string;
  watched: boolean;
  source: 'manual';
  queuedAt: string;
}

export interface WatchedState {
  watched: boolean;
  /** `null`: izlenmemiş ya da 072 öncesi kaynağı bilinmeyen işaret */
  source: WatchedSource | null;
}

export interface ToggleWatchedResult {
  watched: boolean;
  /** `queued`: sunucu yazımı başarısız, bekleyen kuyruğa alındı (Sentry'ye yazıldı) */
  status: 'synced' | 'queued';
}

/**
 * Gauntlet kaynaklı işaret ("seen" ya da "dün izledin mi?" cevabı) kullanıcı
 * tarafından geri alınamaz; diğer kaynaklar alınabilir (Fix 6 karar 4).
 */
export function canUnwatch(source: WatchedSource | null): boolean {
  return source !== 'gauntlet_feedback';
}

/** Unwatch, gauntlet kaynaklı bir işarete denk geldi — UI bu yolu göstermemeli. */
export class WatchedLockedError extends Error {
  constructor(filmId: string) {
    super(`[watchlist] gauntlet_feedback kaynaklı izlendi işareti geri alınamaz: ${filmId}`);
    this.name = 'WatchedLockedError';
  }
}

/**
 * İzlendi durumunu sunucuya yazar. Kuyruğa alma YAPMAZ — çağıran karar verir.
 *
 * İzlendi: satır yoksa açılır (`ignoreDuplicates`), varsa yalnızca
 * `watched_at` NULL iken doldurulur — mevcut izleme tarihi ezilmez
 * (`markWatched`, `_shared/gauntletCore.ts` ile aynı kural).
 *
 * İzlenmedi: satır SİLİNMEZ; `watched_at` + `watched_source` NULL'a çekilir.
 * `gauntlet_feedback` kaynaklı satıra dokunulmaz → `WatchedLockedError`.
 *
 * @throws Sunucu reddederse ya da işaret kilitliyse
 */
export async function writeWatchedToServer(
  appUserId: string,
  filmId: string,
  watched: boolean,
  source: 'manual' | 'local_sync',
): Promise<void> {
  if (watched) {
    const nowIso = new Date().toISOString();

    const { error: insertError } = await supabase
      .from('watchlist')
      .upsert(
        {
          user_id: appUserId,
          film_id: filmId,
          watched_at: nowIso,
          watched_source: source,
          added_from_session: null,
        },
        { onConflict: 'user_id,film_id', ignoreDuplicates: true },
      );
    if (insertError) {
      throw new Error(
        `[watchlist] izlendi INSERT başarısız: ${insertError.code} — ${insertError.message}`,
      );
    }

    const { error: updateError } = await supabase
      .from('watchlist')
      .update({ watched_at: nowIso, watched_source: source })
      .eq('user_id', appUserId)
      .eq('film_id', filmId)
      .is('watched_at', null);
    if (updateError) {
      throw new Error(
        `[watchlist] izlendi UPDATE başarısız: ${updateError.code} — ${updateError.message}`,
      );
    }
    return;
  }

  const { data: cleared, error: clearError } = await supabase
    .from('watchlist')
    .update({ watched_at: null, watched_source: null })
    .eq('user_id', appUserId)
    .eq('film_id', filmId)
    .not('watched_at', 'is', null)
    .or('watched_source.is.null,watched_source.neq.gauntlet_feedback')
    .select('film_id');
  if (clearError) {
    throw new Error(
      `[watchlist] izlenmedi UPDATE başarısız: ${clearError.code} — ${clearError.message}`,
    );
  }
  if ((cleared ?? []).length > 0) return;

  // 0 satır: ya zaten izlenmemiş (hedef durum, sorun yok) ya da işaret
  // gauntlet kaynaklı. İkincisini sessizce "başarılı" saymıyoruz.
  const { data: row, error: readError } = await supabase
    .from('watchlist')
    .select('watched_source')
    .eq('user_id', appUserId)
    .eq('film_id', filmId)
    .maybeSingle();
  if (readError) {
    throw new Error(
      `[watchlist] izlenmedi doğrulama okuması başarısız: ${readError.code} — ${readError.message}`,
    );
  }
  if (row?.watched_source === 'gauntlet_feedback') {
    throw new WatchedLockedError(filmId);
  }
}

/** Oturumun auth id'si — yerel oturumdan okunur, ağ gerektirmez. */
async function readAuthId(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user.id ?? null;
}

/** @throws AsyncStorage okuma ya da JSON çözümleme başarısızsa */
export async function readPendingWatchedOps(authId: string): Promise<PendingWatchedOp[]> {
  const raw = await AsyncStorage.getItem(watchedPendingKey(authId));
  return raw ? (JSON.parse(raw) as PendingWatchedOp[]) : [];
}

/** Aynı filme ait önceki bekleyen işlem yenisiyle değişir (son niyet geçerli). */
async function enqueuePendingWatchedOp(authId: string, op: PendingWatchedOp): Promise<void> {
  const ops = (await readPendingWatchedOps(authId)).filter((o) => o.filmId !== op.filmId);
  ops.push(op);
  await AsyncStorage.setItem(watchedPendingKey(authId), JSON.stringify(ops));
}

/**
 * Verilen işlemleri kuyruktan çıkarır — kuyruk yeniden okunur, böylece bu
 * arada eklenen yeni işlemler korunur. Kuyruk boşalırsa anahtar silinir.
 *
 * @throws AsyncStorage başarısızsa
 */
export async function removePendingWatchedOps(
  authId: string,
  done: (op: PendingWatchedOp) => boolean,
): Promise<number> {
  const remaining = (await readPendingWatchedOps(authId)).filter((o) => !done(o));
  if (remaining.length === 0) {
    await AsyncStorage.removeItem(watchedPendingKey(authId));
  } else {
    await AsyncStorage.setItem(watchedPendingKey(authId), JSON.stringify(remaining));
  }
  return remaining.length;
}

/**
 * Bekleyen işlemleri sunucu durumunun üstüne bindirir. Kuyruk okunamazsa
 * sunucu durumu olduğu gibi döner ve hata Sentry'ye yazılır (sessiz değil).
 */
async function readPendingOverlay(): Promise<Map<string, PendingWatchedOp>> {
  try {
    const authId = await readAuthId();
    if (!authId) return new Map();
    const ops = await readPendingWatchedOps(authId);
    return new Map(ops.map((op) => [op.filmId, op]));
  } catch (err) {
    logger.error('[watchlist] bekleyen izlendi kuyruğu okunamadı', err, {
      code: 'WATCHLIST_WATCHED_PENDING_READ_FAILED',
    });
    return new Map();
  }
}

/**
 * Sunucudaki izlendi durumunun üstüne bekleyen işlemi bindirir. Gauntlet
 * kaynaklı işaret bekleyen bir "izlenmedi" ile geri alınmaz.
 */
function overlayPendingWatched(
  watchedAt: string | null,
  watchedSource: WatchedSource | null,
  op: PendingWatchedOp | undefined,
): Pick<WatchlistItem, 'watchedAt' | 'watchedSource'> {
  if (!op || (watchedSource === 'gauntlet_feedback' && !op.watched)) {
    return { watchedAt, watchedSource };
  }
  if (!op.watched) return { watchedAt: null, watchedSource: null };
  return { watchedAt: watchedAt ?? op.queuedAt, watchedSource: watchedSource ?? op.source };
}

/**
 * Filmin izlendi durumunu değiştirir: önce sunucuya yazar
 * (`watched_source = 'manual'`). Sunucu yazımı başarısızsa hata Sentry'ye
 * yazılır ve işlem `chosy_watched_pending_{authId}` kuyruğuna alınır;
 * `syncWatchedFilms` bir sonraki açılışta boşaltır.
 *
 * @param currentlyWatched Ekranın gösterdiği mevcut durum
 * @throws Oturum yoksa, işaret gauntlet kaynaklıysa (`WatchedLockedError`)
 *         ya da kuyruğa yazma da başarısızsa
 */
export async function toggleWatched(
  filmId: string,
  currentlyWatched: boolean,
): Promise<ToggleWatchedResult> {
  const target = !currentlyWatched;
  try {
    const authId = await readAuthId();
    if (!authId) {
      throw new Error('[watchlist] toggleWatched: oturum yok');
    }

    try {
      const appUserId = await readAppUserId();
      if (!appUserId) {
        throw new Error('[watchlist] toggleWatched: public.users kimliği okunamadı');
      }
      await writeWatchedToServer(appUserId, filmId, target, 'manual');
    } catch (writeErr) {
      if (writeErr instanceof WatchedLockedError) throw writeErr;

      logger.error('[watchlist] izlendi sunucuya yazılamadı, kuyruğa alındı', writeErr, {
        code: 'WATCHLIST_WATCHED_WRITE_QUEUED',
        extra: { filmId, target },
      });
      await enqueuePendingWatchedOp(authId, {
        filmId,
        watched: target,
        source: 'manual',
        queuedAt: new Date().toISOString(),
      });
      return { watched: target, status: 'queued' };
    }

    // Sunucu yazımı daha yeni niyet: aynı filme ait eski bekleyen işlem
    // sonradan flush edilip bunu ezmesin.
    try {
      await removePendingWatchedOps(authId, (op) => op.filmId === filmId);
    } catch (cleanupErr) {
      logger.error('[watchlist] eski bekleyen izlendi işlemi silinemedi', cleanupErr, {
        code: 'WATCHLIST_WATCHED_PENDING_CLEANUP_FAILED',
        extra: { filmId },
      });
    }
    return { watched: target, status: 'synced' };
  } catch (err) {
    // Tek log noktası — hata çağırana yayılır, sessiz yutma yok (kural 1).
    logger.error('[watchlist] toggleWatched hata', err, {
      code:
        err instanceof WatchedLockedError
          ? 'WATCHLIST_WATCHED_LOCKED'
          : 'WATCHLIST_TOGGLE_WATCHED_FAILED',
      extra: { filmId, target },
    });
    throw err;
  }
}

/**
 * Tek filmin izlendi durumu: sunucu + bekleyen kuyruk.
 *
 * @throws Sunucu okuması başarısızsa
 */
export async function getWatchedState(filmId: string): Promise<WatchedState> {
  try {
    const appUserId = await readAppUserId();
    let serverAt: string | null = null;
    let serverSource: WatchedSource | null = null;

    if (appUserId) {
      const { data, error } = await supabase
        .from('watchlist')
        .select('watched_at, watched_source')
        .eq('user_id', appUserId)
        .eq('film_id', filmId)
        .maybeSingle();
      if (error) {
        throw new Error(`[watchlist] getWatchedState failed: ${error.code} — ${error.message}`);
      }
      serverAt = (data?.watched_at as string | null) ?? null;
      serverSource = serverAt ? ((data?.watched_source as WatchedSource | null) ?? null) : null;
    }

    const { watchedAt, watchedSource } = overlayPendingWatched(
      serverAt,
      serverSource,
      (await readPendingOverlay()).get(filmId),
    );
    return { watched: watchedAt !== null, source: watchedSource };
  } catch (err) {
    logger.error('[watchlist] getWatchedState hata', err, {
      code: 'WATCHLIST_WATCHED_READ_FAILED',
      extra: { filmId },
    });
    throw err;
  }
}

/**
 * İzlenen tüm film ID'leri: `watchlist.watched_at IS NOT NULL` + bekleyen kuyruk.
 * Oturum yoksa boş küme (hata değil — `getWatchlist` ile aynı).
 *
 * @throws Sunucu okuması başarısızsa
 */
export async function getWatchedFilmIds(): Promise<Set<string>> {
  try {
    const appUserId = await readAppUserId();
    const ids = new Set<string>();
    const gauntletLocked = new Set<string>();

    if (appUserId) {
      const { data, error } = await supabase
        .from('watchlist')
        .select('film_id, watched_source')
        .eq('user_id', appUserId)
        .not('watched_at', 'is', null);
      if (error) {
        throw new Error(`[watchlist] getWatchedFilmIds failed: ${error.code} — ${error.message}`);
      }
      for (const row of data ?? []) {
        ids.add(row.film_id as string);
        if (row.watched_source === 'gauntlet_feedback') gauntletLocked.add(row.film_id as string);
      }
    }

    for (const op of (await readPendingOverlay()).values()) {
      if (op.watched) ids.add(op.filmId);
      else if (!gauntletLocked.has(op.filmId)) ids.delete(op.filmId);
    }
    return ids;
  } catch (err) {
    logger.error('[watchlist] getWatchedFilmIds hatasi', err, {
      code: 'WATCHLIST_WATCHED_READ_FAILED',
    });
    throw err;
  }
}

/** Watchlist listesinde dönen satır tipi */
export interface WatchlistItem {
  film: Film;
  addedAt: string;
  /** Filmin eklendiği mood session UUID'si (null = session bilinmiyor) */
  sessionId: string | null;
  /** Mood session'ındaki kullanıcı prompt metni (null = bilinmiyor) */
  sessionPrompt: string | null;
  /** `null` = izlenmemiş → Saved. Dolu = izlendi (Profil "Watched"). */
  watchedAt: string | null;
  watchedSource: WatchedSource | null;
}

/**
 * Session bazlı watchlist grubu.
 * P4.2 UI'ı için kullanılacak; her grup = bir mood oturumu.
 */
export interface WatchlistGroup {
  /** Supabase sessions tablosundaki UUID (null = session bilgisi yok) */
  sessionId: string | null;
  /** Kullanıcının girdiği mood prompt metni */
  prompt: string | null;
  /** Gruba ait en son ekleme tarihi (ISO string) */
  lastAdded: string;
  /** Gruptaki film sayısı */
  filmCount: number;
  /** Gruba ait filmler (en yeni → en eski) */
  films: WatchlistItem[];
}

// getAppUserId artık auth-utils.ts'te tanımlı — re-export for backward compat
export { getAppUserId } from './auth-utils';

/** UUID v4 format kontrolü */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Filmi Supabase watchlist tablosuna ekler.
 * Kullanıcı oturum açmamışsa veya film ID'si geçerli UUID değilse işlem yapılmaz
 * (bu iki durum hata değildir — sessizce atlanır).
 *
 * CRITICAL: INSERT başarısız olursa throw eder — çağıran taraf yakalamalı.
 * Daha önce hata yutuluyordu; üç çağıranın hata dalı da ölü koddu.
 *
 * @param film      - Eklenecek film
 * @param sessionId - Filmin eklendiği mood session UUID'si (opsiyonel)
 * @throws INSERT reddedilirse veya beklenmedik hata oluşursa
 */
export async function addToWatchlist(film: Film, sessionId?: string | null): Promise<void> {
  try {
    if (!UUID_REGEX.test(film.id)) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[watchlist] addToWatchlist: film.id UUID değil, atlandı:', film.id);
      }
      return;
    }

    const appUserId = await getAppUserId();

    if (!appUserId) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[watchlist] addToWatchlist: kullanıcı oturumu yok, işlem atlandı');
      }
      return;
    }

    // session_id varsa ve geçerli UUID ise ekle; yoksa NULL bırak
    const added_from_session =
      sessionId && UUID_REGEX.test(sessionId) ? sessionId : null;

    const { error } = await supabase
      .from('watchlist')
      .upsert(
        { user_id: appUserId, film_id: film.id, added_from_session },
        { onConflict: 'user_id,film_id', ignoreDuplicates: true },
      );

    if (error) {
      throw new Error(
        `[watchlist] addToWatchlist failed: ${error.code} — ${error.message}`,
      );
    }

    // Buraya gelindiyse INSERT basarili — error dali yukarida throw etti.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log(
        '[watchlist] eklendi:',
        film.title,
        '| film_id:', film.id,
        '| session:', added_from_session ?? 'none',
      );
    }

    // PostHog: film_added_to_watchlist
    posthogAnalytics.track('film_added_to_watchlist', { film_id: film.id });

    // Arka planda kullanıcı vektörünü güncelle — hata dışarıya yayılmaz
    updateUserVector(appUserId, film.id);

    // Taste signal: watchlist add (fire-and-forget, fail ana akışı etkilemez)
    tasteSignals.recordWatchlistAdd(film.id).catch(() => {});
  } catch (err) {
    // Tek log noktası — hata çağırana yayılır, sessiz yutma yok (kural 1).
    logger.error('[watchlist] addToWatchlist hata', err, {
      code: 'WATCHLIST_ADD_FAILED',
      extra: { filmId: film.id },
    });
    throw err;
  }
}

/** films + sessions join ile gelen satır tipi */
interface WatchlistRow {
  created_at: string;
  match_score: number | null;
  added_from_session: string | null;
  watched_at: string | null;
  watched_source: WatchedSource | null;
  sessions: { raw_input: string | null } | null;
  films: {
    id: string;
    title: string;
    year: number | null;
    poster_url: string | null;
    backdrop_url: string | null;
    overview: string | null;
    runtime: number | null;
    vote_average: number | null;
    genres: string[] | null;
  };
}

/** Poster/backdrop path'ini tam TMDb URL'e çevirir */
function toTmdbUrl(path: string | null, size = 'w780'): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/**
 * Kullanıcının watchlist'ini Supabase'den çeker.
 * Oturum yoksa boş dizi döner (hata değil).
 *
 * CRITICAL: Sorgu başarısız olursa throw eder — çağıran taraf yakalamalı.
 * Daha önce `[]` dönüyordu; "liste boş" ile "yüklenemedi" ayırt edilemiyor,
 * çağıranlar hatayı boş watchlist sanıp tekrar öneri üretiyordu.
 *
 * @returns WatchlistItem dizisi (en yeni en üstte)
 * @throws Sorgu reddedilirse veya beklenmedik hata oluşursa
 */
export async function getWatchlist(): Promise<WatchlistItem[]> {
  try {
    const appUserId = await getAppUserId();

    if (!appUserId) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[watchlist] getWatchlist: kullanıcı oturumu yok');
      }
      return [];
    }

    const { data, error } = await supabase
      .from('watchlist')
      .select(
        'created_at, match_score, added_from_session, watched_at, watched_source, sessions(raw_input), films(id, title, year, poster_url, backdrop_url, overview, runtime, vote_average, genres)',
      )
      .eq('user_id', appUserId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      throw new Error(
        `[watchlist] getWatchlist failed: ${error?.code ?? 'no-data'} — ${error?.message ?? 'empty response'}`,
      );
    }

    const pending = await readPendingOverlay();

    return (data as unknown as WatchlistRow[])
      .filter((row) => row.films)
      .map((row) => ({
        film: {
          id: row.films.id,
          title: row.films.title,
          year: row.films.year ?? 0,
          posterUrl: toTmdbUrl(row.films.poster_url),
          backdropUrl: toTmdbUrl(row.films.backdrop_url, 'w1280'),
          overview: row.films.overview ?? '',
          runtime: row.films.runtime ?? undefined,
          voteAverage: row.films.vote_average ?? undefined,
          matchScore: row.match_score ?? 0,
          moodTags: row.films.genres?.slice(0, 3) ?? [],
          whyThisFilm: row.films.overview ? row.films.overview.slice(0, 90) + '…' : '',
        } satisfies Film,
        addedAt: row.created_at,
        sessionId: row.added_from_session ?? null,
        sessionPrompt: row.sessions?.raw_input ?? null,
        ...overlayPendingWatched(row.watched_at, row.watched_source, pending.get(row.films.id)),
      }));
  } catch (err) {
    // Tek log noktası — hata çağırana yayılır, sessiz yutma yok (kural 1).
    logger.error('[watchlist] getWatchlist hata', err, {
      code: 'WATCHLIST_FETCH_FAILED',
    });
    throw err;
  }
}

/**
 * Kullanıcının Saved listesini temizler — yalnızca `watched_at IS NULL`
 * satırlar silinir. İzlenmiş satırlar kalır: Profil "Watched" sayacının ve
 * gauntlet aday filtresinin (`fetchExclusions`) kaynağı onlar (B-1 / Fix 6).
 *
 * CRITICAL: DELETE başarısız olursa throw eder — çağıran taraf yakalamalı.
 * Daha önce hata yutuluyordu; profile ve watchlist-detail ekranlarında
 * silme başarısız olsa bile "temizlendi" onayı gösteriliyordu.
 *
 * @throws DELETE reddedilirse (örn. RLS) veya beklenmedik hata oluşursa
 */
export async function clearWatchlist(): Promise<void> {
  try {
    const appUserId = await getAppUserId();

    if (!appUserId) return;

    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', appUserId)
      .is('watched_at', null);

    if (error) {
      throw new Error(
        `[watchlist] clearWatchlist failed: ${error.code} — ${error.message}`,
      );
    }
  } catch (err) {
    // Tek log noktası — hata çağırana yayılır, sessiz yutma yok (kural 1).
    logger.error('[watchlist] clearWatchlist hata', err, {
      code: 'WATCHLIST_CLEAR_FAILED',
    });
    throw err;
  }
}

/**
 * Filmi Saved listesinden siler — yalnızca `watched_at IS NULL` ise. İzlenmiş
 * satır silinmez (izleme geçmişi korunur; bkz. `clearWatchlist`). UI izlenmiş
 * film için bu eylemi sunmaz.
 * Başarılı olursa true, hata olursa false döner.
 * Çağıran, false durumunda UI'ı geri almalıdır.
 *
 * @param filmId - Silinecek filmin ID'si
 * @returns Silme başarılıysa true
 */
export async function removeFromWatchlist(filmId: string): Promise<boolean> {
  try {
    const appUserId = await getAppUserId();

    if (!appUserId) return false;

    const { error } = await supabase
      .from('watchlist')
      .delete()
      .match({ film_id: filmId, user_id: appUserId })
      .is('watched_at', null);

    if (error) {
      logger.error('[watchlist] removeFromWatchlist hata', error, {
        code: 'WATCHLIST_REMOVE_FAILED',
        extra: { pgCode: error.code, filmId },
      });
    }

    if (__DEV__) {
      if (!error) {
        // eslint-disable-next-line no-console
        console.log('[watchlist] silindi: film_id=', filmId, '| user_id=', appUserId);
      }
    }

    if (!error) {
      // Taste signal: watchlist remove (fire-and-forget, fail ana akışı etkilemez)
      tasteSignals.recordWatchlistRemove(filmId).catch(() => {});
    }

    return !error;
  } catch (err) {
    logger.error('[watchlist] removeFromWatchlist beklenmedik hata', err, {
      code: 'WATCHLIST_REMOVE_UNEXPECTED',
      extra: { filmId },
    });
    return false;
  }
}

// ─── P4.1: Session Gruplama ─────────────────────────────────────────────────

/**
 * Mood session'ını Supabase sessions tablosuna kaydeder.
 * parseMood başarıyla tamamlandıktan sonra çağrılmalıdır.
 * Hata durumunda null döner — uygulama akışını engellemez.
 *
 * @param userId   - users tablosundaki dahili UUID
 * @param rawInput - Kullanıcının girdiği mood metni
 * @param profile  - Ayrıştırılmış TasteProfile (JSON olarak saklanır)
 * @returns Oluşturulan session UUID veya null (hata durumunda)
 */
export async function saveSession(
  userId: string,
  rawInput: string,
  profile: TasteProfile,
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        raw_input: rawInput,
        parsed_profile_json: profile as unknown as Record<string, unknown>,
      })
      .select('id')
      .single();

    if (error || !data) {
      logger.error('[watchlist] saveSession hata:', error?.message);
      return null;
    }

    logger.log('[watchlist] session kaydedildi:', data.id);
    return data.id as string;
  } catch (err) {
    logger.error('[watchlist] saveSession beklenmedik hata:', err);
    return null;
  }
}

/**
 * Supabase RPC üzerinden watchlist'i session bazlı gruplar.
 * P4.2 Watchlist UI için veri sağlar.
 * Hata durumunda boş dizi döner.
 *
 * @returns WatchlistGroup dizisi (en son ekleme → eskiye göre sıralı)
 */
export async function getWatchlistGroupedBySessions(): Promise<WatchlistGroup[]> {
  try {
    const appUserId = await getAppUserId();
    if (!appUserId) {
      logger.log('[watchlist] getWatchlistGroupedBySessions: kullanıcı oturumu yok');
      return [];
    }

    const { data, error } = await supabase.rpc('get_watchlist_grouped', {
      p_user_id: appUserId,
    });

    if (error || !data) {
      logger.error('[watchlist] getWatchlistGroupedBySessions hata:', error?.message);
      return [];
    }

    // RPC JSON array'ini WatchlistGroup[] formatına dönüştür
    const rows = data as RpcWatchlistGroupRow[];
    return rows.map((row) => ({
      sessionId: row.session_id ?? null,
      prompt: row.prompt ?? null,
      lastAdded: row.last_added,
      filmCount: Number(row.film_count ?? 0),
      films: (row.films ?? []).map((f) => ({
        film: {
          id: f.film_id,
          title: f.title,
          year: f.year ?? 0,
          posterUrl: toTmdbUrl(f.poster_url),
          backdropUrl: toTmdbUrl(f.backdrop_url, 'w1280'),
          overview: f.overview ?? '',
          runtime: f.runtime ?? undefined,
          voteAverage: f.vote_average ?? undefined,
          matchScore: f.match_score ?? 0,
          moodTags: f.genres?.slice(0, 3) ?? [],
          whyThisFilm: f.overview ? f.overview.slice(0, 90) + '…' : '',
        } satisfies Film,
        addedAt: f.added_at,
        sessionId: row.session_id ?? null,
        sessionPrompt: row.prompt ?? null,
        // RPC (121) yalnızca watched_at IS NULL satırları döndürür.
        watchedAt: null,
        watchedSource: null,
      })),
    }));
  } catch (err) {
    logger.error('[watchlist] getWatchlistGroupedBySessions beklenmedik hata:', err);
    return [];
  }
}

// ─── RPC satır tipleri ───────────────────────────────────────────────────────

/** get_watchlist_grouped RPC'den gelen grup satırı */
interface RpcWatchlistGroupRow {
  session_id: string | null;
  prompt: string | null;
  last_added: string;
  film_count: number | string;
  films: RpcWatchlistFilmRow[];
}

/** get_watchlist_grouped RPC'den gelen film satırı */
interface RpcWatchlistFilmRow {
  watchlist_id: string;
  added_at: string;
  match_score: number | null;
  film_id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string | null;
  runtime: number | null;
  vote_average: number | null;
  genres: string[] | null;
}
