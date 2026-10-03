/**
 * ResultCard kahraman görselinin hangi hâlde çizileceği — saf karar.
 *
 * React Native'den bağımsız: `tests/games/resultHeroMode.test.ts`.
 */

export type ResultHeroMode = 'poster' | 'placeholder' | 'none';

export interface ResultHeroInput {
  /** Çağıran kendi kahraman görselini çiziyor (Spotlight karesi, P-2) */
  hidePoster?: boolean;
  /** URL `http(s)` değil — çizilemez */
  invalidUri: boolean;
  /** Yükleme hatası geldi */
  posterFailed: boolean;
  /** Çizilebilir URL var */
  hasUrl: boolean;
}

/**
 * `hidePoster` verilmediğinde karar P-2 öncesiyle birebir aynıdır:
 * geçersiz/başarısız → yer tutucu, URL varsa → poster, yoksa → hiçbiri.
 */
export function resultHeroMode({
  hidePoster = false,
  invalidUri,
  posterFailed,
  hasUrl,
}: ResultHeroInput): ResultHeroMode {
  if (hidePoster) return 'none';
  if (invalidUri || posterFailed) return 'placeholder';
  return hasUrl ? 'poster' : 'none';
}
