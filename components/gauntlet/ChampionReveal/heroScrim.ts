/**
 * Şampiyon hero'sunun geçiş (scrim) geometrisi — V-3 Tur G2, C1 / V3-D4.
 *
 * Poster ekranın ~%60'ını kaplar; alt kısmı `ink`'e düz alfa geçişiyle
 * erir (gradient YALNIZ alfa değiştirir, renk sabit `ink` — sRGB karışımında
 * ara renk üretmez). Etiket + başlık bloğu geçişin üstüne biner.
 *
 * Kontrast (≥ 4.5:1) en kötü durum için ölçülür: bloğun başladığı satırın
 * arkasında SAF BEYAZ poster pikseli. Gerçek afişlerin hepsi (açık posterler
 * dahil, ör. Forrest Gump) bu sınırın altında kalır. Ölçüm Deno testinde:
 * `tests/gauntlet/heroScrim.test.ts`. Sabitlerden biri değişirse test tekrar
 * koşar — geçiş noktası yukarı çekilmesi gerekiyorsa orada görünür.
 *
 * Saf modül: React/RN/import YOK — Deno doğrudan okur.
 */

/** Hero yüksekliği / pencere yüksekliği. */
export const HERO_HEIGHT_RATIO = 0.6;

/** Geçişin kapladığı pay — hero'nun alt yarısı. */
export const SCRIM_HEIGHT_RATIO = 0.5;

/**
 * Geçiş durakları: konum (geçiş içinde 0 → 1) ve `ink` opaklığı.
 * `expo-linear-gradient`'e `locations` + renk olarak aynen verilir.
 */
export const SCRIM_STOPS = [
  { at: 0, alpha: 0 },
  { at: 0.5, alpha: 0.7 },
  { at: 1, alpha: 1 },
] as const;

/**
 * Etiket bloğunun hero'nun alt kenarının ne kadar ÜSTÜNDEN başladığı (pt).
 * Etiket (16pt satır) + boşluk + başlığın ilk satırının bir kısmı.
 */
export const TITLE_OVERLAP = 72;

/**
 * Tasarımın desteklediği en kısa pencere (pt) — iPhone SE 1. nesil sınıfı.
 * Hero kısaldıkça blok geçişin daha açık kısmına düşer; en kötü durum burası.
 */
export const MIN_WINDOW_HEIGHT = 568;

/** Geçiş içindeki konumda (`t` ∈ [0, 1]) `ink` opaklığı — doğrusal ara değer. */
export function scrimAlphaAt(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < SCRIM_STOPS.length; i++) {
    const a = SCRIM_STOPS[i - 1];
    const b = SCRIM_STOPS[i];
    if (x <= b.at) {
      return a.alpha + ((x - a.at) / (b.at - a.at)) * (b.alpha - a.alpha);
    }
  }
  return SCRIM_STOPS[SCRIM_STOPS.length - 1].alpha;
}

/** Verilen pencere yüksekliğinde etiket bloğunun başladığı satırdaki `ink` opaklığı. */
export function alphaAtOverlapStart(windowHeight: number): number {
  const hero = windowHeight * HERO_HEIGHT_RATIO;
  const scrim = hero * SCRIM_HEIGHT_RATIO;
  const blockTop = hero - TITLE_OVERLAP;
  return scrimAlphaAt((blockTop - (hero - scrim)) / scrim);
}
