/**
 * Spotlight — günlük film karesi bulmacası (V3).
 *
 * Bulanık bir kare + maskeli başlık: oyuncu harf açar (her doğru harf kareyi
 * netleştirir, yanlış harf hak götürür) ve istediği an filmi aramadan tahmin
 * eder. 6 hak. Çözüm istemciye inmez — ayrıntı: components/games/Spotlight.
 *
 * Yerleşim: üst bölge (kare + maske) kendi içinde kayar, harf klavyesi +
 * arama alanı dipte sabit kalır — uzun başlık veya açık sistem klavyesi
 * arama alanını ekran dışına itemez (B-1 / Fix 8).
 */
import React from 'react';

import { SpotlightGame } from '@/components/games/Spotlight';

export default function SpotlightScreen() {
  return <SpotlightGame />;
}
