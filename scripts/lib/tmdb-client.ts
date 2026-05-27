/**
 * Rate-limited TMDb API client with retry logic.
 * All requests use language=en-US for consistent English metadata.
 *
 * Rate limiting: 3 req/sec (333ms delay) with 429 backoff.
 * Retry: 3 attempts with exponential backoff (1s, 3s, 9s).
 */

import * as path from 'path';
import * as fs from 'fs';

// ─── Load .env manually (no direct dotenv dep) ─────────────────────────────
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
    // Don't override existing env vars
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

const BASE_URL = 'https://api.themoviedb.org/3';
const DELAY_MS = 334; // ~3 req/sec — safe under TMDb 40/10s limit
const MAX_RETRIES = 3;
const RATE_LIMIT_WAIT_MS = 30_000; // 30s pause on 429

/** Resolved API key / token */
let apiKey: string | undefined;
let readAccessToken: string | undefined;

/** Total API calls counter (for stats) */
let totalCalls = 0;

/** Initialize credentials from env */
export function initCredentials(): void {
  readAccessToken = process.env.TMDB_READ_ACCESS_TOKEN;
  apiKey = process.env.TMDB_API_KEY ?? process.env.EXPO_PUBLIC_TMDB_API_KEY;

  if (!readAccessToken && !apiKey) {
    throw new Error(
      'Missing TMDb credentials. Set TMDB_READ_ACCESS_TOKEN or TMDB_API_KEY env var.',
    );
  }
}

/** Get total API calls made this session */
export function getCallCount(): number {
  return totalCalls;
}

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Last request timestamp for rate limiting */
let lastRequestTime = 0;

/**
 * Core fetch with rate limiting, retry, and error handling.
 * Returns parsed JSON of type T or throws after all retries exhausted.
 */
export async function tmdbGet<T>(
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
  // Rate limit: ensure minimum gap between requests
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < DELAY_MS) {
    await sleep(DELAY_MS - elapsed);
  }

  const url = new URL(`${BASE_URL}${endpoint}`);

  // If no Bearer token, fall back to api_key query param
  if (!readAccessToken && apiKey) {
    url.searchParams.set('api_key', apiKey);
  }

  // Set caller params first
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  // FORCE language=en-US LAST — never allow override
  url.searchParams.set('language', 'en-US');

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (readAccessToken) {
    headers['Authorization'] = `Bearer ${readAccessToken}`;
  }

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    lastRequestTime = Date.now();
    totalCalls++;

    try {
      const res = await fetch(url.toString(), { headers });

      if (res.status === 429) {
        // Rate limit hit — wait and retry
        const waitSec = RATE_LIMIT_WAIT_MS / 1000;
        process.stdout.write(
          `\n\x1b[33m⚠ Rate limit hit (429). Waiting ${waitSec}s...\x1b[0m\n`,
        );
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }

      if (!res.ok) {
        throw new Error(`TMDb ${res.status} ${res.statusText} — ${endpoint}`);
      }

      return (await res.json()) as T;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        const backoffMs = Math.pow(3, attempt) * 1000; // 3s, 9s
        process.stdout.write(
          `\n\x1b[33m⚠ Retry ${attempt}/${MAX_RETRIES} for ${endpoint} (waiting ${backoffMs / 1000}s)\x1b[0m\n`,
        );
        await sleep(backoffMs);
      }
    }
  }

  throw lastError ?? new Error(`Failed after ${MAX_RETRIES} retries: ${endpoint}`);
}

// ─── TMDb Response Types ────────────────────────────────────────────────────

export interface TmdbDiscoverResult {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  adult: boolean;
}

export interface TmdbDiscoverResponse {
  page: number;
  results: TmdbDiscoverResult[];
  total_pages: number;
  total_results: number;
}

export interface TmdbPersonCredits {
  crew: Array<{
    id: number;
    department: string;
    job: string;
    media_type?: string;
  }>;
}

export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbProductionCountry {
  iso_3166_1: string;
  name: string;
}

export interface TmdbCastMember {
  name: string;
  character: string;
  order: number;
  profile_path: string | null;
}

export interface TmdbCrewMember {
  name: string;
  job: string;
  department: string;
}

export interface TmdbKeyword {
  id: number;
  name: string;
}

export interface TmdbExternalIds {
  imdb_id: string | null;
}

export interface TmdbMovieDetail {
  id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  adult: boolean;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: TmdbGenre[];
  production_countries: TmdbProductionCountry[];
  credits: {
    cast: TmdbCastMember[];
    crew: TmdbCrewMember[];
  };
  keywords: {
    keywords: TmdbKeyword[];
  };
  external_ids: TmdbExternalIds;
}
