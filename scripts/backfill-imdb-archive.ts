/**
 * MOOD-VEC-2b Faz 1 — arşiv geri kazanımı (A: yalnız tier, B: imdb alanları + tier)
 *
 * Bu betik CANLI DB'YE YAZMAZ. Yalnız SQL/CSV üretir (docs/investigations/mood-vec-2b/):
 *   phase1a-apply.sql / phase1a-rollback.sql   — DB'de rating+votes zaten dolu, yalnız curation_tier
 *   phase1b-apply.sql / phase1b-rollback.sql   — imdb_rating/imdb_votes[/imdb_id] + curation_tier
 *   needs-review.csv                           — içerik taramasına takılan filmler (SQL'e GİRMEZ)
 *   phase1-rows.json, phase1-summary.md
 *
 * Kapsam: curation_tier = 'archive' ve havuz kapısını (gauntletCore fetchPool) DOĞRUDAN geçenler:
 * release_date <= bugün, poster_url, runtime, year, profile_vector. release_date NULL olanlar
 * (Faz 2 / C grubu) bu betikte YOK.
 *   A: imdb_rating ve imdb_votes DB'de dolu
 *   B: imdb_rating NULL → IMDb veri dosyasından (OMDb yok); imdb_id boşsa TMDb external_ids,
 *      yanlış eşleşme kontrolü: tam yıl + runtime ±5 dk + (başlık, yıl) tekil
 * Yeni tier: scripts/assign-tiers.ts determineCurationTier (kural B, current_tier 'archive').
 * Yalnız tier'ı archive'dan ÇIKAN filmler SQL'e girer.
 *
 * İçerik taraması (title.basics.tsv.gz): titleType 'movie', isAdult 0, 'Adult' türü yok,
 * runtime >= 60 (DB ve basics). Belirsiz grup bayraklanır (Documentary/Music/Talk-Show/Reality-TV,
 * başlıkta Live/Tour/Concert/Special/Stand-Up, tvMovie/video/tvSpecial). Bayraklı film SQL'e girmez.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-imdb-archive.ts
 *
 * Env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_TMDB_API_KEY
 * Veri: data/imdb/title.ratings.tsv.gz, data/imdb/title.basics.tsv.gz (gitignored)
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

const RATINGS_PATH = path.join(process.cwd(), 'data', 'imdb', 'title.ratings.tsv.gz');
const BASICS_PATH = path.join(process.cwd(), 'data', 'imdb', 'title.basics.tsv.gz');
const OUT_DIR = path.join(process.cwd(), 'docs', 'investigations', 'mood-vec-2b');

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
  genres: string[] | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  oscar_wins: number | null;
  oscar_nominations: number | null;
  tmdb_keywords: string[] | null;
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

interface Candidate {
  film: FilmRow;
  phase: 'A' | 'B';
  imdbId: string | null;
  /** B'de imdb_id TMDb'den tamamlandıysa true (UPDATE'e imdb_id eklenir). */
  imdbIdNew: boolean;
  rating: number | null;
  votes: number | null;
}

/**
 * Hariç tutma nedeni kodları, CTO filtre sırası (Adım 1b): 1 oy, 2 içerik, 3 konser, 4 079, 5 oy tabanı.
 * 'imdbid' TMDb'den tamamlanan imdb_id'nin doğrulama hatası (içerikten sonra).
 */
type ReasonCode = 'votes' | 'inconsistent' | 'content' | 'imdbid' | 'concert' | 'trending079' | 'tierfloor';

const REASON_ORDER: ReasonCode[] = ['votes', 'inconsistent', 'content', 'imdbid', 'concert', 'trending079', 'tierfloor'];

interface Flag {
  code: ReasonCode;
  reason: string;
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

// ── Okuma (anon, salt okunur) ───────────────────────────────────────────────

function client() {
  return createClient(
    requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
    requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
}

async function fetchArchive(): Promise<FilmRow[]> {
  const sb = client();
  const rows: FilmRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('films')
      .select(
        'id, tmdb_id, imdb_id, title, year, runtime, release_date, poster_url, director, genres, imdb_rating, imdb_votes, metascore, oscar_wins, oscar_nominations, tmdb_keywords, curation_tier',
      )
      .eq('curation_tier', 'archive')
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

/** profile_vector dolu film id'leri (yalnız id çekilir). */
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

/**
 * TMDb external_ids → imdb_id; yoksa veya film TMDb'de bulunamazsa (404) null — çağıran
 * `unresolvedB` listesine yazar, sessiz değil. Diğer HTTP/ağ hatalarında throw eder.
 */
async function fetchImdbIdFromTmdb(tmdbId: number): Promise<string | null> {
  const key = requireEnv('EXPO_PUBLIC_TMDB_API_KEY');
  const res = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}/external_ids?api_key=${key}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`TMDb external_ids ${tmdbId}: HTTP ${res.status}`);
  const body = (await res.json()) as { imdb_id?: string | null };
  return body.imdb_id && body.imdb_id.length > 0 ? body.imdb_id : null;
}

async function* tsvLines(file: string, expectedHeader: string): AsyncGenerator<string[]> {
  if (!fs.existsSync(file)) fail(`Dosya yok: ${file}`);
  const rl = readline.createInterface({
    input: fs.createReadStream(file).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
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

/**
 * Tek geçiş: istenen tconst'ların basics satırı + istenen (normTitle|yıl) anahtarları için
 * 'movie' sayısı (tekillik kontrolü).
 */
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

// ── Filtreler (Adım 1b) ─────────────────────────────────────────────────────

/** Filtre 1: DB/IMDb oy tabanı (Adım 1b: kural B'nin 5.000'inden yüksek). */
const MIN_VOTES_PHASE1 = 10000;

/** Filtre 2: izin verilen titleType. tvMovie/video yalnız ALLOW_NON_MOVIE_TITLES ile geçer. */
const SOFT_TYPES = ['tvMovie', 'video'];
const ALLOW_NON_MOVIE_TITLES = ["angel's egg"];
const EXCLUDED_GENRES = ['Documentary', 'Talk-Show', 'Reality-TV'];

/** Filtre 3: konser/performans (başlık öneki, küçük harf). Her biri tam bir filme denk gelmeli (rapor doğrular). */
const CONCERT_PREFIXES = [
  'bts world tour',
  'blackpink: light up the sky',
  'burn the stage',
  'bring the soul',
  'history on film, volume ii',
  "avicii - i'm tim",
];

/** Filtre 4: 079 trending-restore ile arşive düşen filmler (başlık, küçük harf). */
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

/** Filtre 2: içerik. Her bayrak SQL'den dışlar. */
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

// ── Tier ────────────────────────────────────────────────────────────────────

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

// ── SQL ─────────────────────────────────────────────────────────────────────

function backupBlock(table: string, columns: string, ids: string[]): string[] {
  const list = ids.map((i) => `'${i}'`).join(', ');
  return [
    `-- Yedek: değişecek ${ids.length} filmin önceki değerleri. Tablo zaten varsa bu satır hata verir ve işlem durur (üzerine yazma yok).`,
    `CREATE TABLE ${table} AS`,
    `  SELECT ${columns} FROM films WHERE id IN (${list});`,
    `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
    '',
  ];
}

/** Sessiz 0-satır UPDATE'e karşı: yedekteki her filmin tier'ı değişmiş olmalı, yedek satır sayısı beklenen olmalı. */
function guardBlock(table: string, expected: number): string[] {
  return [
    '',
    `-- Doğrulama: yedek ${expected} satır olmalı ve hiçbir film eski tier'da kalmamalı; aksi halde işlem geri alınır.`,
    'DO $$',
    'DECLARE _backup INT; _unchanged INT;',
    'BEGIN',
    `  SELECT count(*) INTO _backup FROM ${table};`,
    `  SELECT count(*) INTO _unchanged FROM films f JOIN ${table} b ON b.id = f.id WHERE f.curation_tier = b.curation_tier;`,
    `  IF _backup <> ${expected} THEN RAISE EXCEPTION 'ABORT: yedek % satır (beklenen ${expected})', _backup; END IF;`,
    `  IF _unchanged <> 0 THEN RAISE EXCEPTION 'ABORT: % film tier degistirmedi (UPDATE 0 satir etkiledi)', _unchanged; END IF;`,
    'END $$;',
  ];
}

async function main(): Promise<void> {
  const archive = await fetchArchive();
  const vectorIds = await fetchVectorIds();
  const today = new Date().toISOString().slice(0, 10);
  console.log(`Arşiv: ${archive.length} film; profile_vector dolu film: ${vectorIds.size}; bugün (UTC) ${today}`);

  // Havuz kapısını doğrudan geçenler (gauntletCore.ts fetchPool koşulları)
  const gated = archive.filter(
    (f) =>
      f.release_date !== null &&
      f.release_date <= today &&
      !!f.poster_url &&
      f.runtime !== null &&
      f.year !== null &&
      vectorIds.has(f.id),
  );
  console.log(`Kapıyı doğrudan geçen arşiv filmi: ${gated.length}`);

  // B: imdb_id boşsa TMDb external_ids
  const candidates: Candidate[] = [];
  const unresolvedB: { film: FilmRow; why: string }[] = [];
  for (const film of gated) {
    if (film.imdb_rating !== null && film.imdb_votes !== null) {
      candidates.push({ film, phase: 'A', imdbId: film.imdb_id, imdbIdNew: false, rating: film.imdb_rating, votes: film.imdb_votes });
      continue;
    }
    if (film.imdb_rating !== null) continue; // rating var, votes yok: kapsam dışı (raporlanır)
    let imdbId = film.imdb_id;
    let isNew = false;
    if (!imdbId) {
      if (film.tmdb_id === null) {
        unresolvedB.push({ film, why: 'tmdb_id NULL' });
        continue;
      }
      imdbId = await fetchImdbIdFromTmdb(film.tmdb_id);
      isNew = true;
      if (!imdbId) {
        unresolvedB.push({ film, why: 'TMDb external_ids imdb_id döndürmedi (null veya 404)' });
        continue;
      }
    }
    candidates.push({ film, phase: 'B', imdbId, imdbIdNew: isNew, rating: null, votes: null });
  }
  const partial = gated.filter((f) => f.imdb_rating !== null && f.imdb_votes === null).length;

  // Basics + ratings (tek geçişler)
  const wanted = new Set<string>();
  const wantedKeys = new Set<string>();
  for (const c of candidates) {
    if (c.imdbId) wanted.add(c.imdbId);
    if (c.imdbIdNew && c.film.year !== null) wantedKeys.add(`${normTitle(c.film.title)}|${c.film.year}`);
  }
  const { rows: basics, keyCounts } = await readBasics(wanted, wantedKeys);
  const ratings = await readRatings(wanted);

  const flagged: { c: Candidate; tier: string; flags: Flag[] }[] = [];
  const kept: { c: Candidate; tier: string }[] = [];
  const notInFile: Candidate[] = [];
  const stayArchive: Candidate[] = [];

  for (const c of candidates) {
    const f = c.film;
    const b = c.imdbId ? basics.get(c.imdbId) : undefined;
    const fileRow = c.imdbId ? ratings.get(c.imdbId) : undefined;

    if (c.phase === 'B') {
      if (!fileRow) {
        notInFile.push(c);
        continue;
      }
      c.rating = fileRow.rating;
      c.votes = fileRow.votes;
    }

    const tier = newTier(f, c.rating, c.votes);
    if (tier === 'archive') {
      stayArchive.push(c);
      continue;
    }

    const flags: Flag[] = [];
    // 1) oy tabanı: karar verilen değer (A: DB, B: IMDb dosyası) >= 10.000; DB ve dosya eşiğin
    //    iki ayrı yanındaysa (tutarsız) film atlanır ve listelenir.
    const used = c.votes ?? 0;
    const dbVotes = f.imdb_votes;
    const fileVotes = fileRow ? fileRow.votes : null;
    const other = c.phase === 'A' ? fileVotes : dbVotes;
    const where = `DB ${dbVotes ?? 'NULL'} / dosya ${fileVotes ?? 'yok'}`;
    if (other !== null && used >= MIN_VOTES_PHASE1 !== other >= MIN_VOTES_PHASE1) {
      flags.push({
        code: 'inconsistent',
        reason: `oy tutarsız: kullanılan ${used} (${used >= MIN_VOTES_PHASE1 ? '>=' : '<'} ${MIN_VOTES_PHASE1}), diğer kaynak ${other} (${where})`,
      });
    } else if (used < MIN_VOTES_PHASE1) {
      flags.push({ code: 'votes', reason: `votes ${used} < ${MIN_VOTES_PHASE1} (${where})` });
    }
    // 2) içerik
    flags.push(...screenContent(f, b));
    // TMDb'den gelen imdb_id'nin doğrulaması: tam yıl + runtime ±5 + (başlık,yıl) tekil
    if (c.imdbIdNew) {
      if (!b || b.titleType !== 'movie') {
        flags.push({ code: 'imdbid', reason: `TMDb imdb_id doğrulanamadı: basics movie değil (${b?.titleType ?? 'satır yok'})` });
      } else {
        if (b.startYear !== f.year) flags.push({ code: 'imdbid', reason: `TMDb imdb_id: yıl tam uyuşmuyor (DB ${f.year} / IMDb ${b.startYear})` });
        if (b.runtimeMinutes === null || f.runtime === null || Math.abs(b.runtimeMinutes - f.runtime) > RUNTIME_TOLERANCE) {
          flags.push({ code: 'imdbid', reason: `TMDb imdb_id: runtime ±${RUNTIME_TOLERANCE} dışı (DB ${f.runtime} / IMDb ${b.runtimeMinutes})` });
        }
        const n = keyCounts.get(`${normTitle(f.title)}|${f.year}`) ?? 0;
        if (n !== 1) flags.push({ code: 'imdbid', reason: `TMDb imdb_id: (başlık,yıl) tekil değil (${n} movie)` });
      }
    }
    // 3) konser/performans, 4) 079 trending-restore
    const concert = titleStartsWith(f.title, CONCERT_PREFIXES);
    if (concert) flags.push({ code: 'concert', reason: `konser/performans listesi ('${concert}')` });
    const t079 = titleEquals(f.title, TRENDING_079_TITLES);
    if (t079) flags.push({ code: 'trending079', reason: `079 trending-restore ile düşen ('${t079}')` });
    // 5) determineCurationTier core kurallarını oy tabanından ÖNCE uygular (fonksiyon değişmedi):
    //    kural B oy tabanının altındaki film core/extended dönebilir → SQL'e girmez.
    if (used < ARCHIVE_THRESHOLDS_STANDARD.minVotes) {
      flags.push({
        code: 'tierfloor',
        reason: `oy tabanı altı: votes ${used} < ${ARCHIVE_THRESHOLDS_STANDARD.minVotes} ama determineCurationTier ${tier} döndürdü`,
      });
    }
    if (flags.length > 0) flagged.push({ c, tier, flags });
    else kept.push({ c, tier });
  }

  kept.sort((x, y) => x.c.film.id.localeCompare(y.c.film.id));
  const keptA = kept.filter((k) => k.c.phase === 'A');
  const keptB = kept.filter((k) => k.c.phase === 'B');

  // ── Faz 1A SQL ────────────────────────────────────────────────────────────
  const tableA = `films_phase1a_backup_${STAMP}`;
  const upA: string[] = [
    `-- MOOD-VEC-2b Faz 1A: ${keptA.length} arşiv filminin curation_tier'ı (DB'de rating+votes zaten dolu). HAZIRLANDI, ÇALIŞTIRILMADI.`,
    '-- Yalnız films.curation_tier değişir. Her UPDATE filmin hâlâ archive olduğunu doğrular (kayma varsa 0 satır).',
    `-- Beklenen: ${keptA.length} UPDATE × 1 satır. Geri alma: phase1a-rollback.sql.`,
    '',
    'BEGIN;',
    '',
    ...backupBlock(tableA, 'id, curation_tier', keptA.map((k) => k.c.film.id)),
  ];
  const downA: string[] = [
    '-- MOOD-VEC-2b Faz 1A: phase1a-apply.sql\'in geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.',
    "-- Her UPDATE yalnız uygulanan yeni tier'daki satırı 'archive'e döndürür.",
    '',
    'BEGIN;',
    '',
  ];
  for (const { c, tier } of keptA) {
    const label = `-- ${comment(c.film.title)} (${c.film.year}, ${c.rating}/${c.votes}) → ${tier}`;
    upA.push(label, `UPDATE films SET curation_tier = '${tier}' WHERE id = '${c.film.id}' AND curation_tier = 'archive';`);
    downA.push(label, `UPDATE films SET curation_tier = 'archive' WHERE id = '${c.film.id}' AND curation_tier = '${tier}';`);
  }
  upA.push(...guardBlock(tableA, keptA.length), '', 'COMMIT;', '');
  downA.push('', 'COMMIT;', '');

  // ── Faz 1B SQL ────────────────────────────────────────────────────────────
  const tableB = `films_phase1b_backup_${STAMP}`;
  const upB: string[] = [
    `-- MOOD-VEC-2b Faz 1B: ${keptB.length} arşiv filminin imdb_rating/imdb_votes[/imdb_id] + curation_tier'ı. HAZIRLANDI, ÇALIŞTIRILMADI.`,
    '-- Kaynak: IMDb resmi veri dosyası (title.ratings.tsv.gz). Her UPDATE imdb_rating IS NULL ve curation_tier = archive doğrular.',
    `-- Beklenen: ${keptB.length} UPDATE × 1 satır (${keptB.filter((k) => k.c.imdbIdNew).length} tanesi imdb_id da yazar). Geri alma: phase1b-rollback.sql.`,
    '',
    'BEGIN;',
    '',
    ...backupBlock(tableB, 'id, imdb_id, imdb_rating, imdb_votes, curation_tier', keptB.map((k) => k.c.film.id)),
  ];
  const downB: string[] = [
    '-- MOOD-VEC-2b Faz 1B: phase1b-apply.sql\'in geri alması. HAZIRLANDI, ÇALIŞTIRILMADI.',
    "-- Her UPDATE yalnız uygulanan değerleri taşıyan satırı eski haline (rating NULL, tier archive) döndürür.",
    '',
    'BEGIN;',
    '',
  ];
  for (const { c, tier } of keptB) {
    const f = c.film;
    const label = `-- ${comment(f.title)} (${c.imdbId}) → ${tier}`;
    const setId = c.imdbIdNew ? `, imdb_id = '${c.imdbId}'` : '';
    upB.push(
      label,
      `UPDATE films SET imdb_rating = ${sqlNum(c.rating)}, imdb_votes = ${sqlNum(c.votes)}${setId}, curation_tier = '${tier}' WHERE id = '${f.id}' AND imdb_rating IS NULL AND curation_tier = 'archive';`,
    );
    downB.push(
      label,
      `UPDATE films SET imdb_rating = NULL, imdb_votes = ${sqlNum(f.imdb_votes)}${c.imdbIdNew ? ', imdb_id = NULL' : ''}, curation_tier = 'archive' WHERE id = '${f.id}' AND imdb_rating = ${sqlNum(c.rating)} AND curation_tier = '${tier}';`,
    );
  }
  upB.push(...guardBlock(tableB, keptB.length), '', 'COMMIT;', '');
  downB.push('', 'COMMIT;', '');

  // ── needs-review.csv ──────────────────────────────────────────────────────
  const csv: string[] = ['id,title,year,votes,rating,sebep'];
  const sortedFlagged = [...flagged].sort((x, y) => x.c.film.id.localeCompare(y.c.film.id));
  for (const { c, flags } of sortedFlagged) {
    const reason = flags.map((fl) => `[${fl.code}] ${fl.reason}`).join(' | ');
    csv.push([c.film.id, c.film.title, c.film.year, c.votes, c.rating, reason].map(csvCell).join(','));
  }

  // ── Çıktılar ──────────────────────────────────────────────────────────────
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'phase1a-apply.sql'), upA.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'phase1a-rollback.sql'), downA.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'phase1b-apply.sql'), upB.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'phase1b-rollback.sql'), downB.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'needs-review.csv'), csv.join('\n') + '\n');
  fs.writeFileSync(
    path.join(OUT_DIR, 'phase1-rows.json'),
    JSON.stringify(
      kept.map(({ c, tier }) => ({
        id: c.film.id,
        title: c.film.title,
        year: c.film.year,
        phase: c.phase,
        tier,
        rating: c.rating,
        votes: c.votes,
        imdb_id: c.imdbId,
        imdb_id_new: c.imdbIdNew,
      })),
      null,
      2,
    ) + '\n',
  );

  const allFlags = flagged.flatMap((x) => x.flags);
  const primary = (flags: Flag[]): ReasonCode => REASON_ORDER.find((code) => flags.some((fl) => fl.code === code)) as ReasonCode;
  const primaryCount = new Map<ReasonCode, number>();
  for (const x of flagged) primaryCount.set(primary(x.flags), (primaryCount.get(primary(x.flags)) ?? 0) + 1);
  const anyCount = (code: ReasonCode): number => flagged.filter((x) => x.flags.some((fl) => fl.code === code)).length;
  const byReason = new Map<string, number>();
  for (const fl of allFlags) {
    const key = `[${fl.code}] ${fl.reason.replace(/[0-9]+/g, 'N').replace(/'[^']*'/g, "'…'").replace(/((DB|dosya)[^)]*)/g, '(…)')}`;
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  const tierCount = (rows: { tier: string }[], t: string): number => rows.filter((r) => r.tier === t).length;
  const summary = [
    '# MOOD-VEC-2b Faz 1 — üretim özeti',
    '',
    `- Arşiv: ${archive.length}; kapıyı doğrudan geçen: ${gated.length}`,
    `- A adayı (DB rating+votes dolu): ${candidates.filter((c) => c.phase === 'A').length}; B adayı (rating NULL): ${candidates.filter((c) => c.phase === 'B').length}; B çözülemeyen (TMDb/tmdb_id): ${unresolvedB.length}`,
    `- rating dolu ama votes NULL (kapsam dışı): ${partial}`,
    `- B: veri dosyasında yok: ${notInFile.length}`,
    `- Tier'ı arşivde KALAN (kural B): ${stayArchive.length} (A ${stayArchive.filter((c) => c.phase === 'A').length}, B ${stayArchive.filter((c) => c.phase === 'B').length})`,
    `- Tier'ı arşivden ÇIKACAK adaylar (tier != archive): ${kept.length + flagged.length} → SQL'e giren ${kept.length}, hariç tutulan ${flagged.length} (A ${flagged.filter((x) => x.c.phase === 'A').length}, B ${flagged.filter((x) => x.c.phase === 'B').length})`,
    '- Hariç tutulanların BİRİNCİL nedeni (CTO filtre sırası; bir film birden çok bayrak taşıyabilir):',
    ...REASON_ORDER.map((code) => `  - ${code}: ${primaryCount.get(code) ?? 0} (bu bayrağı taşıyan toplam ${anyCount(code)})`),
    `- **Faz 1A SQL: ${keptA.length} film** (core ${tierCount(keptA.map((k) => ({ tier: k.tier })), 'core')}, extended ${tierCount(keptA.map((k) => ({ tier: k.tier })), 'extended')})`,
    `- **Faz 1B SQL: ${keptB.length} film** (core ${tierCount(keptB.map((k) => ({ tier: k.tier })), 'core')}, extended ${tierCount(keptB.map((k) => ({ tier: k.tier })), 'extended')}; imdb_id yazılan ${keptB.filter((k) => k.c.imdbIdNew).length})`,
    '',
    '## Bayrak dağılımı (film başına birden çok bayrak olabilir; sayılar bayrak adedi)',
    ...[...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k}: ${n}`),
    '',
    '## B — veri dosyasında bulunamayan',
    notInFile.length === 0 ? '_yok_' : notInFile.map((c) => `- ${c.film.title} (${c.imdbId})`).join('\n'),
    '',
    '## B — çözülemeyen',
    unresolvedB.length === 0 ? '_yok_' : unresolvedB.map((u) => `- ${u.film.title}: ${u.why}`).join('\n'),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'phase1-summary.md'), summary);
  console.log(summary);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
