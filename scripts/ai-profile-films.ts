/**
 * AI Film Profiling Script — Anthropic Claude (Haiku 4.5)
 *
 * Replaces rule-based keyword profiling with AI-generated emotional DNA.
 * Each film gets a 12-dimension TasteProfile from Claude Haiku 4.5,
 * then encoded to a 384-dim vector via vectorEncoder (Single Source of Truth).
 *
 * Usage:
 *   npx tsx scripts/ai-profile-films.ts                  # all films
 *   npx tsx scripts/ai-profile-films.ts --only-missing   # skip already AI-profiled
 *   npx tsx scripts/ai-profile-films.ts --film-id=278    # single film (tmdb_id)
 *   npx tsx scripts/ai-profile-films.ts --dry-run        # plan only, no API calls
 *   npx tsx scripts/ai-profile-films.ts --force           # re-profile everything
 *   npx tsx scripts/ai-profile-films.ts --from-db        # DB'den oku: profile_vector NULL
 *                                                        # veya hiç profil satırı olmayan filmler
 *
 * --from-db notu: films-raw.json yalnızca ilk seed'deki filmleri içerir.
 * sync-trending ile sonradan eklenen filmler o dosyada YOKTUR, dolayısıyla
 * --only-missing onları göremez. --from-db girdiyi doğrudan films tablosundan
 * alır ve bu boşluğu kapatır.
 *
 * Env: ANTHROPIC_API_KEY, SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

import { tasteProfileToVector, type TasteProfile } from '../services/vectorEncoder';

// Prompt + dogrulama + model/surum etiketleri TEK KAYNAK: bu modul Edge
// Function tarafiyla ortaktir. Detay: services/filmProfilePrompt.ts
import {
  CLAUDE_MODEL,
  PROFILING_METHOD,
  PROFILING_SYSTEM_PROMPT,
  buildPrompt,
  validateAndConvert,
  type RawFilmJSON,
  type LLMProfileResponse,
} from '../services/filmProfilePrompt';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfilingError {
  tmdb_id: number;
  title: string;
  error: string;
  timestamp: string;
}

/** CLI flags. */
interface Flags {
  onlyMissing: boolean;
  filmId: number | null;
  dryRun: boolean;
  force: boolean;
  fromDb: boolean;
}

interface ProfilingStats {
  total_films: number;
  profiled: number;
  failed: number;
  skipped: number;
  total_api_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  total_duration_seconds: number;
  avg_latency_ms: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BATCH_CONCURRENCY = 5;    // 5 parallel requests — Claude handles it fine
const BATCH_DELAY_MS = 400;     // 400ms between batches
const MAX_RETRIES = 3;          // Only real errors count, rate limits don't
const MAX_RATE_LIMIT_RETRIES = 50;
const RATE_LIMIT_FALLBACK_MS = 5_000;
const PROGRESS_INTERVAL = 50;

const INPUT_PATH = path.join(process.cwd(), 'data', 'films-raw.json');
const ERRORS_PATH = path.join(process.cwd(), 'data', 'profiling-errors.json');
const STATS_PATH = path.join(process.cwd(), 'data', 'profiling-stats.json');

// Claude Haiku 4.5 pricing (per million tokens)
const CLAUDE_INPUT_PRICE = 0.80;
const CLAUDE_OUTPUT_PRICE = 4.00;

// ---------------------------------------------------------------------------
// Prompt · dogrulama · model/surum -> services/filmProfilePrompt.ts
//
// CLAUDE_MODEL · PROFILING_METHOD · PROFILING_SYSTEM_PROMPT · buildPrompt()
// · validateAndConvert() bu dosyadan TASINDI. Tek kaynak olmalari sart:
// supabase/functions/profile-missing-films ayni modulu import ediyor ve
// ayrisirlarsa ayni havuzda iki farkli vektor dagilimi dogar.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Claude API (Anthropic SDK)
// ---------------------------------------------------------------------------

/**
 * Calls Claude Haiku 4.5 to profile a single film.
 * Returns validated TasteProfile + reasoning, or throws.
 */
async function profileFilmWithAI(
  client: Anthropic,
  film: RawFilmJSON,
): Promise<{
  profile: TasteProfile;
  reasoning: string;
  inputTokens: number;
  outputTokens: number;
}> {
  const userPrompt = buildPrompt(film);

  const message = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system: PROFILING_SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: userPrompt },
    ],
  });

  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;

  // Extract text content
  const textBlock = message.content.find((b) => b.type === 'text');
  const content = textBlock?.type === 'text' ? textBlock.text : '';
  if (!content) {
    throw new Error('No text content in Claude response');
  }

  // Parse JSON — handle ```json fences as safety net
  let jsonStr = content.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  let parsed: LLMProfileResponse;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`JSON parse failed: ${jsonStr.slice(0, 200)}`);
  }

  const { profile, reasoning } = validateAndConvert(parsed, film);

  return { profile, reasoning, inputTokens, outputTokens };
}

/**
 * Extracts wait time from a rate limit error.
 * Reads retry-after from Anthropic error headers or message body.
 */
function getWaitInfo(err: unknown): { waitMs: number; isDailyLimit: boolean } {
  let serverSecs: number | null = null;

  // Check for Anthropic API error with headers
  if (err instanceof Anthropic.RateLimitError) {
    const headers = err.headers as Record<string, string> | undefined;
    const retryAfter = headers?.['retry-after'];
    if (retryAfter) {
      const secs = parseFloat(retryAfter);
      if (!isNaN(secs) && secs > 0) serverSecs = secs;
    }
  }

  // Parse error message for "try again in X.XXXs" or "retry-after" patterns
  if (serverSecs === null) {
    const msg = err instanceof Error ? err.message : String(err);
    const match = msg.match(/try again in (\d+\.?\d*)s/i)
      ?? msg.match(/retry.after[:\s]+(\d+\.?\d*)/i);
    if (match) {
      const secs = parseFloat(match[1]);
      if (!isNaN(secs) && secs > 0) serverSecs = secs;
    }
  }

  if (serverSecs !== null) {
    const isDailyLimit = serverSecs > 60;
    return {
      waitMs: Math.ceil(serverSecs * 1000) + 2000,
      isDailyLimit,
    };
  }

  return { waitMs: RATE_LIMIT_FALLBACK_MS, isDailyLimit: false };
}

/**
 * Profiles a single film with retry logic.
 * Rate limits (429) do NOT count against maxRetries — we wait patiently.
 * Only real errors (parse failures, validation, network) consume retries.
 */
async function profileWithRetry(
  client: Anthropic,
  film: RawFilmJSON,
  maxRetries: number,
): Promise<{
  profile: TasteProfile;
  reasoning: string;
  inputTokens: number;
  outputTokens: number;
} | null> {
  let realAttempt = 0;
  let rateLimitHits = 0;

  while (realAttempt < maxRetries) {
    try {
      return await profileFilmWithAI(client, film);
    } catch (err: unknown) {
      const isRateLimit = err instanceof Anthropic.RateLimitError;
      const isOverloaded = err instanceof Anthropic.APIError
        && (err.status === 529 || err.status === 503);

      if (isRateLimit) {
        rateLimitHits++;
        if (rateLimitHits > MAX_RATE_LIMIT_RETRIES) {
          console.error(`\n  Too many rate limits (${rateLimitHits}) for "${film.title}" — giving up.`);
          return null;
        }

        const { waitMs, isDailyLimit } = getWaitInfo(err);

        if (isDailyLimit) {
          const waitMin = Math.ceil(waitMs / 60_000);
          console.warn(
            `\n  DAILY LIMIT HIT on "${film.title}"` +
            `\n     Auto-resuming in ~${waitMin} minutes (${new Date(Date.now() + waitMs).toLocaleTimeString()})...` +
            `\n     Script will continue automatically — safe to leave running.\n`
          );
        } else {
          console.warn(
            `\n  Rate limited on "${film.title}" (hit #${rateLimitHits}) — waiting ${(waitMs / 1000).toFixed(1)}s...`
          );
        }

        await sleep(waitMs);
        continue;
      }

      if (isOverloaded) {
        console.warn(`\n  API overloaded on "${film.title}" — waiting 15s...`);
        await sleep(15_000);
        continue;
      }

      // Real error — counts against retries
      realAttempt++;
      const errMsg = err instanceof Error ? err.message : String(err);
      if (realAttempt < maxRetries) {
        console.warn(`\n  Retry ${realAttempt}/${maxRetries} for "${film.title}": ${errMsg}`);
        await sleep(3000 * realAttempt);
      } else {
        console.error(`\n  FAILED after ${maxRetries} attempts: "${film.title}" — ${errMsg}`);
        return null;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function getSupabaseClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Fetches tmdb_id to film UUID mapping from DB.
 */
async function getTmdbToUuidMap(
  sb: SupabaseClient,
  tmdbIds: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  const BATCH = 500;

  for (let i = 0; i < tmdbIds.length; i += BATCH) {
    const batch = tmdbIds.slice(i, i + BATCH);
    const { data, error } = await sb
      .from('films')
      .select('id, tmdb_id')
      .in('tmdb_id', batch);

    if (error) throw new Error(`films UUID query error: ${error.message}`);
    for (const row of data ?? []) {
      map.set(row.tmdb_id as number, row.id as string);
    }
  }

  return map;
}

/**
 * Fetches set of film_ids that already have AI profiling.
 * Checks both old Groq and new Claude method tags.
 */
async function getAlreadyProfiledIds(sb: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();

  // Check for any AI profiling method
  const { data, error } = await sb
    .from('film_profiles')
    .select('film_id')
    .or(`profiling_method.eq.ai_groq_llama33_v1,profiling_method.eq.${PROFILING_METHOD}`);

  if (error) throw new Error(`film_profiles query error: ${error.message}`);
  for (const row of data ?? []) {
    ids.add(row.film_id as string);
  }
  return ids;
}

/**
 * Fetches set of film_ids that have NULL profile_vector in film_profiles.
 * These are the films invisible to match_films and need AI profiling.
 */
async function getFilmsWithNullVector(sb: SupabaseClient): Promise<Set<string>> {
  const ids = new Set<string>();
  const { data, error } = await sb
    .from('film_profiles')
    .select('film_id')
    .is('profile_vector', null);

  if (error) throw new Error(`film_profiles null vector query error: ${error.message}`);
  for (const row of data ?? []) {
    ids.add(row.film_id as string);
  }
  return ids;
}

/** films tablosunun AI profilleme için gereken kolonları. */
interface DbFilmRow {
  id: string;
  tmdb_id: number | null;
  title: string;
  original_title: string | null;
  original_language: string | null;
  overview: string | null;
  release_date: string | null;
  runtime: number | null;
  vote_average: number | null;
  genres: string[] | null;
  country: string[] | null;
  director: string | null;
  cast: string[] | null;
  tmdb_keywords: string[] | null;
  imdb_id: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  oscar_wins: number | null;
  oscar_nominations: number | null;
  content_rating: string | null;
  metadata_json: Record<string, unknown> | null;
}

/** Sayfalayarak tüm satırları çeker. */
async function fetchAllRows<T>(
  sb: SupabaseClient,
  table: string,
  select: string,
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await sb.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table} query error: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return rows;
}

/** DB satırını prompt'un beklediği RawFilmJSON şekline dönüştürür. */
function dbRowToRawFilm(row: DbFilmRow): RawFilmJSON {
  const voteCount = Number(row.metadata_json?.vote_count ?? 0);

  return {
    tmdb_id: row.tmdb_id ?? 0,
    title: row.title,
    original_title: row.original_title ?? row.title,
    original_language: row.original_language ?? 'en',
    overview: row.overview ?? '',
    release_date: row.release_date ?? '',
    runtime: row.runtime,
    vote_average: row.vote_average ?? 0,
    vote_count: isNaN(voteCount) ? 0 : voteCount,
    genres: (row.genres ?? []).map((name) => ({ id: 0, name })),
    production_countries: row.country ?? [],
    director: row.director,
    cast: row.cast ?? [],
    keywords: row.tmdb_keywords ?? [],
    imdb_id: row.imdb_id,
    poster_url: row.poster_url,
    backdrop_url: row.backdrop_url,
    country: row.country?.[0] ?? null,
    imdb_rating: row.imdb_rating,
    imdb_votes: row.imdb_votes,
    metascore: row.metascore,
    oscar_wins: row.oscar_wins ?? 0,
    oscar_nominations: row.oscar_nominations ?? 0,
    content_rating: row.content_rating,
  };
}

/**
 * Vektörü olmayan filmleri doğrudan films tablosundan çeker:
 * profile_vector NULL olan satırlar + hiç film_profiles satırı olmayan filmler.
 * Her film için UUID de döner (tmdb_id eşleşmesine güvenilmez).
 */
async function getFilmsNeedingVectorFromDb(
  sb: SupabaseClient,
): Promise<{ film: RawFilmJSON; uuid: string; title: string }[]> {
  const profiles = await fetchAllRows<{ film_id: string; profile_vector: unknown }>(
    sb,
    'film_profiles',
    'film_id, profile_vector',
  );

  const hasVector = new Set(
    profiles.filter((p) => !!p.profile_vector).map((p) => p.film_id),
  );

  const films = await fetchAllRows<DbFilmRow>(
    sb,
    'films',
    'id, tmdb_id, title, original_title, original_language, overview, release_date, runtime, ' +
      'vote_average, genres, country, director, cast, tmdb_keywords, imdb_id, poster_url, ' +
      'backdrop_url, imdb_rating, imdb_votes, metascore, oscar_wins, oscar_nominations, ' +
      'content_rating, metadata_json',
  );

  // Profil satırı hiç olmayan film de bu filtreye takılır; upsert ikisini de kapsar.
  return films
    .filter((f) => !hasVector.has(f.id))
    .map((f) => ({ film: dbRowToRawFilm(f), uuid: f.id, title: f.title }));
}

/**
 * Upserts a single profiled film to DB.
 */
async function upsertProfile(
  sb: SupabaseClient,
  filmUuid: string,
  profile: TasteProfile,
  reasoning: string,
): Promise<void> {
  const vector = tasteProfileToVector(profile);

  const { error } = await sb
    .from('film_profiles')
    .upsert(
      {
        film_id: filmUuid,
        profile_vector: vector,
        dimensions_json: profile,
        profiling_method: PROFILING_METHOD,
        profiled_at: new Date().toISOString(),
        profiling_reasoning: reasoning,
      },
      { onConflict: 'film_id' },
    );

  if (error) throw new Error(`Upsert failed for ${filmUuid}: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printProgress(current: number, total: number, label: string, startTime: number): void {
  const elapsed = (Date.now() - startTime) / 1000;
  const perItem = current > 0 ? elapsed / current : 0;
  const remaining = (total - current) * perItem;
  const eta = remaining > 60
    ? `${Math.round(remaining / 60)}m ${Math.round(remaining % 60)}s`
    : `${Math.round(remaining)}s`;

  const width = 40;
  const filled = Math.round((current / total) * width);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
  const pct = Math.round((current / total) * 100).toString().padStart(3);

  process.stdout.write(
    `\r[${bar}] ${pct}%  ${current}/${total}  ETA: ${eta}  ${label.slice(0, 30).padEnd(30)}`,
  );
  if (current === total) process.stdout.write('\n');
}

function parseArgs(): Flags {
  const args = process.argv.slice(2);
  return {
    fromDb: args.includes('--from-db'),
    onlyMissing: args.includes('--only-missing'),
    filmId: (() => {
      const filmArg = args.find((a) => a.startsWith('--film-id='));
      return filmArg ? parseInt(filmArg.split('=')[1], 10) : null;
    })(),
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseArgs();

  // Validate env
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey && !flags.dryRun) {
    console.error('ANTHROPIC_API_KEY environment variable required.');
    process.exit(1);
  }

  // Supabase connection
  const sb = getSupabaseClient();
  if (!sb) {
    console.warn('No Supabase credentials — will only log results, no DB writes.');
  }

  // ── --from-db: girdi films tablosundan gelir, films-raw.json okunmaz ────
  if (flags.fromDb) {
    if (!sb) {
      console.error('--from-db requires Supabase credentials.');
      process.exit(1);
    }
    const rows = await getFilmsNeedingVectorFromDb(sb);
    console.log(`--from-db: ${rows.length} films have no profile_vector (source: films table)`);
    // tmdb_id → UUID eşlemesi doğrudan aynı satırlardan kurulur
    const dbIdMap = new Map(rows.map((r) => [r.film.tmdb_id, r.uuid]));
    await runProfiling(rows.map((r) => r.film), sb, dbIdMap, flags, apiKey);
    return;
  }

  // Load films
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Input file not found: ${INPUT_PATH}\nRun fetch-films first.`);
    process.exit(1);
  }

  const allFilms: RawFilmJSON[] = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
  console.log(`Loaded ${allFilms.length} films from ${INPUT_PATH}`);

  // Filter films based on flags
  let filmsToProcess: RawFilmJSON[];

  if (flags.filmId) {
    const film = allFilms.find((f) => f.tmdb_id === flags.filmId);
    if (!film) {
      console.error(`Film with tmdb_id=${flags.filmId} not found in data.`);
      process.exit(1);
    }
    filmsToProcess = [film];
    console.log(`Single film mode: "${film.title}" (${flags.filmId})`);
  } else if (flags.onlyMissing && sb) {
    // Get UUID map and films with NULL profile_vector
    const tmdbIds = allFilms.map((f) => f.tmdb_id);
    const idMap = await getTmdbToUuidMap(sb, tmdbIds);
    const nullVectorIds = await getFilmsWithNullVector(sb);

    filmsToProcess = allFilms.filter((f) => {
      const uuid = idMap.get(f.tmdb_id);
      if (!uuid) return false; // not in DB — skip
      return nullVectorIds.has(uuid); // only films WITH a profile row but NULL vector
    });

    console.log(`--only-missing: ${filmsToProcess.length} films have NULL profile_vector (targeting exact NULL rows)`);
  } else {
    filmsToProcess = allFilms;
  }

  await runProfiling(filmsToProcess, sb, null, flags, apiKey);
}

/**
 * Profiles the given films and writes the resulting vectors to film_profiles.
 *
 * @param presetIdMap  tmdb_id → film UUID map when the caller already knows it
 *                     (--from-db); null makes the map get resolved from DB.
 */
async function runProfiling(
  filmsToProcess: RawFilmJSON[],
  sb: SupabaseClient | null,
  presetIdMap: Map<number, string> | null,
  flags: Flags,
  apiKey: string | undefined,
): Promise<void> {
  // Dry run
  if (flags.dryRun) {
    const estInputTokens = filmsToProcess.length * 600;
    const estOutputTokens = filmsToProcess.length * 400;
    const estCost = (estInputTokens * CLAUDE_INPUT_PRICE / 1_000_000)
      + (estOutputTokens * CLAUDE_OUTPUT_PRICE / 1_000_000);
    const estBatches = Math.ceil(filmsToProcess.length / BATCH_CONCURRENCY);
    const estTime = estBatches * (BATCH_DELAY_MS / 1000 + 1.5);

    console.log('\n--- DRY RUN ---');
    console.log(`Films to process: ${filmsToProcess.length}`);
    console.log(`Model: ${CLAUDE_MODEL}`);
    console.log(`Est. input tokens: ${estInputTokens.toLocaleString()}`);
    console.log(`Est. output tokens: ${estOutputTokens.toLocaleString()}`);
    console.log(`Est. cost: $${estCost.toFixed(2)}`);
    console.log(`Est. time: ${Math.round(estTime / 60)}m ${Math.round(estTime % 60)}s`);
    console.log(`Concurrency: ${BATCH_CONCURRENCY} parallel`);
    console.log('---');

    if (filmsToProcess.length <= 10) {
      console.log('\nFilms:');
      for (const f of filmsToProcess) {
        console.log(`  - ${f.title} (${f.tmdb_id})`);
      }
    }
    return;
  }

  // Proceed with profiling
  const client = new Anthropic({ apiKey });

  // Get UUID map for DB writes
  let idMap: Map<number, string> | null = presetIdMap;
  if (sb && !idMap) {
    idMap = await getTmdbToUuidMap(sb, filmsToProcess.map((f) => f.tmdb_id));
  }
  if (idMap) {
    console.log(`Mapped ${idMap.size} film UUIDs from DB.`);
  }

  const errors: ProfilingError[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let profiled = 0;
  let skipped = 0;
  const latencies: number[] = [];
  const startTime = Date.now();

  console.log(`\nModel: ${CLAUDE_MODEL} | Concurrency: ${BATCH_CONCURRENCY} | Delay: ${BATCH_DELAY_MS}ms\n`);

  // Process in batches of BATCH_CONCURRENCY
  for (let i = 0; i < filmsToProcess.length; i += BATCH_CONCURRENCY) {
    const batch = filmsToProcess.slice(i, i + BATCH_CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async (film) => {
        const filmStart = Date.now();
        const result = await profileWithRetry(client, film, MAX_RETRIES);
        const latency = Date.now() - filmStart;
        latencies.push(latency);

        if (!result) {
          errors.push({
            tmdb_id: film.tmdb_id,
            title: film.title,
            error: 'Failed after max retries',
            timestamp: new Date().toISOString(),
          });
          return { film, result: null };
        }

        totalInputTokens += result.inputTokens;
        totalOutputTokens += result.outputTokens;

        // Upsert to DB
        if (sb && idMap) {
          const filmUuid = idMap.get(film.tmdb_id);
          if (filmUuid) {
            try {
              await upsertProfile(sb, filmUuid, result.profile, result.reasoning);
              profiled++;
            } catch (err: unknown) {
              const errMsg = err instanceof Error ? err.message : String(err);
              errors.push({
                tmdb_id: film.tmdb_id,
                title: film.title,
                error: `DB upsert: ${errMsg}`,
                timestamp: new Date().toISOString(),
              });
            }
          } else {
            skipped++;
          }
        } else {
          profiled++;
        }

        return { film, result };
      }),
    );

    // Progress
    const done = Math.min(i + BATCH_CONCURRENCY, filmsToProcess.length);
    const lastFilm = batchResults[batchResults.length - 1]?.film;
    printProgress(done, filmsToProcess.length, lastFilm?.title ?? '', startTime);

    // Periodic detailed log
    if (done % PROGRESS_INTERVAL === 0 && done > 0) {
      const avgLatency = latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0;
      const currentCost = (totalInputTokens * CLAUDE_INPUT_PRICE / 1_000_000)
        + (totalOutputTokens * CLAUDE_OUTPUT_PRICE / 1_000_000);
      console.log(
        `\n  [${done}/${filmsToProcess.length}] profiled: ${profiled}, failed: ${errors.length}, ` +
        `avg latency: ${avgLatency}ms, cost: $${currentCost.toFixed(3)}`,
      );
    }

    // Delay between batches
    if (i + BATCH_CONCURRENCY < filmsToProcess.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  // Final stats
  const totalDuration = (Date.now() - startTime) / 1000;
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const totalCost = (totalInputTokens * CLAUDE_INPUT_PRICE / 1_000_000)
    + (totalOutputTokens * CLAUDE_OUTPUT_PRICE / 1_000_000);

  const stats: ProfilingStats = {
    total_films: filmsToProcess.length,
    profiled,
    failed: errors.length,
    skipped,
    total_api_calls: profiled + errors.length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    estimated_cost_usd: Math.round(totalCost * 1000) / 1000,
    total_duration_seconds: Math.round(totalDuration),
    avg_latency_ms: avgLatency,
  };

  console.log('\n\n=== PROFILING COMPLETE ===');
  console.log(`  Model: ${CLAUDE_MODEL}`);
  console.log(`  Films processed: ${stats.total_films}`);
  console.log(`  Successfully profiled: ${stats.profiled}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Skipped (no UUID): ${stats.skipped}`);
  console.log(`  Total API calls: ${stats.total_api_calls}`);
  console.log(`  Input tokens: ${stats.total_input_tokens.toLocaleString()}`);
  console.log(`  Output tokens: ${stats.total_output_tokens.toLocaleString()}`);
  console.log(`  Estimated cost: $${stats.estimated_cost_usd.toFixed(3)}`);
  console.log(`  Duration: ${Math.round(totalDuration / 60)}m ${Math.round(totalDuration % 60)}s`);
  console.log(`  Avg latency: ${avgLatency}ms`);
  console.log('========================\n');

  // Save stats
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 2), 'utf-8');
  console.log(`Stats saved to ${STATS_PATH}`);

  // Save errors
  if (errors.length > 0) {
    fs.writeFileSync(ERRORS_PATH, JSON.stringify(errors, null, 2), 'utf-8');
    console.log(`Errors saved to ${ERRORS_PATH} (${errors.length} failures)`);
  }
}

main().catch((err: unknown) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});
