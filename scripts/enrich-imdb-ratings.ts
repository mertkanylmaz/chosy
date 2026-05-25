/**
 * MoodFlix — OMDb IMDb Rating Enricher
 *
 * Enriches films-raw.json with real IMDb ratings, votes, Metascore,
 * Oscar data, and content ratings from OMDb API.
 *
 * Usage:
 *   npm run enrich:imdb               # Resume from where it left off
 *   npm run enrich:imdb -- --all       # Re-fetch all films
 *   npm run enrich:imdb -- --resume    # Same as default — skip already enriched
 *   npm run enrich:imdb -- --only-missing  # Only films with null imdb_rating
 *   npm run enrich:imdb -- --dry-run   # Show plan without making requests
 *   npm run enrich:imdb -- --filter-only   # Skip fetching, just run quality filter
 *
 * Env: OMDB_API_KEY (get free at https://www.omdbapi.com/apikey.aspx)
 *
 * Free tier: 1,000 req/day. Patreon $1/mo: 100,000 req/day.
 * For 2,300+ films, the Patreon tier finishes in ~10 minutes.
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  initOmdbKey,
  omdbGet,
  parseOmdbResponse,
  getCallCount,
  type ImdbEnrichment,
} from './lib/omdb-client';

// ─── ANSI helpers ────────────────────────────────────────────────────────────
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
  bgYellow: '\x1b[43m',
};

// ─── Paths ───────────────────────────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), 'data');
const FILMS_PATH = path.join(DATA_DIR, 'films-raw.json');
const ERRORS_PATH = path.join(DATA_DIR, 'imdb-fetch-errors.json');
const FILTERED_PATH = path.join(DATA_DIR, 'films-filtered-out.json');
const STATS_PATH = path.join(DATA_DIR, 'imdb-enrich-stats.json');

// ─── Quality thresholds ─────────────────────────────────────────────────────
const MIN_IMDB_RATING = 6.0;
const MIN_IMDB_VOTES = 1000;

// ─── Types ───────────────────────────────────────────────────────────────────
interface Film {
  tmdb_id: number;
  title: string;
  imdb_id?: string;
  vote_average?: number;
  vote_count?: number;
  imdb_rating?: number | null;
  imdb_votes?: number | null;
  metascore?: number | null;
  oscar_wins?: number;
  oscar_nominations?: number;
  content_rating?: string | null;
  [key: string]: unknown;
}

interface FetchError {
  tmdb_id: number;
  title: string;
  imdb_id: string;
  error: string;
  timestamp: string;
}

interface FilteredFilm extends Film {
  filter_reason: string;
}

// ─── CLI args ────────────────────────────────────────────────────────────────
type Mode = 'all' | 'resume' | 'only-missing' | 'dry-run' | 'filter-only';

function parseArgs(): Mode {
  const args = process.argv.slice(2);
  if (args.includes('--all')) return 'all';
  if (args.includes('--only-missing')) return 'only-missing';
  if (args.includes('--dry-run')) return 'dry-run';
  if (args.includes('--filter-only')) return 'filter-only';
  return 'resume'; // default
}

// ─── Progress bar ────────────────────────────────────────────────────────────
function progressBar(current: number, total: number, width = 30): string {
  const pct = total > 0 ? current / total : 0;
  const filled = Math.round(pct * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  return `[${bar}] ${current}/${total} (${(pct * 100).toFixed(1)}%)`;
}

// ─── Auto-save interval (every 50 films) ─────────────────────────────────────
const AUTOSAVE_INTERVAL = 50;

// ─── Main ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const mode = parseArgs();

  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║   MoodFlix — OMDb IMDb Enricher     ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════╝${c.reset}\n`);
  console.log(`${c.dim}Mode: ${mode}${c.reset}\n`);

  // Load films
  if (!fs.existsSync(FILMS_PATH)) {
    console.error(`${c.red}ERROR: ${FILMS_PATH} not found. Run fetch:films first.${c.reset}`);
    process.exit(1);
  }

  const films: Film[] = JSON.parse(fs.readFileSync(FILMS_PATH, 'utf-8'));
  console.log(`${c.cyan}Loaded ${films.length} films from films-raw.json${c.reset}`);

  // Load existing errors (to append, not overwrite)
  let errors: FetchError[] = [];
  if (fs.existsSync(ERRORS_PATH)) {
    errors = JSON.parse(fs.readFileSync(ERRORS_PATH, 'utf-8'));
  }

  // ── Filter-only mode: skip fetching, just apply quality filter ──────────
  if (mode === 'filter-only') {
    applyQualityFilter(films, errors);
    return;
  }

  // ── Determine which films to fetch ──────────────────────────────────────
  let toFetch: Film[];

  if (mode === 'all') {
    toFetch = films.filter(f => f.imdb_id);
  } else if (mode === 'only-missing') {
    toFetch = films.filter(f => f.imdb_id && (f.imdb_rating === undefined || f.imdb_rating === null));
  } else {
    // resume: skip films that already have imdb_rating set (not undefined)
    toFetch = films.filter(f => f.imdb_id && f.imdb_rating === undefined);
  }

  const noImdbId = films.filter(f => !f.imdb_id);
  console.log(`${c.dim}Films without imdb_id: ${noImdbId.length} (skipped)${c.reset}`);
  console.log(`${c.cyan}Films to fetch: ${toFetch.length}${c.reset}\n`);

  if (mode === 'dry-run') {
    console.log(`${c.yellow}DRY RUN — no API calls will be made.${c.reset}`);
    console.log(`Would fetch ${toFetch.length} films from OMDb.`);
    console.log(`Estimated time: ~${Math.ceil(toFetch.length * 0.2 / 60)} minutes (at 5 req/sec)`);
    return;
  }

  if (toFetch.length === 0) {
    console.log(`${c.green}All films already enriched! Running quality filter...${c.reset}\n`);
    applyQualityFilter(films, errors);
    return;
  }

  // ── Init OMDb API ───────────────────────────────────────────────────────
  initOmdbKey();

  // ── Build lookup map for fast access ────────────────────────────────────
  const filmMap = new Map<string, Film>();
  for (const film of films) {
    if (film.imdb_id) filmMap.set(film.imdb_id, film);
  }

  // ── Fetch loop ──────────────────────────────────────────────────────────
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let i = 0; i < toFetch.length; i++) {
    const film = toFetch[i];
    const imdbId = film.imdb_id!;

    // Progress
    if (i % 10 === 0 || i === toFetch.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = i > 0 ? i / elapsed : 0;
      const eta = rate > 0 ? Math.ceil((toFetch.length - i) / rate) : 0;
      process.stdout.write(
        `\r${c.dim}${progressBar(i + 1, toFetch.length)} ` +
        `| ${rate.toFixed(1)} req/s | ETA: ${eta}s${c.reset}  `
      );
    }

    const data = await omdbGet(imdbId);

    if (!data) {
      failCount++;
      errors.push({
        tmdb_id: film.tmdb_id,
        title: film.title,
        imdb_id: imdbId,
        error: 'OMDb returned null (not found or network error)',
        timestamp: new Date().toISOString(),
      });
      // Mark as checked so resume skips it
      film.imdb_rating = null;
      continue;
    }

    const enrichment: ImdbEnrichment = parseOmdbResponse(data);

    // Merge enrichment into film object (preserve existing TMDb fields)
    film.imdb_rating = enrichment.imdb_rating;
    film.imdb_votes = enrichment.imdb_votes;
    film.metascore = enrichment.metascore;
    film.oscar_wins = enrichment.oscar_wins;
    film.oscar_nominations = enrichment.oscar_nominations;
    film.content_rating = enrichment.content_rating;

    successCount++;

    // Autosave every N films
    if ((i + 1) % AUTOSAVE_INTERVAL === 0) {
      fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2));
      fs.writeFileSync(ERRORS_PATH, JSON.stringify(errors, null, 2));
    }
  }

  // Final newline after progress bar
  console.log('\n');

  // ── Save enriched data ─────────────────────────────────────────────────
  fs.writeFileSync(FILMS_PATH, JSON.stringify(films, null, 2));
  fs.writeFileSync(ERRORS_PATH, JSON.stringify(errors, null, 2));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`${c.green}Enrichment complete in ${elapsed}s${c.reset}`);
  console.log(`  ${c.green}Success: ${successCount}${c.reset}`);
  console.log(`  ${c.red}Failed:  ${failCount}${c.reset}`);
  console.log(`  ${c.dim}API calls: ${getCallCount()}${c.reset}\n`);

  // ── Apply quality filter ────────────────────────────────────────────────
  applyQualityFilter(films, errors);
}

// ─── Quality Filter ──────────────────────────────────────────────────────────
function applyQualityFilter(allFilms: Film[], errors: FetchError[]): void {
  console.log(`${c.bold}${c.magenta}── Quality Filter ──${c.reset}\n`);

  const kept: Film[] = [];
  const filtered: FilteredFilm[] = [];

  // Load existing filtered films (from previous runs) to not lose them
  let previousFiltered: FilteredFilm[] = [];
  if (fs.existsSync(FILTERED_PATH)) {
    previousFiltered = JSON.parse(fs.readFileSync(FILTERED_PATH, 'utf-8'));
  }

  for (const film of allFilms) {
    // Films without IMDb data — keep them (might be too new for OMDb)
    if (film.imdb_rating === undefined) {
      kept.push(film);
      continue;
    }

    // Films where OMDb returned nothing (null) — keep with warning
    if (film.imdb_rating === null) {
      kept.push(film);
      continue;
    }

    // Low rating filter
    if (film.imdb_rating < MIN_IMDB_RATING) {
      filtered.push({
        ...film,
        filter_reason: `imdb_rating ${film.imdb_rating} < ${MIN_IMDB_RATING}`,
      });
      continue;
    }

    // Low votes filter
    if (film.imdb_votes !== null && film.imdb_votes !== undefined && film.imdb_votes < MIN_IMDB_VOTES) {
      filtered.push({
        ...film,
        filter_reason: `imdb_votes ${film.imdb_votes} < ${MIN_IMDB_VOTES}`,
      });
      continue;
    }

    kept.push(film);
  }

  // Combine with previously filtered films (avoid duplicates)
  const filteredIds = new Set(filtered.map(f => f.tmdb_id));
  for (const prev of previousFiltered) {
    if (!filteredIds.has(prev.tmdb_id)) {
      filtered.push(prev);
    }
  }

  // Save
  fs.writeFileSync(FILMS_PATH, JSON.stringify(kept, null, 2));
  fs.writeFileSync(FILTERED_PATH, JSON.stringify(filtered, null, 2));

  // ── Stats ──────────────────────────────────────────────────────────────
  const lowRating = filtered.filter(f => f.filter_reason.includes('imdb_rating'));
  const lowVotes = filtered.filter(f => f.filter_reason.includes('imdb_votes'));
  const noImdbId = allFilms.filter(f => !f.imdb_id).length;
  const omdbNotFound = errors.length;

  const stats = {
    timestamp: new Date().toISOString(),
    total_input: allFilms.length,
    enriched_success: allFilms.filter(f => f.imdb_rating !== undefined && f.imdb_rating !== null).length,
    enriched_null: allFilms.filter(f => f.imdb_rating === null).length,
    no_imdb_id: noImdbId,
    omdb_not_found: omdbNotFound,
    filtered_low_rating: lowRating.length,
    filtered_low_votes: lowVotes.length,
    total_filtered: filtered.length,
    net_kept: kept.length,
  };

  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2));

  console.log(`${c.cyan}  Total input:              ${stats.total_input}${c.reset}`);
  console.log(`${c.green}  Enriched (with rating):   ${stats.enriched_success}${c.reset}`);
  console.log(`${c.yellow}  Enriched (null/no data):  ${stats.enriched_null}${c.reset}`);
  console.log(`${c.dim}  No imdb_id:               ${stats.no_imdb_id}${c.reset}`);
  console.log(`${c.red}  OMDb 404 errors:          ${stats.omdb_not_found}${c.reset}`);
  console.log(`${c.red}  Filtered (rating < 6.0):  ${stats.filtered_low_rating}${c.reset}`);
  console.log(`${c.red}  Filtered (votes < 1000):  ${stats.filtered_low_votes}${c.reset}`);
  console.log(`${c.magenta}  Total filtered out:       ${stats.total_filtered}${c.reset}`);
  console.log(`${c.bgGreen}${c.white}  NET KEPT (production):    ${stats.net_kept} ${c.reset}\n`);

  // Top 10 highest rated
  const rated = kept
    .filter(f => typeof f.imdb_rating === 'number')
    .sort((a, b) => (b.imdb_rating ?? 0) - (a.imdb_rating ?? 0))
    .slice(0, 10);

  if (rated.length > 0) {
    console.log(`${c.bold}Top 10 IMDb Ratings:${c.reset}`);
    for (const film of rated) {
      const oscars = film.oscar_wins ? ` | ${film.oscar_wins} Oscar(s)` : '';
      console.log(`  ${c.yellow}${film.imdb_rating}${c.reset} — ${film.title} (${film.release_date?.slice(0, 4)})${oscars}`);
    }
    console.log('');
  }

  // Sample filtered
  if (filtered.length > 0) {
    console.log(`${c.dim}Sample filtered out (first 5):${c.reset}`);
    for (const film of filtered.slice(0, 5)) {
      console.log(`  ${c.dim}${film.title} — ${film.filter_reason}${c.reset}`);
    }
    console.log('');
  }

  console.log(`${c.green}Done! Files updated:${c.reset}`);
  console.log(`  ${c.dim}${FILMS_PATH}${c.reset}`);
  console.log(`  ${c.dim}${FILTERED_PATH}${c.reset}`);
  console.log(`  ${c.dim}${STATS_PATH}${c.reset}`);
}

// ─── Run ─────────────────────────────────────────────────────────────────────
main().catch(err => {
  console.error(`${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
