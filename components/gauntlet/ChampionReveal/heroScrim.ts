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

type ScrimStop = { readonly at: number; readonly alpha: number };

/** Durak listesinde `t` ∈ [0, 1] konumundaki `ink` opaklığı — doğrusal ara değer. */
function alphaInStops(stops: readonly ScrimStop[], t: number): number {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (x <= b.at) {
      return a.alpha + ((x - a.at) / (b.at - a.at)) * (b.alpha - a.alpha);
    }
  }
  return stops[stops.length - 1].alpha;
}

/** Alt geçiş içindeki konumda (`t` ∈ [0, 1]) `ink` opaklığı. */
export function scrimAlphaAt(t: number): number {
  return alphaInStops(SCRIM_STOPS, t);
}

// ─── V-3 referans uyumu: etiket hero'nun TEPESİNDE ───────────────────────────
//
// "TONIGHT'S FILM" posterin üst kenarına, güvenli alanın altına taşındı.
// Posterin tepesi herhangi bir renkte olabilir → üstten `ink`'e ikinci bir
// alfa geçişi (alttakiyle aynı ilke: renk sabit, yalnız alfa). Durum çubuğu
// ikonları da aynı geçişten okunurluk kazanır.

/** Üst geçişin yüksekliği (pt), hero'nun tepesinden aşağı. */
export const TOP_SCRIM_HEIGHT = 160;

/** Üst geçiş durakları — tepeden (0) aşağı (1). Etiket satırı ~0.4–0.6'da. */
export const TOP_SCRIM_STOPS = [
  { at: 0, alpha: 0.85 },
  { at: 0.6, alpha: 0.8 },
  { at: 1, alpha: 0 },
] as const;

/** Etiketin güvenli alanın ne kadar altından başladığı (pt) — `space.base`. */
export const KICKER_TOP_GAP = 16;

/** Etiket satır yüksekliği (pt) — `type['label-caps'].lineHeight`. */
export const KICKER_LINE_HEIGHT = 16;

/** Üst geçiş içindeki konumda (`t` ∈ [0, 1]) `ink` opaklığı. */
export function topScrimAlphaAt(t: number): number {
  return alphaInStops(TOP_SCRIM_STOPS, t);
}

/**
 * Etiket satırının ALT kenarındaki `ink` opaklığı — satırın en şeffaf noktası
 * (geçiş aşağı doğru açılıyor), yani kontrastın en kötü olduğu yer.
 */
export function alphaAtKickerBottom(topInset: number): number {
  const kickerBottom = topInset + KICKER_TOP_GAP + KICKER_LINE_HEIGHT;
  return topScrimAlphaAt(kickerBottom / TOP_SCRIM_HEIGHT);
}

/** Verilen pencere yüksekliğinde etiket bloğunun başladığı satırdaki `ink` opaklığı. */
export function alphaAtOverlapStart(windowHeight: number): number {
  const hero = windowHeight * HERO_HEIGHT_RATIO;
  const scrim = hero * SCRIM_HEIGHT_RATIO;
  const blockTop = hero - TITLE_OVERLAP;
  return scrimAlphaAt((blockTop - (hero - scrim)) / scrim);
}
