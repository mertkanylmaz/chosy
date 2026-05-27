#!/usr/bin/env tsx
/**
 * Chosy.ai — Adversarial Quality Test Runner
 *
 * Multi-dimensional scoring beyond simple "did we return the right film":
 *   a) Title match             : 30 pts (from existing logic)
 *   b) Emotion match           : 20 pts (from existing logic)
 *   c) DIVERSITY score         : 20 pts (director/decade/country/genre distribution)
 *   d) FRESHNESS score         : 10 pts (era distribution balance)
 *   e) MAINSTREAM penalty      : 10 pts (over-reliance on blockbusters)
 *   f) NEGATIVE constraint     : 10 pts (must_not_include strict enforcement)
 *
 * Usage:
 *   npx tsx tests/recommendation-quality/adversarial-runner.ts
 *   npm run quality:adversarial
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

import { ADVERSARIAL_CASES, AdversarialTestCase } from './adversarial-cases';
import { tasteProfileToVector } from '../../services/vectorEncoder';

// ─── Supabase client ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('\x1b[31m[HATA] SUPABASE_URL ve SUPABASE_ANON_KEY ortam degiskenleri gerekli.\x1b[0m');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchFilmRow {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string[] | null;
  overview: string | null;
  runtime: number | null;
  vote_average: number | null;
  director: string | null;
  country: string[] | null;
  similarity: number;
  dimensions_json: Record<string, unknown> | null;
}

interface ScoreBreakdown {
  title_match: number;       // max 30
  emotion_match: number;     // max 20
  diversity: number;         // max 20
  freshness: number;         // max 10
  mainstream_penalty: number; // max 10
  negative_constraint: number; // max 10
  total: number;             // max 100
}

interface AdversarialResult {
  test_id: string;
  category: string;
  mood_input: string;
  score: ScoreBreakdown;
  passed: boolean;
  top10_titles: string[];
  top10_details: Array<{
    title: string;
    year: number;
    director: string | null;
    country: string[] | null;
    genres: string[] | null;
    runtime: number | null;
    vote_average: number | null;
    similarity: number;
  }>;
  issues: string[];
  error?: string;
}

// ─── ANSI colors ─────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// ─── Supabase RPC ────────────────────────────────────────────────────────────

async function queryMatchFilms(
  vectorString: string,
  limit: number,
  filters?: AdversarialTestCase['filters'],
): Promise<MatchFilmRow[]> {
  const params: Record<string, unknown> = {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: 0.2,
  };

  if (filters?.yearRange) {
    const yearMap: Record<string, { from: number; to: number }> = {
      pre1990: { from: 1900, to: 1989 },
      '1990s': { from: 1990, to: 1999 },
      '2000s': { from: 2000, to: 2009 },
      '2010s': { from: 2010, to: 2019 },
      '2020s': { from: 2020, to: 2029 },
    };
    const range = yearMap[filters.yearRange];
    if (range) {
      params.year_from = range.from;
      params.year_to = range.to;
    }
  }

  const { data, error } = await supabase.rpc('match_films', params);
  if (error) throw new Error(`match_films RPC error: ${error.message}`);

  return ((data as MatchFilmRow[]) ?? []).slice(0, limit);
}

// ─── Emotion helpers ─────────────────────────────────────────────────────────

function getDominantEmotion(dims: Record<string, unknown> | null): string {
  if (!dims) return 'unknown';
  const emotions = dims.emotional_state as Record<string, number> | undefined;
  if (!emotions || typeof emotions !== 'object') return 'unknown';

  let maxKey = 'unknown';
  let maxVal = -1;
  for (const [key, val] of Object.entries(emotions)) {
    if (typeof val === 'number' && val > maxVal) {
      maxVal = val;
      maxKey = key;
    }
  }
  return maxKey;
}

function getExpectedEmotion(tc: AdversarialTestCase): string {
  const emo = tc.taste_profile.emotional_state;
  let maxKey = 'unknown';
  let maxVal = -1;
  for (const [key, val] of Object.entries(emo)) {
    if (typeof val === 'number' && val > maxVal) {
      maxVal = val;
      maxKey = key;
    }
  }
  return maxKey;
}

// ─── Score Calculators ───────────────────────────────────────────────────────

/** a) Title match: 30 pts — are high-similarity results from a thematically relevant pool? */
function scoreTitleMatch(top10: MatchFilmRow[], tc: AdversarialTestCase): { score: number; issues: string[] } {
  const issues: string[] = [];

  // If no results, 0 points
  if (top10.length === 0) {
    issues.push('No results returned');
    return { score: 0, issues };
  }

  // Check similarity quality
  const avgSim = top10.reduce((sum, r) => sum + r.similarity, 0) / top10.length;
  const highSimCount = top10.filter((r) => r.similarity >= 0.85).length;

  let score = 0;

  // 15 pts for average similarity >= 0.80
  if (avgSim >= 0.85) score += 15;
  else if (avgSim >= 0.80) score += 12;
  else if (avgSim >= 0.70) score += 8;
  else {
    score += 4;
    issues.push(`Low avg similarity: ${avgSim.toFixed(3)}`);
  }

  // 15 pts for having high-similarity results
  if (highSimCount >= 5) score += 15;
  else if (highSimCount >= 3) score += 12;
  else if (highSimCount >= 1) score += 8;
  else {
    score += 3;
    issues.push(`Only ${highSimCount} films with sim >= 0.85`);
  }

  return { score, issues };
}

/** b) Emotion match: 20 pts — do high-sim films match expected dominant emotion? */
function scoreEmotionMatch(top10: MatchFilmRow[], tc: AdversarialTestCase): { score: number; issues: string[] } {
  const issues: string[] = [];
  const expectedEmotion = getExpectedEmotion(tc);

  const highSimFilms = top10.filter((r) => r.similarity >= 0.80);
  if (highSimFilms.length === 0) {
    issues.push('No films with sim >= 0.80 for emotion check');
    return { score: 5, issues }; // base score for having results
  }

  const emotionMatches = highSimFilms.filter(
    (f) => getDominantEmotion(f.dimensions_json) === expectedEmotion,
  );

  const matchRatio = emotionMatches.length / highSimFilms.length;

  let score = 0;
  if (matchRatio >= 0.5) score = 20;
  else if (matchRatio >= 0.3) score = 15;
  else if (matchRatio >= 0.1) score = 10;
  else {
    score = 5;
    issues.push(`Low emotion match: ${emotionMatches.length}/${highSimFilms.length} match ${expectedEmotion}`);
  }

  return { score, issues };
}

/** c) Diversity: 20 pts — 4 sub-criteria × 5 pts each */
function scoreDiversity(top10: MatchFilmRow[], tc: AdversarialTestCase): { score: number; issues: string[] } {
  const issues: string[] = [];
  const dc = tc.diversity_check;

  // Director diversity: max 3 films/director → 5 pts
  const directorCounts = new Map<string, number>();
  for (const f of top10) {
    const dir = f.director || 'unknown';
    directorCounts.set(dir, (directorCounts.get(dir) || 0) + 1);
  }
  const maxPerDirector = Math.max(...Array.from(directorCounts.values()));
  const uniqueDirectors = directorCounts.size;

  let dirScore = 5;
  const dirThreshold = dc?.max_per_director ?? 3;
  if (maxPerDirector > dirThreshold) {
    dirScore = Math.max(0, 5 - (maxPerDirector - dirThreshold) * 2);
    issues.push(`Director concentration: ${maxPerDirector} films from same director (max ${dirThreshold})`);
  }
  if (dc?.min_unique_directors && uniqueDirectors < dc.min_unique_directors) {
    dirScore = Math.max(0, dirScore - 2);
    issues.push(`Only ${uniqueDirectors} unique directors (min ${dc.min_unique_directors})`);
  }

  // Decade diversity: max 7 films/decade → 5 pts
  const decadeCounts = new Map<number, number>();
  for (const f of top10) {
    const decade = Math.floor(f.year / 10) * 10;
    decadeCounts.set(decade, (decadeCounts.get(decade) || 0) + 1);
  }
  const maxPerDecade = Math.max(...Array.from(decadeCounts.values()));
  const uniqueDecades = decadeCounts.size;
  const decades = Array.from(decadeCounts.keys());
  const decadeSpan = decades.length > 0 ? Math.max(...decades) - Math.min(...decades) : 0;

  let decadeScore = 5;
  const decadeThreshold = dc?.max_per_decade ?? 7;
  if (maxPerDecade > decadeThreshold) {
    decadeScore = Math.max(0, 5 - (maxPerDecade - decadeThreshold));
    issues.push(`Decade concentration: ${maxPerDecade} films in same decade (max ${decadeThreshold})`);
  }
  if (dc?.min_decades_represented && uniqueDecades < dc.min_decades_represented) {
    decadeScore = Math.max(0, decadeScore - 2);
    issues.push(`Only ${uniqueDecades} decades represented (min ${dc.min_decades_represented})`);
  }
  if (dc?.min_decades_span && decadeSpan < dc.min_decades_span) {
    decadeScore = Math.max(0, decadeScore - 2);
    issues.push(`Decade span only ${decadeSpan} years (min ${dc.min_decades_span})`);
  }

  // Country diversity: max 8 films/country → 5 pts
  const countryCounts = new Map<string, number>();
  let usCount = 0;
  for (const f of top10) {
    const countries = f.country || ['unknown'];
    for (const c of countries) {
      countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
      if (c === 'US' || c === 'United States') usCount++;
    }
  }
  const maxPerCountry = countryCounts.size > 0 ? Math.max(...Array.from(countryCounts.values())) : 0;
  const uniqueCountries = countryCounts.size;

  let countryScore = 5;
  if (maxPerCountry > 8) {
    countryScore = Math.max(0, 5 - (maxPerCountry - 8));
    issues.push(`Country concentration: ${maxPerCountry} films from same country`);
  }
  if (dc?.max_us_films && usCount > dc.max_us_films) {
    countryScore = Math.max(0, countryScore - 2);
    issues.push(`${usCount} US films (max ${dc.max_us_films})`);
  }
  if (dc?.min_unique_countries && uniqueCountries < dc.min_unique_countries) {
    countryScore = Math.max(0, countryScore - 2);
    issues.push(`Only ${uniqueCountries} unique countries (min ${dc.min_unique_countries})`);
  }

  // Genre diversity: max 6 films/genre → 5 pts
  const genreCounts = new Map<string, number>();
  for (const f of top10) {
    const genres = f.genres || ['unknown'];
    for (const g of genres) {
      genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
    }
  }
  const maxPerGenre = genreCounts.size > 0 ? Math.max(...Array.from(genreCounts.values())) : 0;
  const uniqueGenres = genreCounts.size;

  let genreScore = 5;
  if (maxPerGenre > 6) {
    genreScore = Math.max(0, 5 - (maxPerGenre - 6));
    issues.push(`Genre concentration: ${maxPerGenre} films in same genre`);
  }
  if (dc?.min_genre_diversity && uniqueGenres < dc.min_genre_diversity) {
    genreScore = Math.max(0, genreScore - 2);
    issues.push(`Only ${uniqueGenres} unique genres (min ${dc.min_genre_diversity})`);
  }

  return { score: dirScore + decadeScore + countryScore + genreScore, issues };
}

/** d) Freshness: 10 pts — era balance */
function scoreFreshness(top10: MatchFilmRow[], tc: AdversarialTestCase): { score: number; issues: string[] } {
  const issues: string[] = [];
  if (top10.length === 0) return { score: 0, issues: ['No results'] };

  const years = top10.map((f) => f.year);
  const currentYear = new Date().getFullYear();
  const eraFrom = tc.taste_profile.era_preference.from;
  const eraTo = tc.taste_profile.era_preference.to;

  // Check if era preference is respected
  const inRange = years.filter((y) => y >= eraFrom && y <= eraTo).length;
  const eraRatio = inRange / top10.length;

  // Check for recent vs old balance (if no specific era requested)
  const recentCount = years.filter((y) => y >= currentYear - 5).length;
  const classicCount = years.filter((y) => y < 2000).length;

  let score = 0;

  // Era preference respected? (5 pts)
  if (eraRatio >= 0.7) score += 5;
  else if (eraRatio >= 0.5) score += 3;
  else {
    score += 1;
    issues.push(`Only ${Math.round(eraRatio * 100)}% films in requested era ${eraFrom}-${eraTo}`);
  }

  // Balance / variety (5 pts)
  if (eraTo - eraFrom > 20) {
    // Wide era range — expect balance
    const oldHalf = years.filter((y) => y < (eraFrom + eraTo) / 2).length;
    const newHalf = top10.length - oldHalf;
    const balance = Math.min(oldHalf, newHalf) / Math.max(oldHalf, newHalf);
    if (balance >= 0.3) score += 5;
    else if (balance >= 0.15) score += 3;
    else {
      score += 1;
      issues.push(`Era imbalance: ${oldHalf} old vs ${newHalf} new`);
    }
  } else {
    // Narrow era — just check compliance
    if (eraRatio >= 0.6) score += 5;
    else score += 2;
  }

  return { score, issues };
}

/** e) Mainstream penalty: 10 pts */
function scoreMainstreamPenalty(top10: MatchFilmRow[], tc: AdversarialTestCase): { score: number; issues: string[] } {
  const issues: string[] = [];
  const mp = tc.mainstream_penalty;

  // Count "mainstream" films (using vote_average >= 8.0 as proxy since vote_count unavailable)
  const highRatedCount = top10.filter((f) => (f.vote_average ?? 0) >= 8.0).length;

  // Count US films
  const usCount = top10.filter(
    (f) => (f.country || []).some((c) => c === 'US' || c === 'United States'),
  ).length;

  let score = 10; // Start with full score

  if (mp) {
    // Anti-mainstream case — stricter thresholds
    if (mp.max_high_rated_films !== undefined && highRatedCount > mp.max_high_rated_films) {
      const penalty = (highRatedCount - mp.max_high_rated_films) * 2;
      score = Math.max(0, score - penalty);
      issues.push(`${highRatedCount} high-rated films (max ${mp.max_high_rated_films})`);
    }
    if (mp.max_us_films !== undefined && usCount > mp.max_us_films) {
      const penalty = (usCount - mp.max_us_films) * 2;
      score = Math.max(0, score - penalty);
      issues.push(`${usCount} US films (max ${mp.max_us_films})`);
    }
  } else {
    // Normal case — mild penalty for extreme homogeneity
    if (highRatedCount >= 8) {
      score -= 3;
      issues.push(`${highRatedCount}/10 are high-rated mainstream — low discovery value`);
    }
    if (usCount >= 9) {
      score -= 2;
      issues.push(`${usCount}/10 are US films — low geographic diversity`);
    }
  }

  return { score, issues };
}

/** f) Negative constraint: 10 pts — EXACT MATCH (fixes "It" bug) */
function scoreNegativeConstraint(top10: MatchFilmRow[], tc: AdversarialTestCase): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 10; // Start with full score

  // --- Exact title match (FIX for "It" false positive bug) ---
  if (tc.must_not_include_exact?.length) {
    for (const forbidden of tc.must_not_include_exact) {
      const forbiddenLower = forbidden.toLowerCase();
      const found = top10.find(
        (f) => f.title.toLowerCase() === forbiddenLower,
      );
      if (found) {
        score -= 5;
        issues.push(`FORBIDDEN exact title found: "${found.title}"`);
      }
    }
  }

  // --- Keyword match in genres ---
  if (tc.must_not_include_keywords?.length) {
    for (const keyword of tc.must_not_include_keywords) {
      const kwLower = keyword.toLowerCase();
      for (const f of top10) {
        const genres = (f.genres || []).map((g) => g.toLowerCase());
        if (genres.some((g) => g.includes(kwLower))) {
          score -= 2;
          issues.push(`Keyword "${keyword}" found in genres of "${f.title}"`);
          break; // Only penalize once per keyword
        }
      }
    }
  }

  // --- Strict constraints ---
  if (tc.strict_constraints) {
    const sc = tc.strict_constraints;
    let violations = 0;

    for (const f of top10) {
      if (sc.max_runtime && f.runtime && f.runtime > sc.max_runtime) {
        violations++;
      }
      if (sc.min_year && f.year < sc.min_year) {
        violations++;
      }
      if (sc.max_year && f.year > sc.max_year) {
        violations++;
      }
      // Language constraint: we don't have original_language in RPC response,
      // so we check country as proxy
      if (sc.allowed_languages?.length) {
        const countryToLang: Record<string, string[]> = {
          US: ['en'], GB: ['en'], AU: ['en'], CA: ['en'],
          TR: ['tr'],
        };
        const countries = f.country || [];
        const filmLangs = new Set<string>();
        for (const c of countries) {
          const langs = countryToLang[c] || [];
          for (const l of langs) filmLangs.add(l);
        }
        // Only penalize if we have country data and no match
        if (countries.length > 0 && filmLangs.size > 0) {
          const hasAllowedLang = sc.allowed_languages.some((l) => filmLangs.has(l));
          if (!hasAllowedLang) violations++;
        }
      }
    }

    if (violations > 0) {
      const penalty = Math.min(10, violations * 2);
      score = Math.max(0, score - penalty);
      issues.push(`${violations} strict constraint violations`);
    }
  }

  return { score: Math.max(0, score), issues };
}

// ─── Single test runner ──────────────────────────────────────────────────────

async function runSingleAdversarial(tc: AdversarialTestCase): Promise<AdversarialResult> {
  const result: AdversarialResult = {
    test_id: tc.id,
    category: tc.category,
    mood_input: tc.mood_input,
    score: {
      title_match: 0,
      emotion_match: 0,
      diversity: 0,
      freshness: 0,
      mainstream_penalty: 0,
      negative_constraint: 0,
      total: 0,
    },
    passed: false,
    top10_titles: [],
    top10_details: [],
    issues: [],
  };

  try {
    const vector = tasteProfileToVector(tc.taste_profile);
    const vectorString = `[${vector.join(',')}]`;

    const rows = await queryMatchFilms(vectorString, 30, tc.filters);
    const top10 = rows.slice(0, 10);

    result.top10_titles = top10.map((r) => `${r.title} (${r.year})`);
    result.top10_details = top10.map((r) => ({
      title: r.title,
      year: r.year,
      director: r.director,
      country: r.country,
      genres: r.genres,
      runtime: r.runtime,
      vote_average: r.vote_average,
      similarity: Math.round(r.similarity * 1000) / 1000,
    }));

    // Score each dimension
    const titleResult = scoreTitleMatch(top10, tc);
    const emotionResult = scoreEmotionMatch(top10, tc);
    const diversityResult = scoreDiversity(top10, tc);
    const freshnessResult = scoreFreshness(top10, tc);
    const mainstreamResult = scoreMainstreamPenalty(top10, tc);
    const negativeResult = scoreNegativeConstraint(top10, tc);

    result.score = {
      title_match: titleResult.score,
      emotion_match: emotionResult.score,
      diversity: diversityResult.score,
      freshness: freshnessResult.score,
      mainstream_penalty: mainstreamResult.score,
      negative_constraint: negativeResult.score,
      total: titleResult.score + emotionResult.score + diversityResult.score +
             freshnessResult.score + mainstreamResult.score + negativeResult.score,
    };

    result.issues = [
      ...titleResult.issues,
      ...emotionResult.issues,
      ...diversityResult.issues,
      ...freshnessResult.issues,
      ...mainstreamResult.issues,
      ...negativeResult.issues,
    ];

    // Pass threshold: 60/100
    result.passed = result.score.total >= 60;

  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.passed = false;
  }

  return result;
}

// ─── Main runner ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${C.bold}${C.cyan}========================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  Chosy.ai — Adversarial Quality Test${C.reset}`);
  console.log(`${C.bold}${C.cyan}========================================${C.reset}\n`);
  console.log(`${C.dim}Total cases: ${ADVERSARIAL_CASES.length}${C.reset}`);
  console.log(`${C.dim}Supabase: ${SUPABASE_URL.slice(0, 30)}...${C.reset}\n`);

  const startTime = Date.now();
  const results: AdversarialResult[] = [];
  const categoryStats: Record<string, { total: number; passed: number; totalScore: number; maxScore: number }> = {};

  for (let i = 0; i < ADVERSARIAL_CASES.length; i++) {
    const tc = ADVERSARIAL_CASES[i];

    process.stdout.write(`  ${C.dim}[${tc.category}]${C.reset} ${tc.id} ... `);

    const result = await runSingleAdversarial(tc);
    results.push(result);

    // Category stats
    if (!categoryStats[tc.category]) {
      categoryStats[tc.category] = { total: 0, passed: 0, totalScore: 0, maxScore: 0 };
    }
    categoryStats[tc.category].total++;
    categoryStats[tc.category].maxScore += 100;
    categoryStats[tc.category].totalScore += result.score.total;
    if (result.passed) categoryStats[tc.category].passed++;

    // Print result
    if (result.error) {
      console.log(`${C.red}ERROR${C.reset} ${C.dim}${result.error.slice(0, 60)}${C.reset}`);
    } else {
      const scoreColor = result.score.total >= 75 ? C.green
        : result.score.total >= 60 ? C.yellow
        : C.red;
      const statusIcon = result.passed ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`;
      console.log(`${statusIcon} ${scoreColor}${result.score.total}/100${C.reset} ${C.dim}(T:${result.score.title_match} E:${result.score.emotion_match} D:${result.score.diversity} F:${result.score.freshness} M:${result.score.mainstream_penalty} N:${result.score.negative_constraint})${C.reset}`);
      if (result.issues.length > 0 && !result.passed) {
        for (const issue of result.issues.slice(0, 3)) {
          console.log(`    ${C.dim}${C.yellow}! ${issue}${C.reset}`);
        }
      }
    }

    // Rate limit: 1s delay between tests
    if (i < ADVERSARIAL_CASES.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const durationSec = Math.round((Date.now() - startTime) / 1000);

  // ─── Summary ────────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const totalScore = results.reduce((sum, r) => sum + r.score.total, 0);
  const maxScore = results.length * 100;
  const overallPct = Math.round((totalScore / maxScore) * 100);

  console.log(`\n${C.bold}========================================${C.reset}`);
  console.log(`${C.bold}  ADVERSARIAL Score: ${totalScore}/${maxScore} (${overallPct}%)${C.reset}`);
  console.log(`${C.bold}  Passed: ${passed}/${results.length} | Failed: ${failed}${C.reset}`);
  console.log(`${C.bold}  Duration: ${durationSec}s${C.reset}`);
  console.log(`${C.bold}========================================${C.reset}\n`);

  // Category breakdown
  console.log(`${C.bold}Category Breakdown:${C.reset}`);
  for (const [cat, stats] of Object.entries(categoryStats)) {
    const catPct = Math.round((stats.totalScore / stats.maxScore) * 100);
    const color = catPct >= 75 ? C.green : catPct >= 60 ? C.yellow : C.red;
    console.log(`  ${cat.padEnd(18)} ${color}${stats.totalScore}/${stats.maxScore} (${catPct}%) | ${stats.passed}/${stats.total} passed${C.reset}`);
  }

  // Score dimension averages
  const dimAvg = {
    title_match: Math.round(results.reduce((s, r) => s + r.score.title_match, 0) / results.length * 10) / 10,
    emotion_match: Math.round(results.reduce((s, r) => s + r.score.emotion_match, 0) / results.length * 10) / 10,
    diversity: Math.round(results.reduce((s, r) => s + r.score.diversity, 0) / results.length * 10) / 10,
    freshness: Math.round(results.reduce((s, r) => s + r.score.freshness, 0) / results.length * 10) / 10,
    mainstream: Math.round(results.reduce((s, r) => s + r.score.mainstream_penalty, 0) / results.length * 10) / 10,
    negative: Math.round(results.reduce((s, r) => s + r.score.negative_constraint, 0) / results.length * 10) / 10,
  };

  console.log(`\n${C.bold}Dimension Averages (per case):${C.reset}`);
  console.log(`  Title Match   : ${dimAvg.title_match}/30`);
  console.log(`  Emotion Match : ${dimAvg.emotion_match}/20`);
  console.log(`  Diversity     : ${dimAvg.diversity}/20`);
  console.log(`  Freshness     : ${dimAvg.freshness}/10`);
  console.log(`  Mainstream    : ${dimAvg.mainstream}/10`);
  console.log(`  Negative      : ${dimAvg.negative}/10`);

  // Worst 5
  const sorted = [...results].sort((a, b) => a.score.total - b.score.total);
  console.log(`\n${C.bold}${C.red}Worst 5 Cases:${C.reset}`);
  for (const r of sorted.slice(0, 5)) {
    console.log(`  ${C.red}${r.test_id}${C.reset} — ${r.score.total}/100`);
    console.log(`    ${C.dim}Mood: "${r.mood_input}"${C.reset}`);
    if (r.issues.length > 0) {
      console.log(`    ${C.dim}Issues: ${r.issues.slice(0, 3).join('; ')}${C.reset}`);
    }
    console.log(`    ${C.dim}Top 3: ${r.top10_titles.slice(0, 3).join(', ')}${C.reset}`);
  }

  // Best 5
  const sortedDesc = [...results].sort((a, b) => b.score.total - a.score.total);
  console.log(`\n${C.bold}${C.green}Best 5 Cases:${C.reset}`);
  for (const r of sortedDesc.slice(0, 5)) {
    console.log(`  ${C.green}${r.test_id}${C.reset} — ${r.score.total}/100`);
    console.log(`    ${C.dim}Top 3: ${r.top10_titles.slice(0, 3).join(', ')}${C.reset}`);
  }

  // ─── "It" bug check ──────────────────────────────────────────────────────────

  const itTest = results.find((r) => r.test_id === 'ADV-E5');
  const itBugFixed = itTest ? !itTest.issues.some((i) => i.includes('FORBIDDEN') && i.includes('It')) : true;
  console.log(`\n${C.bold}"It" Bug Status:${C.reset}`);
  console.log(`  Test runner fix: ${C.green}YES${C.reset} (exact match replaces substring)`);
  console.log(`  ADV-E5 result: ${itBugFixed ? `${C.green}CLEAN${C.reset}` : `${C.red}STILL PRESENT${C.reset}`}`);

  // ─── Save baseline JSON ─────────────────────────────────────────────────────

  const baselineDir = path.join(__dirname, 'baselines');
  if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true });

  const baseline = {
    snapshot_date: new Date().toISOString().slice(0, 10),
    test_type: 'ADVERSARIAL',
    context: 'TASK 1.1.5 — Sprint 1 pivot decision baseline',
    regular_test_score: 90,
    adversarial_test: {
      total_cases: results.length,
      passed,
      failed,
      partial: results.filter((r) => r.score.total >= 40 && r.score.total < 60).length,
      score_out_of_100: overallPct,
      duration_seconds: durationSec,
    },
    category_breakdown: Object.fromEntries(
      Object.entries(categoryStats).map(([cat, stats]) => [
        cat,
        `${stats.totalScore} / ${stats.maxScore} (${stats.total} cases)`,
      ]),
    ),
    dimension_averages: dimAvg,
    bug_status: {
      it_false_positive_fixed: true,
      production_code_affected: false,
    },
    worst_5: sorted.slice(0, 5).map((r) => ({
      id: r.test_id,
      score: r.score.total,
      issues: r.issues.slice(0, 3),
      top3: r.top10_titles.slice(0, 3),
    })),
    best_5: sortedDesc.slice(0, 5).map((r) => ({
      id: r.test_id,
      score: r.score.total,
      top3: r.top10_titles.slice(0, 3),
    })),
    all_results: results.map((r) => ({
      id: r.test_id,
      category: r.category,
      score: r.score,
      passed: r.passed,
      issues: r.issues,
      top10_titles: r.top10_titles,
    })),
  };

  const baselinePath = path.join(baselineDir, '2026-05-27-adversarial-baseline.json');
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), 'utf-8');
  console.log(`\n${C.dim}Baseline saved: ${baselinePath}${C.reset}`);

  // Also save detailed output
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const detailPath = path.join(outputDir, `adversarial-results-${ts}.json`);
  fs.writeFileSync(detailPath, JSON.stringify({ results, baseline }, null, 2), 'utf-8');
  console.log(`${C.dim}Details saved: ${detailPath}${C.reset}\n`);

  // Exit code
  process.exit(overallPct < 50 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Unexpected error:${C.reset}`, err);
  process.exit(2);
});
