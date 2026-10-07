/**
 * Hak noktaları — saf hesap (React Native'den bağımsız, test edilebilir).
 *
 * Nokta sayısı = sunucudaki `puzzle.max_attempts`. `true` = kalan hak (dolu),
 * `false` = harcanmış (içi boş). Noktalar yalnız azalır: `left` ancak düşer.
 */
export function chanceStates(max: number, left: number): boolean[] {
  const total = Math.max(0, Math.floor(max));
  const remaining = Math.min(total, Math.max(0, Math.floor(left)));
  return Array.from({ length: total }, (_, i) => i < remaining);
}
