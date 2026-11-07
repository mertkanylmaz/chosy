/**
 * PROTOTİP — statik onay kapısı sahnelerinin saf geometrisi (RN yok; Deno ile test edilir:
 * tests/moodgauntlet/cinematicStatic.test.ts). Işık yaklaşımı (kurucu kararı 07.11.2026):
 * projektör nesnesi YOK; hacimsel huzme + toz + vinyet + perspektifli perforasyonlu şerit.
 * Tüm ölçüler sahne boyundan / ızgara kutusundan türetilir, sabit piksel kompozisyonu yok.
 */

/** Asgari poster hücresi (pt). Altında ızgara ÇİZİLMEZ, görünür dev uyarısı çıkar. */
export const MIN_CELL = 96;

export interface CellGuard {
  cell: number;
  ok: boolean;
}

/** `fourCellWidth` sonucunu asgari sınıra karşı denetler; küçültüp sessizce çizmez. */
export function guardCell(cell: number, min: number = MIN_CELL): CellGuard {
  return { cell, ok: cell >= min };
}

export interface Point {
  x: number;
  y: number;
}

export interface Cubic {
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

export function cubicPoint(c: Cubic, t: number): Point {
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

/** Birim teğet. */
export function cubicTangent(c: Cubic, t: number): Point {
  const u = 1 - t;
  const dx = 3 * u * u * (c.p1.x - c.p0.x) + 6 * u * t * (c.p2.x - c.p1.x) + 3 * t * t * (c.p3.x - c.p2.x);
  const dy = 3 * u * u * (c.p1.y - c.p0.y) + 6 * u * t * (c.p2.y - c.p1.y) + 3 * t * t * (c.p3.y - c.p2.y);
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

export function toPoints(pts: Point[]): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** Deterministik PRNG (mulberry32): toz her açılışta aynı yerde — statik sahne kararlı. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Işık huzmesi ──

export interface Beam {
  apex: Point;
  /** Eksen yönü (radyan). */
  dir: number;
  length: number;
  /** Eksenin ucu (gradyan bitişi). */
  end: Point;
}

export function beamTowards(apex: Point, target: Point, length: number): Beam {
  const dir = Math.atan2(target.y - apex.y, target.x - apex.x);
  return { apex, dir, length, end: { x: apex.x + Math.cos(dir) * length, y: apex.y + Math.sin(dir) * length } };
}

/** Huzmenin bir katmanı: tepede `apexHalf` genişlikli, `halfAngleDeg` açılı kama (4 köşe). */
export function beamWedge(b: Beam, halfAngleDeg: number, apexHalf: number): Point[] {
  const n = { x: -Math.sin(b.dir), y: Math.cos(b.dir) };
  const h = (halfAngleDeg * Math.PI) / 180;
  const far = (s: number): Point => ({
    x: b.apex.x + Math.cos(b.dir + s * h) * b.length,
    y: b.apex.y + Math.sin(b.dir + s * h) * b.length,
  });
  return [
    { x: b.apex.x + n.x * apexHalf, y: b.apex.y + n.y * apexHalf },
    far(1),
    far(-1),
    { x: b.apex.x - n.x * apexHalf, y: b.apex.y - n.y * apexHalf },
  ];
}

export interface Mote {
  x: number;
  y: number;
  r: number;
  o: number;
}

/** Huzme içindeki toz: eksen boyunca uzaklaştıkça söner, kenara yaklaştıkça incelir. */
export function dustMotes(b: Beam, halfAngleDeg: number, count: number, seed: number): Mote[] {
  const rnd = mulberry32(seed);
  const h = (halfAngleDeg * Math.PI) / 180;
  const out: Mote[] = [];
  for (let i = 0; i < count; i += 1) {
    const along = 0.12 + rnd() * 0.8; // tepeye çok yakın değil: orada ışık zaten yanık
    const lateral = (rnd() * 2 - 1) * 0.85; // kamanın içinde
    const a = b.dir + lateral * h;
    const d = along * b.length;
    const falloff = (1 - along) * (1 - Math.abs(lateral) * 0.6);
    out.push({
      x: b.apex.x + Math.cos(a) * d,
      y: b.apex.y + Math.sin(a) * d,
      r: 0.6 + rnd() * 1.4,
      o: Math.min(1, 0.15 + falloff * 0.75 * (0.5 + rnd() * 0.5)),
    });
  }
  return out;
}

// ── Perspektifli film şeridi ──

export interface Ribbon {
  /** Şerit gövdesi (kapalı yol). */
  outline: string;
  /** Işığa bakan kenar çizgisi. */
  rim: string;
  /** Perforasyon delikleri (her biri 4 köşeli çokgen). */
  holes: string[];
  /** Kare pencereleri (boş — veri gelmeden film karesi YOK). */
  windows: string[];
}

/** Perforasyon / pencere oranları — yerel şerit genişliğine göre (35 mm'ye yakın). */
export const RIBBON_RATIO = {
  holeOffset: 0.4, // merkez çizgiden delik merkezine (w × oran)
  holeAlong: 0.08,
  holeAcross: 0.1,
  holePitch: 0.19,
  windowAcross: 0.56,
  windowAlong: 0.74,
  windowPitch: 0.82,
} as const;

interface Sample {
  t: number;
  p: Point;
  s: number; // yay uzunluğu
}

function sampleArc(c: Cubic, n: number): Sample[] {
  const out: Sample[] = [{ t: 0, p: cubicPoint(c, 0), s: 0 }];
  for (let i = 1; i <= n; i += 1) {
    const t = i / n;
    const p = cubicPoint(c, t);
    const prev = out[i - 1];
    out.push({ t, p, s: prev.s + Math.hypot(p.x - prev.p.x, p.y - prev.p.y) });
  }
  return out;
}

function tAtLength(samples: Sample[], s: number): number {
  for (let i = 1; i < samples.length; i += 1) {
    if (samples[i].s >= s) {
      const a = samples[i - 1];
      const b = samples[i];
      const k = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s);
      return a.t + (b.t - a.t) * k;
    }
  }
  return 1;
}

/** Eğri üzerinde, teğete hizalı dikdörtgen (merkez + normal ofset). */
export function quadOnCurve(center: Point, tan: Point, along: number, across: number): Point[] {
  const n = { x: -tan.y, y: tan.x };
  const a = along / 2;
  const c = across / 2;
  return [
    { x: center.x + tan.x * a + n.x * c, y: center.y + tan.y * a + n.y * c },
    { x: center.x + tan.x * a - n.x * c, y: center.y + tan.y * a - n.y * c },
    { x: center.x - tan.x * a - n.x * c, y: center.y - tan.y * a - n.y * c },
    { x: center.x - tan.x * a + n.x * c, y: center.y - tan.y * a + n.y * c },
  ];
}

/**
 * Genişliği uçtan uca `w0 → w1` değişen şerit: genişleyen uç izleyiciye yakın okunur (perspektif).
 * Delik ve pencere aralığı yerel genişlikle ölçeklenir → uzak uçta sıklaşır.
 */
export function ribbon(c: Cubic, w0: number, w1: number, samples = 64): Ribbon {
  const width = (t: number): number => w0 + (w1 - w0) * t;
  const left: Point[] = [];
  const right: Point[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const p = cubicPoint(c, t);
    const tan = cubicTangent(c, t);
    const n = { x: -tan.y, y: tan.x };
    const h = width(t) / 2;
    left.push({ x: p.x + n.x * h, y: p.y + n.y * h });
    right.push({ x: p.x - n.x * h, y: p.y - n.y * h });
  }
  const f = (p: Point): string => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  const outline = `M ${left.map(f).join(' L ')} L ${[...right].reverse().map(f).join(' L ')} Z`;
  // Normal (-ty, tx): soldan sağa giden eğride (y aşağı) `right` dizisi ÜST kenardır → ışık kenarı.
  const rim = `M ${right.map(f).join(' L ')}`;

  const arc = sampleArc(c, 240);
  const total = arc[arc.length - 1].s;
  const R = RIBBON_RATIO;

  const holes: string[] = [];
  for (let s = 0; s < total; ) {
    const t = tAtLength(arc, s);
    const w = width(t);
    const p = cubicPoint(c, t);
    const tan = cubicTangent(c, t);
    const n = { x: -tan.y, y: tan.x };
    for (const side of [1, -1]) {
      const center = { x: p.x + n.x * w * R.holeOffset * side, y: p.y + n.y * w * R.holeOffset * side };
      holes.push(toPoints(quadOnCurve(center, tan, w * R.holeAlong, w * R.holeAcross)));
    }
    s += Math.max(1, w * R.holePitch);
  }

  const windows: string[] = [];
  for (let s = width(0) * R.windowPitch * 0.5; s < total; ) {
    const t = tAtLength(arc, s);
    const w = width(t);
    windows.push(toPoints(quadOnCurve(cubicPoint(c, t), cubicTangent(c, t), w * R.windowAlong, w * R.windowAcross)));
    s += Math.max(1, w * R.windowPitch);
  }

  return { outline, rim, holes, windows };
}

// ── Sahne kompozisyonu ──

export interface GridFrame {
  x: number;
  y: number;
  w: number;
  posterH: number;
  tileH: number;
}

export interface SceneLayout {
  beam: Beam;
  /** Huzme katmanları: içten dışa (yarı açı derece, tepe yarı genişliği, opaklık). */
  beamLayers: { half: number; apexHalf: number; opacity: number }[];
  motes: Mote[];
  /** Izgara merkezi + ortam ışığı yarıçapları. */
  glow: { cx: number; cy: number; rx: number; ry: number };
  ribbons: { shape: Ribbon; nearAtEnd: boolean }[];
}

/** Huzme katmanları — üst üste binince merkez parlar, kenar yumuşar (bulanıklık filtresi yok). */
export const BEAM_LAYERS = [
  { half: 5, apexHalf: 3, opacity: 0.1 },
  { half: 10, apexHalf: 6, opacity: 0.07 },
  { half: 16, apexHalf: 10, opacity: 0.05 },
  { half: 24, apexHalf: 14, opacity: 0.035 },
] as const;

const DUST_COUNT = 42;
const DUST_SEED = 7112026;

/**
 * Bekleme ve final sahnesinin ortak ışık kompozisyonu. Huzme sol alttan (ekran dışı kaynak)
 * ızgaranın sağ üstüne doğru açılır; iki şerit üst ve alt sırayı yay gibi sarar.
 * `withStrips: false` → final sahnesi (şerit söner, ışık kalır).
 */
export function sceneLayout(sceneW: number, sceneH: number, frames: GridFrame[], withStrips: boolean): SceneLayout | null {
  if (frames.length !== 4 || sceneW <= 0 || sceneH <= 0) return null;
  const gridTop = frames[0].y;
  const gridBottom = frames[3].y + frames[3].tileH;
  const gridLeft = frames[0].x;
  const gridRight = frames[1].x + frames[1].w;
  const gridH = gridBottom - gridTop;
  const cx = (gridLeft + gridRight) / 2;
  const cy = (gridTop + gridBottom) / 2;

  const apex = { x: -0.08 * sceneW, y: cy + gridH * 0.32 };
  const beam = beamTowards(apex, { x: gridRight, y: gridTop + gridH * 0.1 }, Math.hypot(sceneW, gridH) * 1.15);

  const ribbons: SceneLayout['ribbons'] = [];
  if (withStrips) {
    const unit = frames[0].w; // şerit kalınlığı hücreye bağlı: hücre büyürse şerit de büyür
    const upper: Cubic = {
      p0: { x: -0.12 * sceneW, y: gridTop + gridH * 0.06 },
      p1: { x: 0.3 * sceneW, y: gridTop - gridH * 0.2 },
      p2: { x: 0.68 * sceneW, y: gridTop + gridH * 0.14 },
      p3: { x: 1.12 * sceneW, y: gridTop - gridH * 0.12 },
    };
    const lower: Cubic = {
      p0: { x: -0.12 * sceneW, y: gridBottom - gridH * 0.04 },
      p1: { x: 0.34 * sceneW, y: gridBottom + gridH * 0.16 },
      p2: { x: 0.7 * sceneW, y: gridBottom - gridH * 0.1 },
      p3: { x: 1.12 * sceneW, y: gridBottom + gridH * 0.08 },
    };
    ribbons.push({ shape: ribbon(upper, unit * 0.16, unit * 0.32), nearAtEnd: true });
    ribbons.push({ shape: ribbon(lower, unit * 0.3, unit * 0.14), nearAtEnd: false });
  }

  return {
    beam,
    beamLayers: BEAM_LAYERS.map((l) => ({ ...l })),
    motes: dustMotes(beam, BEAM_LAYERS[2].half, DUST_COUNT, DUST_SEED),
    glow: { cx, cy, rx: sceneW * 0.75, ry: gridH * 0.6 },
    ribbons,
  };
}
