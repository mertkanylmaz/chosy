/**
 * Profil servisi — user_stats, mood_history, tonight_pick ve swipe içgörüleri.
 * Supabase view'ları ve RPC çağrılarını sarar.
 */

import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';

import type { TasteProfile } from '../types/index';
import type {
  GenreDistribution,
  MoodHistoryItem,
  SwipeInsight,
  TonightPick,
  TopDirector,
  UserStats,
} from '../types/profile';
import { normalizeGenre } from '../utils/filmFilters';

// ─── getUserStats ─────────────────────────────────────────────────────────────

/**
 * user_stats view'dan kullanıcı istatistiklerini çeker.
 *
 * @param userId - users tablosundaki dahili UUID
 * @returns UserStats veya null (veri yoksa / hata durumunda)
 */
export async function getUserStats(userId: string): Promise<UserStats | null> {
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select(
        'saved_films, total_discovered, total_saved, total_skipped, total_sessions, favorite_genre, top_genres, last_mood, last_profile_json',
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return data as UserStats;
  } catch (err) {
    if (__DEV__) {
      console.error('[profileService] getUserStats hatası:', err);
    }
    return null;
  }
}

// ─── getMoodHistory ────────────────────────────────────────────────────────────

/**
 * mood_history view'dan kullanıcının geçmiş mood oturumlarını çeker.
 * Yeniden eskiye sıralı, maks 20 kayıt döner.
 *
 * @param userId - users tablosundaki dahili UUID
 * @returns MoodHistoryItem listesi (boş dizi hata durumunda)
 */
export async function getMoodHistory(userId: string): Promise<MoodHistoryItem[]> {
  const { data, error } = await supabase
    .from('mood_history')
    .select('session_id, user_id, mood_text, parsed_profile_json, created_at, total_swipes, saved_count, skipped_count, saved_posters')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    Sentry.captureException(error, { tags: { service: 'profileService', fn: 'getMoodHistory' } });
    throw error;
  }

  return (data ?? []) as MoodHistoryItem[];
}

// ─── getTonightPick ────────────────────────────────────────────────────────────

/**
 * tonight_pick RPC'sini çağırarak kullanıcı için akşam film önerisi alır.
 * RPC, kullanıcının preferences_vector'ünü baz alır.
 *
 * @param userId - users tablosundaki dahili UUID
 * @returns TonightPick veya null (RPC başarısızsa / sonuç yoksa)
 */
export async function getTonightPick(userId: string): Promise<TonightPick | null> {
  try {
    const { data, error } = await supabase.rpc('tonight_pick', { p_user_id: userId });

    if (error) throw error;
    if (!data || (Array.isArray(data) && data.length === 0)) return null;

    const row = Array.isArray(data) ? data[0] : data;
    return row as TonightPick;
  } catch (err) {
    if (__DEV__) {
      console.error('[profileService] getTonightPick hatası:', err);
    }
    return null;
  }
}

// ─── getSwipeInsights ──────────────────────────────────────────────────────────

// ─── Yerel Tipler ─────────────────────────────────────────────────────────────

interface WatchlistRow {
  films: {
    genres: string[] | null;
    director: string | null;
  } | null;
}

/**
 * Kullanıcının watchlist'ini films join ile çekerek içgörüler üretir:
 * - Kaydedilen filmlerin genre dağılımı (%)
 * - En çok kaydettiği yönetmenler (maks 5)
 *
 * @param userId - users tablosundaki dahili UUID
 * @returns SwipeInsight veya null (veri yoksa / hata durumunda)
 */
export async function getSwipeInsights(userId: string): Promise<SwipeInsight | null> {
  try {
    const { data: rows, error } = await supabase
      .from('watchlist')
      .select('*, films(genres, director)')
      .eq('user_id', userId);

    if (error) throw error;
    if (!rows || rows.length === 0) return null;

    const items = rows as unknown as WatchlistRow[];

    // ── Genre dağılımı ──
    const genreCountMap = new Map<string, number>();
    for (const row of items) {
      for (const rawGenre of row.films?.genres ?? []) {
        const genre = normalizeGenre(rawGenre); // TR → EN dönüşümü
        genreCountMap.set(genre, (genreCountMap.get(genre) ?? 0) + 1);
      }
    }

    const totalGenreCounts = Array.from(genreCountMap.values()).reduce((a, b) => a + b, 0);
    const saved_genre_distribution: GenreDistribution[] = Array.from(genreCountMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([genre, count]) => ({
        genre,
        count,
        percentage: totalGenreCounts > 0 ? Math.round((count / totalGenreCounts) * 100) : 0,
      }));

    // ── En çok kaydedilen yönetmenler ──
    const directorMap = new Map<string, number>();
    for (const row of items) {
      const director = row.films?.director;
      if (director) {
        directorMap.set(director, (directorMap.get(director) ?? 0) + 1);
      }
    }
    const top_directors: TopDirector[] = Array.from(directorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([director, saved_count]) => ({ director, saved_count }));

    return {
      saved_genre_distribution,
      skipped_signals: [],
      top_directors,
      total_saves: items.length,
      total_skips: 0,
    };
  } catch (err) {
    if (__DEV__) {
      console.error('[profileService] getSwipeInsights hatası:', err);
    }
    return null;
  }
}

// ─── getLastParsedProfile ──────────────────────────────────────────────────────

/**
 * Kullanıcının en son oturumundan parsed_profile_json değerini çeker.
 * TasteDNA bileşeni için gerekli 12 boyutlu profil verisini sağlar.
 *
 * @param userId - users tablosundaki dahili UUID
 * @returns TasteProfile veya null (kayıt yoksa / hata durumunda)
 */
export async function getLastParsedProfile(userId: string): Promise<TasteProfile | null> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('parsed_profile_json')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data?.parsed_profile_json) return null;

    return data.parsed_profile_json as TasteProfile;
  } catch (err) {
    if (__DEV__) {
      console.error('[profileService] getLastParsedProfile hatası:', err);
    }
    return null;
  }
}

declare const __DEV__: boolean;
