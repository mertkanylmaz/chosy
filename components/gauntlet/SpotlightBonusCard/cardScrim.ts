/**
 * Spotlight Home kartı: tam-kart film karesinin katmanları (Home-B1.2, B+ Cinematic Spotlight).
 * Saf modül — React/RN import YOK, Deno okur (`tests/gauntlet/spotlightCardScrim.test.ts`).
 * `heroScrim.ts` ile aynı desen: durak sabitleri burada, renk bileşende `withAlpha(kart rengi, alfa)`.
 *
 * Katman sırası (alttan üste): kare (cover, üst-orta odak) → karartma (yalnız bulanık durumda)
 * → soldan sağa koyu gradyan (metin okunur) → metin. Katman rengi KART RENGİ (`surface.raised`) —
 * Saydamlığı Azalt açıkken de aynı çizilir (renk opak, blur görselde; alfa yalnız karışım oranı).
 */

/** Dikey odak: kare 361×72 (≈5:1) olduğundan 16:9 kaynak ağır kırpılır; yüzler genelde üst üçte birde. */
export const FRAME_FOCUS_TOP = '40%';

/** Bulanık durumda kareye binen hafif karartma (kart rengi, bu opaklıkta). */
export const FRAME_DIM_ALPHA = 0.2;

/**
 * Soldan sağa gradyan durakları: konum (kart genişliğinin 0 → 1'i) ve kart rengi opaklığı.
 * Metin bloğu kartın `TEXT_MAX_FRACTION`'ına kadar uzanır; o noktaya dek opaklık tavanda kalır.
 * Sağ kenarda ~%15: kare orada görünür, hap/chevron kendi koyu zemininde okunur.
 */
export const SCRIM_X_STOPS = [
  { at: 0, alpha: 0.88 },
  { at: 0.5, alpha: 0.88 },
  { at: 1, alpha: 0.15 },
] as const;

/** Metin bloğunun kart genişliğine oranla sağ sınırı (padding dahil ≈ 0.5): `maxWidth` yüzdesiyle sağlanır. */
export const TEXT_MAX_FRACTION = 0.5;

/** Metin bloğunun `maxWidth` değeri — kartın iç genişliğine oranla (padding 16'lar hariç). */
export const TEXT_BLOCK_MAX_WIDTH = '50%';

/** Gradyanın `x` konumundaki kart rengi opaklığı (doğrusal ara değer). */
export function scrimAlphaAtX(x: number): number {
  const first = SCRIM_X_STOPS[0];
  const last = SCRIM_X_STOPS[SCRIM_X_STOPS.length - 1];
  if (x <= first.at) return first.alpha;
  if (x >= last.at) return last.alpha;
  for (let i = 1; i < SCRIM_X_STOPS.length; i++) {
    const a = SCRIM_X_STOPS[i - 1];
    const b = SCRIM_X_STOPS[i];
    if (x <= b.at) return a.alpha + ((b.alpha - a.alpha) * (x - a.at)) / (b.at - a.at);
  }
  return last.alpha;
}
