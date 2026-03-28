/**
 * Watch History servisi — Swipe geçmişi, istatistikler ve mood timeline.
 *
 * Supabase RPC fonksiyonları üzerinden çalışır:
 *   - get_user_stats(p_user_id)       → genel istatistikler
 *   - get_swipe_history(...)          → sayfalanmış swipe geçmişi
 *   - get_mood_timeline(...)          → mood session geçmişi
 *
 * Kullanım:
 *   - Profile ekranında: getUserStats()
 *   - Watch History listesinde: getSwipeHistory({ page, direction })
 *   - Mood Timeline'da: getMoodTimeline()
 */

import { supabase } from './supabase';
import { getAppUserId } from './watchlist';

// ─── Tipler ──────────────────────────────────────────────────────────────────

/** Kullanıcı genel istatistikleri */
export interface UserStats {
  totalSwipes: number;
  rightSwipes: number;
  leftSwipes: number;
  /** Sağa kaydırma oranı, 0-100 arası */
  saveRate: number;
  totalWatchlist: number;
  totalSessions: number;
  firstSwipeAt: string | null;
  /** Top 10 tür dağılımı: { "Drama": 15, "Thriller": 8 } */
  topGenres: Record<string, number>;
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null;
}

/** Swipe geçmişindeki bir kayıt */
export interface SwipeHistoryItem {
  swipeId: string;
  filmId: string;
  title: string;
  year: number | null;
  posterUrl: string;
  voteAverage: number | null;
  genres: string[] | null;
  direction: 'left' | 'right';
  swipedAt: string;
  moodText: string | null;
}

/** Sayfalanmış swipe geçmişi sonucu */
export interface SwipeHistoryResult {
  items: SwipeHistoryItem[];
  total: number;
  hasMore: boolean;
}

/** Mood timeline'daki bir kayıt */
export interface MoodTimelineItem {
  sessionId: string;
  moodText: string | null;
  profile: Record<string, unknown> | null;
  createdAt: string;
  swipeCount: number;
  saveCount: number;
}

/** Swipe geçmişi sorgu parametreleri */
export interface SwipeHistoryParams {
  page?: number;
  pageSize?: number;
  /** null = tümü, 'right' = kaydedilenler, 'left' = atlananlar */
  direction?: 'left' | 'right' | null;
}

// ─── Yardımcı ────────────────────────────────────────────────────────────────

/** Poster path'ini tam TMDb URL'e çevirir */
function toTmdbPosterUrl(path: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w500${path}`;
}

// ─── Ana Fonksiyonlar ────────────────────────────────────────────────────────

/**
 * Kullanıcının genel istatistiklerini döner.
 * Profile ekranında ve DiscoveryStats componentinde kullanılır.
 */
export async function getUserStats(): Promise<UserStats | null> {
  try {
    const userId = await getAppUserId();
    if (!userId) return null;

    const { data, error } = await supabase.rpc('get_user_stats', {
      p_user_id: userId,
    });

    if (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[history] getUserStats hatası:', error.message);
      }
      return null;
    }

    const raw = data as {
      total_swipes: number;
      right_swipes: number;
      left_swipes: number;
      save_rate: number;
      total_watchlist: number;
      total_sessions: number;
      first_swipe_at: string | null;
      top_genres: Record<string, number>;
      current_streak: number;
      longest_streak: number;
      total_active_days: number;
      last_active_date: string | null;
    };

    return {
      totalSwipes: raw.total_swipes ?? 0,
      rightSwipes: raw.right_swipes ?? 0,
      leftSwipes: raw.left_swipes ?? 0,
      saveRate: raw.save_rate ?? 0,
      totalWatchlist: raw.total_watchlist ?? 0,
      totalSessions: raw.total_sessions ?? 0,
      firstSwipeAt: raw.first_swipe_at,
      topGenres: raw.top_genres ?? {},
      currentStreak: raw.current_streak ?? 0,
      longestStreak: raw.longest_streak ?? 0,
      totalActiveDays: raw.total_active_days ?? 0,
      lastActiveDate: raw.last_active_date,
    };
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[history] getUserStats beklenmedik hata:', err);
    }
    return null;
  }
}

/**
 * Sayfalanmış swipe geçmişini döner.
 *
 * @param params - Sayfa numarası, boyutu ve yön filtresi
 */
export async function getSwipeHistory(
  params: SwipeHistoryParams = {},
): Promise<SwipeHistoryResult> {
  const { page = 1, pageSize = 20, direction = null } = params;

  try {
    const userId = await getAppUserId();
    if (!userId) return { items: [], total: 0, hasMore: false };

    const offset = (page - 1) * pageSize;

    const { data, error } = await supabase.rpc('get_swipe_history', {
      p_user_id: userId,
      p_limit: pageSize,
      p_offset: offset,
      p_direction: direction,
    });

    if (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[history] getSwipeHistory hatası:', error.message);
      }
      return { items: [], total: 0, hasMore: false };
    }

    const raw = data as {
      items: Array<{
        swipe_id: string;
        film_id: string;
        title: string;
        year: number | null;
        poster_url: string | null;
        vote_average: number | null;
        genres: string[] | null;
        direction: string;
        swiped_at: string;
        mood_text: string | null;
      }>;
      total: number;
    };

    const items: SwipeHistoryItem[] = (raw.items ?? []).map((item) => ({
      swipeId: item.swipe_id,
      filmId: item.film_id,
      title: item.title,
      year: item.year,
      posterUrl: toTmdbPosterUrl(item.poster_url),
      voteAverage: item.vote_average,
      genres: item.genres,
      direction: item.direction as 'left' | 'right',
      swipedAt: item.swiped_at,
      moodText: item.mood_text,
    }));

    return {
      items,
      total: raw.total ?? 0,
      hasMore: offset + pageSize < (raw.total ?? 0),
    };
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[history] getSwipeHistory beklenmedik hata:', err);
    }
    return { items: [], total: 0, hasMore: false };
  }
}

/**
 * Kullanıcının mood session geçmişini döner.
 * Mood Timeline componentinde ve profile ekranında kullanılır.
 *
 * @param limit - Maksimum kayıt sayısı (varsayılan: 20)
 */
export async function getMoodTimeline(limit = 20): Promise<MoodTimelineItem[]> {
  try {
    const userId = await getAppUserId();
    if (!userId) return [];

    const { data, error } = await supabase.rpc('get_mood_timeline', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[history] getMoodTimeline hatası:', error.message);
      }
      return [];
    }

    const rawItems = data as Array<{
      session_id: string;
      mood_text: string | null;
      profile: Record<string, unknown> | null;
      created_at: string;
      swipe_count: number;
      save_count: number;
    }>;

    return (rawItems ?? []).map((item) => ({
      sessionId: item.session_id,
      moodText: item.mood_text,
      profile: item.profile,
      createdAt: item.created_at,
      swipeCount: item.swipe_count ?? 0,
      saveCount: item.save_count ?? 0,
    }));
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[history] getMoodTimeline beklenmedik hata:', err);
    }
    return [];
  }
}

declare const __DEV__: boolean;
