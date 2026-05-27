#!/usr/bin/env tsx
/**
 * Chosy.ai — Comprehensive Film Metadata Enrichment (TASK 1.2)
 *
 * Enriches NULL fields in films table from TMDb:
 *   - director        (crew → job === "Director")
 *   - country         (production_countries → ISO 3166-1 array)
 *   - cast            (top 3 actor names, comma-separated string)
 *   - cast_json       (top 5 actors with name + profile_url)
 *   - tmdb_keywords   (keywords array)
 *   - imdb_id         (external_ids → imdb_id)
 *   - original_language (original_language from movie detail)
 *
 * Usage:
 *   npx tsx scripts/enrich-films-metadata.ts              # Only NULL fields
 *   npx tsx scripts/enrich-films-metadata.ts --dry-run    # Preview, no DB writes
 *   npx tsx scripts/enrich-films-metadata.ts --force      # Re-fetch all
 *
 * Safety:
 *   - Idempotent: only updates NULL fields per film (existing data untouched)
 *   - 100+ consecutive errors → stops and asks
 *   - Error log saved to data/enrichment-errors-<timestamp>.json
 *   - Rate limit: ~3 req/sec with 429 backoff (30s)
 */

import { initCredentials, tmdbGet, getCallCount, TmdbMovieDetail } from './lib/tmdb-client';

// ─── Manual .env loading ─────────────────────────────────────────────────────
import * as path from 'path';
import * as fs from 'fs';

function loadEnvFile(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile();

// ─── Supabase ────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('\x1b[31m[HATA] SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.\x1b[0m');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE_MODE = process.argv.includes('--force');
const MAX_CAST_JSON = 5;
const MAX_CAST_STRING = 3;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';
const BATCH_SIZE = 25;
const MAX_CONSECUTIVE_ERRORS = 100;
const PROGRESS_INTERVAL = 50;

// ─── Types ───────────────────────────────────────────────────────────────────

interface FilmRow {
  id: string;
  tmdb_id: number;
  title: string;
  director: string | null;
  country: string[] | null;
  cast: string[] | null;
  cast_json: unknown[] | null;
  tmdb_keywords: string[] | null;
  imdb_id: string | null;
  original_language: string | null;
}

interface FilmUpdate {
  id: string;
  [key: string]: unknown;
}

interface ErrorEntry {
  tmdb_id: number;
  title: string;
  error: string;
  timestamp: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function printProgress(current: number, total: number, title: string): void {
  const width = 40;
  const filled = Math.round((current / total) * width);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
  const pct = Math.round((current / total) * 100).toString().padStart(3);
  process.stdout.write(`\r[${bar}] ${pct}%  ${title.slice(0, 40).padEnd(40)}`);
  if (current === total) process.stdout.write('\n');
}

// ─── TMDb Data Extraction ────────────────────────────────────────────────────

function extractDirector(crew: TmdbMovieDetail['credits']['crew']): string | null {
  return crew.find((m) => m.job === 'Director')?.name ?? null;
}

function extractCountries(countries: TmdbMovieDetail['production_countries']): string[] {
  return countries.map((c) => c.iso_3166_1);
}

function extractCastArray(cast: TmdbMovieDetail['credits']['cast']): string[] | null {
  const names = cast.slice(0, MAX_CAST_STRING).map((c) => c.name);
  return names.length > 0 ? names : null;
}

function extractCastJson(cast: TmdbMovieDetail['credits']['cast']): Array<{ name: string; profile_url: string | null }> {
  return cast.slice(0, MAX_CAST_JSON).map((m) => ({
    name: m.name,
    profile_url: m.profile_path ? `${TMDB_IMAGE_BASE}${m.profile_path}` : null,
  }));
}

function extractKeywords(keywords: TmdbMovieDetail['keywords']): string[] {
  return (keywords?.keywords ?? []).map((k) => k.name);
}

// ─── Core: Build update object (only NULL fields) ────────────────────────────

function buildUpdate(film: FilmRow, detail: TmdbMovieDetail): FilmUpdate | null {
  const update: FilmUpdate = { id: film.id };
  let hasChanges = false;

  // Director
  if (film.director === null || FORCE_MODE) {
    const director = extractDirector(detail.credits?.crew ?? []);
    if (director) {
      update.director = director;
      hasChanges = true;
    }
  }

  // Country
  if (film.country === null || FORCE_MODE) {
    const countries = extractCountries(detail.production_countries ?? []);
    if (countries.length > 0) {
      update.country = countries;
      hasChanges = true;
    }
  }

  // Cast (string)
  if (film.cast === null || FORCE_MODE) {
    const castArr = extractCastArray(detail.credits?.cast ?? []);
    if (castArr) {
      update.cast = castArr;
      hasChanges = true;
    }
  }

  // Cast JSON
  if (film.cast_json === null || FORCE_MODE) {
    const castJson = extractCastJson(detail.credits?.cast ?? []);
    if (castJson.length > 0) {
      update.cast_json = castJson;
      hasChanges = true;
    }
  }

  // Keywords
  if (film.tmdb_keywords === null || FORCE_MODE) {
    const keywords = extractKeywords(detail.keywords);
    if (keywords.length > 0) {
      update.tmdb_keywords = keywords;
      hasChanges = true;
    }
  }

  // IMDb ID
  if (film.imdb_id === null || FORCE_MODE) {
    const imdbId = detail.external_ids?.imdb_id ?? null;
    if (imdbId) {
      update.imdb_id = imdbId;
      hasChanges = true;
    }
  }

  // Original language
  if (film.original_language === null || FORCE_MODE) {
    const lang = detail.original_language ?? null;
    if (lang) {
      update.original_language = lang;
      hasChanges = true;
    }
  }

  return hasChanges ? update : null;
}

// ─── DB Operations ───────────────────────────────────────────────────────────

async function fetchFilmsToEnrich(): Promise<FilmRow[]> {
  // Fetch all films — we filter per-field in buildUpdate
  // But if not --force, only get films that have at least one NULL field
  const selectFields = 'id, tmdb_id, title, director, country, cast, cast_json, tmdb_keywords, imdb_id, original_language';

  if (FORCE_MODE) {
    const { data, error } = await supabase
      .from('films')
      .select(selectFields)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Query error: ${error.message}`);
    return data as FilmRow[];
  }

  // Get films with ANY null field
  // Supabase doesn't support OR on .is() chains directly, so we query all and filter client-side
  const { data, error } = await supabase
    .from('films')
    .select(selectFields)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Query error: ${error.message}`);

  const allFilms = data as FilmRow[];
  return allFilms.filter((f) =>
    f.director === null ||
    f.country === null ||
    f.cast === null ||
    f.cast_json === null ||
    f.tmdb_keywords === null ||
    f.imdb_id === null ||
    f.original_language === null
  );
}

async function applyUpdate(update: FilmUpdate): Promise<void> {
  const { id, ...fields } = update;
  const { error } = await supabase.from('films').update(fields).eq('id', id);
  if (error) throw new Error(`DB update error (${id}): ${error.message}`);
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n\x1b[36m========================================\x1b[0m');
  console.log('\x1b[36m  Chosy.ai — Film Metadata Enrichment   \x1b[0m');
  console.log('\x1b[36m========================================\x1b[0m\n');

  if (DRY_RUN) console.log('\x1b[33m[DRY RUN] No DB writes will be made.\x1b[0m\n');
  if (FORCE_MODE) console.log('\x1b[33m[FORCE] All films will be re-fetched.\x1b[0m\n');

  initCredentials();

  // 1. Fetch films to enrich
  console.log('Querying films to enrich...');
  const films = await fetchFilmsToEnrich();

  if (films.length === 0) {
    console.log('\x1b[32mAll films already enriched. Nothing to do.\x1b[0m');
    return;
  }

  console.log(`\x1b[1m${films.length} films\x1b[0m to process.\n`);

  // 2. Process films
  const startTime = Date.now();
  let processed = 0;
  let updated = 0;
  let unchanged = 0;
  let errorCount = 0;
  let consecutiveErrors = 0;
  const errors: ErrorEntry[] = [];

  // Field-level counters
  const fieldCounts: Record<string, number> = {
    director: 0,
    country: 0,
    cast: 0,
    cast_json: 0,
    tmdb_keywords: 0,
    imdb_id: 0,
    original_language: 0,
  };

  const pendingUpdates: FilmUpdate[] = [];

  const flushBatch = async (): Promise<void> => {
    if (DRY_RUN || pendingUpdates.length === 0) {
      pendingUpdates.length = 0;
      return;
    }
    for (const u of pendingUpdates) {
      await applyUpdate(u);
    }
    pendingUpdates.length = 0;
  };

  for (let i = 0; i < films.length; i++) {
    const film = films[i];
    printProgress(i + 1, films.length, film.title);

    try {
      // Fetch from TMDb with credits + keywords + external_ids
      const detail = await tmdbGet<TmdbMovieDetail>(
        `/movie/${film.tmdb_id}`,
        { append_to_response: 'credits,keywords,external_ids' },
      );

      const update = buildUpdate(film, detail);

      if (update) {
        // Count field-level updates
        for (const key of Object.keys(update)) {
          if (key !== 'id' && fieldCounts[key] !== undefined) {
            fieldCounts[key]++;
          }
        }
        pendingUpdates.push(update);
        updated++;
      } else {
        unchanged++;
      }

      consecutiveErrors = 0;
    } catch (err) {
      errorCount++;
      consecutiveErrors++;

      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push({
        tmdb_id: film.tmdb_id,
        title: film.title,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      });

      process.stderr.write(
        `\n  \x1b[31m[ERR]\x1b[0m tmdb_id=${film.tmdb_id} (${film.title}): ${errorMsg}\n`,
      );

      // Safety stop
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        console.error(`\n\x1b[31m[STOP] ${MAX_CONSECUTIVE_ERRORS} consecutive errors. Aborting.\x1b[0m`);
        await flushBatch();
        break;
      }
    }

    processed++;

    // Batch flush
    if (pendingUpdates.length >= BATCH_SIZE) {
      await flushBatch();
    }

    // Progress log
    if (processed % PROGRESS_INTERVAL === 0) {
      const elapsed = ((Date.now() - startTime) / 60000).toFixed(1);
      process.stdout.write(
        `\n  \x1b[36m[${elapsed}m]\x1b[0m ${processed}/${films.length}` +
        ` | updated: ${updated} | errors: ${errorCount}\n`,
      );
    }
  }

  // Final flush
  await flushBatch();

  // 3. Stats
  const durationMin = ((Date.now() - startTime) / 60000).toFixed(1);
  const apiCalls = getCallCount();

  console.log('\n\x1b[36m========================================\x1b[0m');
  console.log('\x1b[36m  ENRICHMENT COMPLETE                   \x1b[0m');
  console.log('\x1b[36m========================================\x1b[0m\n');
  console.log(`  Total processed : ${processed}`);
  console.log(`  Updated         : ${updated}`);
  console.log(`  Unchanged       : ${unchanged}`);
  console.log(`  Errors          : ${errorCount}`);
  console.log(`  API calls       : ${apiCalls}`);
  console.log(`  Duration        : ${durationMin} minutes`);
  console.log('');
  console.log('  Field updates:');
  for (const [field, count] of Object.entries(fieldCounts)) {
    console.log(`    ${field.padEnd(20)}: ${count}`);
  }

  // 4. Save error log
  if (errors.length > 0) {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const errorFile = path.join(
      dataDir,
      `enrichment-errors-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`,
    );
    fs.writeFileSync(errorFile, JSON.stringify(errors, null, 2));
    console.log(`\n  Error log: ${errorFile}`);
  }

  // 5. Output JSON stats for baseline recording
  const stats = {
    total_processed: processed,
    updates: updated,
    unchanged,
    failed: errorCount,
    duration_minutes: parseFloat(durationMin),
    api_calls: apiCalls,
    field_updates: fieldCounts,
  };
  console.log('\n\x1b[2m--- JSON STATS ---\x1b[0m');
  console.log(JSON.stringify(stats));
}

main().then(() => process.exit(0)).catch((err: unknown) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
