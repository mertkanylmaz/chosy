/**
 * MOOD-VEC-2b Faz 2 (C grubu) — ADIM 0: keşif + hazırlık
 *
 * Bu betik CANLI DB'YE YAZMAZ. Yalnız okur (anon) ve docs/investigations/mood-vec-2b/ altına yazar:
 *   c-tmdb-cache.json      — TMDb yanıtlarının kırpılmış hâli (tekrar çağrı gerekmesin)
 *   c-discovery.md         — kırılım, ilk 30, 8 ikonik film, gauntlet etkisi
 *   c-payload.tsv          — kurtarılan filmler (id, old_votes, new_votes, new_rating, imdb_id_to_set,
 *                            release_date, director_to_set, new_tier); TAB ayrık, id'ye göre sıralı
 *   c-needs-review.csv     — kurtarılabilir ama payload'a girmeyen filmler
 *
 * Kapsam: films WHERE curation_tier='archive' AND release_date IS NULL.
 *   - TMDb /movie/{tmdb_id}?append_to_response=external_ids → release_date + imdb_id
 *   - TMDb /movie/{tmdb_id}/credits → director (yalnız kurtarılan + DB director NULL; crew job='Director' ilki,
 *     add-missing-films/backfill-film-metadata ile aynı kural)
 *   - imdb_id TMDb'den geldiyse IMDb startYear ile DB yılı arasında |fark| <= 1 kabul
 *   - oy/rating: data/imdb/title.ratings.tsv.gz (OMDb yok)
 *   - kurtarma eşiği: dosya oyu >= 10.000 VE release_date NOT NULL VE <= bugün
 *   - tier: scripts/assign-tiers.ts determineCurationTier (dosya rating + dosya oy; fonksiyon değişmedi)
 *   - içerik/imdb_id doğrulaması: backfill-imdb-archive.ts ile aynı filtreler (kopya; o betik değişmedi)
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-archive-c.ts
 *
 * Env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_TMDB_API_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as zlib from 'zlib';

import { createClient } from '@supabase/supabase-js';

import { ARCHIVE_THRESHOLDS_STANDARD, determineCurationTier } from './assign-tiers';

const PAGE = 1000;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MIN_RUNTIME = 60;
const RUNTIME_TOLERANCE = 5;
const YEAR_TOLERANCE = 1;
const MIN_VOTES = 10000;
/** TMDb limiti: 35 istek / 10 sn → istekler arası en az 290 ms. */
const TMDB_MIN_INTERVAL_MS = 290;
const CACHE_FLUSH_EVERY = 25;

const RATINGS_PATH = path.join(process.cwd(), 'data', 'imdb', 'title.ratings.tsv.gz');
const BASICS_PATH = path.join(process.cwd(), 'data', 'imdb', 'title.basics.tsv.gz');
const OUT_DIR = path.join(process.cwd(), 'docs', 'investigations', 'mood-vec-2b');
const CACHE_PATH = path.join(OUT_DIR, 'c-tmdb-cache.json');

const ICONIC: { name: string; tmdbId: number }[] = [
  { name: 'Superbad', tmdbId: 8363 },
  { name: 'Hot Fuzz', tmdbId: 4638 },
  { name: 'Groundhog Day', tmdbId: 137 },
  { name: "Ferris Bueller's Day Off", tmdbId: 9377 },
  { name: 'Bridesmaids', tmdbId: 55721 },
  { name: 'Paddington 2', tmdbId: 346648 },
  { name: "Ocean's Eleven", tmdbId: 161 },
  { name: 'Get Out', tmdbId: 419430 },
];

interface FilmRow {
  id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  year: number | null;
  runtime: number | null;
  release_date: string | null;
  poster_url: string | null;
  director: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  oscar_wins: number | null;
  oscar_nominations: number | null;
  tmdb_keywords: string[] | null;
  curation_tier: string;
}

interface PoolFilm {
  id: string;
  imdb_votes: number | null;
  imdb_rating: number | null;
  imdb_id: string | null;
  release_date: string | null;
  poster_url: string | null;
  runtime: number | null;
  year: number | null;
  curation_tier: string;
}

interface BasicsRow {
  tconst: string;
  titleType: string;
  isAdult: boolean;
  startYear: number | null;
  runtimeMinutes: number | null;
  genres: string[];
}

interface TmdbEntry {
  status: number; // HTTP durumu (200 | 404)
  fetched_at: string;
  imdb_id: string | null;
  release_date: string | null;
  title: string | null;
  original_title: string | null;
  runtime: number | null;
  tmdb_status: string | null;
  original_language: string | null;
  genres: string[];
  poster_path: string | null;
  /** /credits sonucu (ilk crew job='Director'). undefined = hiç sorulmadı, null = sorulduğunda yok. */
  director?: string | null;
}

type TmdbCache = Record<string, TmdbEntry>;

type ReasonCode =
  | 'lookup'
  | 'nofile'
  | 'votes'
  | 'date'
  | 'content'
  | 'imdbid'
  | 'concert'
  | 'trending079'
  | 'tierfloor'
  | 'coretier'
  | 'no_director';

interface Flag {
  code: ReasonCode;
  reason: string;
}

interface Analysis {
  film: FilmRow;
  tmdb: TmdbEntry | null;
  imdbId: string | null;
  /** DB'de imdb_id NULL idi, TMDb'den tamamlandı. */
  imdbIdNew: boolean;
  fileRating: number | null;
  fileVotes: number | null;
  releaseDate: string | null;
  tier: string | null;
  flags: Flag[];
}

function fail(message: string): never {
  console.error(`HATA: ${message}`);
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) fail(`${name} gerekli.`);
  return value;
}

function normTitle(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '');
}

function csvCell(value: string | number | null): string {
  const s = value === null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(n: number): string {
  return n.toLocaleString('tr-TR');
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ── Okuma (anon, salt okunur) ───────────────────────────────────────────────

function client() {
  return createClient(requireEnv('EXPO_PUBLIC_SUPABASE_URL'), requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'), {
    auth: { persistSession: false },
  });
}

async function fetchScope(): Promise<FilmRow[]> {
  const sb = client();
  const rows: FilmRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('films')
      .select(
        'id, tmdb_id, imdb_id, title, year, runtime, release_date, poster_url, director, imdb_rating, imdb_votes, metascore, oscar_wins, oscar_nominations, tmdb_keywords, curation_tier',
      )
      .eq('curation_tier', 'archive')
      .is('release_date', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail(`films okunamadı: ${error.message}`);
    for (const r of (data ?? []) as FilmRow[]) {
      rows.push({ ...r, imdb_rating: toNum(r.imdb_rating), imdb_votes: toNum(r.imdb_votes) });
    }
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** Havuz tahmini için: tüm filmler (id, oy, tier, kapı alanları). */
async function fetchAllFilms(): Promise<PoolFilm[]> {
  const sb = client();
  const rows: PoolFilm[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('films')
      .select('id, imdb_votes, imdb_rating, imdb_id, release_date, poster_url, runtime, year, curation_tier')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail(`films (havuz) okunamadı: ${error.message}`);
    for (const r of (data ?? []) as PoolFilm[]) {
      rows.push({ ...r, imdb_votes: toNum(r.imdb_votes), imdb_rating: toNum(r.imdb_rating) });
    }
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

async function fetchVectorIds(): Promise<Set<string>> {
  const sb = client();
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('film_profiles')
      .select('film_id')
      .not('profile_vector', 'is', null)
      .order('film_id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail(`film_profiles okunamadı: ${error.message}`);
    for (const r of (data ?? []) as { film_id: string }[]) ids.add(r.film_id);
    if (!data || data.length < PAGE) break;
  }
  return ids;
}

// ── TMDb (cache + hız sınırı + retry/backoff) ───────────────────────────────

function loadCache(): TmdbCache {
  if (!fs.existsSync(CACHE_PATH)) return {};
  return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8')) as TmdbCache;
}

function saveCache(cache: TmdbCache): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const tmp = `${CACHE_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(cache) + '\n');
  fs.renameSync(tmp, CACHE_PATH);
}

let lastCallAt = 0;

/** Hız sınırı + retry/backoff ile TMDb GET. 404 → null. */
async function tmdbRequest(tmdbId: number, pathAndQuery: string): Promise<unknown | null> {
  const key = requireEnv('EXPO_PUBLIC_TMDB_API_KEY');
  const sep = pathAndQuery.includes('?') ? '&' : '?';
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}${pathAndQuery}${sep}api_key=${key}`;
  const MAX_ATTEMPTS = 6;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const wait = lastCallAt + TMDB_MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw new Error(`TMDb ${tmdbId}: ağ hatası ${(err as Error).message}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '0');
      await sleep(Math.max(retryAfter * 1000, 1000 * 2 ** attempt));
      continue;
    }
    if (res.status >= 500) {
      if (attempt === MAX_ATTEMPTS) throw new Error(`TMDb ${tmdbId}: HTTP ${res.status}`);
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`TMDb ${tmdbId}: HTTP ${res.status}`);
    return await res.json();
  }
  throw new Error(`TMDb ${tmdbId}: ${MAX_ATTEMPTS} denemede başarısız`);
}

async function tmdbGet(tmdbId: number): Promise<TmdbEntry> {
  const b = (await tmdbRequest(tmdbId, '?append_to_response=external_ids')) as {
    imdb_id?: string | null;
    release_date?: string | null;
    title?: string;
    original_title?: string;
    runtime?: number | null;
    status?: string;
    original_language?: string;
    genres?: { name: string }[];
    poster_path?: string | null;
    external_ids?: { imdb_id?: string | null };
  } | null;
  if (b === null) {
    return {
      status: 404, fetched_at: new Date().toISOString(), imdb_id: null, release_date: null, title: null,
      original_title: null, runtime: null, tmdb_status: null, original_language: null, genres: [], poster_path: null,
    };
  }
  const imdb = b.external_ids?.imdb_id || b.imdb_id || null;
  return {
    status: 200,
    fetched_at: new Date().toISOString(),
    imdb_id: imdb && imdb.length > 0 ? imdb : null,
    release_date: b.release_date && b.release_date.length > 0 ? b.release_date : null,
    title: b.title ?? null,
    original_title: b.original_title ?? null,
    runtime: b.runtime ?? null,
    tmdb_status: b.status ?? null,
    original_language: b.original_language ?? null,
    genres: (b.genres ?? []).map((g) => g.name),
    poster_path: b.poster_path ?? null,
  };
}

/** crew içinden ilk 'Director' (add-missing-films.ts / backfill-film-metadata.ts ile aynı kural, düz ad). */
async function tmdbDirector(tmdbId: number): Promise<string | null> {
  const b = (await tmdbRequest(tmdbId, '/credits')) as { crew?: { job?: string; name?: string }[] } | null;
  const name = b?.crew?.find((m) => m.job === 'Director')?.name?.trim();
  return name && name.length > 0 ? name : null;
}

async function fillCache(films: FilmRow[], cache: TmdbCache): Promise<number> {
  const todo = films.filter((f) => f.tmdb_id !== null && !cache[String(f.tmdb_id)]);
  console.log(`TMDb: ${films.length} film, cache'te yok: ${todo.length}`);
  let n = 0;
  for (const f of todo) {
    cache[String(f.tmdb_id)] = await tmdbGet(f.tmdb_id as number);
    n++;
    if (n % CACHE_FLUSH_EVERY === 0) {
      saveCache(cache);
      console.log(`  TMDb ${n}/${todo.length}`);
    }
  }
  saveCache(cache);
  return todo.length;
}

// ── IMDb veri dosyaları ─────────────────────────────────────────────────────

async function* tsvLines(file: string, expectedHeader: string): AsyncGenerator<string[]> {
  if (!fs.existsSync(file)) fail(`Dosya yok: ${file}`);
  const rl = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  let header = true;
  for await (const line of rl) {
    if (header) {
      if (line !== expectedHeader) fail(`Beklenmeyen başlık (${path.basename(file)}): ${line}`);
      header = false;
      continue;
    }
    yield line.split('\t');
  }
}

async function readRatings(wanted: Set<string>): Promise<Map<string, { rating: number; votes: number }>> {
  const found = new Map<string, { rating: number; votes: number }>();
  for await (const c of tsvLines(RATINGS_PATH, 'tconst\taverageRating\tnumVotes')) {
    if (!wanted.has(c[0])) continue;
    const rating = Number(c[1]);
    const votes = Number(c[2]);
    if (!Number.isFinite(rating) || !Number.isInteger(votes)) fail(`Bozuk ratings satırı: ${c.join('\t')}`);
    found.set(c[0], { rating, votes });
  }
  return found;
}

async function readBasics(
  wanted: Set<string>,
  wantedKeys: Set<string>,
): Promise<{ rows: Map<string, BasicsRow>; keyCounts: Map<string, number> }> {
  const rows = new Map<string, BasicsRow>();
  const keyCounts = new Map<string, number>();
  const header = 'tconst\ttitleType\tprimaryTitle\toriginalTitle\tisAdult\tstartYear\tendYear\truntimeMinutes\tgenres';
  for await (const c of tsvLines(BASICS_PATH, header)) {
    const tconst = c[0];
    const startYear = c[5] === '\\N' ? null : Number(c[5]);
    if (wanted.has(tconst)) {
      rows.set(tconst, {
        tconst,
        titleType: c[1],
        isAdult: c[4] === '1',
        startYear,
        runtimeMinutes: c[7] === '\\N' ? null : Number(c[7]),
        genres: c[8] === '\\N' ? [] : c[8].split(','),
      });
    }
    if (c[1] === 'movie' && startYear !== null) {
      for (const t of new Set([normTitle(c[2]), normTitle(c[3])])) {
        const k = `${t}|${startYear}`;
        if (wantedKeys.has(k)) keyCounts.set(k, (keyCounts.get(k) ?? 0) + 1);
      }
    }
  }
  return { rows, keyCounts };
}

// ── Filtreler (backfill-imdb-archive.ts ile aynı) ───────────────────────────

const SOFT_TYPES = ['tvMovie', 'video'];
const ALLOW_NON_MOVIE_TITLES = ["angel's egg"];
const EXCLUDED_GENRES = ['Documentary', 'Talk-Show', 'Reality-TV'];
const CONCERT_PREFIXES = [
  'bts world tour',
  'blackpink: light up the sky',
  'burn the stage',
  'bring the soul',
  'history on film, volume ii',
  "avicii - i'm tim",
];
const TRENDING_079_TITLES = [
  'hoppers',
  'ready or not: here i come',
  'the drama',
  'neon genesis evangelion: death and rebirth',
];

function titleStartsWith(title: string, prefixes: string[]): string | null {
  const t = title.trim().toLowerCase();
  return prefixes.find((p) => t.startsWith(p)) ?? null;
}

function titleEquals(title: string, titles: string[]): string | null {
  const t = title.trim().toLowerCase();
  return titles.find((x) => t === x) ?? null;
}

function screenContent(film: FilmRow, basics: BasicsRow | undefined): Flag[] {
  const flags: Flag[] = [];
  const add = (reason: string): void => {
    flags.push({ code: 'content', reason });
  };
  if (film.runtime !== null && film.runtime < MIN_RUNTIME) add(`DB runtime ${film.runtime} < ${MIN_RUNTIME}`);
  if (!basics) {
    add('title.basics satırı yok');
    return flags;
  }
  if (basics.titleType !== 'movie') {
    const allowed =
      SOFT_TYPES.includes(basics.titleType) && ALLOW_NON_MOVIE_TITLES.includes(film.title.trim().toLowerCase());
    if (!allowed) add(`titleType=${basics.titleType}`);
  }
  if (basics.isAdult) add('isAdult=1');
  if (basics.genres.includes('Adult')) add("genres 'Adult'");
  if (basics.runtimeMinutes === null) add('basics runtime yok');
  else if (basics.runtimeMinutes < MIN_RUNTIME) add(`basics runtime ${basics.runtimeMinutes} < ${MIN_RUNTIME}`);
  const excluded = basics.genres.filter((g) => EXCLUDED_GENRES.includes(g));
  if (excluded.length > 0) add(`genres ${excluded.join('/')}`);
  if (film.year !== null && basics.startYear !== null && Math.abs(basics.startYear - film.year) > 1) {
    add(`imdb_id yıl uyumsuz (DB ${film.year} / IMDb ${basics.startYear})`);
  }
  return flags;
}

function newTier(film: FilmRow, rating: number | null, votes: number | null): string {
  return determineCurationTier({
    director: film.director,
    imdb_rating: rating,
    imdb_votes: votes,
    metascore: film.metascore,
    oscar_wins: film.oscar_wins ?? 0,
    oscar_nominations: film.oscar_nominations ?? 0,
    keywords: film.tmdb_keywords ?? [],
    current_tier: 'archive',
  });
}

// ── Analiz ──────────────────────────────────────────────────────────────────

function analyze(
  film: FilmRow,
  tmdb: TmdbEntry | null,
  basics: Map<string, BasicsRow>,
  ratings: Map<string, { rating: number; votes: number }>,
  keyCounts: Map<string, number>,
  today: string,
): Analysis {
  const a: Analysis = {
    film, tmdb, imdbId: film.imdb_id, imdbIdNew: false, fileRating: null, fileVotes: null,
    releaseDate: null, tier: null, flags: [],
  };

  // 1) TMDb arama
  if (film.tmdb_id === null) a.flags.push({ code: 'lookup', reason: 'tmdb_id NULL' });
  else if (!tmdb) a.flags.push({ code: 'lookup', reason: 'TMDb yanıtı cache\'te yok' });
  else if (tmdb.status === 404) a.flags.push({ code: 'lookup', reason: 'TMDb 404' });

  // release_date
  if (tmdb && tmdb.status === 200) {
    if (!tmdb.release_date) a.flags.push({ code: 'date', reason: 'TMDb release_date boş' });
    else {
      a.releaseDate = tmdb.release_date;
      if (tmdb.release_date > today) a.flags.push({ code: 'date', reason: `release_date gelecekte (${tmdb.release_date})` });
      const y = Number(tmdb.release_date.slice(0, 4));
      if (film.year !== null && Math.abs(y - film.year) > 1) {
        a.flags.push({ code: 'date', reason: `release_date yılı uyumsuz (DB ${film.year} / TMDb ${y})` });
      }
    }
  }

  // imdb_id
  if (!film.imdb_id) {
    if (tmdb && tmdb.status === 200) {
      if (tmdb.imdb_id) {
        a.imdbId = tmdb.imdb_id;
        a.imdbIdNew = true;
      } else a.flags.push({ code: 'lookup', reason: 'TMDb imdb_id döndürmedi' });
    }
  } else if (tmdb && tmdb.status === 200 && tmdb.imdb_id && tmdb.imdb_id !== film.imdb_id) {
    a.flags.push({ code: 'imdbid', reason: `DB imdb_id ${film.imdb_id} ≠ TMDb ${tmdb.imdb_id}` });
  }

  // dosya oy/rating
  const fileRow = a.imdbId ? ratings.get(a.imdbId) : undefined;
  if (a.imdbId && !fileRow) a.flags.push({ code: 'nofile', reason: `${a.imdbId} ratings dosyasında yok` });
  if (fileRow) {
    a.fileRating = fileRow.rating;
    a.fileVotes = fileRow.votes;
    a.tier = newTier(film, fileRow.rating, fileRow.votes);
    if (fileRow.votes < MIN_VOTES) a.flags.push({ code: 'votes', reason: `dosya oyu ${fileRow.votes} < ${MIN_VOTES}` });
    if (a.tier === 'archive') {
      a.flags.push({ code: 'tierfloor', reason: `dosya ${fileRow.rating}/${fileRow.votes} ile tier archive kalıyor` });
    }
    if (a.tier !== 'archive' && fileRow.votes < ARCHIVE_THRESHOLDS_STANDARD.minVotes) {
      a.flags.push({ code: 'coretier', reason: `oy tabanı altı ama determineCurationTier ${a.tier} döndürdü` });
    }
  }

  // içerik + imdb_id doğrulaması
  if (a.imdbId) {
    const b = basics.get(a.imdbId);
    a.flags.push(...screenContent(film, b));
    if (a.imdbIdNew) {
      if (!b || b.titleType !== 'movie') {
        a.flags.push({ code: 'imdbid', reason: `TMDb imdb_id doğrulanamadı: basics movie değil (${b?.titleType ?? 'satır yok'})` });
      } else {
        // TMDb external_ids kaynaklı imdb_id: yıl ±1 kabul (ülke/festival tarihi farkı)
        if (film.year === null || b.startYear === null || Math.abs(b.startYear - film.year) > YEAR_TOLERANCE) {
          a.flags.push({ code: 'imdbid', reason: `TMDb imdb_id: yıl ±${YEAR_TOLERANCE} dışı (DB ${film.year} / IMDb ${b.startYear})` });
        }
        if (b.runtimeMinutes === null || film.runtime === null || Math.abs(b.runtimeMinutes - film.runtime) > RUNTIME_TOLERANCE) {
          a.flags.push({ code: 'imdbid', reason: `TMDb imdb_id: runtime ±${RUNTIME_TOLERANCE} dışı (DB ${film.runtime} / IMDb ${b?.runtimeMinutes})` });
        }
        const n = keyCounts.get(`${normTitle(film.title)}|${b.startYear}`) ?? 0;
        if (n !== 1) a.flags.push({ code: 'imdbid', reason: `TMDb imdb_id: (başlık,yıl) tekil değil (${n} movie)` });
      }
    }
  }
  const concert = titleStartsWith(film.title, CONCERT_PREFIXES);
  if (concert) a.flags.push({ code: 'concert', reason: `konser listesi ('${concert}')` });
  const t079 = titleEquals(film.title, TRENDING_079_TITLES);
  if (t079) a.flags.push({ code: 'trending079', reason: `079 listesi ('${t079}')` });
  return a;
}

// ── SQL ─────────────────────────────────────────────────────────────────────

interface Rescue {
  a: Analysis;
  tier: string;
  releaseDate: string;
  votes: number;
  rating: number;
  oldVotes: number | null;
  /** DB imdb_rating NULL → yazılır. */
  setRating: boolean;
  setImdbId: boolean;
  /** DB director NULL idi ve TMDb credits'ten bulundu → yazılır. */
  setDirector: string | null;
}

const TSV_HEADER = ['id', 'old_votes', 'new_votes', 'new_rating', 'imdb_id_to_set', 'release_date', 'director_to_set', 'new_tier'];
const NULL_CELL = '\\N';

function tsvCell(value: string | number | null): string {
  if (value === null) return NULL_CELL;
  const text = String(value);
  if (/[\t\r\n]/.test(text)) fail(`TSV hücresinde TAB/satır sonu: ${JSON.stringify(text)}`);
  return text;
}

function buildPayload(rows: Rescue[]): string {
  const lines = [TSV_HEADER.join('\t')];
  for (const r of rows) {
    const f = r.a.film;
    lines.push(
      [
        f.id,
        r.oldVotes,
        r.votes,
        r.rating.toFixed(1),
        r.setImdbId ? r.a.imdbId : null,
        r.releaseDate,
        r.setDirector,
        r.tier,
      ].map(tsvCell).join('\t'),
    );
  }
  return lines.join('\n') + '\n';
}

// ── Gauntlet etkisi ─────────────────────────────────────────────────────────

interface PoolStat {
  n: number;
  p55: number;
  p80: number;
  median: number;
}

/** gauntletCore.percentRanks ile aynı semantik: v'den kesin küçüklerin oranı. Eşik değerleri sıralı oydan alınır. */
function poolStat(votes: number[]): PoolStat {
  const s = [...votes].sort((a, b) => a - b);
  const q = (p: number): number => {
    if (s.length === 0) return 0;
    const idx = (p / 100) * (s.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  return { n: s.length, p55: q(55), p80: q(80), median: q(50) };
}

interface PoolEntry {
  id: string;
  votes: number;
}

function buildPool(
  films: Map<string, PoolFilm>,
  vectorIds: Set<string>,
  today: string,
  tiers: string[],
): PoolEntry[] {
  const out: PoolEntry[] = [];
  for (const f of films.values()) {
    if (!tiers.includes(f.curation_tier)) continue;
    if (!f.release_date || f.release_date > today) continue;
    if (!f.poster_url || f.runtime === null || f.year === null) continue;
    if (!vectorIds.has(f.id)) continue;
    if (f.imdb_votes === null || f.imdb_votes <= 0) continue;
    out.push({ id: f.id, votes: f.imdb_votes });
  }
  return out;
}

function bandMembers(pool: PoolEntry[], st: PoolStat): Set<string> {
  return new Set(pool.filter((p) => p.votes >= st.p55 && p.votes <= st.p80).map((p) => p.id));
}

interface Impact {
  label: string;
  tiers: string[];
  before: PoolStat;
  after: PoolStat;
  added: number;
  addedCore: number;
  addedExt: number;
  exits: number;
  enters: number;
  newInBand: number;
}

function impact(
  label: string,
  tiers: string[],
  base: Map<string, PoolFilm>,
  withC: Map<string, PoolFilm>,
  vectorIds: Set<string>,
  today: string,
): Impact {
  const pb = buildPool(base, vectorIds, today, tiers);
  const pa = buildPool(withC, vectorIds, today, tiers);
  const sb = poolStat(pb.map((p) => p.votes));
  const sa = poolStat(pa.map((p) => p.votes));
  const bandB = bandMembers(pb, sb);
  const bandA = bandMembers(pa, sa);
  const baseIds = new Set(pb.map((p) => p.id));
  const added = pa.filter((p) => !baseIds.has(p.id));
  let exits = 0;
  let enters = 0;
  for (const id of bandB) if (baseIds.has(id) && !bandA.has(id)) exits++;
  for (const id of bandA) if (baseIds.has(id) && !bandB.has(id)) enters++;
  return {
    label, tiers, before: sb, after: sa, added: added.length,
    addedCore: added.filter((p) => withC.get(p.id)?.curation_tier === 'core').length,
    addedExt: added.filter((p) => withC.get(p.id)?.curation_tier === 'extended').length,
    exits, enters,
    newInBand: added.filter((p) => bandA.has(p.id)).length,
  };
}

/** Bekleyen (canlıya uygulanmamış) 1B/1C/1D UPDATE'lerini, film hâlâ archive ise bellekteki kopyaya uygular. */
function applyPending(base: Map<string, PoolFilm>): { map: Map<string, PoolFilm>; applied: number } {
  const map = new Map<string, PoolFilm>();
  for (const [k, v] of base) map.set(k, { ...v });
  const files = ['phase1b-apply.sql', 'phase1c-1-apply.sql', 'phase1c-2-apply.sql', 'phase1d-apply.sql'];
  let applied = 0;
  for (const file of files) {
    const p = path.join(OUT_DIR, file);
    if (!fs.existsSync(p)) fail(`Bekleyen SQL yok: ${file}`);
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = /^UPDATE films SET (.+?) WHERE id = '([0-9a-f-]{36})' AND /.exec(line);
      if (!m) continue;
      const f = map.get(m[2]);
      if (!f || f.curation_tier !== 'archive') continue; // zaten canlı
      const v = /imdb_votes = (\d+)/.exec(m[1]);
      const r = /imdb_rating = ([\d.]+)/.exec(m[1]);
      const t = /curation_tier = '(\w+)'/.exec(m[1]);
      const i = /imdb_id = '(tt\d+)'/.exec(m[1]);
      if (v) f.imdb_votes = Number(v[1]);
      if (r) f.imdb_rating = Number(r[1]);
      if (i) f.imdb_id = i[1];
      if (t) f.curation_tier = t[1];
      applied++;
    }
  }
  return { map, applied };
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const scope = await fetchScope();
  console.log(`Kapsam (archive + release_date NULL): ${scope.length}; bugün (UTC) ${today}`);
  const noImdb = scope.filter((f) => !f.imdb_id).length;
  const noTmdb = scope.filter((f) => f.tmdb_id === null).length;
  console.log(`  imdb_id NULL: ${noImdb}; tmdb_id NULL: ${noTmdb}`);

  const cache = loadCache();
  const fetched = await fillCache(scope, cache);
  console.log(`TMDb yeni çağrı: ${fetched}`);

  const wanted = new Set<string>();
  const wantedKeys = new Set<string>();
  for (const f of scope) {
    const t = f.tmdb_id !== null ? cache[String(f.tmdb_id)] : undefined;
    const id = f.imdb_id ?? t?.imdb_id ?? null;
    if (id) wanted.add(id);
    if (t?.imdb_id && t.imdb_id !== f.imdb_id) wanted.add(t.imdb_id);
    if (!f.imdb_id && f.year !== null) {
      for (let d = -YEAR_TOLERANCE; d <= YEAR_TOLERANCE; d++) wantedKeys.add(`${normTitle(f.title)}|${f.year + d}`);
    }
  }
  console.log(`IMDb dosyaları taranıyor (${wanted.size} tconst)…`);
  const { rows: basics, keyCounts } = await readBasics(wanted, wantedKeys);
  const ratings = await readRatings(wanted);

  const analyses = scope.map((f) =>
    analyze(f, f.tmdb_id !== null ? cache[String(f.tmdb_id)] ?? null : null, basics, ratings, keyCounts, today),
  );

  // Kurtarma adayları: bayrak yok (tier archive değil, oy >= 10k, tarih geçerli, içerik temiz)
  const candidates = analyses.filter((a) => a.flags.length === 0 && a.tier !== null && a.tier !== 'archive' && a.releaseDate !== null);

  // Director: DB'de NULL olan adaylar için TMDb credits. Bulunamayan needs-review'a (no_director).
  const needDirector = candidates.filter((a) => a.film.director === null && a.film.tmdb_id !== null);
  const dirTodo = needDirector.filter((a) => cache[String(a.film.tmdb_id)].director === undefined);
  console.log(`Director: ${needDirector.length} aday film DB'de NULL; credits çağrısı: ${dirTodo.length}`);
  let dn = 0;
  for (const a of dirTodo) {
    cache[String(a.film.tmdb_id)].director = await tmdbDirector(a.film.tmdb_id as number);
    dn++;
    if (dn % CACHE_FLUSH_EVERY === 0) {
      saveCache(cache);
      console.log(`  credits ${dn}/${dirTodo.length}`);
    }
  }
  saveCache(cache);
  const directorFor = new Map<string, string | null>();
  for (const a of needDirector) {
    const d = cache[String(a.film.tmdb_id)].director ?? null;
    directorFor.set(a.film.id, d);
    if (d === null) a.flags.push({ code: 'no_director', reason: 'TMDb credits: crew job=Director yok' });
  }

  const rescues: Rescue[] = candidates
    .filter((a) => a.flags.length === 0)
    .map((a) => ({
      a,
      tier: a.tier as string,
      releaseDate: a.releaseDate as string,
      votes: a.fileVotes as number,
      rating: a.fileRating as number,
      oldVotes: a.film.imdb_votes,
      setRating: a.film.imdb_rating === null,
      setImdbId: a.imdbIdNew,
      setDirector: directorFor.get(a.film.id) ?? null,
    }))
    .sort((x, y) => (x.a.film.id < y.a.film.id ? -1 : x.a.film.id > y.a.film.id ? 1 : 0));
  const rescuedIds = new Set(rescues.map((r) => r.a.film.id));

  // ── payload TSV ──
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^c-(apply|rollback)(-\d+)?\.sql$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'c-payload.tsv'), buildPayload(rescues));

  // ── needs-review.csv: kurtarılabilir olabilecek ama SQL'e girmeyenler ──
  const reviewable = analyses.filter((a) => {
    if (rescuedIds.has(a.film.id)) return false;
    const onlyLegitArchive = a.flags.length > 0 && a.flags.every((f) => f.code === 'votes' || f.code === 'tierfloor');
    if (onlyLegitArchive) return false; // oy < 10k veya rating tabanı: meşru arşiv
    return true;
  });
  const csv = ['id,title,year,tmdb_id,imdb_id,release_date,votes,rating,tier,sebep'];
  for (const a of reviewable.sort((x, y) => x.film.id.localeCompare(y.film.id))) {
    csv.push(
      [a.film.id, a.film.title, a.film.year, a.film.tmdb_id, a.imdbId, a.releaseDate, a.fileVotes, a.fileRating, a.tier,
        a.flags.map((f) => `[${f.code}] ${f.reason}`).join(' | ')].map(csvCell).join(','),
    );
  }
  fs.writeFileSync(path.join(OUT_DIR, 'c-needs-review.csv'), csv.join('\n') + '\n');

  // ── Etki ──
  const [allFilms, vectorIds] = await Promise.all([fetchAllFilms(), fetchVectorIds()]);
  const live = new Map<string, PoolFilm>(allFilms.map((f) => [f.id, f]));
  const withPending = applyPending(live);
  const addC = (src: Map<string, PoolFilm>): Map<string, PoolFilm> => {
    const m = new Map<string, PoolFilm>();
    for (const [k, v] of src) m.set(k, { ...v });
    for (const r of rescues) {
      const f = m.get(r.a.film.id);
      if (!f || f.curation_tier !== 'archive') continue;
      f.release_date = r.releaseDate;
      f.imdb_votes = r.votes;
      if (r.setRating) f.imdb_rating = r.rating;
      f.curation_tier = r.tier;
    }
    return m;
  };
  const DAILY = ['core', 'extended', 'trending'];
  const GLOBAL = ['core', 'trending'];
  const scenarios = [
    { name: 'A. Canlı DB → canlı + C', base: live, with: addC(live) },
    { name: 'B. Canlı + bekleyen 1B/1C/1D → + C', base: withPending.map, with: addC(withPending.map) },
  ];
  const impacts = scenarios.map((s) => ({
    name: s.name,
    daily: impact('günlük (core+extended+trending)', DAILY, s.base, s.with, vectorIds, today),
    global: impact('global slot (core+trending)', GLOBAL, s.base, s.with, vectorIds, today),
  }));
  const rescuedPoolEligible = rescues.filter((r) => {
    const f = live.get(r.a.film.id);
    return !!f && !!f.poster_url && f.runtime !== null && f.year !== null && vectorIds.has(f.id);
  }).length;

  // ── Kırılım ──
  const count = (pred: (a: Analysis) => boolean): number => analyses.filter(pred).length;
  const withDbImdb = analyses.filter((a) => a.film.imdb_id !== null);
  const withoutDbImdb = analyses.filter((a) => a.film.imdb_id === null);
  const tmdbOk = (a: Analysis): boolean => a.tmdb !== null && a.tmdb.status === 200;
  const hasDate = (a: Analysis): boolean => a.tmdb !== null && a.tmdb.status === 200 && !!a.tmdb.release_date;
  const hasFile = (a: Analysis): boolean => a.fileVotes !== null;
  const ge10k = (a: Analysis): boolean => (a.fileVotes ?? 0) >= MIN_VOTES;
  const primary = (a: Analysis): string => {
    const order: ReasonCode[] = ['lookup', 'date', 'nofile', 'votes', 'tierfloor', 'content', 'imdbid', 'concert', 'trending079', 'coretier'];
    return order.find((c) => a.flags.some((f) => f.code === c)) ?? 'ok';
  };
  const primaryCounts = new Map<string, number>();
  for (const a of analyses) primaryCounts.set(primary(a), (primaryCounts.get(primary(a)) ?? 0) + 1);
  const dbRatingDiff = rescues.filter((r) => !r.setRating && r.a.film.imdb_rating !== r.rating).length;
  const coreRescued = rescues.filter((r) => r.tier === 'core').length;
  const coreUnder10k = rescues.filter((r) => r.tier !== 'archive' && r.votes < MIN_VOTES).length;
  const trGenre = scope.filter((f) => f.tmdb_id !== null && cache[String(f.tmdb_id)]).length;
  const directorFilled = rescues.filter((r) => r.setDirector !== null).length;
  const directorMissing = analyses.filter((a) => a.flags.some((f) => f.code === 'no_director')).length;

  const status = (a: Analysis): string => {
    if (rescuedIds.has(a.film.id)) return `KURTARILDI → ${a.tier}`;
    return `SQL'de yok (${a.flags.map((f) => `[${f.code}] ${f.reason}`).join(' | ') || 'bayrak yok'})`;
  };
  const top30 = [...analyses].filter(hasFile).sort((x, y) => (y.fileVotes ?? 0) - (x.fileVotes ?? 0)).slice(0, 30);
  const iconicRows = ICONIC.map((ic) => {
    const a = analyses.find((x) => x.film.tmdb_id === ic.tmdbId);
    return { ic, a };
  });

  const md: string[] = [
    '# MOOD-VEC-2b Faz 2 (C grubu) — Adım 0: keşif',
    '',
    `31 Eki 2026 · dal \`feat/mood-vec-2b\` · **yalnız hazırlık**, canlıya yazılmadı. Betik: \`scripts/backfill-archive-c.ts\`.`,
    '',
    '## 1. Kapsam ve kırılım',
    '',
    '| | film |',
    '|---|---|',
    `| Kapsam (archive + release_date NULL) | **${scope.length}** |`,
    `| DB'de imdb_id dolu | ${withDbImdb.length} |`,
    `| DB'de imdb_id NULL | ${withoutDbImdb.length} |`,
    `| tmdb_id NULL | ${noTmdb} |`,
    `| TMDb çağrısı (yeni / cache'ten) | ${fetched} / ${scope.length - fetched} |`,
    `| TMDb 200 | ${count(tmdbOk)} |`,
    `| TMDb 404 | ${count((a) => a.tmdb?.status === 404)} |`,
    `| TMDb'de release_date **dolu** | ${count(hasDate)} |`,
    `| TMDb'de release_date **boş** (200 ama tarih yok) | ${count((a) => tmdbOk(a) && !a.tmdb?.release_date)} |`,
    `| imdb_id'si olan: ratings dosyasında **eşleşen** | ${count((a) => a.imdbId !== null && hasFile(a))} |`,
    `| imdb_id'si olan: ratings dosyasında **eşleşmeyen** | ${count((a) => a.imdbId !== null && !hasFile(a))} |`,
    `| imdb_id hiç bulunamayan (DB NULL + TMDb döndürmedi) | ${count((a) => a.imdbId === null)} |`,
    `| — DB imdb_id'li grupta dosyada eşleşen / toplam | ${withDbImdb.filter(hasFile).length} / ${withDbImdb.length} |`,
    `| — DB imdb_id'siz grupta (TMDb ile) eşleşen / toplam | ${withoutDbImdb.filter(hasFile).length} / ${withoutDbImdb.length} |`,
    `| Dosya oyu **>= 10.000** | ${count(ge10k)} |`,
    `| — bunlardan release_date dolu (TMDb) | ${count((a) => ge10k(a) && hasDate(a))} |`,
    `| — bunlardan tier archive kalan (rating < taban) | ${count((a) => ge10k(a) && a.tier === 'archive')} |`,
    `| — bunlardan içerik/imdb_id/konser/079/tarih bayrağı yüzünden SQL dışı | ${count((a) => ge10k(a) && a.tier !== 'archive' && a.flags.length > 0)} |`,
    `| **KURTARILAN (SQL'e giren)** | **${rescues.length}** |`,
    `| — core | ${coreRescued} |`,
    `| — extended | ${rescues.length - coreRescued} |`,
    `| — imdb_id yazılan (DB NULL idi) | ${rescues.filter((r) => r.setImdbId).length} |`,
    `| — imdb_rating yazılan (DB NULL idi) | ${rescues.filter((r) => r.setRating).length} |`,
    `| — DB rating dolu ve dosyadan farklı (rating'e dokunulmaz, tier dosya değeriyle) | ${dbRatingDiff} |`,
    `| — havuz kapısını (poster/runtime/year/profile_vector + yeni date) geçen | ${rescuedPoolEligible} |`,
    `| — director DB'de NULL idi, TMDb credits'ten dolan | ${directorFilled} |`,
    `| — director bulunamadı (needs-review, no_director) | ${directorMissing} |`,
    `| needs-review.csv satırı | ${reviewable.length} |`,
    '',
    '**core + oy < 10.000 (bilinen bug):** ' + (coreUnder10k === 0 ? 'yok (eşik zaten filtreliyor; kontrol bayrağı `coretier` çalıştırıldı)' : `${coreUnder10k} — needs-review'a atıldı`),
    `· \`coretier\` bayrağı taşıyan: ${count((a) => a.flags.some((f) => f.code === 'coretier'))}`,
    '',
    '### Birincil elenme nedeni (bir film birden çok bayrak taşıyabilir; sırayla ilk)',
    '',
    ...[...primaryCounts.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n}`),
    '',
    '## 2. En yüksek oylu 30 film (dosya oyu, 951 içinden)',
    '',
    '| # | film | yıl | tmdb | imdb_id | rating/oy | tier | durum |',
    '|---|---|---|---|---|---|---|---|',
    ...top30.map((a, i) => `| ${i + 1} | ${a.film.title} | ${a.film.year} | ${a.film.tmdb_id} | ${a.imdbId}${a.imdbIdNew ? '*' : ''} | ${a.fileRating}/${fmt(a.fileVotes as number)} | ${a.tier} | ${status(a)} |`),
    '',
    '`*` = imdb_id TMDb\'den tamamlandı.',
    '',
    '## 3. Sekiz ikonik film',
    '',
    '| film | tmdb_id | kapsamda mı | DB imdb_id | TMDb release_date | rating/oy | tier | durum |',
    '|---|---|---|---|---|---|---|---|',
    ...iconicRows.map(({ ic, a }) =>
      a
        ? `| ${ic.name} | ${ic.tmdbId} | evet (${a.film.title}, ${a.film.year}) | ${a.film.imdb_id ?? 'NULL'} → ${a.imdbId ?? '—'} | ${a.releaseDate ?? '—'} | ${a.fileRating ?? '—'}/${a.fileVotes !== null ? fmt(a.fileVotes) : '—'} | ${a.tier ?? '—'} | ${status(a)} |`
        : `| ${ic.name} | ${ic.tmdbId} | **hayır** (kapsamda bulunamadı) | — | — | — | — | araştırılmalı |`,
    ),
    '',
    '## 4. Gauntlet etkisi (tahmin; yalnız hesap)',
    '',
    'Havuz tahmini: tier ∈ kümesi + release_date ≤ bugün + poster/runtime/year + profile_vector + imdb_votes > 0 (Faz 1 raporlarıyla aynı yöntem; `maxRuntime` ve `isDuelEligible` modellenmedi). Yüzdelik: `percentRanks` semantiği, bant p55–p80.',
    `Kurtarılan ${rescues.length} filmin ${rescuedPoolEligible}'i kapıyı geçer; kalanı poster/runtime/year/profile_vector eksiği yüzünden havuza girmez.`,
    '',
    ...impacts.flatMap((s) => {
      const row = (i: Impact): string[] => [
        `**${i.label}**`,
        '',
        '| | önce | sonra |',
        '|---|---|---|',
        `| havuz (votes'lu) | ${fmt(i.before.n)} | ${fmt(i.after.n)} (+${i.added}: core ${i.addedCore}, extended ${i.addedExt}) |`,
        `| p55 oy | ${fmt(Math.round(i.before.p55))} | ${fmt(Math.round(i.after.p55))} (${(((i.after.p55 / i.before.p55) - 1) * 100).toFixed(1)}%) |`,
        `| p80 oy | ${fmt(Math.round(i.before.p80))} | ${fmt(Math.round(i.after.p80))} (${(((i.after.p80 / i.before.p80) - 1) * 100).toFixed(1)}%) |`,
        `| medyan oy | ${fmt(Math.round(i.before.median))} | ${fmt(Math.round(i.after.median))} |`,
        `| mevcut filmlerden banttan çıkan / giren | | ${i.exits} / ${i.enters} |`,
        `| yeni filmlerden bantta | | ${i.newInBand} / ${i.added} |`,
        '',
      ];
      return [`### ${s.name}${s.name.startsWith('B') ? ` (bekleyen UPDATE uygulanan: ${withPending.applied})` : ''}`, '', ...row(s.daily), ...row(s.global)];
    }),
    '## 5. Çıktı dosyaları ve notlar',
    '',
    `- Payload: \`c-payload.tsv\` (${rescues.length} satır); SQL üretilmez.`,
    `- Tür etiketi: payload \`genres\`, \`original_language\`'e **dokunmuyor** (istenmedi). Faz 1 keşfi arşivde Türkçe tür etiketlerinin yaygın olduğunu gösterdi; gauntlet \`genres[0]\`'ı ham sayıyor (çeşitlilik kuralı). TMDb en-US tür adları cache'te (\`genres\`) duruyor, ayrı bir karar/SQL gerekir.`,
    `- \`c-tmdb-cache.json\` kırpılmış alan kümesi tutar (id, imdb_id, release_date, title, runtime, status, language, genres, poster_path); ${trGenre} kayıt.`,
    '',
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'c-discovery.md'), md.join('\n'));

  console.log(`Kurtarılan: ${rescues.length} (core ${coreRescued}); needs-review: ${reviewable.length}`);
  console.log(`Director dolan: ${directorFilled}; bulunamayan: ${directorMissing}`);
  const yearTol = rescues.filter((r) => {
    const b = r.a.imdbIdNew && r.a.imdbId ? basics.get(r.a.imdbId) : undefined;
    return !!b && b.startYear !== r.a.film.year;
  }).length;
  console.log(`Yıl toleransıyla eklenen (startYear != DB yılı): ${yearTol}`);
  for (const { ic, a } of iconicRows) {
    console.log(`İkonik ${ic.name}: ${a ? (rescuedIds.has(a.film.id) ? `LİSTEDE (${a.tier})` : 'LİSTEDE DEĞİL') : 'kapsamda yok'}`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
