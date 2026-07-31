/**
 * useGameLayout — oyun ekranlarinin genislik hesabi icin hook.
 *
 * `Dimensions.get('window')` modul seviyesinde bir kez okunur ve rotasyon,
 * iPad Split View veya katlanabilir cihazda guncellenmez. `useWindowDimensions`
 * her degisimde yeniden render eder. Yeni yazilan oyun ekranlari bunu kullanir;
 * mevcut stil dosyalari (Detective, CineMetrics, Spotlight) hala modul sabiti
 * uzerinden `gameContentWidth()` cagiriyor — o gecis ayri bir is.
 *
 * Sozlesme ayrintisi: constants/gameLayout.ts dosya basi.
 */
import { useWindowDimensions } from 'react-native';

import { gameContentWidth, gridItemWidth } from '@/constants/gameLayout';

/**
 * GameShell icinde kullanilabilir yatay alan. Ekran boyutu degisince guncellenir.
 */
export function useGameContentWidth(): number {
  const { width } = useWindowDimensions();
  return gameContentWidth(width);
}

/**
 * N sutunlu izgarada oge genisligi — icerik alanina gore.
 *
 * @param columns - Sutun sayisi
 * @param gap - Sutunlar arasi bosluk
 */
export function useGridItemWidth(columns: number, gap: number): number {
  const contentWidth = useGameContentWidth();
  return gridItemWidth(contentWidth, columns, gap);
}
