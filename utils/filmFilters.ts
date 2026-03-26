/**
 * FilmFilters yardımcı fonksiyonları.
 * TasteProfile alanlarına dönüşüm ve JS tarafı filtreleme için kullanılır.
 */
import { EraPreference, FilmFilters, YearRangeFilter } from '../types';

/** Yıl aralığı filtresini era_preference'a dönüştürür */
export function yearRangeToEra(range: YearRangeFilter): EraPreference {
  switch (range) {
    case 'pre1990': return { from: 1900, to: 1989 };
    case '1990s':   return { from: 1990, to: 1999 };
    case '2000s':   return { from: 2000, to: 2009 };
    case '2010s':   return { from: 2010, to: 2019 };
    case '2020s':   return { from: 2020, to: 2030 };
    default:        return { from: 1900, to: 2030 };
  }
}

/**
 * Bölge etiketlerini TMDb ISO 3166-1 alpha-2 ülke kodlarına eşler.
 * films.country sütununda bu kodlar saklanır; SQL && operatörüyle filtrelenir.
 */
export function regionsToCulturalContext(regions: string[]): string[] {
  const MAP: Record<string, string[]> = {
    hollywood:    ['US'],
    british:      ['GB'],
    french:       ['FR'],
    german:       ['DE'],
    eastAsia:     ['JP', 'CN', 'HK'],
    korean:       ['KR'],
    turkish:      ['TR'],
    scandinavian: ['SE', 'DK', 'NO', 'FI'],
  };
  return regions.flatMap((r) => MAP[r] ?? [r.toUpperCase()]);
}

/**
 * Minimum oy ortalaması eşiğini döndürür.
 * "top250" ≈ 8.5 olarak tahmin edilir.
 */
export function minRatingThreshold(rating: FilmFilters['minRating']): number | null {
  if (rating === null || rating === undefined) return null;
  if (rating === 'top250') return 8.5;
  return rating;
}
