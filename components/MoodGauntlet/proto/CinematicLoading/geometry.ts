/**
 * PROTOTİP — Cinematic Discovery Loading sahne geometrisi. Saf fonksiyonlar: RN/Reanimated yok,
 * Deno ile test edilir (tests/moodgauntlet/cinematicProto.test.ts).
 *
 * Tek koordinat sistemi: sahne kökü (Your four kökü ile aynı kutu). Çerçeveler SON yerlerinde
 * (2×2 ızgara) mutlak konumlanır; şeritteki hâl bu konumdan bir transform ofsetidir. Böylece
 * çıkışta düzen değişmez, yalnız transform 1'e gider → layout shift yok.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bir çerçevenin ızgaradaki kutusu (sol-üst + boy) — poster alanı + meta bloğu. */
export interface FrameSlot {
  x: number;
  y: number;
  w: number;
  /** Yalnız poster alanı (2:3). */
  posterH: number;
  /** Poster + azami meta bloğu: yükseklik sabit, başlık gelince satır kaymaz. */
  tileH: number;
}

/** Şeritteki hâl: ızgara konumundan ofset (RN transform sırası: translate → rotate → scale). */
export interface StripPose {
  tx: number;
  ty: number;
  rotateDeg: number;
  scale: number;
}

/**
 * Your four ızgarasıyla aynı yerleşim: `gridBox` içinde ortalı 2×2, hücre genişliği `cell`
 * (FourIntro.fourCellWidth), aralık `gap`, meta bloğu `metaH` (POSTER_META_BLOCK_HEIGHT).
 */
export function gridSlots(gridBox: Box, cell: number, gap: number, metaH: number): FrameSlot[] {
  if (cell <= 0) return [];
  const posterH = cell * 1.5;
  const tileH = posterH + metaH;
  const gridW = cell * 2 + gap;
  const gridH = tileH * 2 + gap;
  const x0 = gridBox.x + (gridBox.w - gridW) / 2;
  const y0 = gridBox.y + (gridBox.h - gridH) / 2;
  const slots: FrameSlot[] = [];
  for (let row = 0; row < 2; row += 1) {
    for (let col = 0; col < 2; col += 1) {
      slots.push({ x: x0 + col * (cell + gap), y: y0 + row * (tileH + gap), w: cell, posterH, tileH });
    }
  }
  return slots;
}

/** Şeridin orta çizgisi: ekranı yatay geçen yumuşak S (kübik Bézier). */
export interface StripCurve {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

export function stripCurve(sceneW: number, centerY: number, amplitude: number): StripCurve {
  return {
    p0: { x: -0.08 * sceneW, y: centerY + amplitude },
    p1: { x: 0.33 * sceneW, y: centerY - 1.6 * amplitude },
    p2: { x: 0.66 * sceneW, y: centerY + 1.6 * amplitude },
    p3: { x: 1.08 * sceneW, y: centerY - amplitude },
  };
}

export function curvePath(c: StripCurve, dy = 0): string {
  const f = (p: Point): string => `${p.x.toFixed(1)} ${(p.y + dy).toFixed(1)}`;
  return `M ${f(c.p0)} C ${f(c.p1)} ${f(c.p2)} ${f(c.p3)}`;
}

export function pointAt(c: StripCurve, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const d = 3 * u * t * t;
  const e = t * t * t;
  return {
    x: a * c.p0.x + b * c.p1.x + d * c.p2.x + e * c.p3.x,
    y: a * c.p0.y + b * c.p1.y + d * c.p2.y + e * c.p3.y,
  };
}

/** Teğet açısı (derece). */
export function angleAt(c: StripCurve, t: number): number {
  const u = 1 - t;
  const dx = 3 * u * u * (c.p1.x - c.p0.x) + 6 * u * t * (c.p2.x - c.p1.x) + 3 * t * t * (c.p3.x - c.p2.x);
  const dy = 3 * u * u * (c.p1.y - c.p0.y) + 6 * u * t * (c.p2.y - c.p1.y) + 3 * t * t * (c.p3.y - c.p2.y);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

/** Dört çerçevenin şeritteki parametreleri (eşit aralık). */
export const STRIP_T = [0.2, 0.4, 0.6, 0.8] as const;

/**
 * Izgara kutusundan şeritteki pozu: poster alanının merkezi şerit noktasına oturur, çerçeve
 * teğete döner ve `scale` kadar küçülür. RN dönüş/ölçeği görünüm MERKEZİ etrafında uygular;
 * poster merkezi görünüm merkezinin `dy0` kadar yukarısında (meta bloğu altta).
 */
export function stripPose(slot: FrameSlot, target: Point, rotateDeg: number, scale: number): StripPose {
  const centerX = slot.x + slot.w / 2;
  const centerY = slot.y + slot.tileH / 2;
  const dy0 = slot.posterH / 2 - slot.tileH / 2; // ≤ 0
  const rad = (rotateDeg * Math.PI) / 180;
  // rot(θ)·(0, s·dy0) = (−s·dy0·sinθ, s·dy0·cosθ)
  const offX = -scale * dy0 * Math.sin(rad);
  const offY = scale * dy0 * Math.cos(rad);
  return { tx: target.x - offX - centerX, ty: target.y - offY - centerY, rotateDeg, scale };
}

/** Şerit ölçüleri: şeritteki küçük çerçevenin poster yüksekliği + iki perforasyon bandı. */
export interface StripMetrics {
  width: number;
  perfBand: number;
  perfOffset: number;
  holeW: number;
  holeLen: number;
  holeGap: number;
}

export function stripMetrics(posterH: number, scale: number, minBand: number): StripMetrics {
  const small = posterH * scale;
  const perfBand = Math.max(minBand, small * 0.16);
  const width = small + perfBand * 2;
  return {
    width,
    perfBand,
    perfOffset: width / 2 - perfBand / 2,
    holeW: perfBand * 0.5,
    holeLen: perfBand * 0.6,
    holeGap: perfBand * 0.9,
  };
}

/** Işık huzmesi: mercekten ızgaranın altına açılan yamuk. */
export function beamPolygon(lens: Point, gridLeft: number, gridRight: number, bottom: number, spread: number): string {
  const pts: Point[] = [
    { x: lens.x - 4, y: lens.y },
    { x: lens.x + 4, y: lens.y },
    { x: gridRight + spread, y: bottom },
    { x: gridLeft - spread, y: bottom },
  ];
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}
