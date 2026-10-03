/**
 * Spotlight bonus kartının durumu — S-2. Saf modül (Deno testli:
 * `tests/gauntlet/championFold.test.ts`).
 *
 * Tek kaynak `get-daily-challenge` ilerlemesidir (`game_scores`, sunucu);
 * istemci deneme SAYMAZ. Kart deneme sayısı göstermez (CTO kararı, 3 Eki
 * 2026) — `game_scores.attempts` response'ta yok, S-3 adayı.
 *
 *   progress yok              → not_started  ("Play")
 *   completed = false         → in_progress  ("Continue")
 *   completed && won          → solved       (özet, yeniden oynatma yok)
 *   completed && !won         → failed       (özet, yeniden oynatma yok)
 */

export type SpotlightCardState = 'not_started' | 'in_progress' | 'solved' | 'failed';

export function spotlightCardStateFrom(
  progress: { completed: boolean; won: boolean } | null | undefined,
): SpotlightCardState {
  if (!progress) return 'not_started';
  if (!progress.completed) return 'in_progress';
  return progress.won ? 'solved' : 'failed';
}

/** Kartta eylem fiili gösterilen durumlar — bitmiş oyun yeniden oynatılmaz (K-22). */
export function isSpotlightPlayable(state: SpotlightCardState): boolean {
  return state === 'not_started' || state === 'in_progress';
}
