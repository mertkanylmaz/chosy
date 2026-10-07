/**
 * Spotlight "ilerleyen odak" — saf hesap (React/RN import YOK, test edilebilir).
 *
 * Görsel netliği = İLERLEME. Girdi açılan POZİSYON sayısı (harf türü değil);
 * sunucunun `letter_count`'u yalnız slot sayar (rakam/noktalama hariç), bu yüzden
 * tüm slotlar açılınca oran tam 1'e ulaşır ve görsel net olur.
 */

/**
 * Açılan pozisyon oranına göre bulanıklık: hiçbiri açık değilken `maxBlur`,
 * hepsi açıkken 0. Doğrusal, monoton, [0, maxBlur] aralığına kenetli.
 *
 * Tam sayıya yuvarlanır — bitişik pozisyonlar aynı düzeye düşebilir; düzey
 * değişmezse görsel geçişi de tetiklenmez (SpotlightFocusStill).
 */
export function blurForProgress(
  openedPositions: number,
  totalPositions: number,
  maxBlur: number,
): number {
  if (!Number.isFinite(totalPositions) || totalPositions <= 0) return 0;
  if (!Number.isFinite(maxBlur) || maxBlur <= 0) return 0;
  const opened = Number.isFinite(openedPositions) ? openedPositions : 0;
  const progress = Math.min(1, Math.max(0, opened / totalPositions));
  return Math.round(maxBlur * (1 - progress));
}
