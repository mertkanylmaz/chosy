/**
 * MOOD-VEC-2 — IMDb resmi veri dosyasıyla imdb_rating / imdb_votes backfill
 *
 * Kaynak: https://datasets.imdbws.com/title.ratings.tsv.gz
 *         (tconst, averageRating, numVotes) → data/imdb/ altında, repoya girmez.
 *
 * Bu betik CANLI DB'YE YAZMAZ. Yalnız SQL üretir:
 *   docs/investigations/mood-vec-2/backfill-imdb.sql
 *   docs/investigations/mood-vec-2/rollback-imdb.sql
 *   docs/investigations/mood-vec-2/imdb-dataset-rows.json
 *   docs/investigations/mood-vec-2/backfill-summary.md
 *
 * Kapsam: curation_tier ∈ {core, extended, trending} ve imdb_rating IS NULL.
 * Okuma anon anahtarla yapılır (service role yok).
 *
 * Eşleme: films.imdb_id = tconst. imdb_id'si NULL olan filmler için TMDb
 * /movie/{tmdb_id}/external_ids çağrılır; yine bulunamazsa SQL dışı raporlanır.
 * Dosyada bulunamayan film: imdb_rating NULL kalır, imdb_votes NULL'a çekilir
 * (kirli TMDb vekili); ham sayı metadata_json.vote_count'ta durur.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/backfill-imdb-dataset.ts
 *
 * Env: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, EXPO_PUBLIC_TMDB_API_KEY
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as zlib from 'zlib';

import { createClient } from '@supabase/supabase-js';

const TIERS = ['core', 'extended', 'trending'];
const PAGE = 1000;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

const RATINGS_PATH = path.join(process.cwd(), 'data', 'imdb', 'title.ratings.tsv.gz');
const OUT_DIR = path.join(process.cwd(), 'docs', 'investigations', 'mood-vec-2');

interface FilmRow {
  id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  imdb_rating: number | null;
  imdb_votes: number | null;
  curation_tier: string | null;
}

interface DatasetRow {
  tconst: string;
  averageRating: number;
  numVotes: number;
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

/** Kapsamdaki filmleri anon istemciyle sayfalayarak okur. */
async function fetchFilms(): Promise<FilmRow[]> {
  const sb = createClient(
    requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
    requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    { auth: { persistSession: false } },
  );
  const rows: FilmRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('films')
      .select('id, tmdb_id, imdb_id, title, imdb_rating, imdb_votes, curation_tier')
      .in('curation_tier', TIERS)
      .is('imdb_rating', null)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) fail(`films okunamadı: ${error.message}`);
    rows.push(...(data as FilmRow[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

/** TMDb external_ids → imdb_id; yoksa null. Ağ/HTTP hatasında throw eder. */
async function fetchImdbIdFromTmdb(tmdbId: number): Promise<string | null> {
  const key = requireEnv('EXPO_PUBLIC_TMDB_API_KEY');
  const res = await fetch(`${TMDB_BASE_URL}/movie/${tmdbId}/external_ids?api_key=${key}`);
  if (!res.ok) throw new Error(`TMDb external_ids ${tmdbId}: HTTP ${res.status}`);
  const body = (await res.json()) as { imdb_id?: string | null };
  return body.imdb_id && body.imdb_id.length > 0 ? body.imdb_id : null;
}

/** Dosyayı akış olarak okur, yalnız istenen tconst'ların satırını döndürür. */
async function readDataset(wanted: Set<string>): Promise<Map<string, DatasetRow>> {
  if (!fs.existsSync(RATINGS_PATH)) fail(`Dosya yok: ${RATINGS_PATH}`);
  const found = new Map<string, DatasetRow>();
  const rl = readline.createInterface({
    input: fs.createReadStream(RATINGS_PATH).pipe(zlib.createGunzip()),
    crlfDelay: Infinity,
  });
  let header = true;
  for await (const line of rl) {
    if (header) {
      if (line !== 'tconst\taverageRating\tnumVotes') fail(`Beklenmeyen başlık: ${line}`);
      header = false;
      continue;
    }
    const [tconst, rating, votes] = line.split('\t');
    if (!wanted.has(tconst)) continue;
    const averageRating = Number(rating);
    const numVotes = Number(votes);
    if (!Number.isFinite(averageRating) || !Number.isInteger(numVotes)) {
      fail(`Bozuk satır: ${line}`);
    }
    found.set(tconst, { tconst, averageRating, numVotes });
  }
  return found;
}

function sqlNum(value: number | null): string {
  return value === null ? 'NULL' : String(value);
}

async function main(): Promise<void> {
  const films = await fetchFilms();
  console.log(`Kapsam: ${films.length} film`);

  // imdb_id'siz filmleri TMDb'den tamamla
  const tmdbResolved = new Map<string, string>();
  const unresolved: FilmRow[] = [];
  for (const film of films.filter((f) => !f.imdb_id)) {
    const resolved = film.tmdb_id === null ? null : await fetchImdbIdFromTmdb(film.tmdb_id);
    if (resolved) tmdbResolved.set(film.id, resolved);
    else unresolved.push(film);
  }

  const imdbIdOf = (f: FilmRow): string | null => f.imdb_id ?? tmdbResolved.get(f.id) ?? null;
  const wanted = new Set<string>();
  for (const f of films) {
    const id = imdbIdOf(f);
    if (id) wanted.add(id);
  }
  const dataset = await readDataset(wanted);

  const up: string[] = ['BEGIN;', ''];
  const down: string[] = ['BEGIN;', ''];
  const matched: DatasetRow[] = [];
  const notInFile: FilmRow[] = [];
  let clearedVotes = 0;

  for (const film of films) {
    const imdbId = imdbIdOf(film);
    if (!imdbId) continue; // SQL dışı, unresolved'da raporlanır
    const row = dataset.get(imdbId);
    const setImdbId = film.imdb_id ? '' : `, imdb_id = '${imdbId}'`;
    const label = `-- ${film.title.replace(/[\r\n]+/g, ' ')} (${imdbId})`;

    if (row) {
      matched.push(row);
      up.push(
        label,
        `UPDATE films SET imdb_rating = ${row.averageRating}, imdb_votes = ${row.numVotes}${setImdbId} WHERE id = '${film.id}' AND imdb_rating IS NULL;`,
      );
      down.push(
        label,
        `UPDATE films SET imdb_rating = NULL, imdb_votes = ${sqlNum(film.imdb_votes)}${film.imdb_id ? '' : ', imdb_id = NULL'} WHERE id = '${film.id}' AND imdb_rating = ${row.averageRating};`,
      );
    } else {
      notInFile.push(film);
      // Dosyada yok: rating NULL kalır. Kirli TMDb vekili imdb_votes'u NULL'a çek.
      if (film.imdb_votes !== null || setImdbId) {
        const sets = [film.imdb_votes !== null ? 'imdb_votes = NULL' : '', setImdbId.slice(2)]
          .filter(Boolean)
          .join(', ');
        if (film.imdb_votes !== null) clearedVotes++;
        up.push(label + ' [dosyada yok]', `UPDATE films SET ${sets} WHERE id = '${film.id}' AND imdb_rating IS NULL;`);
        const back = [
          film.imdb_votes !== null ? `imdb_votes = ${film.imdb_votes}` : '',
          film.imdb_id ? '' : 'imdb_id = NULL',
        ]
          .filter(Boolean)
          .join(', ');
        down.push(label + ' [dosyada yok]', `UPDATE films SET ${back} WHERE id = '${film.id}' AND imdb_rating IS NULL;`);
      }
    }
  }
  up.push('', 'COMMIT;', '');
  down.push('', 'COMMIT;', '');

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'backfill-imdb.sql'), up.join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'rollback-imdb.sql'), down.join('\n'));
  fs.writeFileSync(
    path.join(OUT_DIR, 'imdb-dataset-rows.json'),
    JSON.stringify(matched, null, 2) + '\n',
  );

  const list = (rows: FilmRow[]): string =>
    rows.length === 0 ? '_yok_' : rows.map((f) => `- ${f.title} (${imdbIdOf(f) ?? 'imdb_id yok'}, tmdb ${f.tmdb_id})`).join('\n');
  const summary = [
    '# MOOD-VEC-2 — IMDb veri dosyası backfill özeti',
    '',
    `- Kapsam: ${films.length} film (tier ${TIERS.join('/')}, imdb_rating IS NULL)`,
    `- Dosyada bulundu (rating + votes yazılacak): ${matched.length}`,
    `- Dosyada yok (rating NULL kalır): ${notInFile.length}`,
    `  - bunlardan imdb_votes NULL'a çekilecek (kirli TMDb vekili): ${clearedVotes}`,
    `- TMDb external_ids ile imdb_id tamamlanan: ${tmdbResolved.size}`,
    `- imdb_id bulunamadı, SQL dışı: ${unresolved.length}`,
    '',
    '## Dosyada bulunamayan filmler',
    list(notInFile),
    '',
    '## imdb_id bulunamayan filmler (SQL dışı)',
    list(unresolved),
    '',
    '## TMDb ile tamamlanan imdb_id',
    films
      .filter((f) => tmdbResolved.has(f.id))
      .map((f) => `- ${f.title}: ${tmdbResolved.get(f.id)}`)
      .join('\n') || '_yok_',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'backfill-summary.md'), summary);

  console.log(summary);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
