/**
 * Mood Gauntlet "Daha hafif / Daha yoğun" (Faz 2-1b) — parse'ı TEKRARLAMAZ; mevcut profilin
 * yoğunluk boyutları kaydırılır ve sorgu vektörü yeniden üretilir. Saf, RN / ağ yok.
 *
 * Kaydırılan boyutlar (12 boyutlu TasteProfile'dan üçü):
 *  - energy_level   (Boyut 2, 0 sakin — 1 enerjik)   → ±INTENSITY_STEP / adım
 *  - thematic_depth (Boyut 5, 0 hafif — 1 derin)      → ±INTENSITY_STEP / adım
 *  - pace_preference (Boyut 3, slow/medium/fast)      → en fazla ±1 basamak (adım ≠ 0 ise)
 * Diğer boyutlar (duygu vektörü, avoid_signals, vb.) ve parse'ın genres_exclude / max_runtime
 * kısıtları DEĞİŞMEZ. Adım HER ZAMAN özgün (parse'tan gelen) profile uygulanır → birikmez, ±MAX.
 */

export const INTENSITY_STEP = 0.2;
export const MAX_INTENSITY_STEPS = 3;

const PACES = ['slow', 'medium', 'fast'] as const;

interface Shiftable {
  energy_level: number;
  thematic_depth: number;
  pace_preference: string;
}

export function isShiftable(p: unknown): p is Shiftable {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.energy_level === 'number' &&
    typeof o.thematic_depth === 'number' &&
    typeof o.pace_preference === 'string'
  );
}

export function clampIntensityStep(n: number): number {
  return Math.max(-MAX_INTENSITY_STEPS, Math.min(MAX_INTENSITY_STEPS, Math.trunc(n)));
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, Math.round(n * 1000) / 1000));

/**
 * Özgün profile `step` adım uygular (negatif = hafif, pozitif = yoğun). Profil beklenen
 * boyutları taşımıyorsa `null` döner — çağıran bunu hata olarak yüzeye çıkarır (sessiz geçiş yok).
 */
export function applyIntensity<P>(base: P, step: number): P | null {
  if (!isShiftable(base)) return null;
  const s = clampIntensityStep(step);
  const idx = PACES.indexOf(base.pace_preference as (typeof PACES)[number]);
  const paceIdx = idx === -1 ? 1 : idx;
  const nextPace = PACES[Math.min(PACES.length - 1, Math.max(0, paceIdx + Math.sign(s)))];
  return {
    ...base,
    energy_level: clamp01(base.energy_level + s * INTENSITY_STEP),
    thematic_depth: clamp01(base.thematic_depth + s * INTENSITY_STEP),
    pace_preference: nextPace,
  } as P;
}
