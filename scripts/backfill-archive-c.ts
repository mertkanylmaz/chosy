/**
 * MOOD-VEC-2b Faz 2 (C grubu) — ADIM 0: keşif + hazırlık
 *
 * Bu betik CANLI DB'YE YAZMAZ. Yalnız okur (anon) ve docs/investigations/mood-vec-2b/ altına yazar:
 *   c-tmdb-cache.json      — TMDb yanıtlarının kırpılmış hâli (tekrar çağrı gerekmesin)
 *   c-discovery.md         — kırılım, ilk 30, 8 ikonik film, gauntlet etkisi
 *   c-apply[-N].sql / c-rollback[-N].sql — UPDATE'ler (parça başına ≤ 10.000 bayt)
 *   c-needs-review.csv     — kurtarılabilir ama SQL'e girmeyen filmler
 *
 * Kapsam: films WHERE curation_tier='archive' AND release_date IS NULL.
 *   - TMDb /movie/{tmdb_id}?append_to_response=external_ids → release_date + imdb_id
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
const STAMP = '20261031';
const MIN_RUNTIME = 60;
const RUNTIME_TOLERANCE = 5;
const MIN_VOTES = 10000;
const MAX_FILE_BYTES = 10000;
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
  | 'coretier';

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

function sqlNum(value: number | null): string {
  return value === null ? 'NULL' : String(value);
}

function comment(s: string): string {
  return s.replace(/[\r\n]+/g, ' ');
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

async function tmdbGet(tmdbId: number): Promise<TmdbEntry> {
  const key = requireEnv('EXPO_PUBLIC_TMDB_API_KEY');
  const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${key}&append_to_response=external_ids`;
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
    if (res.status === 404) {
      return {
        status: 404, fetched_at: new Date().toISOString(), imdb_id: null, release_date: null, title: null,
        original_title: null, runtime: null, tmdb_status: null, original_language: null, genres: [], poster_path: null,
      };
    }
    if (!res.ok) throw new Error(`TMDb ${tmdbId}: HTTP ${res.status}`);
    const b = (await res.json()) as {
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
    };
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
  throw new Error(`TMDb ${tmdbId}: ${MAX_ATTEMPTS} denemede başarısız`);
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
        if (b.startYear !== film.year) a.flags.push({ code: 'imdbid', reason: `TMDb imdb_id: yıl tam uyuşmuyor (DB ${film.year} / IMDb ${b.startYear})` });
        if (b.runtimeMinutes === null || film.runtime === null || Math.abs(b.runtimeMinutes - film.runtime) > RUNTIME_TOLERANCE) {
          a.flags.push({ code: 'imdbid', reason: `TMDb imdb_id: runtime ±${RUNTIME_TOLERANCE} dışı (DB ${film.runtime} / IMDb ${b?.runtimeMinutes})` });
        }
        const n = keyCounts.get(`${normTitle(film.title)}|${film.year}`) ?? 0;
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
}

function updateLine(r: Rescue): { up: string; down: string; label: string } {
  const f = r.a.film;
  const oldV = sqlNum(r.oldVotes);
  const label = `-- ${comment(f.title)} (${f.year}) ${r.rating}/${r.votes} → ${r.tier}`;
  const sets = [`release_date = '${r.releaseDate}'`];
  if (r.setImdbId) sets.push(`imdb_id = '${r.a.imdbId}'`);
  sets.push(`imdb_votes = ${r.votes}`);
  if (r.setRating) sets.push(`imdb_rating = ${r.rating}`);
  sets.push(`curation_tier = '${r.tier}'`);
  const guards = [`id = '${f.id}'`, `curation_tier = 'archive'`, `release_date IS NULL`, `imdb_votes IS NOT DISTINCT FROM ${oldV}`];
  if (r.setImdbId) guards.push('imdb_id IS NULL');
  if (r.setRating) guards.push('imdb_rating IS NULL');
  const up = `UPDATE films SET ${sets.join(', ')} WHERE ${guards.join(' AND ')};`;

  const dsets = [`release_date = NULL`];
  if (r.setImdbId) dsets.push('imdb_id = NULL');
  dsets.push(`imdb_votes = ${oldV}`);
  if (r.setRating) dsets.push('imdb_rating = NULL');
  dsets.push(`curation_tier = 'archive'`);
  const dguards = [`id = '${f.id}'`, `curation_tier = '${r.tier}'`, `release_date = '${r.releaseDate}'`, `imdb_votes = ${r.votes}`];
  if (r.setImdbId) dguards.push(`imdb_id = '${r.a.imdbId}'`);
  if (r.setRating) dguards.push(`imdb_rating = ${r.rating}`);
  const down = `UPDATE films SET ${dsets.join(', ')} WHERE ${dguards.join(' AND ')};`;
  return { up, down, label };
}

function buildApply(rows: Rescue[], table: string, n: number | null, total: number | null): string {
  const part = n === null ? '' : ` (parça ${n}/${total})`;
  const lines = [
    `-- MOOD-VEC-2b Faz 2C${part}: ${rows.length} arşiv filminin release_date[/imdb_id] + imdb_votes[/imdb_rating] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.`,
    "-- Kaynak: TMDb (release_date, imdb_id) + IMDb veri dosyası (oy/rating). Her UPDATE filmin hâlâ archive + release_date NULL + oyun eski değerde olduğunu doğrular.",
    `-- Beklenen: ${rows.length} UPDATE × 1 satır.`,
    '',
    'BEGIN;',
    '',
    `CREATE TABLE ${table} AS`,
    `  SELECT id, imdb_id, imdb_rating, imdb_votes, release_date, curation_tier FROM films WHERE id IN (${rows.map((r) => `'${r.a.film.id}'`).join(', ')});`,
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    '',
  ];
  for (const r of rows) {
    const u = updateLine(r);
    lines.push(u.label, u.up);
  }
  lines.push(
    '',
    `DO $$`,
    'DECLARE _backup INT; _unchanged INT;',
    'BEGIN',
    `  SELECT count(*) INTO _backup FROM ${table};`,
    `  SELECT count(*) INTO _unchanged FROM films f JOIN ${table} b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;`,
    `  IF _backup <> ${rows.length} THEN RAISE EXCEPTION 'ABORT: yedek % satir (beklenen ${rows.length})', _backup; END IF;`,
    `  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film degismedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;`,
    'END $$;',
    '',
    'COMMIT;',
    '',
  );
  return lines.join('\n');
}

function buildRollback(rows: Rescue[], n: number | null, total: number | null): string {
  const part = n === null ? '' : ` (parça ${n}/${total})`;
  const lines = [
    `-- MOOD-VEC-2b Faz 2C${part}: c-apply'ın geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.`,
    '-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (release_date NULL, tier archive) döndürür.',
    '',
    'BEGIN;',
    '',
  ];
  for (const r of rows) {
    const u = updateLine(r);
    lines.push(u.label, u.down);
  }
  lines.push('', 'COMMIT;', '');
  return lines.join('\n');
}

/** Parça başına hem apply hem rollback ≤ MAX_FILE_BYTES olacak şekilde açgözlü paketleme. */
function pack(rescues: Rescue[]): Rescue[][] {
  const chunks: Rescue[][] = [];
  let cur: Rescue[] = [];
  const fits = (rows: Rescue[]): boolean =>
    Buffer.byteLength(buildApply(rows, `films_phase2c_backup_${STAMP}_99`, 99, 99)) <= MAX_FILE_BYTES &&
    Buffer.byteLength(buildRollback(rows, 99, 99)) <= MAX_FILE_BYTES;
  for (const r of rescues) {
    if (cur.length > 0 && !fits([...cur, r])) {
      chunks.push(cur);
      cur = [];
    }
    cur.push(r);
  }
  if (cur.length > 0) chunks.push(cur);
  return chunks;
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
    if (!f.imdb_id && f.year !== null) wantedKeys.add(`${normTitle(f.title)}|${f.year}`);
  }
  console.log(`IMDb dosyaları taranıyor (${wanted.size} tconst)…`);
  const { rows: basics, keyCounts } = await readBasics(wanted, wantedKeys);
  const ratings = await readRatings(wanted);

  const analyses = scope.map((f) =>
    analyze(f, f.tmdb_id !== null ? cache[String(f.tmdb_id)] ?? null : null, basics, ratings, keyCounts, today),
  );

  // Kurtarılanlar: bayrak yok (tier archive değil, oy >= 10k, tarih geçerli, içerik temiz)
  const rescues: Rescue[] = analyses
    .filter((a) => a.flags.length === 0 && a.tier !== null && a.tier !== 'archive' && a.releaseDate !== null)
    .map((a) => ({
      a,
      tier: a.tier as string,
      releaseDate: a.releaseDate as string,
      votes: a.fileVotes as number,
      rating: a.fileRating as number,
      oldVotes: a.film.imdb_votes,
      setRating: a.film.imdb_rating === null,
      setImdbId: a.imdbIdNew,
    }))
    .sort((x, y) => x.a.film.id.localeCompare(y.a.film.id));
  const rescuedIds = new Set(rescues.map((r) => r.a.film.id));

  // ── SQL dosyaları ──
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^c-(apply|rollback)(-\d+)?\.sql$/.test(f)) fs.unlinkSync(path.join(OUT_DIR, f));
  }
  const chunks = pack(rescues);
  const outFiles: string[] = [];
  chunks.forEach((rows, i) => {
    const single = chunks.length === 1;
    const n = i + 1;
    const table = single ? `films_phase2c_backup_${STAMP}` : `films_phase2c_backup_${STAMP}_${n}`;
    const aName = single ? 'c-apply.sql' : `c-apply-${n}.sql`;
    const rName = single ? 'c-rollback.sql' : `c-rollback-${n}.sql`;
    fs.writeFileSync(path.join(OUT_DIR, aName), buildApply(rows, table, single ? null : n, chunks.length));
    fs.writeFileSync(path.join(OUT_DIR, rName), buildRollback(rows, single ? null : n, chunks.length));
    outFiles.push(aName, rName);
  });

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
  const noDirector = rescues.filter((r) => r.a.film.director === null).length;

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
    `| — director NULL (gauntlet "bilinmeyen yönetmen" kovası) | ${noDirector} |`,
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
    `- SQL parçası: ${chunks.length} (${chunks.map((c) => c.length).join(' + ')} UPDATE); her parça ≤ ${MAX_FILE_BYTES} bayt.`,
    `- Tür etiketi: bu SQL \`genres\`, \`director\`, \`original_language\`'e **dokunmuyor** (istenmedi). Faz 1 keşfi arşivde Türkçe tür etiketlerinin yaygın olduğunu gösterdi; gauntlet \`genres[0]\`'ı ham sayıyor (çeşitlilik kuralı). TMDb en-US tür adları cache'te (\`genres\`) duruyor, ayrı bir karar/SQL gerekir.`,
    `- \`c-tmdb-cache.json\` kırpılmış alan kümesi tutar (id, imdb_id, release_date, title, runtime, status, language, genres, poster_path); ${trGenre} kayıt.`,
    '',
  ];
  fs.writeFileSync(path.join(OUT_DIR, 'c-discovery.md'), md.join('\n'));

  console.log(`Kurtarılan: ${rescues.length} (core ${coreRescued}); parça: ${chunks.length}; needs-review: ${reviewable.length}`);
  console.log(`Dosyalar: ${outFiles.join(', ')}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
