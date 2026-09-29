/**
 * Şampiyon hero'sunun geçiş (scrim) geometrisi — V-3 Tur G2, C1 / V3-D4.
 *
 * Poster ekranın ~%46'sını kaplar (V-4 Tur B; önce ~%60); alt kısmı `ink`'e
 * düz alfa geçişiyle erir (gradient YALNIZ alfa değiştirir, renk sabit `ink` — sRGB karışımında
 * ara renk üretmez). Etiket + başlık bloğu geçişin üstüne biner.
 *
 * V-4 Tur A (V4-D2, V4-D3): geçişin BİTTİĞİ renk sayfa zemininin kendisi —
 * `ink`, alfa 1. TestFlight 906'daki sert kenar, sayfanın `ink` + şampiyon
 * ışık sızması olmasından çıkıyordu; şampiyonda sızma kapatıldı
 * (`GauntletShell`), zemin saf `ink`.
 *
 * Kontrast (≥ 4.5:1) en kötü durum için ölçülür: bloğun başladığı satırın
 * arkasında SAF BEYAZ poster pikseli. Gerçek afişlerin hepsi (açık posterler
 * dahil, ör. Forrest Gump) bu sınırın altında kalır. Ölçüm Deno testinde:
 * `tests/gauntlet/heroScrim.test.ts`. Sabitlerden biri değişirse test tekrar
 * koşar — geçiş noktası yukarı çekilmesi gerekiyorsa orada görünür.
 *
 * Saf modül: React/RN/import YOK — Deno doğrudan okur.
 */

/**
 * Hero yüksekliği / pencere yüksekliği.
 *
 * V-4 Tur B: 0.6 → 0.46 (TestFlight 906: ilk ekranda yalnız Watch now
 * görünüyordu). Hedef: ≥ 844pt pencerede Watch now + Sonraya bırak + Paylaş
 * kaydırmadan görünür; SE'de en az Watch now.
 */
export const HERO_HEIGHT_RATIO = 0.46;

/**
 * Geçişin pencere yüksekliğindeki MUTLAK payı — V-4 Tur A'nın geometrisi
 * (0.6 hero × 0.35 = pencerenin %21'i). Hero kısalınca oran hero'ya göre
 * sabit tutulsaydı geçiş de kısalır, blok geçişin açık kısmına düşer ve
 * SE'de kontrast 4.5'in altına inerdi. Mutlak pay korununca etiket/başlık
 * satırının arkasındaki `ink` opaklığı Tur A ile birebir aynı kalır.
 */
const SCRIM_WINDOW_RATIO = 0.21;

/** Geçişin kapladığı pay — hero'ya oranla (V-4 Tur B: 0.35 → ~0.457). */
export const SCRIM_HEIGHT_RATIO = SCRIM_WINDOW_RATIO / HERO_HEIGHT_RATIO;

/**
 * Geçiş durakları: konum (geçiş içinde 0 → 1) ve `ink` opaklığı.
 * `expo-linear-gradient`'e `locations` + renk olarak aynen verilir.
 */
export const SCRIM_STOPS = [
  { at: 0, alpha: 0 },
  { at: 0.4, alpha: 0.8 },
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

// ─── Üst geçiş — V-4 Tur A (V4-D2) ───────────────────────────────────────────
//
// Etiket hero'dan ÇIKTI (TestFlight 906: "YOUR FIRST FILM" posterin basılı
// başlığının üstüne biniyordu); artık alt blokta, başlığın hemen üstünde.
// Üst geçiş yalnız durum çubuğunu ve posterin tepesini yumuşatır — posterin
// basılı başlığı ne olursa olsun. Aynı ilke: renk sabit `ink`, yalnız alfa.

/** Üst geçişin kapladığı pay — hero'nun üst %25'i. */
export const TOP_SCRIM_HEIGHT_RATIO = 0.25;

/** Üst geçiş durakları — tepeden (0) aşağı (1): `ink`@55% → şeffaf. */
export const TOP_SCRIM_STOPS = [
  { at: 0, alpha: 0.55 },
  { at: 1, alpha: 0 },
] as const;

/** Üst geçiş içindeki konumda (`t` ∈ [0, 1]) `ink` opaklığı. */
export function topScrimAlphaAt(t: number): number {
  return alphaInStops(TOP_SCRIM_STOPS, t);
}

/** Verilen pencere yüksekliğinde etiket bloğunun başladığı satırdaki `ink` opaklığı. */
export function alphaAtOverlapStart(windowHeight: number): number {
  const hero = windowHeight * HERO_HEIGHT_RATIO;
  const scrim = hero * SCRIM_HEIGHT_RATIO;
  const blockTop = hero - TITLE_OVERLAP;
  return scrimAlphaAt((blockTop - (hero - scrim)) / scrim);
}
