#!/usr/bin/env tsx
/**
 * Chosy.ai — Film Oneri Kalite Testi
 *
 * Mevcut oneri algoritmasini 20 test vakasina karsi calistirir,
 * her vakanin top 10 sonucunu kontrol eder ve toplam skor verir.
 *
 * Kullanim:
 *   npx tsx tests/recommendation-quality/run-quality-test.ts
 *   npm run test:quality
 *
 * Cikti:
 *   - Konsola renkli ozet
 *   - tests/recommendation-quality/output/baseline-results-[timestamp].json
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';

import { TEST_CASES, QualityTestCase } from './test-cases';
import { tasteProfileToVector } from '../../services/vectorEncoder';

// ─── Supabase client (servis icinden import edemeyiz, dogrudan olustur) ──────

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

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface TestResult {
  test_id: string;
  category: string;
  mood_input: string;
  archetype: string;
  passed: boolean;
  pass_reason: 'emotion_match' | 'title_match' | 'edge_case' | 'none';
  top10_titles: string[];
  matched_expected: string[];
  matched_forbidden: string[];
  match_count: number;
  required_count: number;
  similarity_range: { min: number; max: number };
  emotion_match_detail?: {
    expected_emotion: string;
    high_sim_films: Array<{ title: string; similarity: number; dominant_emotion: string }>;
    matched: boolean;
  };
  error?: string;
}

interface TestReport {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  score_pct: number;
  by_category: Record<string, { total: number; passed: number }>;
  results: TestResult[];
}

// ─── Supabase RPC cagirici ──────────────────────────────────────────────────

async function queryMatchFilms(
  vectorString: string,
  limit: number,
  filters?: QualityTestCase['filters'],
): Promise<MatchFilmRow[]> {
  const params: Record<string, unknown> = {
    query_vector: vectorString,
    match_count: limit,
    min_similarity: 0.2,
  };

  if (filters?.directors?.length) {
    // Director filtresi varsa — RPC'de yok, sonra JS'te filtreleriz
  }

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

  if (error) {
    throw new Error(`match_films RPC hatasi: ${error.message}`);
  }

  let results = (data as MatchFilmRow[]) ?? [];

  // JS-side director filter
  if (filters?.directors?.length) {
    const dirLower = filters.directors.map((d: string) => d.toLowerCase());
    const dirFiltered = results.filter((r) =>
      r.director && dirLower.some((d: string) => r.director!.toLowerCase().includes(d)),
    );
    // Yonetmen filtresi sonuc azaltabilir — en az 3 film varsa uygula
    if (dirFiltered.length >= 3) {
      results = dirFiltered;
    }
  }

  return results.slice(0, limit);
}

// ─── Emotion helpers ────────────────────────────────────────────────────────

/** dimensions_json.emotional_state icerisinden en yuksek duyguyu dondurur */
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

/** TasteProfile.emotional_state icerisinden en yuksek duyguyu dondurur */
function getExpectedEmotion(tc: QualityTestCase): string {
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

// ─── Tek test calistirici ───────────────────────────────────────────────────

async function runSingleTest(tc: QualityTestCase): Promise<TestResult> {
  const result: TestResult = {
    test_id: tc.id,
    category: tc.category,
    mood_input: tc.mood_input || '(empty)',
    archetype: tc.archetype,
    passed: false,
    pass_reason: 'none',
    top10_titles: [],
    matched_expected: [],
    matched_forbidden: [],
    match_count: 0,
    required_count: tc.min_top10_matches,
    similarity_range: { min: 0, max: 0 },
  };

  try {
    const vector = tasteProfileToVector(tc.taste_profile);
    const vectorString = `[${vector.join(',')}]`;

    const rows = await queryMatchFilms(vectorString, 30, tc.filters);
    const top10 = rows.slice(0, 10);

    result.top10_titles = top10.map((r) => `${r.title} (${r.year})`);

    if (top10.length > 0) {
      result.similarity_range = {
        min: Math.round(top10[top10.length - 1].similarity * 1000) / 1000,
        max: Math.round(top10[0].similarity * 1000) / 1000,
      };
    }

    // ── Kriter 1: Emotion-based match (gercekci) ──────────────────────
    // Top 10'da similarity >= 0.85 VE dominant_emotion == expected → PASS
    const expectedEmotion = getExpectedEmotion(tc);
    const highSimFilms = top10
      .filter((r) => r.similarity >= 0.85)
      .map((r) => ({
        title: r.title,
        similarity: Math.round(r.similarity * 1000) / 1000,
        dominant_emotion: getDominantEmotion(r.dimensions_json),
      }));

    const emotionMatched = highSimFilms.some(
      (f) => f.dominant_emotion === expectedEmotion,
    );

    result.emotion_match_detail = {
      expected_emotion: expectedEmotion,
      high_sim_films: highSimFilms,
      matched: emotionMatched,
    };

    // ── Kriter 2: Title-based match (eski yontem, bonus) ──────────────
    const top10Lower = top10.map((r) => r.title.toLowerCase());

    for (const expected of tc.expected_films_must_include_any_of) {
      const expLower = expected.toLowerCase();
      if (top10Lower.some((t) => t.includes(expLower) || expLower.includes(t))) {
        result.matched_expected.push(expected);
      }
    }

    // Yasak film eslesmesi — EXACT match (fixes "It" false positive bug)
    for (const forbidden of tc.expected_films_must_not_include) {
      const forbLower = forbidden.toLowerCase();
      if (top10Lower.some((t) => t === forbLower)) {
        result.matched_forbidden.push(forbidden);
      }
    }

    result.match_count = result.matched_expected.length;

    // ── Pass/Fail Logic ───────────────────────────────────────────────
    const forbiddenPass = result.matched_forbidden.length === 0;
    const hasResults = top10.length > 0;
    const titlePass = result.match_count >= tc.min_top10_matches;

    // Edge case'ler icin: min_top10_matches === 0 → sonuc donmesi yeterli
    const isEdgeCase = tc.min_top10_matches === 0;

    if (!hasResults) {
      result.passed = false;
      result.pass_reason = 'none';
    } else if (!forbiddenPass) {
      result.passed = false;
      result.pass_reason = 'none';
    } else if (isEdgeCase) {
      // Edge case: sonuc var + yasak yok = PASS
      result.passed = true;
      result.pass_reason = 'edge_case';
    } else if (emotionMatched) {
      // Birincil kriter: emotion-based match
      result.passed = true;
      result.pass_reason = 'emotion_match';
    } else if (titlePass) {
      // Ikincil kriter: eski title-based match (geriye uyumluluk)
      result.passed = true;
      result.pass_reason = 'title_match';
    } else {
      result.passed = false;
      result.pass_reason = 'none';
    }

  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.passed = false;
  }

  return result;
}

// ─── ANSI renk yardimcilari ─────────────────────────────────────────────────

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
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// ─── Ana calistirici ────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${C.bold}${C.cyan}========================================${C.reset}`);
  console.log(`${C.bold}${C.cyan}  Chosy.ai — Film Oneri Kalite Testi${C.reset}`);
  console.log(`${C.bold}${C.cyan}========================================${C.reset}\n`);
  console.log(`${C.dim}Toplam test vakasi: ${TEST_CASES.length}${C.reset}`);
  console.log(`${C.dim}Supabase: ${SUPABASE_URL.slice(0, 30)}...${C.reset}\n`);

  const results: TestResult[] = [];
  const categoryStats: Record<string, { total: number; passed: number }> = {};

  let skipped = 0;

  for (const tc of TEST_CASES) {
    process.stdout.write(`  ${C.dim}[${tc.category}]${C.reset} ${tc.id} ... `);

    // Skip islemi
    if (tc.skip) {
      skipped++;
      console.log(`${C.yellow}SKIP${C.reset} ${C.dim}(film havuzunda yeterli veri yok)${C.reset}`);
      continue;
    }

    const result = await runSingleTest(tc);
    results.push(result);

    // Kategori istatistigi
    if (!categoryStats[tc.category]) {
      categoryStats[tc.category] = { total: 0, passed: 0 };
    }
    categoryStats[tc.category].total++;
    if (result.passed) categoryStats[tc.category].passed++;

    // Sonuc yazdirma
    if (result.passed) {
      const reasonTag = result.pass_reason === 'emotion_match'
        ? `emotion:${result.emotion_match_detail?.expected_emotion}`
        : result.pass_reason === 'title_match'
          ? `${result.match_count} title match`
          : 'edge_case';
      console.log(`${C.green}PASS${C.reset} ${C.dim}(${reasonTag}, sim: ${result.similarity_range.max})${C.reset}`);
    } else if (result.error) {
      console.log(`${C.red}ERROR${C.reset} ${C.dim}${result.error.slice(0, 60)}${C.reset}`);
    } else {
      const reasons: string[] = [];
      if (result.match_count < result.required_count) {
        reasons.push(`${result.match_count}/${result.required_count} expected`);
      }
      if (result.matched_forbidden.length > 0) {
        reasons.push(`forbidden: ${result.matched_forbidden.join(', ')}`);
      }
      if (result.top10_titles.length === 0) {
        reasons.push('no results');
      }
      console.log(`${C.red}FAIL${C.reset} ${C.dim}(${reasons.join(' | ')})${C.reset}`);
    }
  }

  // ─── Ozet ───────────────────────────────────────────────────────────────────

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const pct = Math.round((passed / results.length) * 100);

  console.log(`\n${C.bold}========================================${C.reset}`);
  console.log(`${C.bold}  Quality Score: ${passed}/${results.length} (${pct}%)${C.reset}`);
  if (skipped > 0) {
    console.log(`${C.dim}  Skipped: ${skipped} test(s)${C.reset}`);
  }
  console.log(`${C.bold}========================================${C.reset}\n`);

  // Kategori bazli
  console.log(`${C.bold}Kategori Bazli:${C.reset}`);
  for (const [cat, stats] of Object.entries(categoryStats)) {
    const catPct = Math.round((stats.passed / stats.total) * 100);
    const color = catPct >= 75 ? C.green : catPct >= 50 ? C.yellow : C.red;
    console.log(`  ${cat.padEnd(12)} ${color}${stats.passed}/${stats.total} (${catPct}%)${C.reset}`);
  }

  // Fail detaylari
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log(`\n${C.bold}${C.red}Basarisiz Vakalar:${C.reset}\n`);
    for (const f of failures) {
      console.log(`  ${C.red}x${C.reset} ${C.bold}${f.test_id}${C.reset}`);
      console.log(`    ${C.dim}Mood: "${f.mood_input}"${C.reset}`);
      console.log(`    ${C.dim}Archetype: ${f.archetype}${C.reset}`);
      if (f.error) {
        console.log(`    ${C.red}Error: ${f.error}${C.reset}`);
      } else {
        console.log(`    ${C.dim}Top 10: ${f.top10_titles.slice(0, 5).join(', ')}${f.top10_titles.length > 5 ? '...' : ''}${C.reset}`);
        if (f.emotion_match_detail) {
          const em = f.emotion_match_detail;
          console.log(`    ${C.yellow}Expected emotion: ${em.expected_emotion} | High-sim films (>=0.85): ${em.high_sim_films.length}${C.reset}`);
          if (em.high_sim_films.length > 0) {
            for (const hsf of em.high_sim_films.slice(0, 3)) {
              console.log(`      ${C.dim}${hsf.title} (sim: ${hsf.similarity}, emo: ${hsf.dominant_emotion})${C.reset}`);
            }
          } else {
            console.log(`      ${C.dim}No films with similarity >= 0.85${C.reset}`);
          }
        }
        if (f.matched_expected.length > 0) {
          console.log(`    ${C.green}Title matched: ${f.matched_expected.join(', ')}${C.reset}`);
        }
        if (f.matched_forbidden.length > 0) {
          console.log(`    ${C.red}Forbidden hit: ${f.matched_forbidden.join(', ')}${C.reset}`);
        }
        console.log(`    ${C.dim}Title match: ${f.match_count}/${f.required_count} | Similarity: ${f.similarity_range.min}-${f.similarity_range.max}${C.reset}`);
      }
      console.log('');
    }
  }

  // ─── JSON rapor kaydet ────────────────────────────────────────────────────

  const report: TestReport = {
    timestamp: new Date().toISOString(),
    total: results.length,
    passed,
    failed,
    score_pct: pct,
    by_category: categoryStats,
    results,
  };

  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(outputDir, `baseline-results-${ts}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');

  console.log(`\n${C.dim}Rapor kaydedildi: ${outputPath}${C.reset}\n`);

  // Exit code — CI icin
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Beklenmedik hata:${C.reset}`, err);
  process.exit(2);
});
