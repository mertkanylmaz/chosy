/**
 * Spotlight sonuç ekranı "NEXT PUZZLE" sayacı — saf (P-4a, 4 Eki 2026).
 *
 * Hedef bir sonraki YEREL 18:00 — ritüelin kapısı. Saat kuralı burada
 * yazılmaz: hedef `nextUnlockAfter` (GauntletShell/unlockClock.ts), biçim
 * `countdownParts` + `formatCountdown` (hooks/countdownCore.ts). Bu dosya
 * yalnız ikisini birleştirir.
 *
 * Bilinen tutarsızlık (TEKNIK_BORC): bulmaca anahtarı hâlâ yerel takvim
 * günü (`Spotlight/index.tsx` `puzzleDate`) — 00:00'da yeni bulmaca açılır,
 * sayaç ise 18:00'e sayar. M2 Faz 2b ile anahtar da 18:00'e çekilecek.
 *
 * React Native'den bağımsız — `tests/games/nextPuzzleClock.test.ts`.
 */

import { countdownParts, formatCountdown } from '../../../hooks/countdownCore';
import { nextUnlockAfter } from '../../gauntlet/GauntletShell/unlockClock';

/** `now`'dan sonraki yerel 18:00'e kalan süre, "SS:DD:ss". */
export function nextPuzzleCountdown(now: Date): string {
  const remainingMs = nextUnlockAfter(now).getTime() - now.getTime();
  return formatCountdown(countdownParts(remainingMs), true);
}
