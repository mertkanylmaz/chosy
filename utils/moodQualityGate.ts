/**
 * Mood destesi kalite süzgeci (saf fonksiyon — `recommendations.ts` kullanır).
 *
 * Taban, adayların GERÇEK en yüksek benzerliğinin %55'idir. Eskiden `data[0]`
 * alınıyordu: LLM rerank düşük benzerlikli bir filmi başa koyunca taban aşağı
 * kayıyor, süzgeç gevşiyordu. Sıra korunur; süzgeç yalnız eler ve 8'e keser.
 */

export const FINAL_CAP = 8
export const RELATIVE_QUALITY_FLOOR = 0.55

export interface QualityGateResult<T> {
  rows: T[]
  bestScore: number
  qualityFloor: number
}

export function applyQualityGate<T extends { similarity: number }>(
  rows: readonly T[],
): QualityGateResult<T> {
  if (rows.length === 0) return { rows: [], bestScore: 0, qualityFloor: 0 }

  let bestScore = 0
  for (const row of rows) {
    if (row.similarity > bestScore) bestScore = row.similarity
  }
  const qualityFloor = bestScore * RELATIVE_QUALITY_FLOOR

  return {
    rows: rows.filter((row) => row.similarity >= qualityFloor).slice(0, FINAL_CAP),
    bestScore,
    qualityFloor,
  }
}
