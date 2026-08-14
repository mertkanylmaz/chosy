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
import { getAppUserId } from './auth-utils'; // re-export aşağıda, iç kullanım için de import

// ─── Watched Status (local) ──────────────────────────────────────────────────

export const WATCHED_KEY = 'chosy_watched_films';

/**
 * Filmin izlendi durumunu toggle eder.
 * AsyncStorage'da JSON Set olarak saklanır.
 */
export async function toggleWatched(filmId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(WATCHED_KEY);
    const set: Set<string> = raw ? new Set(JSON.parse(raw)) : new Set();
    const isWatched = set.has(filmId);
    if (isWatched) {
      set.delete(filmId);
    } else {
      set.add(filmId);
    }
    await AsyncStorage.setItem(WATCHED_KEY, JSON.stringify([...set]));
    return !isWatched;
  } catch {
    return false;
  }
}

/**
 * Tüm izlenen film ID'lerini döndürür.
 */
export async function getWatchedFilmIds(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(WATCHED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
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
 * Kullanıcı oturum açmamışsa veya film ID'si geçerli UUID değilse işlem yapılmaz.
 *
 * @param film      - Eklenecek film
 * @param sessionId - Filmin eklendiği mood session UUID'si (opsiyonel)
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

    if (__DEV__) {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[watchlist] addToWatchlist hata:', error.message, '| code:', error.code);
      } else {
        // eslint-disable-next-line no-console
        console.log(
          '[watchlist] eklendi:',
          film.title,
          '| film_id:', film.id,
          '| session:', added_from_session ?? 'none',
        );
      }
    }

    if (!error) {
      // PostHog: film_added_to_watchlist
      posthogAnalytics.track('film_added_to_watchlist', { film_id: film.id });

      // Arka planda kullanıcı vektörünü güncelle — hata dışarıya yayılmaz
      updateUserVector(appUserId, film.id);

      // Taste signal: watchlist add (fire-and-forget, fail ana akışı etkilemez)
      tasteSignals.recordWatchlistAdd(film.id).catch(() => {});
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] addToWatchlist beklenmedik hata:', err);
    }
  }
}

/** films + sessions join ile gelen satır tipi */
interface WatchlistRow {
  created_at: string;
  match_score: number | null;
  added_from_session: string | null;
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
 * Hata durumunda boş dizi döner.
 *
 * @returns WatchlistItem dizisi (en yeni en üstte)
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
        'created_at, match_score, added_from_session, sessions(raw_input), films(id, title, year, poster_url, backdrop_url, overview, runtime, vote_average, genres)',
      )
      .eq('user_id', appUserId)
      .order('created_at', { ascending: false });

    if (error || !data) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[watchlist] getWatchlist hata:', error?.message);
      }
      return [];
    }

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
      }));
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] getWatchlist beklenmedik hata:', err);
    }
    return [];
  }
}

/**
 * Kullanıcının tüm watchlist'ini temizler.
 */
export async function clearWatchlist(): Promise<void> {
  try {
    const appUserId = await getAppUserId();

    if (!appUserId) return;

    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', appUserId);

    if (__DEV__ && error) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] clearWatchlist hata:', error.message);
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] clearWatchlist beklenmedik hata:', err);
    }
  }
}

/**
 * Filmi watchlist'ten siler.
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
      .match({ film_id: filmId, user_id: appUserId });

    if (__DEV__) {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[watchlist] removeFromWatchlist hata:', error.message, '| code:', error.code);
      } else {
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
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] removeFromWatchlist beklenmedik hata:', err);
    }
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
