/**
 * Rate-limited OMDb API client with retry logic.
 *
 * OMDb free tier: 1,000 req/day. Patreon $1/mo: 100,000 req/day.
 * Rate limiting: 5 req/sec with 429 backoff.
 * Retry: 3 attempts with exponential backoff.
 */

import * as path from 'path';
import * as fs from 'fs';

// ─── Load .env manually (no dotenv dep) ──────────────────────────────────────
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
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

const BASE_URL = 'https://www.omdbapi.com';
const DELAY_MS = 200; // 5 req/sec
const MAX_RETRIES = 3;
const RATE_LIMIT_WAIT_MS = 60_000; // 60s on rate limit

let apiKey: string | undefined;
let callCount = 0;

// ─── ANSI helpers ────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

/** Initialize and validate OMDb API key */
export function initOmdbKey(): void {
  apiKey = process.env.OMDB_API_KEY;
  if (!apiKey) {
    console.error(
      `${c.red}ERROR: OMDB_API_KEY not found.${c.reset}\n` +
      `Get a free key at https://www.omdbapi.com/apikey.aspx\n` +
      `Then add to .env: OMDB_API_KEY=your_key_here`
    );
    process.exit(1);
  }
  console.log(`${c.cyan}OMDb API key loaded${c.reset}`);
}

/** OMDb response shape */
export interface OmdbResponse {
  Response: 'True' | 'False';
  Error?: string;
  imdbRating?: string;
  imdbVotes?: string;
  Metascore?: string;
  Awards?: string;
  Rated?: string;
  Title?: string;
  Year?: string;
}

/** Parsed enrichment data */
export interface ImdbEnrichment {
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  oscar_wins: number;
  oscar_nominations: number;
  content_rating: string | null;
}

/** Sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Get total API calls made this session */
export function getCallCount(): number {
  return callCount;
}

/**
 * Fetch a single film from OMDb by IMDb ID.
 * Returns null if film not found or API error.
 */
export async function omdbGet(imdbId: string): Promise<OmdbResponse | null> {
  if (!apiKey) throw new Error('Call initOmdbKey() first');

  const url = `${BASE_URL}/?i=${imdbId}&apikey=${apiKey}`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await sleep(DELAY_MS);
      callCount++;

      const res = await fetch(url);

      // Rate limited
      if (res.status === 429) {
        console.warn(`${c.yellow}429 rate limited — waiting ${RATE_LIMIT_WAIT_MS / 1000}s...${c.reset}`);
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }

      // Auth error
      if (res.status === 401) {
        console.error(`${c.red}401 Unauthorized — check OMDB_API_KEY${c.reset}`);
        process.exit(1);
      }

      if (!res.ok) {
        console.warn(`${c.yellow}HTTP ${res.status} for ${imdbId} (attempt ${attempt})${c.reset}`);
        await sleep(1000 * attempt);
        continue;
      }

      const data = (await res.json()) as OmdbResponse;

      // OMDb returns 200 with Response: "False" for not found
      if (data.Response === 'False') {
        return null;
      }

      return data;
    } catch (err) {
      console.warn(`${c.yellow}Network error for ${imdbId} (attempt ${attempt}): ${err}${c.reset}`);
      await sleep(1000 * attempt);
    }
  }

  return null;
}

/**
 * Parse Awards string into oscar_wins, oscar_nominations, other_awards.
 *
 * Examples:
 *   "Won 7 Oscars. 168 wins & 245 nominations total."
 *   "Nominated for 5 Oscars. 74 wins & 146 nominations total."
 *   "Won 1 Oscar. 5 wins & 3 nominations total."
 *   "3 wins & 5 nominations."
 *   "N/A"
 */
export function parseAwards(awards: string | undefined): {
  oscar_wins: number;
  oscar_nominations: number;
} {
  if (!awards || awards === 'N/A') {
    return { oscar_wins: 0, oscar_nominations: 0 };
  }

  let oscar_wins = 0;
  let oscar_nominations = 0;

  // "Won X Oscars" or "Won 1 Oscar"
  const wonMatch = awards.match(/Won\s+(\d+)\s+Oscar/i);
  if (wonMatch) {
    oscar_wins = parseInt(wonMatch[1], 10);
  }

  // "Nominated for X Oscars" or "Nominated for 1 Oscar"
  const nomMatch = awards.match(/Nominated\s+for\s+(\d+)\s+Oscar/i);
  if (nomMatch) {
    oscar_nominations = parseInt(nomMatch[1], 10);
  }

  return { oscar_wins, oscar_nominations };
}

/**
 * Parse OMDb response into clean enrichment data.
 */
export function parseOmdbResponse(data: OmdbResponse): ImdbEnrichment {
  // imdbRating: "9.3" → 9.3, "N/A" → null
  const imdb_rating =
    data.imdbRating && data.imdbRating !== 'N/A'
      ? parseFloat(data.imdbRating)
      : null;

  // imdbVotes: "2,500,000" → 2500000, "N/A" → null
  const imdb_votes =
    data.imdbVotes && data.imdbVotes !== 'N/A'
      ? parseInt(data.imdbVotes.replace(/,/g, ''), 10)
      : null;

  // Metascore: "98" → 98, "N/A" → null
  const metascore =
    data.Metascore && data.Metascore !== 'N/A'
      ? parseInt(data.Metascore, 10)
      : null;

  // Awards parsing
  const { oscar_wins, oscar_nominations } = parseAwards(data.Awards);

  // Content rating: "R", "PG-13", "N/A" → null
  const content_rating =
    data.Rated && data.Rated !== 'N/A' ? data.Rated : null;

  return {
    imdb_rating,
    imdb_votes,
    metascore,
    oscar_wins,
    oscar_nominations,
    content_rating,
  };
}
