#!/usr/bin/env tsx
/**
 * Founder Acceptance Test Runner
 *
 * Calls real parse-mood Edge Function + match_films_v2 RPC for each
 * founder-defined mood, then scores against ground-truth film lists.
 *
 * Usage:
 *   npm run test:founder
 *   npx tsx tests/founder-acceptance/runner.ts
 *
 * Cost: ~$0.01 per run (5 cases x parse-mood API call)
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

import { FOUNDER_CASES, FounderTestCase } from './cases';
import { tasteProfileToVector, TasteProfile } from '../../services/vectorEncoder';

// ─── Supabase client ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('\x1b[31m[HATA] SUPABASE_URL ve SUPABASE_ANON_KEY ortam degiskenleri gerekli.\x1b[0m');
  console.error('  export EXPO_PUBLIC_SUPABASE_URL=... && export EXPO_PUBLIC_SUPABASE_ANON_KEY=...');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── ANSI colors ─────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchFilmRow {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  poster_url: string | null;
  genres: string[] | null;
  overview: string | null;
  similarity: number;
  director: string | null;
  dimensions_json: Record<string, unknown> | null;
}

type CaseVerdict = 'PASS' | 'PARTIAL' | 'WEAK' | 'FAIL';

interface CaseResult {
  id: string;
  mood: string;
  verdict: CaseVerdict;
  acceptableCount: number;
  unacceptableCount: number;
  avgSimilarity: number;
  top10: Array<{
    title: string;
    year: number;
    similarity: number;
    isAcceptable: boolean;
    isUnacceptable: boolean;
  }>;
  profile: TasteProfile;
  error?: string;
}

// ─── Yol B: Unacceptable-based + similarity scoring ────────────────────────

function evaluateCase(
  acceptableCount: number,
  unacceptableCount: number,
  avgSim: number,
): CaseVerdict {
  // Kötü film sızdı = gerçek başarısızlık
  if (unacceptableCount > 0) return 'FAIL';
  // Temiz + mood'a uygun (high similarity, with acceptable hits or very high sim)
  if (avgSim >= 0.75 && (acceptableCount >= 2 || avgSim >= 0.85)) return 'PASS';
  // Temiz ama similarity orta
  if (avgSim >= 0.70) return 'PARTIAL';
  // Similarity düşük, mood yakalanmamış
  return 'WEAK';
}

// ─── Title matching (flexible) ───────────────────────────────────────────────

function titleMatches(filmTitle: string, examples: string[]): boolean {
  const normalized = filmTitle.toLowerCase().trim();
  return examples.some((ex) => {
    const exNorm = ex.toLowerCase().trim();
    return normalized.includes(exNorm) || exNorm.includes(normalized);
  });
}

// ─── Parse-mood Edge Function call ───────────────────────────────────────────

async function callParseMood(input: string): Promise<TasteProfile> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-mood`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ raw_input: input }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(`parse-mood HTTP ${res.status}: ${JSON.stringify(errorData)}`);
    }

    const raw = await res.json();
    return raw as TasteProfile;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── match_films_v2 RPC ──────────────────────────────────────────────────────

async function queryMatchFilmsV2(vectorString: string, limit: number): Promise<MatchFilmRow[]> {
  const { data, error } = await supabase.rpc('match_films_v2', {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: 0.2,
    per_director_cap: 3,
    tier_boost: false,
  });

  if (error) throw new Error(`match_films_v2 RPC error: ${error.message}`);
  return ((data as MatchFilmRow[]) ?? []).slice(0, limit);
}

// ─── Single case runner ──────────────────────────────────────────────────────

async function runCase(tc: FounderTestCase): Promise<CaseResult> {
  const result: CaseResult = {
    id: tc.id,
    mood: tc.mood,
    verdict: 'FAIL',
    acceptableCount: 0,
    unacceptableCount: 0,
    avgSimilarity: 0,
    top10: [],
    profile: {} as TasteProfile,
  };

  try {
    // Step 1: Call parse-mood (real AI)
    const profile = await callParseMood(tc.mood);
    result.profile = profile;

    // Step 2: Encode to vector
    const vector = tasteProfileToVector(profile);
    const vectorString = `[${vector.join(',')}]`;

    // Step 3: Query match_films_v2
    const rows = await queryMatchFilmsV2(vectorString, 10);

    // Step 4: Score against ground truth
    for (const row of rows) {
      const isAcc = titleMatches(row.title, tc.acceptableExamples);
      const isUnacc = titleMatches(row.title, tc.unacceptableExamples);

      if (isAcc) result.acceptableCount++;
      if (isUnacc) result.unacceptableCount++;

      result.top10.push({
        title: row.title,
        year: row.year,
        similarity: Math.round(row.similarity * 1000) / 1000,
        isAcceptable: isAcc,
        isUnacceptable: isUnacc,
      });
    }

    // Step 5: Compute avgSimilarity + determine verdict (Yol B)
    result.avgSimilarity = result.top10.length > 0
      ? Math.round((result.top10.reduce((s, f) => s + f.similarity, 0) / result.top10.length) * 1000) / 1000
      : 0;

    result.verdict = evaluateCase(
      result.acceptableCount,
      result.unacceptableCount,
      result.avgSimilarity,
    );
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.verdict = 'FAIL';
  }

  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dateStr = new Date().toISOString().slice(0, 10);

  console.log(`\n${C.bold}${C.cyan}${'='.repeat(50)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  FOUNDER ACCEPTANCE TEST - ${dateStr}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  RPC: match_films_v2${C.reset}`);
  console.log(`${C.bold}${C.cyan}${'='.repeat(50)}${C.reset}\n`);

  const results: CaseResult[] = [];

  for (let i = 0; i < FOUNDER_CASES.length; i++) {
    const tc = FOUNDER_CASES[i];
    process.stdout.write(`  ${tc.id.padEnd(28)} `);

    const result = await runCase(tc);
    results.push(result);

    // Print verdict
    if (result.error) {
      console.log(`${C.red}ERROR${C.reset} ${C.dim}${result.error.slice(0, 50)}${C.reset}`);
    } else {
      const verdictColor = result.verdict === 'PASS' ? C.green
        : result.verdict === 'PARTIAL' ? C.yellow
        : C.red;
      console.log(
        `${verdictColor}${result.verdict.padEnd(8)}${C.reset}` +
        `acc:${result.acceptableCount} unacc:${result.unacceptableCount} avgSim:${result.avgSimilarity}`
      );
    }

    // Rate limit between calls
    if (i < FOUNDER_CASES.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // Summary
  const passCount = results.filter((r) => r.verdict === 'PASS').length;
  const partialCount = results.filter((r) => r.verdict === 'PARTIAL').length;
  const weakCount = results.filter((r) => r.verdict === 'WEAK').length;
  const failCount = results.filter((r) => r.verdict === 'FAIL').length;

  console.log(`\n${C.bold}${'='.repeat(50)}${C.reset}`);
  console.log(`${C.bold}  TOTAL: ${passCount}/${results.length} PASS` +
    (partialCount > 0 ? `, ${partialCount} PARTIAL` : '') +
    (weakCount > 0 ? `, ${C.yellow}${weakCount} WEAK${C.reset}${C.bold}` : '') +
    (failCount > 0 ? `, ${C.red}${failCount} FAIL${C.reset}${C.bold}` : '') +
    `${C.reset}`);

  // Print top 10 for each case
  console.log(`\n${C.bold}  TOP 10 DETAILS:${C.reset}`);
  for (const r of results) {
    const verdictColor = r.verdict === 'PASS' ? C.green
      : r.verdict === 'PARTIAL' ? C.yellow
      : r.verdict === 'WEAK' ? C.yellow
      : C.red;
    console.log(`\n  ${C.bold}${verdictColor}[${r.verdict}]${C.reset} ${C.bold}${r.id}${C.reset} ${C.dim}("${r.mood}")${C.reset}`);
    for (let i = 0; i < r.top10.length; i++) {
      const f = r.top10[i];
      const tag = f.isUnacceptable ? `${C.red}[UNACC]${C.reset}`
        : f.isAcceptable ? `${C.green}[ACC]${C.reset}`
        : `${C.dim}[---]${C.reset}`;
      console.log(`    ${String(i + 1).padStart(2)}. ${f.title} (${f.year}) ${C.dim}sim=${f.similarity}${C.reset} ${tag}`);
    }
  }

  console.log(`\n${C.bold}${'='.repeat(50)}${C.reset}`);
  console.log(`${C.dim}  Top 10 dumps saved to results.json${C.reset}\n`);

  // ─── Save results.json ──────────────────────────────────────────────────────

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const resultsPath = path.join(outputDir, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify(results.map((r) => ({
    id: r.id,
    mood: r.mood,
    verdict: r.verdict,
    acceptableCount: r.acceptableCount,
    unacceptableCount: r.unacceptableCount,
    avgSimilarity: r.avgSimilarity,
    top10: r.top10,
    profile: r.profile,
  })), null, 2), 'utf-8');

  // ─── Save baseline ─────────────────────────────────────────────────────────

  const baselineDir = path.join(__dirname, 'baselines');
  if (!fs.existsSync(baselineDir)) fs.mkdirSync(baselineDir, { recursive: true });

  const baseline = {
    date: dateStr,
    sprint: 'Sprint 1 v5.0 closure',
    rpc: 'match_films_v2',
    results: Object.fromEntries(
      results.map((r) => [r.id, {
        verdict: r.verdict,
        acceptableCount: r.acceptableCount,
        unacceptableCount: r.unacceptableCount,
        avgSimilarity: r.avgSimilarity,
        top10_titles: r.top10.map((f) => `${f.title} (${f.year}) sim=${f.similarity}`),
      }])
    ),
    scoring: 'Yol B: unacceptable-based + similarity',
    total_pass: passCount,
    total_partial: partialCount,
    total_weak: weakCount,
    total_fail: failCount,
    notes: 'Yol B scoring: PASS = 0 unacc + avgSim>=0.75 + (acc>=2 || avgSim>=0.85)',
  };

  const baselinePath = path.join(baselineDir, `${dateStr}-sprint1-close.json`);
  fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2), 'utf-8');
  console.log(`${C.dim}  Baseline saved: ${baselinePath}${C.reset}\n`);

  // Exit code: FAIL or WEAK = exit 1
  process.exit(failCount > 0 || weakCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Unexpected error:${C.reset}`, err);
  process.exit(2);
});
