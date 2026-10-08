/**
 * Spotlight kartının görünürlük ölçüsü — F2.3 `spotlight_card_visible`.
 * Saf modül: React/RN import YOK, Deno okur.
 *
 * Görünür alan = kaydırma görünümü eksi alttan örten pay (tab bar). Kart
 * koordinatları kaydırma İÇERİĞİNE göredir.
 */

/** Kartın görünür sayılması için gereken pay. */
export const VISIBLE_FRACTION_MIN = 0.5;

/** Görünürlüğün kesintisiz sürmesi gereken süre (ms). */
export const VISIBLE_DWELL_MS = 1000;

export interface VisibilityMetrics {
  cardY: number;
  cardHeight: number;
  scrollY: number;
  viewportHeight: number;
  bottomInset: number;
}

/** Kartın görünür payı, 0–1. Ölçü eksikse (yükseklik 0) 0. */
export function cardVisibleFraction(m: VisibilityMetrics): number {
  if (m.cardHeight <= 0 || m.viewportHeight <= 0) return 0;
  const top = Math.max(m.cardY, m.scrollY);
  const bottom = Math.min(
    m.cardY + m.cardHeight,
    m.scrollY + m.viewportHeight - m.bottomInset,
  );
  return Math.max(0, bottom - top) / m.cardHeight;
}

export function isCardVisible(m: VisibilityMetrics): boolean {
  return cardVisibleFraction(m) >= VISIBLE_FRACTION_MIN;
}
