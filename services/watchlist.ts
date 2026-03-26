/**
 * Watchlist servisi — Supabase watchlist tablosuna kayıt ekler/çeker/siler.
 * Oturum açmış kullanıcılar için users tablosundaki UUID kullanılır.
 * Tablo şeması: id, user_id (→ users.id), film_id (→ films.id), added_from_session, created_at
 */
import { Film } from '../types/film';
import { supabase } from './supabase';
import { updateUserVector } from './userProfile';

/** Watchlist listesinde dönen satır tipi */
export interface WatchlistItem {
  film: Film;
  addedAt: string;
}

/**
 * Auth kullanıcısının `users` tablosundaki UUID'sini döndürür.
 * Kayıt yoksa (anonim dahil) otomatik oluşturur.
 */
export async function getAppUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (data) return data.id as string;

    // Kayıt yoksa oluştur (anonim kullanıcı ilk kullanım)
    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert({ auth_id: user.id })
      .select('id')
      .single();

    if (insertError || !inserted) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[watchlist] users kaydı oluşturulamadı:', insertError?.message);
      }
      return null;
    }

    return inserted.id as string;
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] getAppUserId beklenmedik hata:', err);
    }
    return null;
  }
}

/** UUID v4 format kontrolü */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Filmi Supabase watchlist tablosuna ekler.
 * Kullanıcı oturum açmamışsa veya film ID'si geçerli UUID değilse işlem yapılmaz.
 *
 * @param film - Eklenecek film
 */
export async function addToWatchlist(film: Film): Promise<void> {
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

    const { error } = await supabase
      .from('watchlist')
      .upsert(
        { user_id: appUserId, film_id: film.id },
        { onConflict: 'user_id,film_id', ignoreDuplicates: true },
      );

    if (__DEV__) {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[watchlist] addToWatchlist hata:', error.message, '| code:', error.code);
      } else {
        // eslint-disable-next-line no-console
        console.log('[watchlist] eklendi:', film.title, '| film_id:', film.id);
      }
    }

    if (!error) {
      // Arka planda kullanıcı vektörünü güncelle — hata dışarıya yayılmaz
      updateUserVector(appUserId, film.id);
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] addToWatchlist beklenmedik hata:', err);
    }
  }
}

/** films tablosundan join ile gelen satır tipi */
interface WatchlistRow {
  created_at: string;
  match_score: number | null;
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
      .select('created_at, match_score, films(id, title, year, poster_url, backdrop_url, overview, runtime, vote_average, genres)')
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
 *
 * @param filmId - Silinecek filmin ID'si
 */
export async function removeFromWatchlist(filmId: string): Promise<void> {
  try {
    const appUserId = await getAppUserId();

    if (!appUserId) return;

    const { error } = await supabase
      .from('watchlist')
      .delete()
      .match({ film_id: filmId, user_id: appUserId });

    if (__DEV__ && error) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] removeFromWatchlist hata:', error.message);
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[watchlist] removeFromWatchlist beklenmedik hata:', err);
    }
  }
}
