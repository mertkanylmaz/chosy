/**
 * Pure calculation functions for Cinema DNA.
 * No side effects — testable as a standalone module.
 *
 * Dimensions: knowledge, deduction, auteur_sense, instinct, consistency
 * visual_sense is locked until Phase 3 (weight = 0, never updated).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** The 5 active DNA dimensions (visual_sense excluded). */
export interface DimValues {
  knowledge: number
  deduction: number
  auteur_sense: number
  instinct: number
  consistency: number
}

/** Weight map from dna_config. Keys use short names matching config. */
export interface Weights {
  knowledge: number
  deduction: number
  auteur: number
  instinct: number
  consistency: number
}

// ─── Dimension key used in config vs DB mapping ─────────────────────────────
// Config uses "auteur", DB uses "auteur_sense". This module uses DB names
// internally and maps config keys where needed.

// ─── EWMA ───────────────────────────────────────────────────────────────────

/**
 * Exponentially Weighted Moving Average.
 * Signal values come in 0-1 range, scaled to 0-100 internally.
 *
 * @param oldVal - Current dimension value (0-100 scale)
 * @param signalVal - New signal value (0-1 scale, will be multiplied by 100)
 * @param alpha - Smoothing factor (0-1), typically 0.15
 * @returns Updated dimension value (0-100 scale)
 */
export function applyEWMA(oldVal: number, signalVal: number, alpha: number): number {
  return alpha * (signalVal * 100) + (1 - alpha) * oldVal
}

// ─── Cinema Score ───────────────────────────────────────────────────────────

/**
 * Weighted sum of active dimensions.
 * visual_sense is excluded (Phase 3).
 * Result clamped to [0, 100].
 */
export function calcCinemaScore(dims: DimValues, weights: Weights): number {
  const raw =
    weights.knowledge * dims.knowledge +
    weights.deduction * dims.deduction +
    weights.auteur * dims.auteur_sense +
    weights.instinct * dims.instinct +
    weights.consistency * dims.consistency

  return Math.min(100, Math.max(0, Math.round(raw)))
}

// ─── Rank ───────────────────────────────────────────────────────────────────

/**
 * Determines rank based on cinema_score AND total dailies completed.
 * Both conditions must be met for each tier.
 * Returns 1-indexed rank (1 = lowest).
 */
export function calcRank(
  score: number,
  dailies: number,
  thresholds: number[],
  minDailies: number[],
): number {
  let rank = 1
  for (let i = 0; i < thresholds.length; i++) {
    if (score >= thresholds[i] && dailies >= minDailies[i]) {
      rank = i + 1
    }
  }
  return rank
}

// ─── Identity Title ─────────────────────────────────────────────────────────

/** All 5 active dimension keys, alphabetically ordered for tie-breaking. */
const DIM_KEYS: (keyof DimValues)[] = [
  'auteur_sense',
  'consistency',
  'deduction',
  'instinct',
  'knowledge',
]

/**
 * Title lookup table.
 * Keys are sorted dimension pairs joined with '+'.
 * Includes fallback keys for when both top dims are the same (single-dominant).
 */
const IDENTITY_TITLES: Record<string, string> = {
  // Cross-dimension pairs (sorted alphabetically by first dim)
  'auteur_sense+consistency': 'The Auteur Devotee / Yönetmen Takipçisi',
  'auteur_sense+deduction': 'The Style Hunter / Üslup Avcısı',
  'auteur_sense+instinct': 'The Gut Auteurist / İçgüdüsel Yönetmen',
  'auteur_sense+knowledge': 'The Scholar / Sinema Akademisyeni',
  'consistency+deduction': 'The Patient Solver / Sabırlı Çözücü',
  'consistency+instinct': 'The Daily Duelist / Günlük Düellocu',
  'consistency+knowledge': 'The Devoted Cinephile / Adanmış Sinefil',
  'deduction+instinct': 'The Quick Mind / Çevik Zihin',
  'deduction+knowledge': 'The Film Detective / Film Dedektifi',
  'instinct+knowledge': 'The Encyclopedist / Ansiklopedist',

  // Single-dominant fallbacks
  'auteur_sense+auteur_sense': "The Director's Eye / Yönetmen Gözü",
  'consistency+consistency': 'The Iron Cinephile / Demir Sinefil',
  'deduction+deduction': 'The Puzzle Master / Bulmaca Ustası',
  'instinct+instinct': 'The Film Instinct / Film İçgüdüsü',
  'knowledge+knowledge': 'The Lorekeeper / Bilgi Bekçisi',
}

/**
 * Picks identity title based on top 2 dimensions.
 * Tie-breaking: alphabetical order of dimension keys.
 * If a single dimension dominates (>2x the second), uses the single-dominant fallback.
 *
 * @returns Combined EN + TR title string: "The Film Detective / Film Dedektifi"
 */
export function pickIdentityTitle(dims: DimValues): string {
  // Sort dimensions descending by value, then alphabetically for ties
  const sorted = [...DIM_KEYS].sort((a, b) => {
    const diff = dims[b] - dims[a]
    if (diff !== 0) return diff
    return a.localeCompare(b)
  })

  const top1 = sorted[0]
  const top2 = sorted[1]

  // Single-dominant: top dim is more than 2x the second
  const useKey =
    dims[top1] > 0 && (dims[top2] === 0 || dims[top1] > dims[top2] * 2)
      ? [top1, top1].join('+')
      : [top1, top2].sort().join('+')

  return IDENTITY_TITLES[useKey] ?? 'The Cinephile / Sinefil'
}
