/**
 * Seed Films to Supabase DB — Sprint 1.2
 *
 * Reads data/films-raw.json (2282 enriched films) and UPSERTs into
 * the films table. Creates placeholder film_profiles for new entries.
 * Assigns curation tiers.
 *
 * IMPORTANT: Does NOT truncate — safe for production with existing user data.
 *
 * Usage: npx tsx scripts/seed-films-to-db.ts
 * Env:   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

import { determineCurationTier, type CurationTier } from './assign-tiers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawFilmJSON {
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
  production_countries: string[];
  director: string | null;
  cast: string[];
  keywords: string[];
  imdb_id: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  country: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  oscar_wins: number;
  oscar_nominations: number;
  content_rating: string | null;
}

interface FilmUpsertRow {
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
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  oscar_wins: number;
  oscar_nominations: number;
  content_rating: string | null;
  curation_tier: CurationTier;
  metadata_json: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('ERROR: SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL not set.');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set.');
  process.exit(1);
}

const RAW_PATH = path.join(process.cwd(), 'data', 'films-raw.json');
const BATCH_SIZE = 500;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Progress bar for terminal output */
function printProgress(current: number, total: number, label: string): void {
  const width = 40;
  const filled = Math.round((current / total) * width);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
  const pct = Math.round((current / total) * 100)
    .toString()
    .padStart(3);
  process.stdout.write(`\r[${bar}] ${pct}%  ${label.padEnd(55)}`);
  if (current === total) process.stdout.write('\n');
}

/** Split array into chunks */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/** Extract year from release_date string */
function extractYear(releaseDate: string): number | null {
  if (!releaseDate) return null;
  const year = parseInt(releaseDate.slice(0, 4), 10);
  return isNaN(year) ? null : year;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------

/** Convert raw JSON film to DB upsert row */
function toUpsertRow(film: RawFilmJSON): FilmUpsertRow {
  const tier = determineCurationTier({
    director: film.director,
    imdb_rating: film.imdb_rating,
    imdb_votes: film.imdb_votes,
    metascore: film.metascore,
    oscar_wins: film.oscar_wins,
    oscar_nominations: film.oscar_nominations,
    keywords: film.keywords ?? [],
  });

  return {
    tmdb_id: film.tmdb_id,
    title: film.title,
    original_title: film.original_title,
    original_language: film.original_language,
    overview: film.overview,
    release_date: film.release_date,
    year: extractYear(film.release_date),
    runtime: film.runtime,
    vote_average: film.vote_average,
    genres: film.genres.map((g) => g.name),
    poster_url: film.poster_url,
    backdrop_url: film.backdrop_url,
    director: film.director,
    country: film.country ? [film.country] : null,
    cast: film.cast ?? [],
    tmdb_keywords: film.keywords ?? [],
    imdb_id: film.imdb_id || null, // empty string → null
    imdb_rating: film.imdb_rating,
    imdb_votes: film.imdb_votes,
    metascore: film.metascore,
    oscar_wins: film.oscar_wins ?? 0,
    oscar_nominations: film.oscar_nominations ?? 0,
    content_rating: film.content_rating,
    curation_tier: tier,
    metadata_json: {
      genre_ids: film.genres.map((g) => g.id),
      production_countries: film.production_countries,
      vote_count: film.vote_count,
    },
  };
}

// ---------------------------------------------------------------------------
// Seed: films table
// ---------------------------------------------------------------------------

async function seedFilms(
  supabase: SupabaseClient,
  rows: FilmUpsertRow[],
): Promise<{ inserted: number; updated: number; idMap: Map<number, string> }> {
  console.log(`\n--- Seeding ${rows.length} films into films table ---`);

  // Get existing tmdb_ids to track insert vs update
  const existingTmdbIds = new Set<number>();
  const tmdbIdBatches = chunk(
    rows.map((r) => r.tmdb_id),
    500,
  );

  for (const batch of tmdbIdBatches) {
    const { data } = await supabase
      .from('films')
      .select('tmdb_id')
      .in('tmdb_id', batch);
    if (data) {
      for (const row of data) {
        existingTmdbIds.add(row.tmdb_id as number);
      }
    }
  }

  let processed = 0;
  const batches = chunk(rows, BATCH_SIZE);

  for (const batch of batches) {
    const { error } = await supabase
      .from('films')
      .upsert(batch, { onConflict: 'tmdb_id' });

    if (error) {
      throw new Error(`films upsert error: ${error.message}`);
    }

    processed += batch.length;
    printProgress(processed, rows.length, `films — ${processed}/${rows.length}`);
  }

  // Fetch tmdb_id → UUID mapping
  const idMap = new Map<number, string>();
  const allTmdbIds = rows.map((r) => r.tmdb_id);

  for (const batch of chunk(allTmdbIds, 500)) {
    const { data, error } = await supabase
      .from('films')
      .select('id, tmdb_id')
      .in('tmdb_id', batch);

    if (error) throw new Error(`films UUID fetch error: ${error.message}`);
    for (const row of data ?? []) {
      idMap.set(row.tmdb_id as number, row.id as string);
    }
  }

  const inserted = rows.filter((r) => !existingTmdbIds.has(r.tmdb_id)).length;
  const updated = rows.length - inserted;

  console.log(`  Inserted: ${inserted} | Updated: ${updated} | Mapped: ${idMap.size}`);
  return { inserted, updated, idMap };
}

// ---------------------------------------------------------------------------
// Seed: film_profiles placeholders
// ---------------------------------------------------------------------------

async function seedPlaceholderProfiles(
  supabase: SupabaseClient,
  idMap: Map<number, string>,
): Promise<number> {
  console.log(`\n--- Checking film_profiles for missing entries ---`);

  // Get existing film_ids in film_profiles
  const existingProfileIds = new Set<string>();
  const uuids = [...idMap.values()];

  for (const batch of chunk(uuids, 500)) {
    const { data } = await supabase
      .from('film_profiles')
      .select('film_id')
      .in('film_id', batch);

    if (data) {
      for (const row of data) {
        existingProfileIds.add(row.film_id as string);
      }
    }
  }

  // Find films without profiles
  const missingIds = uuids.filter((id) => !existingProfileIds.has(id));
  console.log(`  Existing profiles: ${existingProfileIds.size}`);
  console.log(`  Missing profiles: ${missingIds.length}`);

  if (missingIds.length === 0) {
    console.log('  No placeholder profiles needed.');
    return 0;
  }

  // Insert placeholder rows (no vector, no dimensions)
  const placeholders = missingIds.map((filmId) => ({
    film_id: filmId,
    profile_vector: null,
    dimensions_json: null,
  }));

  let inserted = 0;
  const batches = chunk(placeholders, BATCH_SIZE);

  for (const batch of batches) {
    const { error } = await supabase
      .from('film_profiles')
      .upsert(batch, { onConflict: 'film_id' });

    if (error) {
      throw new Error(`film_profiles placeholder error: ${error.message}`);
    }

    inserted += batch.length;
    printProgress(
      inserted,
      placeholders.length,
      `film_profiles placeholders — ${inserted}/${placeholders.length}`,
    );
  }

  return inserted;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('MoodFlix — Film Seed Script (Sprint 1.2)');
  console.log('=========================================');

  // Read data
  if (!fs.existsSync(RAW_PATH)) {
    console.error(`ERROR: ${RAW_PATH} not found. Run fetch-films first.`);
    process.exit(1);
  }

  const rawFilms: RawFilmJSON[] = JSON.parse(
    fs.readFileSync(RAW_PATH, 'utf-8'),
  );
  console.log(`Loaded ${rawFilms.length} films from films-raw.json`);

  // Transform
  const rows = rawFilms.map(toUpsertRow);

  // Tier stats
  const tierStats: Record<CurationTier, number> = { core: 0, extended: 0, archive: 0 };
  for (const row of rows) {
    tierStats[row.curation_tier]++;
  }
  console.log(`\nTier distribution (pre-seed):`);
  console.log(`  Core:     ${tierStats.core} (${((tierStats.core / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  Extended: ${tierStats.extended} (${((tierStats.extended / rows.length) * 100).toFixed(1)}%)`);
  console.log(`  Archive:  ${tierStats.archive} (${((tierStats.archive / rows.length) * 100).toFixed(1)}%)`);

  // Supabase client
  const supabase = createClient(
    SUPABASE_URL as string,
    SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );

  // NOTE: tr_title is NOT in FilmUpsertRow, so UPSERT won't overwrite it.
  // Migration 029 backfills tr_title from Turkish titles before this runs.
  // The search_vector trigger (029) also fires on every UPSERT, rebuilding
  // the full-text index automatically.

  // Seed films
  const { inserted, updated, idMap } = await seedFilms(supabase, rows);

  // Seed placeholder profiles
  const placeholderCount = await seedPlaceholderProfiles(supabase, idMap);

  // Final stats
  console.log('\n=========================================');
  console.log('SEED COMPLETE');
  console.log('=========================================');
  console.log(`Total films processed: ${rows.length}`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`Tier distribution:`);
  console.log(`  Core:     ${tierStats.core}`);
  console.log(`  Extended: ${tierStats.extended}`);
  console.log(`  Archive:  ${tierStats.archive}`);
  console.log(`Placeholder profiles created: ${placeholderCount}`);
  console.log(`Profile vectors empty (Sprint 2 re-profile): ${placeholderCount}`);
}

main().catch((err: unknown) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
