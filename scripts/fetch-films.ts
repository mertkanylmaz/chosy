/**
 * MoodFlix — TMDb Film Fetcher v2
 *
 * 3-phase pipeline:
 *   Phase A — Discovery: Collect unique tmdb_id pool (3,000–4,000 films)
 *   Phase B — Enrichment: Full metadata via /movie/{id}?append_to_response=...
 *   Phase C — Validation: Quality filters, stats, JSON output
 *
 * Usage:
 *   npm run fetch:films -- --fresh          # Start from scratch
 *   npm run fetch:films -- --resume         # Skip already-fetched IDs
 *   npm run fetch:films -- --only-enrichment # Skip discovery, enrich existing ID list
 *   npm run fetch:films -- --dry-run        # Show plan without making requests
 *
 * Env: TMDB_API_KEY or TMDB_READ_ACCESS_TOKEN
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  initCredentials,
  tmdbGet,
  getCallCount,
  type TmdbDiscoverResponse,
  type TmdbPersonCredits,
  type TmdbMovieDetail,
} from './lib/tmdb-client';
import { DISCOVERY_QUERIES, type DiscoveryQuery } from './lib/discovery-queries';
import { AUTEUR_DIRECTORS } from './lib/auteur-directors';

// ─── ANSI helpers (no chalk dependency) ─────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
};

// ─── Output paths ───────────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_RAW = path.join(DATA_DIR, 'films-raw.json');
const OUTPUT_ERRORS = path.join(DATA_DIR, 'films-fetch-errors.json');
const OUTPUT_STATS = path.join(DATA_DIR, 'films-fetch-stats.json');

// ─── Types ──────────────────────────────────────────────────────────────────

/** Enriched film record written to films-raw.json */
export interface EnrichedFilm {
  tmdb_id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  /** Primary country ISO code (e.g. "US", "FR") — first production country */
  country: string | null;
  /** All production country ISO codes */
  production_countries: string[];
  director: string | null;
  cast: string[];
  keywords: string[];
  imdb_id: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
}

interface FetchError {
  tmdb_id: number;
  error: string;
  phase: 'enrichment';
}

type FilterReason =
  | 'low_vote_count'
  | 'low_rating'
  | 'short_runtime'
  | 'no_poster'
  | 'adult_content';

interface FetchStats {
  started_at: string;
  finished_at: string;
  duration_seconds: number;
  discovery: {
    queries_run: number;
    auteur_directors_queried: number;
    raw_ids_collected: number;
    unique_ids_after_dedup: number;
  };
  enrichment: {
    attempted: number;
    successful: number;
    filtered: Record<FilterReason, number>;
    errors: number;
  };
  api_calls_total: number;
}

// ─── CLI args ───────────────────────────────────────────────────────────────

type RunMode = 'fresh' | 'resume' | 'only-enrichment' | 'dry-run';

function parseMode(): RunMode {
  const args = process.argv.slice(2);
  if (args.includes('--fresh')) return 'fresh';
  if (args.includes('--resume')) return 'resume';
  if (args.includes('--only-enrichment')) return 'only-enrichment';
  if (args.includes('--dry-run')) return 'dry-run';
  return 'fresh'; // default
}

// ─── Logging helpers ────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`${c.dim}[fetch]${c.reset} ${msg}`);
}

function logPhase(phase: string): void {
  console.log(`\n${c.bold}${c.cyan}━━━ ${phase} ━━━${c.reset}\n`);
}

function progressBar(current: number, total: number, label: string): void {
  const width = 30;
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(pct * width);
  const bar = `${c.green}${'█'.repeat(filled)}${c.dim}${'░'.repeat(width - filled)}${c.reset}`;
  const pctStr = `${Math.round(pct * 100)}%`.padStart(4);
  process.stdout.write(`\r  ${bar} ${pctStr}  ${label.slice(0, 50).padEnd(50)}`);
  if (current === total) process.stdout.write('\n');
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function printETA(started: number, current: number, total: number): void {
  if (current === 0) return;
  const elapsed = (Date.now() - started) / 1000;
  const perItem = elapsed / current;
  const remaining = perItem * (total - current);
  log(
    `${c.dim}Progress: ${current}/${total} — ` +
      `ETA: ${formatDuration(remaining)} — ` +
      `Elapsed: ${formatDuration(elapsed)}${c.reset}`,
  );
}

// ─── Phase A: Discovery ─────────────────────────────────────────────────────

/**
 * Run a single /discover/movie query, collecting up to `target` unique IDs.
 */
async function runDiscoverQuery(
  query: DiscoveryQuery,
  seenIds: Set<number>,
): Promise<number[]> {
  const collected: number[] = [];
  let page = 1;

  const first = await tmdbGet<TmdbDiscoverResponse>('/discover/movie', {
    ...query.params,
    page: '1',
  });
  const maxPages = Math.min(first.total_pages, 500); // TMDb caps at 500

  for (const m of first.results) {
    if (!seenIds.has(m.id) && !m.adult) {
      seenIds.add(m.id);
      collected.push(m.id);
    }
  }
  page++;

  while (collected.length < query.target && page <= maxPages) {
    const data = await tmdbGet<TmdbDiscoverResponse>('/discover/movie', {
      ...query.params,
      page: String(page),
    });

    for (const m of data.results) {
      if (!seenIds.has(m.id) && !m.adult) {
        seenIds.add(m.id);
        collected.push(m.id);
      }
    }
    page++;

    if (data.results.length === 0) break; // no more results
  }

  return collected.slice(0, query.target);
}

/**
 * Fetch all directed films for a single director via /person/{id}/movie_credits.
 */
async function fetchDirectorFilmIds(
  personId: number,
  seenIds: Set<number>,
): Promise<number[]> {
  try {
    const credits = await tmdbGet<TmdbPersonCredits>(
      `/person/${personId}/movie_credits`,
    );

    const directedIds: number[] = [];
    for (const crew of credits.crew) {
      if (crew.job === 'Director' && !seenIds.has(crew.id)) {
        seenIds.add(crew.id);
        directedIds.push(crew.id);
      }
    }
    return directedIds;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`${c.yellow}⚠ Failed to fetch credits for person ${personId}: ${msg}${c.reset}`);
    return [];
  }
}

/**
 * Phase A: Build the full unique tmdb_id pool.
 */
async function phaseDiscovery(): Promise<{
  ids: number[];
  rawCount: number;
  queriesRun: number;
  auteursQueried: number;
}> {
  logPhase('PHASE A — Discovery');

  const seenIds = new Set<number>();
  let rawCount = 0;
  let queriesRun = 0;

  // 1) Discovery queries
  log(`Running ${DISCOVERY_QUERIES.length} discovery queries...`);

  for (const query of DISCOVERY_QUERIES) {
    const ids = await runDiscoverQuery(query, seenIds);
    rawCount += ids.length;
    queriesRun++;
    log(
      `  ${c.green}✓${c.reset} ${query.label}: ${c.bold}${ids.length}${c.reset} new IDs ` +
        `(pool: ${seenIds.size})`,
    );
  }

  // 2) Auteur directors filmographies
  log(`\nFetching filmographies for ${AUTEUR_DIRECTORS.length} auteur directors...`);

  let auteursQueried = 0;
  for (let i = 0; i < AUTEUR_DIRECTORS.length; i++) {
    const dir = AUTEUR_DIRECTORS[i];
    const ids = await fetchDirectorFilmIds(dir.tmdbPersonId, seenIds);
    rawCount += ids.length;
    auteursQueried++;

    if ((i + 1) % 10 === 0 || i === AUTEUR_DIRECTORS.length - 1) {
      log(
        `  ${c.dim}Directors: ${i + 1}/${AUTEUR_DIRECTORS.length} — ` +
          `pool: ${seenIds.size}${c.reset}`,
      );
    }
  }

  const uniqueIds = Array.from(seenIds);
  log(
    `\n${c.bold}${c.green}Discovery complete:${c.reset} ` +
      `${rawCount} raw → ${c.bold}${uniqueIds.length}${c.reset} unique IDs`,
  );

  return {
    ids: uniqueIds,
    rawCount,
    queriesRun,
    auteursQueried,
  };
}

// ─── Phase B: Enrichment ────────────────────────────────────────────────────

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';

/**
 * Transform TMDb detail response into our enriched film format.
 */
function transformDetail(detail: TmdbMovieDetail): EnrichedFilm {
  const directors = detail.credits.crew
    .filter((c) => c.job === 'Director')
    .map((c) => c.name);

  const cast = detail.credits.cast
    .sort((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((c) => c.name);

  const keywords = detail.keywords.keywords.map((k) => k.name);

  const countries = detail.production_countries.map((c) => c.iso_3166_1);

  return {
    tmdb_id: detail.id,
    title: detail.title,
    original_title: detail.original_title,
    original_language: detail.original_language,
    overview: detail.overview,
    release_date: detail.release_date,
    runtime: detail.runtime,
    vote_average: detail.vote_average,
    vote_count: detail.vote_count,
    genres: detail.genres.map((g) => ({ id: g.id, name: g.name })),
    country: countries[0] ?? null,
    production_countries: countries,
    director: directors[0] ?? null,
    cast,
    keywords,
    imdb_id: detail.external_ids?.imdb_id ?? null,
    poster_url: detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : null,
    backdrop_url: detail.backdrop_path
      ? `${TMDB_IMAGE_BASE}${detail.backdrop_path}`
      : null,
  };
}

/**
 * Apply quality filters. Returns filter reason or null if film passes.
 */
function applyQualityFilter(film: EnrichedFilm): FilterReason | null {
  if (film.vote_count < 100) return 'low_vote_count';
  if (film.vote_average < 6.0) return 'low_rating';
  if (film.runtime !== null && film.runtime < 60) return 'short_runtime';
  if (!film.poster_url) return 'no_poster';
  return null;
}

/**
 * Phase B+C: Enrich each ID and validate.
 */
async function phaseEnrichment(
  ids: number[],
  existingFilms: Map<number, EnrichedFilm>,
): Promise<{
  films: EnrichedFilm[];
  errors: FetchError[];
  filterCounts: Record<FilterReason, number>;
}> {
  logPhase('PHASE B — Enrichment + Validation');

  const films: EnrichedFilm[] = [];
  const errors: FetchError[] = [];
  const filterCounts: Record<FilterReason, number> = {
    low_vote_count: 0,
    low_rating: 0,
    short_runtime: 0,
    no_poster: 0,
    adult_content: 0,
  };

  // Filter out already-fetched IDs (resume mode)
  const toFetch = ids.filter((id) => !existingFilms.has(id));
  const skipped = ids.length - toFetch.length;

  if (skipped > 0) {
    log(`Skipping ${skipped} already-enriched films (resume mode)`);
  }
  log(`Enriching ${c.bold}${toFetch.length}${c.reset} films...\n`);

  const startTime = Date.now();

  for (let i = 0; i < toFetch.length; i++) {
    const tmdbId = toFetch[i];

    try {
      const detail = await tmdbGet<TmdbMovieDetail>(
        `/movie/${tmdbId}`,
        { append_to_response: 'credits,keywords,external_ids' },
      );

      // Skip adult content at API level
      if (detail.adult) {
        filterCounts.adult_content++;
        continue;
      }

      const film = transformDetail(detail);
      const filterReason = applyQualityFilter(film);

      if (filterReason) {
        filterCounts[filterReason]++;
      } else {
        films.push(film);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ tmdb_id: tmdbId, error: msg, phase: 'enrichment' });
    }

    // Progress logging every 50 films
    if ((i + 1) % 50 === 0 || i === toFetch.length - 1) {
      progressBar(i + 1, toFetch.length, `${films.length} passed, ${errors.length} errors`);
      printETA(startTime, i + 1, toFetch.length);
    }
  }

  log(
    `\n${c.bold}${c.green}Enrichment complete:${c.reset} ` +
      `${c.green}${films.length} passed${c.reset}, ` +
      `${c.yellow}${Object.values(filterCounts).reduce((a, b) => a + b, 0)} filtered${c.reset}, ` +
      `${c.red}${errors.length} errors${c.reset}`,
  );

  // Log filter breakdown
  for (const [reason, count] of Object.entries(filterCounts)) {
    if (count > 0) {
      log(`  ${c.dim}${reason}: ${count}${c.reset}`);
    }
  }

  return { films, errors, filterCounts };
}

// ─── File I/O ───────────────────────────────────────────────────────────────

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadExistingFilms(): Map<number, EnrichedFilm> {
  const map = new Map<number, EnrichedFilm>();
  if (fs.existsSync(OUTPUT_RAW)) {
    try {
      const data = JSON.parse(fs.readFileSync(OUTPUT_RAW, 'utf-8')) as EnrichedFilm[];
      for (const f of data) {
        map.set(f.tmdb_id, f);
      }
      log(`Loaded ${map.size} existing films from ${OUTPUT_RAW}`);
    } catch {
      log(`${c.yellow}⚠ Could not parse existing films-raw.json, starting fresh${c.reset}`);
    }
  }
  return map;
}

/**
 * Extract tmdb_ids from existing films-raw.json for --only-enrichment mode.
 * Falls back to empty array if file doesn't exist.
 */
function loadExistingIds(): number[] {
  if (fs.existsSync(OUTPUT_RAW)) {
    try {
      const data = JSON.parse(fs.readFileSync(OUTPUT_RAW, 'utf-8')) as EnrichedFilm[];
      return data.map((f) => f.tmdb_id);
    } catch {
      return [];
    }
  }
  return [];
}

function writeOutput(
  films: EnrichedFilm[],
  errors: FetchError[],
  stats: FetchStats,
): void {
  ensureDataDir();

  fs.writeFileSync(OUTPUT_RAW, JSON.stringify(films, null, 2), 'utf-8');
  log(`${c.green}✓${c.reset} Wrote ${films.length} films → ${OUTPUT_RAW}`);

  fs.writeFileSync(OUTPUT_ERRORS, JSON.stringify(errors, null, 2), 'utf-8');
  log(`${c.green}✓${c.reset} Wrote ${errors.length} errors → ${OUTPUT_ERRORS}`);

  fs.writeFileSync(OUTPUT_STATS, JSON.stringify(stats, null, 2), 'utf-8');
  log(`${c.green}✓${c.reset} Wrote stats → ${OUTPUT_STATS}`);
}

// ─── Dry Run ────────────────────────────────────────────────────────────────

function dryRun(): void {
  logPhase('DRY RUN — Plan Preview');

  log(`${c.bold}Discovery Queries:${c.reset}`);
  let totalTarget = 0;
  for (const q of DISCOVERY_QUERIES) {
    log(`  • ${q.label}: target ${q.target} films`);
    totalTarget += q.target;
  }
  log(`  ${c.dim}Subtotal target: ~${totalTarget}${c.reset}`);

  log(`\n${c.bold}Auteur Directors:${c.reset} ${AUTEUR_DIRECTORS.length} directors`);
  for (const d of AUTEUR_DIRECTORS) {
    log(`  • ${d.name} (TMDb ID: ${d.tmdbPersonId})`);
  }

  log(
    `\n${c.bold}Estimated total:${c.reset} ~${totalTarget + AUTEUR_DIRECTORS.length * 15} raw IDs ` +
      `→ ~3,000–4,000 unique after dedup`,
  );
  log(
    `${c.bold}Estimated time:${c.reset} ~25–40 min ` +
      `(discovery ~5 min + enrichment ~20–35 min at 3 req/s)`,
  );
  log(`\n${c.bold}Output:${c.reset}`);
  log(`  • ${OUTPUT_RAW}`);
  log(`  • ${OUTPUT_ERRORS}`);
  log(`  • ${OUTPUT_STATS}`);

  log(`\n${c.yellow}No requests made (dry run).${c.reset}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `\n${c.bold}${c.magenta}` +
      `╔══════════════════════════════════════╗\n` +
      `║   MoodFlix — TMDb Film Fetcher v2    ║\n` +
      `╚══════════════════════════════════════╝${c.reset}\n`,
  );

  const mode = parseMode();
  log(`Mode: ${c.bold}${mode}${c.reset}`);

  // Dry run: just show the plan
  if (mode === 'dry-run') {
    dryRun();
    return;
  }

  // Init credentials
  initCredentials();

  const startedAt = new Date();
  ensureDataDir();

  // Load existing data for resume mode
  const existingFilms =
    mode === 'resume' ? loadExistingFilms() : new Map<number, EnrichedFilm>();

  // Phase A: Discovery
  let discoveryIds: number[];
  let discoveryRawCount = 0;
  let discoveryQueriesRun = 0;
  let discoveryAuteursQueried = 0;

  if (mode === 'only-enrichment') {
    // Skip discovery, use existing IDs
    discoveryIds = loadExistingIds();
    if (discoveryIds.length === 0) {
      log(
        `${c.red}✗ No existing IDs found in ${OUTPUT_RAW}. ` +
          `Run with --fresh first.${c.reset}`,
      );
      process.exit(1);
    }
    log(`Using ${discoveryIds.length} existing IDs for enrichment`);
  } else {
    const discovery = await phaseDiscovery();
    discoveryIds = discovery.ids;
    discoveryRawCount = discovery.rawCount;
    discoveryQueriesRun = discovery.queriesRun;
    discoveryAuteursQueried = discovery.auteursQueried;
  }

  // Phase B + C: Enrichment + Validation
  const { films: newFilms, errors, filterCounts } = await phaseEnrichment(
    discoveryIds,
    existingFilms,
  );

  // Merge with existing (for resume mode)
  const allFilms = new Map<number, EnrichedFilm>(existingFilms);
  for (const f of newFilms) {
    allFilms.set(f.tmdb_id, f);
  }
  const finalFilms = Array.from(allFilms.values());

  // Build stats
  const finishedAt = new Date();
  const durationSeconds = (finishedAt.getTime() - startedAt.getTime()) / 1000;

  const stats: FetchStats = {
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    duration_seconds: Math.round(durationSeconds),
    discovery: {
      queries_run: discoveryQueriesRun,
      auteur_directors_queried: discoveryAuteursQueried,
      raw_ids_collected: discoveryRawCount,
      unique_ids_after_dedup: discoveryIds.length,
    },
    enrichment: {
      attempted: discoveryIds.length - existingFilms.size,
      successful: newFilms.length,
      filtered: filterCounts,
      errors: errors.length,
    },
    api_calls_total: getCallCount(),
  };

  // Write output
  logPhase('PHASE C — Output');
  writeOutput(finalFilms, errors, stats);

  // Summary
  console.log(
    `\n${c.bold}${c.green}` +
      `╔══════════════════════════════════════╗\n` +
      `║            FETCH COMPLETE            ║\n` +
      `╚══════════════════════════════════════╝${c.reset}\n`,
  );
  log(`Total films:     ${c.bold}${finalFilms.length}${c.reset}`);
  log(`New this run:    ${c.bold}${newFilms.length}${c.reset}`);
  log(`Errors:          ${c.bold}${errors.length}${c.reset}`);
  log(`API calls:       ${c.bold}${getCallCount()}${c.reset}`);
  log(`Duration:        ${c.bold}${formatDuration(durationSeconds)}${c.reset}`);
}

main().catch((err: unknown) => {
  console.error(`\n${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
