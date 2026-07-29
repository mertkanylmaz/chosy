/**
 * Oyun onerisi — hangi oynanmamis oyun DNA'daki en buyuk bosugu kapatir.
 *
 * Eskiden RecommendedRoute bileseninin icindeydi ve kendi cinema_dna sorgusunu
 * atiyordu. Hub artik DNA'yi bir kez okuyor (useCinemaDna), bu yuzden hesap
 * saf fonksiyona cikarildi — veri cekmez, yalnizca siralar.
 */
import type { CinemaDna, DnaDimension } from '@/hooks/useCinemaDna';

/** Her oyunun besledigi DNA boyutlari */
const GAME_DNA_MAP: Record<string, DnaDimension[]> = {
  cinemetrics: ['knowledge', 'deduction', 'auteur_sense'],
  logline: ['knowledge', 'deduction'],
  fadein: ['visual_sense', 'knowledge'],
  imposter: ['knowledge'],
  quoted: ['knowledge', 'deduction'],
  spotlight: ['knowledge', 'deduction'],
  detective: ['knowledge', 'deduction', 'visual_sense', 'auteur_sense'],
};

/** DNA verisi yokken varsayilan boyut degeri — tum bosluklar esit sayilir */
const NEUTRAL_DIMENSION = 50;

export interface GameRecommendation {
  gameType: string;
  /** Toplam kapatilabilir bosluk — buyuk olan once */
  impactScore: number;
  /** En cok fayda saglayacak boyut */
  primaryDimension: DnaDimension | null;
}

/**
 * Oynanmamis oyunlari DNA etkisine gore siralar.
 *
 * @param dna - Kullanicinin DNA'si; null ise tum boyutlar notr kabul edilir
 * @param playedGames - Bugun oynanmis oyun tipleri (haric tutulur)
 * @param availableGames - Hub'da acik olan oyun tipleri (games_enabled)
 */
export function rankByDnaImpact(
  dna: CinemaDna | null,
  playedGames: string[],
  availableGames: string[],
): GameRecommendation[] {
  const played = new Set(playedGames);
  const unplayed = availableGames.filter((g) => !played.has(g));
  if (unplayed.length === 0) return [];

  const scored = unplayed.map((gameType) => {
    const dims = GAME_DNA_MAP[gameType] ?? [];
    let impactScore = 0;
    let primaryDimension: DnaDimension | null = null;
    let bestGap = -1;

    for (const dim of dims) {
      const gap = 100 - (dna?.[dim] ?? NEUTRAL_DIMENSION);
      impactScore += gap;
      if (gap > bestGap) {
        bestGap = gap;
        primaryDimension = dim;
      }
    }

    return { gameType, impactScore, primaryDimension };
  });

  return scored.sort((a, b) => b.impactScore - a.impactScore);
}
