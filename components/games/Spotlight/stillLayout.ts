/**
 * Spotlight karesinin kutu geometrisi — saf fonksiyonlar.
 *
 * P-2: kutu eskiden ölçülen alandan 150–380pt arası yükseklik alıyordu;
 * `contentFit="cover"` + merkez konumla 16:9 backdrop yanlardan kırpılıyor,
 * kenarda duran figür (Beau Travail) kutu dışında kalıyordu. Kutu artık
 * kaynakla aynı oranda: genişlik × 9/16. Her cihazda aynı kare, kırpma yok.
 *
 * React Native'den bağımsız — `tests/games/spotlightLayout.test.ts`.
 */

/** TMDb backdrop oranı — kutu bu orana sabitlenir */
export const STILL_ASPECT = 16 / 9;

/** Kutu yüksekliği — genişlikten türetilir, ölçüm beklemez */
export function stillHeightFor(width: number): number {
  return width / STILL_ASPECT;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * `cover` yerleşiminde kaynağın kutuda görünen oranı (0..1, eksen başına).
 * Kutu kaynaktan uzunsa yanlar, basıksa üst/alt kırpılır.
 */
export function coverVisibleFraction(box: Size, source: Size): { x: number; y: number } {
  const scale = Math.max(box.width / source.width, box.height / source.height);
  return {
    x: Math.min(1, box.width / (source.width * scale)),
    y: Math.min(1, box.height / (source.height * scale)),
  };
}
