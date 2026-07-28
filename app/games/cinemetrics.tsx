/**
 * CineMetrics — Günlük film tahmin bulmacası.
 *
 * 6 sütun (Yıl, Tür, Yönetmen, Puan, Süre, Ülke) üzerinden
 * film eşleştirme oyunu. Wordle benzeri feedback grid.
 */
import React from 'react';

import { CineMetricsGame } from '@/components/games/CineMetrics';

export default function CineMetricsScreen() {
  return <CineMetricsGame />;
}
