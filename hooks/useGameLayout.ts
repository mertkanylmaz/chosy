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
import { useCallback, useState } from 'react';
import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';

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

// ─── Dikey sigdirma (Festival Layer Kural 7: oynanis tek sayfa) ─────────────

export interface GameFit {
  /**
   * Olculen kullanilabilir yukseklik. Ilk cizimde 0 — `measured` false iken
   * icerik cizilmemeli, yoksa yanlis boyutla bir kare titrer.
   */
  height: number;
  /** Oynanis kabinin `onLayout`'una baglanir */
  onLayout: (event: LayoutChangeEvent) => void;
  /** Olcum geldi mi */
  measured: boolean;
}

/**
 * Oynanis alaninin yuksekligini olcer — "scroll yok" kuralinin motoru.
 *
 * Oyun ekranlari `ScrollView` kullanmaz (DESIGN_SYSTEM.md › Festival Layer
 * Kural 7); bunun yerine ekran bir kez olculur ve oge boyutlari kalan alandan
 * pay bicilerek hesaplanir. Once Imposter'da yazilmisti, alti oyun ayni
 * matematigi kopyalamasin diye buraya cikarildi.
 *
 * @example
 * const fit = useGameFit();
 * const posterH = clamp(fit.height * 0.3, 120, 220);
 * return <View style={styles.screen} onLayout={fit.onLayout}>
 *   {fit.measured ? <Board height={fit.height - posterH} /> : null}
 * </View>;
 */
export function useGameFit(): GameFit {
  const [height, setHeight] = useState(0);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.height;
    // Yalnizca anlamli degisimde state guncelle — 0.5px'lik layout gurultusu
    // her karede yeniden render tetiklemesin.
    setHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
  }, []);

  return { height, onLayout, measured: height > 0 };
}

/**
 * Bir degeri alt ve ust sinir arasina sikistirir.
 *
 * Sigdirma hesaplarinda taban DEGERI onemlidir: sifira inen bir yukseklik
 * icerigi sessizce kirpar, ki bu yasak (Kural 7). Her cagri yerinde `min`
 * "bu cihazda hala okunur" degeri olarak secilir ve gerekcesi yorumla yazilir.
 *
 * @param value Hesaplanan ham deger
 * @param min Okunurluk tabani
 * @param max Ust sinir — oge gereksiz buyumesin
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}
