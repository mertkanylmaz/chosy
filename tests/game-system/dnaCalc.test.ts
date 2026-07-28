/**
 * Unit tests for dnaCalc.ts — Cinema DNA pure calculations.
 *
 * Run: deno test tests/game-system/dnaCalc.test.ts --allow-read --allow-env
 */

import { assertEquals } from 'https://deno.land/std@0.208.0/assert/mod.ts'

import {
  applyEWMA,
  calcCinemaScore,
  calcRank,
  pickIdentityTitle,
  type DimValues,
  type Weights,
} from '../../supabase/functions/_shared/dnaCalc.ts'

// ─── Default weights from config seed ────────────────────────────────────────

const WEIGHTS: Weights = {
  knowledge: 0.30,
  deduction: 0.20,
  auteur: 0.15,
  instinct: 0.15,
  consistency: 0.20,
}

const THRESHOLDS = [0, 20, 35, 50, 65, 80]
const MIN_DAILIES = [0, 5, 15, 30, 60, 100]

// ─── EWMA ────────────────────────────────────────────────────────────────────

Deno.test('applyEWMA: alpha=0.15, old=50, signal=1.0 → 57.5', () => {
  const result = applyEWMA(50, 1.0, 0.15)
  assertEquals(result, 57.5)
})

Deno.test('applyEWMA: new user (old=0), signal=0.8 → 12', () => {
  const result = applyEWMA(0, 0.8, 0.15)
  assertEquals(result, 12)
})

Deno.test('applyEWMA: signal=0 keeps most of old value', () => {
  const result = applyEWMA(80, 0, 0.15)
  assertEquals(result, 68) // 0.15*0 + 0.85*80 = 68
})

Deno.test('applyEWMA: alpha=1.0 replaces completely', () => {
  const result = applyEWMA(50, 0.6, 1.0)
  assertEquals(result, 60) // 1.0*60 + 0*50 = 60
})

Deno.test('applyEWMA: alpha=0 keeps old value', () => {
  const result = applyEWMA(50, 1.0, 0)
  assertEquals(result, 50) // 0*100 + 1*50 = 50
})

// ─── Cinema Score ────────────────────────────────────────────────────────────

Deno.test('calcCinemaScore: all dims at 80 → score = 80', () => {
  const dims: DimValues = {
    knowledge: 80,
    deduction: 80,
    auteur_sense: 80,
    instinct: 80,
    consistency: 80,
  }
  const score = calcCinemaScore(dims, WEIGHTS)
  assertEquals(score, 80)
})

Deno.test('calcCinemaScore: all dims at 0 → score = 0', () => {
  const dims: DimValues = {
    knowledge: 0,
    deduction: 0,
    auteur_sense: 0,
    instinct: 0,
    consistency: 0,
  }
  assertEquals(calcCinemaScore(dims, WEIGHTS), 0)
})

Deno.test('calcCinemaScore: mixed dims weighted correctly', () => {
  const dims: DimValues = {
    knowledge: 100,
    deduction: 50,
    auteur_sense: 0,
    instinct: 0,
    consistency: 0,
  }
  // 0.30*100 + 0.20*50 + 0.15*0 + 0.15*0 + 0.20*0 = 30 + 10 = 40
  assertEquals(calcCinemaScore(dims, WEIGHTS), 40)
})

Deno.test('calcCinemaScore: clamped to 100 max', () => {
  const dims: DimValues = {
    knowledge: 200,
    deduction: 200,
    auteur_sense: 200,
    instinct: 200,
    consistency: 200,
  }
  assertEquals(calcCinemaScore(dims, WEIGHTS), 100)
})

// ─── Rank ────────────────────────────────────────────────────────────────────

Deno.test('calcRank: score=35, dailies=20 → rank 3 (Apprentice)', () => {
  assertEquals(calcRank(35, 20, THRESHOLDS, MIN_DAILIES), 3)
})

Deno.test('calcRank: score=35, dailies=10 → rank 2 (Explorer, min_dailies[2]=15 not met)', () => {
  assertEquals(calcRank(35, 10, THRESHOLDS, MIN_DAILIES), 2)
})

Deno.test('calcRank: score=80, dailies=100 → rank 6 (Master)', () => {
  assertEquals(calcRank(80, 100, THRESHOLDS, MIN_DAILIES), 6)
})

Deno.test('calcRank: score=0, dailies=0 → rank 1 (base)', () => {
  assertEquals(calcRank(0, 0, THRESHOLDS, MIN_DAILIES), 1)
})

Deno.test('calcRank: score=99, dailies=50 → rank 4 (min_dailies[4]=60 not met)', () => {
  // Tiers met: [0,0]=yes, [20,5]=yes(50>=5), [35,15]=yes, [50,30]=yes, [65,60]=no(50<60)
  assertEquals(calcRank(99, 50, THRESHOLDS, MIN_DAILIES), 4)
})

Deno.test('calcRank: high score but zero dailies → rank 1', () => {
  // Only tier [0,0] is met because dailies=0 fails min_dailies[1]=5
  assertEquals(calcRank(100, 0, THRESHOLDS, MIN_DAILIES), 1)
})

// ─── Identity Title ─────────────────────────────────────────────────────────

Deno.test('pickIdentityTitle: knowledge=90, deduction=70 → Film Detective', () => {
  const dims: DimValues = {
    knowledge: 90,
    deduction: 70,
    auteur_sense: 30,
    instinct: 20,
    consistency: 10,
  }
  assertEquals(pickIdentityTitle(dims), 'The Film Detective / Film Dedektifi')
})

Deno.test('pickIdentityTitle: all equal → consistency wins (alphabetic tie-break)', () => {
  const dims: DimValues = {
    knowledge: 50,
    deduction: 50,
    auteur_sense: 50,
    instinct: 50,
    consistency: 50,
  }
  // Sorted alphabetically: auteur_sense, consistency, deduction, instinct, knowledge
  // Top 2 = auteur_sense + consistency
  assertEquals(pickIdentityTitle(dims), 'The Auteur Devotee / Yönetmen Takipçisi')
})

Deno.test('pickIdentityTitle: single dominant (knowledge=80, rest<20) → fallback Lorekeeper', () => {
  const dims: DimValues = {
    knowledge: 80,
    deduction: 15,
    auteur_sense: 10,
    instinct: 5,
    consistency: 10,
  }
  // knowledge is > 2x deduction (80 > 30), so single-dominant
  assertEquals(pickIdentityTitle(dims), 'The Lorekeeper / Bilgi Bekçisi')
})

Deno.test('pickIdentityTitle: auteur + instinct → Gut Auteurist', () => {
  const dims: DimValues = {
    knowledge: 10,
    deduction: 20,
    auteur_sense: 85,
    instinct: 60,
    consistency: 15,
  }
  assertEquals(pickIdentityTitle(dims), 'The Gut Auteurist / İçgüdüsel Yönetmen')
})

Deno.test('pickIdentityTitle: deduction dominant → Puzzle Master fallback', () => {
  const dims: DimValues = {
    knowledge: 10,
    deduction: 90,
    auteur_sense: 5,
    instinct: 10,
    consistency: 15,
  }
  // deduction=90 > 2*30 (second highest is consistency=15, 90 > 30)
  assertEquals(pickIdentityTitle(dims), 'The Puzzle Master / Bulmaca Ustası')
})

Deno.test('pickIdentityTitle: consistency + knowledge → Devoted Cinephile', () => {
  const dims: DimValues = {
    knowledge: 70,
    deduction: 30,
    auteur_sense: 20,
    instinct: 10,
    consistency: 75,
  }
  assertEquals(pickIdentityTitle(dims), 'The Devoted Cinephile / Adanmış Sinefil')
})

Deno.test('pickIdentityTitle: all zeros → fallback', () => {
  const dims: DimValues = {
    knowledge: 0,
    deduction: 0,
    auteur_sense: 0,
    instinct: 0,
    consistency: 0,
  }
  // top1 val = 0, top2 val = 0 → dims[top1] > 0 is false, so cross-pair
  // alphabetical top 2: auteur_sense + consistency
  assertEquals(pickIdentityTitle(dims), 'The Auteur Devotee / Yönetmen Takipçisi')
})
