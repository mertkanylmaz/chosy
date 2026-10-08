/**
 * Spotlight sonuç ekranı "NEXT PUZZLE" sayacı — saf.
 *
 * Hedef SUNUCUNUN söylediği bir sonraki cycle geçişidir (`next_cycle_at`,
 * F2); istemci 18:00'i kendisi hesaplamaz. Bulmaca anahtarı da cycle tarihine
 * bağlı olduğundan (F2/C4) sayaç ve yeni bulmaca aynı anda döner. Biçim
 * `countdownParts` + `formatCountdown` (hooks/countdownCore.ts).
 *
 * `nextCycleAt` yoksa ya da okunamıyorsa `null` — uydurma bir süre gösterilmez.
 *
 * React Native'den bağımsız — `tests/games/nextPuzzleClock.test.ts`.
 */

import { countdownParts, formatCountdown } from '../../../hooks/countdownCore';

/** `now`'dan `nextCycleAt`'e kalan süre, "SS:DD:ss". */
export function nextPuzzleCountdown(now: Date, nextCycleAt: string | undefined): string | null {
  if (!nextCycleAt) return null;
  const boundary = Date.parse(nextCycleAt);
  if (Number.isNaN(boundary)) return null;
  const remainingMs = Math.max(0, boundary - now.getTime());
  return formatCountdown(countdownParts(remainingMs), true);
}
