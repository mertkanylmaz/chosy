/**
 * searchFilms — Supabase RPC ile çok katmanlı film arama.
 *
 * title, original_title, tr_title, director, cast üzerinden
 * full-text search + ILIKE fallback.
 */
import { supabase } from './supabase';
import { logger } from '@/utils/logger';

/** DB search result */
export interface DbFilmSearchResult {
  id: string;
  tmdb_id: number;
  title: string;
  original_title: string | null;
  tr_title: string | null;
  year: number | null;
  poster_url: string | null;
  director: string | null;
  imdb_rating: number | null;
  relevance_rank: number;
}

/**
 * Film arama — Supabase search_films RPC kullanır.
 * title, original_title, tr_title, director, cast üzerinden arar.
 *
 * @param query - Arama terimi (min 2 karakter)
 * @param limit - Maks sonuç sayısı (varsayılan: 20)
 * @returns Sıralı film listesi
 */
export async function searchFilmsDb(
  query: string,
  limit = 20,
): Promise<DbFilmSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  try {
    const { data, error } = await supabase.rpc('search_films', {
      search_query: trimmed,
      result_limit: limit,
    });

    if (error) {
      logger.error('[searchFilms] RPC error:', error.message);
      return [];
    }

    return (data as DbFilmSearchResult[]) ?? [];
  } catch (err) {
    logger.error('[searchFilms] Unexpected error:', err);
    return [];
  }
}
