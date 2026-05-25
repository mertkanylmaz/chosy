/**
 * AI Profile Verification — Sanity Checks
 *
 * Checks known films against expected emotional profiles to validate
 * that the AI profiling is producing sensible results.
 *
 * Target: >= 80% pass rate, otherwise prompt needs revision.
 *
 * Usage: npx tsx scripts/verify-ai-profiles.ts
 * Env:   SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmotionalState {
  joy: number;
  sadness: number;
  fear: number;
  anger: number;
  surprise: number;
  trust: number;
  anticipation: number;
  disgust: number;
}

interface StoredProfile {
  emotional_state: EmotionalState;
  energy_level: number;
  thematic_depth: number;
  pace_preference: string;
  visual_style: string;
  ending_preference: string;
  narrative_style: string;
  social_context: string;
  rewatch_tolerance: boolean;
}

interface SanityCheck {
  /** Film title (partial match) */
  title: string;
  /** Expected dominant emotion (highest value in emotional_state) */
  expected_dominant_emotion?: keyof EmotionalState;
  /** Alternative acceptable dominant emotions */
  alt_dominant_emotions?: (keyof EmotionalState)[];
  /** energy_level should be <= this */
  expected_energy_max?: number;
  /** energy_level should be >= this */
  expected_energy_min?: number;
  /** thematic_depth should be >= this */
  expected_thematic_depth_min?: number;
  /** thematic_depth should be <= this */
  expected_thematic_depth_max?: number;
  /** Expected pace */
  expected_pace?: string;
  /** Expected ending */
  expected_ending?: string;
}

interface CheckResult {
  title: string;
  found: boolean;
  passed: boolean;
  details: string[];
}

// ---------------------------------------------------------------------------
// Sanity check definitions
// ---------------------------------------------------------------------------

const SANITY_CHECKS: SanityCheck[] = [
  {
    title: 'The Notebook',
    expected_dominant_emotion: 'sadness',
    alt_dominant_emotions: ['trust'],
    expected_energy_max: 0.5,
  },
  {
    title: 'Manchester by the Sea',
    expected_dominant_emotion: 'sadness',
    expected_energy_max: 0.3,
    expected_thematic_depth_min: 0.7,
  },
  {
    title: 'Mad Max: Fury Road',
    expected_dominant_emotion: 'anticipation',
    alt_dominant_emotions: ['anger', 'fear'],
    expected_energy_min: 0.8,
    expected_pace: 'fast',
  },
  {
    title: 'Eternal Sunshine of the Spotless Mind',
    expected_dominant_emotion: 'sadness',
    alt_dominant_emotions: ['surprise'],
    expected_thematic_depth_min: 0.7,
  },
  {
    title: 'The Shawshank Redemption',
    expected_dominant_emotion: 'trust',
    alt_dominant_emotions: ['sadness', 'anticipation'],
    expected_ending: 'hopeful',
  },
  {
    title: 'Schindler',
    expected_dominant_emotion: 'sadness',
    alt_dominant_emotions: ['trust', 'fear'],
    expected_thematic_depth_min: 0.8,
  },
  {
    title: 'Inception',
    expected_dominant_emotion: 'anticipation',
    alt_dominant_emotions: ['surprise'],
    expected_energy_min: 0.6,
    expected_thematic_depth_min: 0.6,
  },
  {
    title: 'The Shining',
    expected_dominant_emotion: 'fear',
    expected_energy_max: 0.6,
    expected_thematic_depth_min: 0.5,
  },
  {
    title: 'Whiplash',
    expected_energy_min: 0.7,
    expected_thematic_depth_min: 0.6,
  },
  {
    title: 'Parasite',
    expected_thematic_depth_min: 0.7,
  },
  {
    title: 'Inside Out',
    expected_dominant_emotion: 'joy',
    alt_dominant_emotions: ['sadness', 'trust'],
    expected_thematic_depth_min: 0.4,
  },
  {
    title: 'Dumb and Dumber',
    expected_dominant_emotion: 'joy',
    expected_thematic_depth_max: 0.3,
    expected_energy_min: 0.5,
  },
  {
    title: 'Requiem for a Dream',
    expected_dominant_emotion: 'sadness',
    alt_dominant_emotions: ['fear', 'disgust'],
    expected_ending: 'tragic',
  },
  {
    title: '2001: A Space Odyssey',
    expected_thematic_depth_min: 0.8,
    expected_pace: 'slow',
  },
  {
    title: 'The Godfather',
    expected_thematic_depth_min: 0.7,
    expected_dominant_emotion: 'anticipation',
    alt_dominant_emotions: ['fear', 'anger', 'trust'],
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  // Fetch all AI-profiled films with their titles
  const { data: profileRows, error } = await sb
    .from('film_profiles')
    .select(`
      film_id,
      dimensions_json,
      profiling_method,
      profiling_reasoning,
      films!inner(title, tmdb_id)
    `)
    .eq('profiling_method', 'ai_groq_llama33_v1');

  if (error) {
    console.error('DB query error:', error.message);
    process.exit(1);
  }

  if (!profileRows || profileRows.length === 0) {
    console.error('No AI-profiled films found. Run ai-profile-films.ts first.');
    process.exit(1);
  }

  console.log(`Found ${profileRows.length} AI-profiled films in DB.\n`);

  // Run sanity checks
  const results: CheckResult[] = [];

  for (const check of SANITY_CHECKS) {
    const row = profileRows.find((r) => {
      const filmTitle = ((r.films as Record<string, unknown>)?.title as string) ?? '';
      return filmTitle.toLowerCase().includes(check.title.toLowerCase());
    });

    if (!row) {
      results.push({
        title: check.title,
        found: false,
        passed: false,
        details: ['Film not found in AI-profiled set'],
      });
      continue;
    }

    const profile = row.dimensions_json as StoredProfile;
    const details: string[] = [];
    let allPassed = true;

    // Check dominant emotion
    if (check.expected_dominant_emotion) {
      const emo = profile.emotional_state;
      const sorted = (Object.entries(emo) as [keyof EmotionalState, number][])
        .sort((a, b) => b[1] - a[1]);
      const dominant = sorted[0][0];
      const acceptable = [check.expected_dominant_emotion, ...(check.alt_dominant_emotions ?? [])];

      if (acceptable.includes(dominant)) {
        details.push(`  PASS dominant=${dominant} (${sorted[0][1].toFixed(2)})`);
      } else {
        details.push(
          `  FAIL dominant=${dominant} (${sorted[0][1].toFixed(2)}), ` +
          `expected ${acceptable.join(' or ')}. ` +
          `Top 3: ${sorted.slice(0, 3).map(([k, v]) => `${k}=${v.toFixed(2)}`).join(', ')}`,
        );
        allPassed = false;
      }
    }

    // Check energy bounds
    if (check.expected_energy_max !== undefined) {
      if (profile.energy_level <= check.expected_energy_max) {
        details.push(`  PASS energy=${profile.energy_level.toFixed(2)} <= ${check.expected_energy_max}`);
      } else {
        details.push(`  FAIL energy=${profile.energy_level.toFixed(2)} > ${check.expected_energy_max}`);
        allPassed = false;
      }
    }
    if (check.expected_energy_min !== undefined) {
      if (profile.energy_level >= check.expected_energy_min) {
        details.push(`  PASS energy=${profile.energy_level.toFixed(2)} >= ${check.expected_energy_min}`);
      } else {
        details.push(`  FAIL energy=${profile.energy_level.toFixed(2)} < ${check.expected_energy_min}`);
        allPassed = false;
      }
    }

    // Check thematic depth
    if (check.expected_thematic_depth_min !== undefined) {
      if (profile.thematic_depth >= check.expected_thematic_depth_min) {
        details.push(`  PASS depth=${profile.thematic_depth.toFixed(2)} >= ${check.expected_thematic_depth_min}`);
      } else {
        details.push(`  FAIL depth=${profile.thematic_depth.toFixed(2)} < ${check.expected_thematic_depth_min}`);
        allPassed = false;
      }
    }
    if (check.expected_thematic_depth_max !== undefined) {
      if (profile.thematic_depth <= check.expected_thematic_depth_max) {
        details.push(`  PASS depth=${profile.thematic_depth.toFixed(2)} <= ${check.expected_thematic_depth_max}`);
      } else {
        details.push(`  FAIL depth=${profile.thematic_depth.toFixed(2)} > ${check.expected_thematic_depth_max}`);
        allPassed = false;
      }
    }

    // Check pace
    if (check.expected_pace) {
      if (profile.pace_preference === check.expected_pace) {
        details.push(`  PASS pace=${profile.pace_preference}`);
      } else {
        details.push(`  FAIL pace=${profile.pace_preference}, expected ${check.expected_pace}`);
        allPassed = false;
      }
    }

    // Check ending
    if (check.expected_ending) {
      if (profile.ending_preference === check.expected_ending) {
        details.push(`  PASS ending=${profile.ending_preference}`);
      } else {
        details.push(`  FAIL ending=${profile.ending_preference}, expected ${check.expected_ending}`);
        allPassed = false;
      }
    }

    results.push({
      title: check.title,
      found: true,
      passed: allPassed,
      details,
    });
  }

  // Print results
  console.log('=== SANITY CHECK RESULTS ===\n');

  let passCount = 0;
  let failCount = 0;
  let notFound = 0;

  for (const r of results) {
    if (!r.found) {
      console.log(`SKIP  "${r.title}" — ${r.details[0]}`);
      notFound++;
    } else if (r.passed) {
      console.log(`PASS  "${r.title}"`);
      for (const d of r.details) console.log(d);
      passCount++;
    } else {
      console.log(`FAIL  "${r.title}"`);
      for (const d of r.details) console.log(d);
      failCount++;
    }
    console.log('');
  }

  const evaluated = passCount + failCount;
  const passRate = evaluated > 0 ? Math.round((passCount / evaluated) * 100) : 0;

  console.log('=== SUMMARY ===');
  console.log(`  Checks: ${results.length}`);
  console.log(`  Found:  ${evaluated}`);
  console.log(`  Passed: ${passCount}`);
  console.log(`  Failed: ${failCount}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Pass rate: ${passRate}%`);
  console.log('');

  if (passRate >= 80) {
    console.log('AI profiling quality is GOOD (>= 80% pass rate).');
  } else {
    console.error(`AI profiling quality is LOW (${passRate}% < 80%). Review and tune the prompt.`);
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
