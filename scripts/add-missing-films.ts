/**
 * Catalog Expansion — Find & add missing popular films
 *
 * 3 sources:
 *   A) TMDb top_rated (≈260 films, ~13 pages)
 *   B) Manually curated franchise/classic IDs
 *   C) Box office hits 2021-2026 (5 pages = 100 films)
 *
 * Pipeline: detect missing → fetch details → upsert to films + placeholder film_profiles
 *
 * Usage:
 *   npx tsx scripts/add-missing-films.ts                # full run
 *   npx tsx scripts/add-missing-films.ts --dry-run      # detect only, no DB writes
 *   npx tsx scripts/add-missing-films.ts --skip-profile  # skip ai-profile step at end
 *
 * Env: TMDB_API_KEY or EXPO_PUBLIC_TMDB_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import {
  initCredentials,
  tmdbGet,
  getCallCount,
  type TmdbMovieDetail,
  type TmdbDiscoverResponse,
} from './lib/tmdb-client';

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
};

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/original';
const BATCH_SIZE = 100;

/** Manually curated franchise/classic tmdb_ids to check */
const FRANCHISE_IDS: number[] = [
  45243,   // The Hangover Part II
  107846,  // The Hangover Part III
  1452,    // The Beach
  2502,    // The Bourne Supremacy
  49040,   // The Bourne Legacy
  324668,  // Jason Bourne
  142145,  // Only God Forgives
  153,     // Lost in Translation
  1422,    // The Departed
  769,     // Goodfellas
  680,     // Pulp Fiction
  550,     // Fight Club
  27205,   // Inception
  155,     // The Dark Knight
  496243,  // Parasite
  670,     // Oldboy
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface TMDbTopRatedResponse {
  page: number;
  results: Array<{ id: number; title: string }>;
  total_pages: number;
}

interface FilmInsertRow {
  tmdb_id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  release_date: string;
  year: number | null;
  runtime: number | null;
  vote_average: number;
  genres: string[];
  poster_url: string | null;
  backdrop_url: string | null;
  director: string | null;
  country: string[] | null;
  cast: string[];
  tmdb_keywords: string[];
  imdb_id: string | null;
  imdb_rating: null; // intentionally NULL — we don't write TMDB score here
  imdb_votes: number | null; // TMDB vote_count as proxy
  metascore: null;
  oscar_wins: number;
  oscar_nominations: number;
  content_rating: null;
  curation_tier: string;
  metadata_json: Record<string, unknown>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function log(msg: string): void {
  console.log(`${c.dim}[add-missing]${c.reset} ${msg}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Determine curation tier based on TMDB vote data (no IMDb available for new films) */
function assignTier(voteCount: number, voteAverage: number): string {
  if (voteCount >= 100000) return 'core';
  if (voteCount >= 50000 && voteAverage >= 7.0) return 'core';
  if (voteCount >= 25000) return 'extended';
  return 'archive';
}

/** Transform TMDb detail to our DB row */
function detailToRow(detail: TmdbMovieDetail): FilmInsertRow {
  const directors = detail.credits.crew
    .filter((cr) => cr.job === 'Director')
    .map((cr) => cr.name);

  const cast = detail.credits.cast
    .sort((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((a) => a.name);

  const keywords = detail.keywords.keywords.map((k) => k.name);
  const countries = detail.production_countries.map((pc) => pc.iso_3166_1);
  const year = detail.release_date
    ? parseInt(detail.release_date.slice(0, 4), 10) || null
    : null;

  return {
    tmdb_id: detail.id,
    title: detail.title,
    original_title: detail.original_title,
    original_language: detail.original_language,
    overview: detail.overview,
    release_date: detail.release_date ?? '',
    year,
    runtime: detail.runtime,
    vote_average: detail.vote_average,
    genres: detail.genres.map((g) => g.name),
    poster_url: detail.poster_path ? `${TMDB_IMAGE_BASE}${detail.poster_path}` : null,
    backdrop_url: detail.backdrop_path ? `${TMDB_IMAGE_BASE}${detail.backdrop_path}` : null,
    director: directors[0] ?? null,
    country: countries.length > 0 ? countries : null,
    cast,
    tmdb_keywords: keywords,
    imdb_id: detail.external_ids?.imdb_id ?? null,
    imdb_rating: null, // intentionally NULL — not TMDB score
    imdb_votes: detail.vote_count, // TMDB vote_count as proxy
    metascore: null,
    oscar_wins: 0,
    oscar_nominations: 0,
    content_rating: null,
    curation_tier: assignTier(detail.vote_count, detail.vote_average),
    metadata_json: {
      genre_ids: detail.genres.map((g) => g.id),
      production_countries: countries,
      vote_count: detail.vote_count,
      source: 'add-missing-films',
      added_at: new Date().toISOString(),
    },
  };
}

// ─── Source A: TMDb Top Rated ────────────────────────────────────────────────

async function fetchTopRatedIds(): Promise<number[]> {
  log(`${c.cyan}Source A: TMDb Top Rated${c.reset}`);
  const ids: number[] = [];

  for (let page = 1; page <= 13; page++) {
    const data = await tmdbGet<TMDbTopRatedResponse>('/movie/top_rated', {
      page: String(page),
    });
    for (const m of data.results) {
      ids.push(m.id);
    }
    if (page % 5 === 0) log(`  Page ${page}/13 — ${ids.length} IDs collected`);
  }

  log(`  ${c.green}✓${c.reset} Collected ${ids.length} top rated IDs`);
  return ids;
}

// ─── Source C: Box Office 2021-2026 ──────────────────────────────────────────

async function fetchBoxOfficeIds(): Promise<number[]> {
  log(`${c.cyan}Source C: Box Office 2021-2026${c.reset}`);
  const ids: number[] = [];

  for (let page = 1; page <= 5; page++) {
    const data = await tmdbGet<TmdbDiscoverResponse>('/discover/movie', {
      sort_by: 'revenue.desc',
      'primary_release_date.gte': '2021-01-01',
      page: String(page),
    });
    for (const m of data.results) {
      ids.push(m.id);
    }
  }

  log(`  ${c.green}✓${c.reset} Collected ${ids.length} box office IDs`);
  return ids;
}

// ─── DB Check: which tmdb_ids are already in our films table? ────────────────

async function getExistingTmdbIds(sb: SupabaseClient): Promise<Set<number>> {
  log('Fetching existing tmdb_ids from DB...');
  const existing = new Set<number>();

  // Paginate through all films
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await sb
      .from('films')
      .select('tmdb_id')
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`DB query error: ${error.message}`);

    if (data) {
      for (const row of data) {
        if (row.tmdb_id != null) existing.add(row.tmdb_id as number);
      }
    }

    hasMore = (data?.length ?? 0) === pageSize;
    from += pageSize;
  }

  log(`  ${c.green}✓${c.reset} Found ${existing.size} existing films in DB`);
  return existing;
}

// ─── Fetch full details for missing IDs ──────────────────────────────────────

async function fetchFilmDetails(tmdbIds: number[]): Promise<{
  rows: FilmInsertRow[];
  errors: Array<{ tmdb_id: number; error: string }>;
}> {
  const rows: FilmInsertRow[] = [];
  const errors: Array<{ tmdb_id: number; error: string }> = [];

  for (let i = 0; i < tmdbIds.length; i++) {
    const tmdbId = tmdbIds[i];

    try {
      const detail = await tmdbGet<TmdbMovieDetail>(
        `/movie/${tmdbId}`,
        { append_to_response: 'credits,keywords,external_ids' },
      );

      // Skip adult content
      if (detail.adult) continue;

      // Skip films with no poster or extremely short
      if (!detail.poster_path) continue;
      if (detail.runtime !== null && detail.runtime < 60) continue;

      rows.push(detailToRow(detail));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ tmdb_id: tmdbId, error: msg });
    }

    if ((i + 1) % 20 === 0 || i === tmdbIds.length - 1) {
      log(`  Enriched ${i + 1}/${tmdbIds.length} — ${rows.length} valid, ${errors.length} errors`);
    }
  }

  return { rows, errors };
}

// ─── Upsert to DB ────────────────────────────────────────────────────────────

async function upsertFilms(
  sb: SupabaseClient,
  rows: FilmInsertRow[],
): Promise<{ inserted: number }> {
  let total = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await sb
      .from('films')
      .upsert(batch, { onConflict: 'tmdb_id' });

    if (error) throw new Error(`Films upsert error: ${error.message}`);
    total += batch.length;
    log(`  Upserted batch: ${total}/${rows.length}`);
  }

  return { inserted: total };
}

/** Create placeholder film_profiles for newly added films */
async function createPlaceholderProfiles(
  sb: SupabaseClient,
  tmdbIds: number[],
): Promise<number> {
  // Get UUIDs for the inserted films
  const uuidMap = new Map<number, string>();

  for (let i = 0; i < tmdbIds.length; i += 500) {
    const batch = tmdbIds.slice(i, i + 500);
    const { data, error } = await sb
      .from('films')
      .select('id, tmdb_id')
      .in('tmdb_id', batch);

    if (error) throw new Error(`UUID fetch error: ${error.message}`);
    for (const row of data ?? []) {
      uuidMap.set(row.tmdb_id as number, row.id as string);
    }
  }

  // Check which already have profiles
  const uuids = [...uuidMap.values()];
  const existingProfiles = new Set<string>();

  for (let i = 0; i < uuids.length; i += 500) {
    const batch = uuids.slice(i, i + 500);
    const { data } = await sb
      .from('film_profiles')
      .select('film_id')
      .in('film_id', batch);

    for (const row of data ?? []) {
      existingProfiles.add(row.film_id as string);
    }
  }

  // Insert missing placeholders
  const missing = uuids.filter((id) => !existingProfiles.has(id));
  if (missing.length === 0) return 0;

  const placeholders = missing.map((filmId) => ({
    film_id: filmId,
    profile_vector: null,
    dimensions_json: null,
  }));

  for (let i = 0; i < placeholders.length; i += BATCH_SIZE) {
    const batch = placeholders.slice(i, i + BATCH_SIZE);
    const { error } = await sb
      .from('film_profiles')
      .upsert(batch, { onConflict: 'film_id' });

    if (error) throw new Error(`Profile placeholder error: ${error.message}`);
  }

  return missing.length;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    `\n${c.bold}${c.magenta}` +
    `╔════════════════════════════════════════╗\n` +
    `║  MoodFlix — Add Missing Films Script   ║\n` +
    `╚════════════════════════════════════════╝${c.reset}\n`,
  );

  const isDryRun = process.argv.includes('--dry-run');

  // Init TMDB
  initCredentials();

  // Init Supabase
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
    process.exit(1);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Step 1: Get existing tmdb_ids from DB
  const existing = await getExistingTmdbIds(sb);

  // Step 2: Collect candidate IDs from all 3 sources
  const topRatedIds = await fetchTopRatedIds();
  const franchiseIds = FRANCHISE_IDS;
  const boxOfficeIds = await fetchBoxOfficeIds();

  // Deduplicate
  const allCandidates = new Set<number>([...topRatedIds, ...franchiseIds, ...boxOfficeIds]);

  // Find missing
  const missingIds = [...allCandidates].filter((id) => !existing.has(id));

  // Stats by source
  const missingTopRated = topRatedIds.filter((id) => !existing.has(id));
  const missingFranchise = franchiseIds.filter((id) => !existing.has(id));
  const missingBoxOffice = boxOfficeIds.filter((id) => !existing.has(id));

  console.log(`\n${c.bold}═══ Missing Film Report ═══${c.reset}`);
  console.log(`  DB total:          ${existing.size}`);
  console.log(`  Candidates total:  ${allCandidates.size} (deduped)`);
  console.log(`  ${c.yellow}Missing total:     ${missingIds.length}${c.reset}`);
  console.log(`    Top Rated:       ${missingTopRated.length} / ${topRatedIds.length}`);
  console.log(`    Franchise/Classic: ${missingFranchise.length} / ${franchiseIds.length}`);
  console.log(`    Box Office:      ${missingBoxOffice.length} / ${boxOfficeIds.length}`);

  // Show franchise check details
  console.log(`\n${c.bold}Franchise/Classic check:${c.reset}`);
  for (const id of franchiseIds) {
    const status = existing.has(id) ? `${c.green}✓ exists${c.reset}` : `${c.red}✗ MISSING${c.reset}`;
    console.log(`  tmdb_id ${String(id).padEnd(8)} ${status}`);
  }

  if (missingIds.length === 0) {
    log(`${c.green}All films already in catalog! Nothing to do.${c.reset}`);
    return;
  }

  if (missingIds.length > 500) {
    log(`${c.red}⚠ ${missingIds.length} missing films — exceeds 500 limit. Capping at 500.${c.reset}`);
    missingIds.splice(500);
  }

  if (isDryRun) {
    log(`${c.yellow}DRY RUN — no DB writes. Would add ${missingIds.length} films.${c.reset}`);
    log(`API calls made: ${getCallCount()}`);
    return;
  }

  // Step 3: Fetch full details for missing films
  log(`\n${c.cyan}Fetching details for ${missingIds.length} missing films...${c.reset}`);
  const { rows, errors } = await fetchFilmDetails(missingIds);

  if (errors.length > 0) {
    log(`${c.yellow}${errors.length} fetch errors:${c.reset}`);
    for (const e of errors.slice(0, 10)) {
      log(`  ${c.dim}tmdb_id ${e.tmdb_id}: ${e.error}${c.reset}`);
    }
  }

  if (rows.length === 0) {
    log(`${c.red}No valid films to add.${c.reset}`);
    return;
  }

  // Show first 20 films to add
  console.log(`\n${c.bold}Films to add (showing first 20):${c.reset}`);
  for (const row of rows.slice(0, 20)) {
    console.log(
      `  ${c.dim}${row.tmdb_id}${c.reset} ${row.title} (${row.year}) — ` +
      `${row.vote_average}/10, ${row.imdb_votes} votes → ${c.cyan}${row.curation_tier}${c.reset}`,
    );
  }
  if (rows.length > 20) {
    console.log(`  ${c.dim}... and ${rows.length - 20} more${c.reset}`);
  }

  // Tier distribution
  const tierCounts = { core: 0, extended: 0, archive: 0 };
  for (const row of rows) {
    const tier = row.curation_tier as keyof typeof tierCounts;
    if (tier in tierCounts) tierCounts[tier]++;
  }
  console.log(`\n${c.bold}Tier distribution of new films:${c.reset}`);
  console.log(`  Core:     ${tierCounts.core}`);
  console.log(`  Extended: ${tierCounts.extended}`);
  console.log(`  Archive:  ${tierCounts.archive}`);

  // Step 4: Upsert to DB
  log(`\n${c.cyan}Upserting ${rows.length} films to DB...${c.reset}`);
  const { inserted } = await upsertFilms(sb, rows);
  log(`${c.green}✓ ${inserted} films upserted${c.reset}`);

  // Step 5: Create placeholder profiles
  log(`Creating placeholder profiles...`);
  const addedTmdbIds = rows.map((r) => r.tmdb_id);
  const placeholders = await createPlaceholderProfiles(sb, addedTmdbIds);
  log(`${c.green}✓ ${placeholders} placeholder profiles created${c.reset}`);

  // Summary
  console.log(
    `\n${c.bold}${c.green}` +
    `╔════════════════════════════════════════╗\n` +
    `║           EXPANSION COMPLETE           ║\n` +
    `╚════════════════════════════════════════╝${c.reset}\n`,
  );
  console.log(`  Films added:       ${inserted}`);
  console.log(`  Profiles created:  ${placeholders}`);
  console.log(`  Fetch errors:      ${errors.length}`);
  console.log(`  API calls:         ${getCallCount()}`);
  console.log(`\n  ${c.yellow}NEXT: Run ai-profile-films.ts --only-missing to generate vectors${c.reset}`);
}

main().catch((err: unknown) => {
  console.error(`\n${c.red}Fatal error:${c.reset}`, err);
  process.exit(1);
});
