/**
 * useCinemaDna — Cinema DNA'nin tek okuma noktasi.
 *
 * Hub hero'su, DNA kart'i ve profil ayni veriyi gosteriyor; sorgu uc yerde
 * kopyalanmasin diye buraya alindi.
 *
 * Rank ilerlemesi `app_config.dna_config`'ten okunur (Hard Rule 4 — esikler
 * module-level sabit degildir). Config okunamazsa `progress` null doner ve
 * cagiran taraf ilerleme cubugunu gizler; uydurma esik gosterilmez.
 */
import { useCallback, useEffect, useState } from 'react';

import { getDnaConfig } from '@/services/gameApi';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';

/** cinema_dna tablosunun istemcide kullanilan alanlari */
export interface CinemaDna {
  knowledge: number;
  deduction: number;
  auteur_sense: number;
  instinct: number;
  consistency: number;
  visual_sense: number;
  cinema_score: number;
  rank_id: number;
  identity_title: string | null;
  total_dailies_completed: number;
}

/** Bir sonraki rank'a ilerleme — hangi kosulun bagladigini da soyler */
export interface RankProgressInfo {
  /** 0-1 arasi ilerleme; iki kosuldan darbogaz olani */
  ratio: number;
  /** Ilerlemeyi baglayan kosul — kullaniciya ne yapmasi gerektigini soyler */
  blockedBy: 'accuracy' | 'dailies';
  /** Sonraki rank icin gereken gunluk sayisi (blockedBy='dailies' ise anlamli) */
  dailiesNeeded: number;
  /** Zaten en ust rank ise true — ilerleme cubugu gosterilmez */
  isMaxRank: boolean;
}

/** DNA boyutlari — gosterim sirasi */
export const DNA_DIMENSIONS = [
  'knowledge',
  'deduction',
  'auteur_sense',
  'instinct',
  'consistency',
  'visual_sense',
] as const;

export type DnaDimension = typeof DNA_DIMENSIONS[number];

interface UseCinemaDnaResult {
  dna: CinemaDna | null;
  progress: RankProgressInfo | null;
  loading: boolean;
  /** Veri cekilemedi — cagiran taraf gorunur hata/retry sunar (Hard Rule 5) */
  error: boolean;
  reload: () => Promise<void>;
}

/** Alti boyutun duz ortalamasi — rank esikleri bu deger uzerinden degerlendirilir */
function dimensionAverage(dna: CinemaDna): number {
  const sum = DNA_DIMENSIONS.reduce((acc, dim) => acc + (dna[dim] ?? 0), 0);
  return sum / DNA_DIMENSIONS.length;
}

/**
 * Kullanicinin Cinema DNA'sini ve bir sonraki rank'a ilerlemesini doner.
 *
 * DNA satiri yoksa (hic oyun oynamamis kullanici) `dna` null doner — bu bir
 * hata degildir, `error` false kalir.
 */
export function useCinemaDna(): UseCinemaDnaResult {
  const [dna, setDna] = useState<CinemaDna | null>(null);
  const [progress, setProgress] = useState<RankProgressInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const { data, error: dbError } = await supabase
        .from('cinema_dna')
        .select(
          'knowledge, deduction, auteur_sense, instinct, consistency, visual_sense, cinema_score, rank_id, identity_title, total_dailies_completed',
        )
        .maybeSingle();

      if (dbError) throw dbError;

      if (!data) {
        // Henuz oyun oynamamis kullanici — bos durum, hata degil
        setDna(null);
        setProgress(null);
        return;
      }

      const row = data as CinemaDna;
      setDna(row);
      setProgress(await computeProgress(row));
    } catch (err) {
      logger.error(
        '[useCinemaDna] DNA okunamadi:', err,
        {
          code: 'CINEMA_DNA_READ_FAILED',
          sampleRate: 0.5,
        },
      );
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { dna, progress, loading, error, reload };
}

/**
 * Bir sonraki rank'a ilerlemeyi hesaplar.
 *
 * Sunucudaki kural (migration 058): rank kazanilmasi icin hem DNA ortalamasi
 * esigi hem de tamamlanmis gunluk sayisi saglanmali. Ikisinden dusuk olani
 * ilerlemeyi baglar — kullaniciya gosterilen de odur.
 */
async function computeProgress(dna: CinemaDna): Promise<RankProgressInfo | null> {
  const config = await getDnaConfig();
  if (!config) return null;

  const { rankThresholds, rankMinDailies } = config;
  // rank_id 1 tabanli; sonraki rank'in esigi index = rank_id
  const nextIndex = dna.rank_id;

  if (nextIndex >= rankThresholds.length || nextIndex >= rankMinDailies.length) {
    return { ratio: 1, blockedBy: 'accuracy', dailiesNeeded: 0, isMaxRank: true };
  }

  const neededAvg = rankThresholds[nextIndex];
  const neededDailies = rankMinDailies[nextIndex];

  const avgRatio = neededAvg > 0 ? dimensionAverage(dna) / neededAvg : 1;
  const dailiesRatio =
    neededDailies > 0 ? dna.total_dailies_completed / neededDailies : 1;

  const blockedBy = dailiesRatio < avgRatio ? 'dailies' : 'accuracy';

  return {
    ratio: Math.max(0, Math.min(1, Math.min(avgRatio, dailiesRatio))),
    blockedBy,
    dailiesNeeded: Math.max(0, neededDailies - dna.total_dailies_completed),
    isMaxRank: false,
  };
}
