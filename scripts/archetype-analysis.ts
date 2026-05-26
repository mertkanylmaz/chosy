/**
 * BUG-008 Analysis: Brute-force all 3,072 calibration combinations
 * to check if all 12 archetypes are reachable.
 *
 * Run: npx ts-node scripts/archetype-analysis.ts
 */

// ── Inline types & logic (avoid import issues) ──────────────────────────────

interface EmotionalState {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
  anticipation: number;
  trust: number;
}

interface TasteProfile {
  emotional_state: EmotionalState;
  energy_level: number;
  pace_preference: 'slow' | 'medium' | 'fast';
  visual_style: string;
  thematic_depth: number;
  ending_preference: string;
  era_preference: { from: number; to: number };
  cultural_context: string[];
  avoid_signals: string[];
  narrative_style: string;
  social_context: string;
  rewatch_tolerance: boolean;
}

// ── Calibration questions effects (from questions.ts) ────────────────────────

interface OptionEffect {
  emotional_state?: Partial<EmotionalState>;
  energy_level?: number;
  pace_preference?: 'slow' | 'medium' | 'fast';
  visual_style?: string;
  thematic_depth?: number;
  ending_preference?: string;
  narrative_style?: string;
  social_context?: string;
}

const Q_OPTIONS: OptionEffect[][] = [
  // Q1 (4 options)
  [
    { energy_level: 0.9, emotional_state: { fear: 0.6, anticipation: 0.7 } },
    { thematic_depth: 0.85, emotional_state: { surprise: 0.7, anticipation: 0.6 } },
    { thematic_depth: 0.7, emotional_state: { sadness: 0.8, trust: 0.5 } },
    { energy_level: 0.6, emotional_state: { joy: 0.9 } },
  ],
  // Q2 (4 options)
  [
    { visual_style: 'lush' },
    { visual_style: 'raw' },
    { visual_style: 'experimental' },
    { visual_style: 'cinematic' },
  ],
  // Q3 (3 options)
  [
    { pace_preference: 'fast', energy_level: 0.3 },
    { pace_preference: 'medium' },
    { pace_preference: 'slow', energy_level: -0.2 },
  ],
  // Q4 (4 options)
  [
    { ending_preference: 'hopeful' },
    { ending_preference: 'bittersweet' },
    { ending_preference: 'open' },
    { ending_preference: 'triumphant' },
  ],
  // Q5 (4 options)
  [
    { social_context: 'alone' },
    { social_context: 'couple' },
    { social_context: 'friends' },
    { social_context: 'family' },
  ],
  // Q6 (4 options)
  [
    { narrative_style: 'dialogue-driven', thematic_depth: 0.2 },
    { narrative_style: 'nonlinear', thematic_depth: 0.3 },
    { narrative_style: 'linear' },
    { narrative_style: 'anthology' },
  ],
];

function buildProfile(choices: number[]): TasteProfile {
  const profile: TasteProfile = {
    emotional_state: {
      joy: 0.3, sadness: 0.3, anger: 0.2, fear: 0.2,
      surprise: 0.3, disgust: 0.1, anticipation: 0.3, trust: 0.3,
    },
    energy_level: 0.5,
    pace_preference: 'medium',
    visual_style: 'cinematic',
    thematic_depth: 0.5,
    ending_preference: 'hopeful',
    era_preference: { from: 1990, to: 2026 },
    cultural_context: [],
    avoid_signals: [],
    narrative_style: 'linear',
    social_context: 'alone',
    rewatch_tolerance: true,
  };

  for (let q = 0; q < 6; q++) {
    const effect = Q_OPTIONS[q][choices[q]];

    if (effect.pace_preference !== undefined) profile.pace_preference = effect.pace_preference;
    if (effect.visual_style !== undefined) profile.visual_style = effect.visual_style;
    if (effect.ending_preference !== undefined) profile.ending_preference = effect.ending_preference;
    if (effect.narrative_style !== undefined) profile.narrative_style = effect.narrative_style;
    if (effect.social_context !== undefined) profile.social_context = effect.social_context;

    if (effect.energy_level !== undefined) {
      profile.energy_level = Math.max(0, Math.min(1, profile.energy_level + effect.energy_level));
    }
    if (effect.thematic_depth !== undefined) {
      const isQ6 = q === 5; // 0-indexed Q6
      if (isQ6) {
        profile.thematic_depth = Math.max(0, Math.min(1, profile.thematic_depth + effect.thematic_depth));
      } else {
        profile.thematic_depth = Math.max(0, Math.min(1, effect.thematic_depth));
      }
    }

    if (effect.emotional_state) {
      for (const [key, val] of Object.entries(effect.emotional_state)) {
        if (val !== undefined) {
          (profile.emotional_state as unknown as Record<string, number>)[key] = Math.max(0, Math.min(1, val));
        }
      }
    }
  }

  return profile;
}

// ── Archetype scoring (from archetypeEngine.ts) ──────────────────────────────

interface WF { w: number; v: number; }

function ws(features: WF[]): number {
  let sumWV = 0, sumW = 0;
  for (const { w, v } of features) { sumWV += w * Math.max(0, Math.min(1, v)); sumW += w; }
  return sumW > 0 ? sumWV / sumW : 0;
}

function paceScore(pace: string, target: string): number {
  if (pace === target) return 1;
  const order = ['slow', 'medium', 'fast'];
  return Math.abs(order.indexOf(pace) - order.indexOf(target)) === 1 ? 0.45 : 0;
}

function visualMatch(style: string, ...targets: string[]): number { return targets.includes(style) ? 1 : 0; }
function endingMatch(e: string, ...targets: string[]): number { return targets.includes(e) ? 1 : 0; }
function socialMatch(c: string, ...targets: string[]): number { return targets.includes(c) ? 1 : 0; }
function narrativeMatch(n: string, ...targets: string[]): number { return targets.includes(n) ? 1 : 0; }

const MIN_SCORE_THRESHOLD = 0.35;

const SCORERS: Array<(p: TasteProfile) => number> = [
  // 1 — Adrenaline Junkie
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.0, v: p.energy_level }, { w: 2.5, v: paceScore(p.pace_preference, 'fast') },
    { w: 2.0, v: e.fear }, { w: 1.5, v: e.anger }, { w: 1.5, v: e.anticipation },
    { w: 1.0, v: visualMatch(p.visual_style, 'raw', 'cinematic') },
  ]); },
  // 2 — Mind-Bender
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.0, v: p.thematic_depth }, { w: 2.5, v: e.surprise }, { w: 2.0, v: e.anticipation },
    { w: 2.0, v: narrativeMatch(p.narrative_style, 'nonlinear', 'anthology') },
    { w: 1.5, v: visualMatch(p.visual_style, 'experimental') },
    { w: 1.0, v: socialMatch(p.social_context, 'alone') },
  ]); },
  // 3 — Melancholy Soul
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.5, v: e.sadness }, { w: 2.5, v: p.thematic_depth },
    { w: 2.0, v: paceScore(p.pace_preference, 'slow') },
    { w: 2.0, v: endingMatch(p.ending_preference, 'bittersweet', 'tragic') },
    { w: 1.0, v: 1 - e.joy },
  ]); },
  // 4 — Joy Seeker
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.5, v: e.joy }, { w: 2.5, v: endingMatch(p.ending_preference, 'hopeful', 'triumphant') },
    { w: 2.0, v: 1 - p.thematic_depth },
    { w: 1.5, v: paceScore(p.pace_preference, 'fast') + paceScore(p.pace_preference, 'medium') * 0.7 },
    { w: 1.5, v: socialMatch(p.social_context, 'friends', 'family') },
  ]); },
  // 5 — Hopeless Romantic
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.0, v: e.trust }, { w: 2.5, v: e.joy },
    { w: 2.5, v: socialMatch(p.social_context, 'couple') },
    { w: 2.0, v: endingMatch(p.ending_preference, 'hopeful', 'bittersweet') },
    { w: 1.0, v: e.sadness > 0.4 ? e.sadness : 0 },
  ]); },
  // 6 — Dark Passenger
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.0, v: e.fear }, { w: 2.5, v: e.disgust },
    { w: 2.0, v: endingMatch(p.ending_preference, 'tragic', 'open') },
    { w: 1.5, v: socialMatch(p.social_context, 'alone') },
    { w: 1.5, v: visualMatch(p.visual_style, 'raw', 'experimental') },
    { w: 0.5, v: 1 - e.joy },
  ]); },
  // 7 — Visual Poet
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.5, v: visualMatch(p.visual_style, 'lush', 'cinematic') },
    { w: 2.5, v: p.thematic_depth }, { w: 2.0, v: paceScore(p.pace_preference, 'slow') },
    { w: 1.5, v: (e.joy + e.surprise) / 2 }, { w: 0.5, v: socialMatch(p.social_context, 'alone') },
  ]); },
  // 8 — Nostalgia Keeper
  (p) => {
    const e = p.emotional_state;
    const era = p.era_preference;
    const eraV = era.from < 1970 ? 1.0 : era.from < 1990 ? 0.8 : era.to < 2000 ? 0.6 : era.to < 2010 ? 0.35 : 0;
    return ws([
      { w: 3.0, v: eraV }, { w: 2.5, v: p.rewatch_tolerance ? 1 : 0 },
      { w: 2.0, v: e.trust }, { w: 1.5, v: endingMatch(p.ending_preference, 'hopeful', 'triumphant') },
      { w: 1.0, v: narrativeMatch(p.narrative_style, 'linear') },
    ]);
  },
  // 9 — Chaos Agent
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.0, v: e.anger }, { w: 2.5, v: e.surprise }, { w: 2.0, v: e.disgust },
    { w: 1.5, v: paceScore(p.pace_preference, 'fast') },
    { w: 1.5, v: visualMatch(p.visual_style, 'raw', 'experimental') },
    { w: 0.5, v: endingMatch(p.ending_preference, 'open', 'tragic') },
  ]); },
  // 10 — Zen Wanderer
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.0, v: 1 - p.energy_level }, { w: 2.5, v: paceScore(p.pace_preference, 'slow') },
    { w: 2.0, v: e.trust }, { w: 2.0, v: socialMatch(p.social_context, 'alone') },
    { w: 1.5, v: (1 - e.fear + 1 - e.anger) / 2 },
  ]); },
  // 11 — Truth Seeker
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.5, v: p.thematic_depth }, { w: 2.5, v: visualMatch(p.visual_style, 'raw', 'minimalist') },
    { w: 2.0, v: narrativeMatch(p.narrative_style, 'dialogue-driven') },
    { w: 1.5, v: 1 - e.joy }, { w: 1.5, v: (e.disgust + e.anger) / 2 },
  ]); },
  // 12 — Escapist
  (p) => { const e = p.emotional_state; return ws([
    { w: 3.0, v: e.anticipation }, { w: 2.5, v: e.joy }, { w: 2.0, v: p.energy_level },
    { w: 2.0, v: visualMatch(p.visual_style, 'lush', 'cinematic') },
    { w: 1.5, v: endingMatch(p.ending_preference, 'hopeful', 'triumphant') },
    { w: 0.5, v: p.rewatch_tolerance ? 1 : 0 },
  ]); },
];

const ARCHETYPE_NAMES: Record<number, string> = {
  1: 'Adrenaline Junkie',
  2: 'Mind-Bender',
  3: 'Melancholy Soul',
  4: 'Joy Seeker',
  5: 'Hopeless Romantic',
  6: 'Dark Passenger',
  7: 'Visual Poet',
  8: 'Nostalgia Keeper',
  9: 'Chaos Agent',
  10: 'Zen Wanderer',
  11: 'Truth Seeker',
  12: 'Escapist',
};

const Q_LABELS = [
  ['intensity', 'cerebral', 'emotional', 'bright'],
  ['lush/visual_art', 'raw/old_footage', 'experimental/galactic', 'cinematic'],
  ['fast/scifi', 'medium/masks', 'slow/escape'],
  ['hopeful/daydream', 'bittersweet/sadness', 'open/curious', 'triumphant/achievement'],
  ['alone/soundtrack', 'couple/relationships', 'friends/casual', 'family/cozy'],
  ['dialogue-driven/social', 'nonlinear/randomize', 'linear/continue', 'anthology/backstory'],
];

// ── Brute-force ──────────────────────────────────────────────────────────────

const counts: Record<number, number> = {};
const nullCount = { count: 0 };
const exampleCombos: Record<number, { choices: number[]; score: number; allScores: { id: number; score: number }[] }> = {};

// Track max score per archetype
const maxScores: Record<number, { score: number; choices: number[] }> = {};
for (let i = 1; i <= 12; i++) { maxScores[i] = { score: 0, choices: [] }; counts[i] = 0; }

let total = 0;

for (let q1 = 0; q1 < 4; q1++) {
  for (let q2 = 0; q2 < 4; q2++) {
    for (let q3 = 0; q3 < 3; q3++) {
      for (let q4 = 0; q4 < 4; q4++) {
        for (let q5 = 0; q5 < 4; q5++) {
          for (let q6 = 0; q6 < 4; q6++) {
            total++;
            const choices = [q1, q2, q3, q4, q5, q6];
            const profile = buildProfile(choices);

            let bestId = -1;
            let bestScore = -1;
            const allScores: { id: number; score: number }[] = [];

            SCORERS.forEach((scorer, idx) => {
              const s = scorer(profile);
              allScores.push({ id: idx + 1, score: s });
              if (s > bestScore) { bestScore = s; bestId = idx + 1; }
            });

            allScores.sort((a, b) => b.score - a.score);

            if (bestScore < MIN_SCORE_THRESHOLD) {
              nullCount.count++;
            } else {
              counts[bestId]++;
              if (!exampleCombos[bestId]) {
                exampleCombos[bestId] = { choices, score: bestScore, allScores };
              }
            }

            // Track max score per archetype regardless of winner
            for (const { id, score } of allScores) {
              if (score > maxScores[id].score) {
                maxScores[id] = { score, choices: [...choices] };
              }
            }
          }
        }
      }
    }
  }
}

// ── Report ───────────────────────────────────────────────────────────────────

console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║  BUG-008: Archetype Assignment Analysis — 3,072 combos     ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');

console.log(`Total combinations: ${total}`);
console.log(`Null results (below threshold ${MIN_SCORE_THRESHOLD}): ${nullCount.count}\n`);

console.log('── Winner Distribution ──────────────────────────────────────');
for (let i = 1; i <= 12; i++) {
  const pct = ((counts[i] / total) * 100).toFixed(1);
  const bar = '█'.repeat(Math.round(counts[i] / total * 50));
  const status = counts[i] === 0 ? ' ❌ NEVER ASSIGNED' : '';
  console.log(`  #${i.toString().padStart(2)} ${ARCHETYPE_NAMES[i].padEnd(20)} ${counts[i].toString().padStart(5)} (${pct.padStart(5)}%)  ${bar}${status}`);
}

console.log('\n── Max Achievable Score per Archetype ───────────────────────');
for (let i = 1; i <= 12; i++) {
  const m = maxScores[i];
  const labels = m.choices.map((c, qi) => Q_LABELS[qi][c]);
  const reachable = counts[i] > 0 ? '✅' : '❌';
  console.log(`  ${reachable} #${i.toString().padStart(2)} ${ARCHETYPE_NAMES[i].padEnd(20)} max=${m.score.toFixed(4)}  combo=[${labels.join(', ')}]`);
}

console.log('\n── Example Winning Combos ───────────────────────────────────');
for (let i = 1; i <= 12; i++) {
  const ex = exampleCombos[i];
  if (!ex) {
    console.log(`  #${i.toString().padStart(2)} ${ARCHETYPE_NAMES[i].padEnd(20)} — NO WINNING COMBINATION`);
    continue;
  }
  const labels = ex.choices.map((c, qi) => Q_LABELS[qi][c]);
  console.log(`  #${i.toString().padStart(2)} ${ARCHETYPE_NAMES[i].padEnd(20)} score=${ex.score.toFixed(4)}  [${labels.join(', ')}]`);
  console.log(`       Top 3: ${ex.allScores.slice(0, 3).map(s => `#${s.id}=${s.score.toFixed(3)}`).join(', ')}`);
}

// ── Bias Analysis ────────────────────────────────────────────────────────────

console.log('\n── Structural Bias Analysis ─────────────────────────────────');
console.log('  Features NEVER modified by calibration questions:');
console.log('    • anger      — always 0.2 (default) → hurts #9 Chaos Agent (w=3.0)');
console.log('    • disgust    — always 0.1 (default) → hurts #6 Dark Passenger (w=2.5), #9 (w=2.0), #11 Truth Seeker (w=1.5)');
console.log('    • era_pref   — always {1990,2026}  → hurts #8 Nostalgia Keeper (eraV=0, w=3.0)');
console.log('    • rewatch    — always true          → benefits #8 (w=2.5) but not enough to offset era=0');
console.log('    • visual "minimalist" — never an option → hurts #10 Zen Wanderer, #11 Truth Seeker');
console.log('    • ending "tragic"     — never an option → hurts #3 Melancholy Soul, #6 Dark Passenger');
