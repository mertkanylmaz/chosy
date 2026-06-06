/**
 * Watchlist Roulette servisi — watchlist'ten rastgele film seçer.
 * Filtreleme client-side yapılır (watchlist zaten yüklü).
 * Analytics Supabase'e kaydedilir.
 */
import { Film } from '../types/film';
import { WatchlistItem } from './watchlist';
import { getAppUserId } from './auth-utils';
import { supabase } from './supabase';
import { logger } from '../utils/logger';

// ─── Tipler ─────────────────────────────────────────────────────────────────

/** Runtime filtre seçenekleri */
export type RuntimeFilter = 'short' | 'medium' | 'long' | 'any';

/** Roulette filtre parametreleri */
export interface RouletteFilters {
  runtime: RuntimeFilter;
  excludeGenres: string[];
}

/** Roulette spin sonucu */
export interface RouletteResult {
  film: Film;
  candidateCount: number;
}

/** Analytics outcome tipi */
export type RouletteOutcome = 'shown' | 'accepted' | 'spin_again' | 'closed';

// ─── Runtime sınırları ──────────────────────────────────────────────────────

const RUNTIME_BOUNDS: Record<RuntimeFilter, [number, number]> = {
  short: [0, 90],
  medium: [90, 120],
  long: [120, 999],
  any: [0, 999],
};

// ─── Ana fonksiyonlar ───────────────────────────────────────────────────────

/**
 * Watchlist öğelerini filtreler ve rastgele bir film seçer.
 * Client-side filtreleme — Edge Function gerektirmez.
 *
 * @param items     - Mevcut watchlist öğeleri
 * @param watchedIds - İzlenmiş film ID'leri (AsyncStorage'dan)
 * @param filters   - Runtime + tür filtreleri
 * @returns Seçilen film ve aday sayısı, veya null (uygun film yoksa)
 */
export function pickRandomFilm(
  items: WatchlistItem[],
  watchedIds: Set<string>,
  filters: RouletteFilters,
): RouletteResult | null {
  const [minRuntime, maxRuntime] = RUNTIME_BOUNDS[filters.runtime];

  const candidates = items.filter((item) => {
    // İzlenmiş filmleri çıkar
    if (watchedIds.has(item.film.id)) return false;

    // Runtime filtresi (runtime bilgisi yoksa geçir)
    if (filters.runtime !== 'any' && item.film.runtime != null) {
      if (item.film.runtime < minRuntime || item.film.runtime > maxRuntime) {
        return false;
      }
    }

    // Tür filtresi (seçilen türleri çıkar)
    if (filters.excludeGenres.length > 0 && item.film.moodTags.length > 0) {
      const filmGenresLower = item.film.moodTags.map((g) => g.toLowerCase());
      const hasExcluded = filters.excludeGenres.some((eg) =>
        filmGenresLower.includes(eg.toLowerCase()),
      );
      if (hasExcluded) return false;
    }

    return true;
  });

  if (candidates.length === 0) return null;

  // Rastgele seçim
  const randomIndex = Math.floor(Math.random() * candidates.length);
  const picked = candidates[randomIndex];

  return {
    film: picked.film,
    candidateCount: candidates.length,
  };
}

/**
 * Roulette spin sonucunu analytics tablosuna kaydeder.
 * Fire-and-forget — hata UI'ı engellemez.
 *
 * @param filmId         - Seçilen film ID'si
 * @param filters        - Uygulanan filtreler
 * @param candidateCount - Filtreleme sonrası aday sayısı
 * @param outcome        - Kullanıcı aksiyonu
 */
export async function logRoulettePick(
  filmId: string,
  filters: RouletteFilters,
  candidateCount: number,
  outcome: RouletteOutcome = 'shown',
): Promise<void> {
  try {
    const appUserId = await getAppUserId();
    if (!appUserId) return;

    const { error } = await supabase.from('roulette_picks').insert({
      user_id: appUserId,
      film_id: filmId,
      runtime_filter: filters.runtime,
      excluded_genres: filters.excludeGenres,
      used_mood: false,
      outcome,
      candidate_count: candidateCount,
    });

    if (error) {
      logger.error('[roulette] logRoulettePick hata:', error.message);
    }
  } catch (err) {
    logger.error('[roulette] logRoulettePick beklenmedik hata:', err);
  }
}

/**
 * Mevcut roulette pick'in outcome'unu günceller.
 * Kullanıcı "accepted" veya "spin_again" yaptığında çağrılır.
 */
export async function updateRouletteOutcome(
  filmId: string,
  outcome: RouletteOutcome,
): Promise<void> {
  try {
    const appUserId = await getAppUserId();
    if (!appUserId) return;

    const { error } = await supabase
      .from('roulette_picks')
      .update({ outcome })
      .eq('user_id', appUserId)
      .eq('film_id', filmId)
      .order('picked_at', { ascending: false })
      .limit(1);

    if (error) {
      logger.error('[roulette] updateRouletteOutcome hata:', error.message);
    }
  } catch (err) {
    logger.error('[roulette] updateRouletteOutcome beklenmedik hata:', err);
  }
}
