/**
 * Gevşetme zinciri (match_films çağrı adımları) — saf fonksiyon, test edilebilir.
 *
 * Kural (PRO-0 F0-1): kullanıcının seçtiği puan (`ratingMin`) ve dönem (`era`)
 * HİÇBİR denemede gevşetilmez; yalnız `minSimilarity` gevşer. Kullanıcı filtre
 * seçmediyse zincir eski değerlerle aynıdır (puan 6.5 → 6.0 → 5.5 → yok, dönem yok).
 */

export interface RelaxationEra {
  from: number;
  to: number;
}

export interface RelaxationStep {
  minSimilarity: number;
  minRating: number | null;
  era: RelaxationEra | null;
}

/** Filtre seçilmediğinde varsayılan başlangıç puanı (eski `baseRating`). */
export const DEFAULT_BASE_RATING = 6.5;

export function buildRelaxationSteps(
  ratingMin: number | null,
  era: RelaxationEra | null,
): RelaxationStep[] {
  const userRating = ratingMin != null;
  const userEra = era != null;
  const legacy: RelaxationStep[] = [
    { minSimilarity: 0.45, minRating: ratingMin ?? DEFAULT_BASE_RATING, era },
    { minSimilarity: 0.42, minRating: 6.0, era },
    { minSimilarity: 0.4, minRating: 5.5, era: null },
    { minSimilarity: 0.38, minRating: null, era: null },
  ];
  return legacy.map((step) => ({
    minSimilarity: step.minSimilarity,
    minRating: userRating ? ratingMin : step.minRating,
    era: userEra ? era : step.era,
  }));
}
