/**
 * Mood Gauntlet turnuva durumu — saf mantık (RN/Supabase yok).
 *
 * Dörtlü [a, b, c, d]: Tur 1 a↔b, Tur 2 c↔d, Tur 3 (final) kazanan1↔kazanan2.
 * "Hiçbiri" turu HARCAMAZ: çağıran yeni dörtlü ister, mevcut akış atılır.
 * Günlük gauntlet'in tiplerine (types/gauntlet.ts) dokunmaz; kendi küçük tipi vardır.
 */

export type MoodRound = 1 | 2 | 3;

export interface MoodFlow {
  four: readonly [string, string, string, string];
  /** Tamamlanan turların kazananları (Tur 1, Tur 2). */
  winners: readonly string[];
  /** Tamamlanan tur sayısı (0..3). 3 = şampiyon belli. */
  completed: 0 | 1 | 2 | 3;
  champion: string | null;
}

export interface MoodPair {
  round: MoodRound;
  a: string;
  b: string;
}

export function initFlow(four: readonly string[]): MoodFlow {
  if (four.length !== 4 || new Set(four).size !== 4) {
    throw new Error(`initFlow: 4 benzersiz film gerekli (gelen ${four.length})`);
  }
  return {
    four: [four[0], four[1], four[2], four[3]],
    winners: [],
    completed: 0,
    champion: null,
  };
}

/** Sıradaki eşleşme; akış bitmişse null. */
export function currentPair(flow: MoodFlow): MoodPair | null {
  switch (flow.completed) {
    case 0:
      return { round: 1, a: flow.four[0], b: flow.four[1] };
    case 1:
      return { round: 2, a: flow.four[2], b: flow.four[3] };
    case 2:
      return { round: 3, a: flow.winners[0], b: flow.winners[1] };
    default:
      return null;
  }
}

/** Mevcut eşleşmede `winnerId` seçilir. Eşleşmede olmayan film → hata (sessiz geçiş yok). */
export function choose(flow: MoodFlow, winnerId: string): MoodFlow {
  const pair = currentPair(flow);
  if (!pair) throw new Error('choose: akış zaten tamamlandı');
  if (winnerId !== pair.a && winnerId !== pair.b) {
    throw new Error(`choose: ${winnerId} mevcut eşleşmede değil`);
  }
  const winners = [...flow.winners, winnerId];
  if (pair.round === 3) {
    return { ...flow, winners, completed: 3, champion: winnerId };
  }
  return { ...flow, winners, completed: pair.round };
}

export function isComplete(flow: MoodFlow): boolean {
  return flow.completed === 3 && flow.champion !== null;
}

/** Hız göstergesi: ilk dörtlü görünene kadar geçen süre, tur başına vb. için ms farkı (negatif olmaz). */
export function elapsedMs(startMs: number, nowMs: number): number {
  return Math.max(0, Math.round(nowMs - startMs));
}
