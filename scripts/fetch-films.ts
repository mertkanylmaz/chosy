/**
 * TMDb'den film verisi çeker — top_rated, popular, discover high-rated.
 * Her film için credits endpoint'ten director, cast (ilk 5), country alır.
 *
 * Çalıştırmak için: npx tsx scripts/fetch-films.ts
 *
 * Gerekli env var: TMDB_API_KEY veya EXPO_PUBLIC_TMDB_API_KEY
 *
 * Hedef:
 *   - /movie/top_rated      → 500 film
 *   - /movie/popular        → 300 film
 *   - /discover/movie       → 200 film (vote_average ≥ 7, vote_count ≥ 1000)
 *
 * Rate limit: TMDb = 40 istek / 10 sn. Güvenli taraf için 250ms arası bekleme.
 * Upsert: Mevcut data/films-raw.json varsa içindekilerle merge edilir (id bazlı).
 */

import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TmdbListMovie {
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
}

interface TmdbListResponse {
  page: number;
  results: TmdbListMovie[];
  total_pages: number;
  total_results: number;
}

interface TmdbCrew {
  job: string;
  name: string;
}

interface TmdbCast {
  name: string;
  order: number;
}

interface TmdbCredits {
  crew: TmdbCrew[];
  cast: TmdbCast[];
}

interface TmdbMovieDetail {
  id: number;
  runtime: number | null;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
}

export interface RawFilm {
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
  runtime: number | null;
  director: string | null;
  cast: string[];
  countries: string[];
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_KEY = process.env.TMDB_API_KEY ?? process.env.EXPO_PUBLIC_TMDB_API_KEY;
if (!API_KEY) {
  console.error('Hata: TMDB_API_KEY veya EXPO_PUBLIC_TMDB_API_KEY tanımlanmamış.');
  process.exit(1);
}

const BASE_URL = 'https://api.themoviedb.org/3';
const DELAY_MS = 250; // 250ms = güvenli rate limit aralığı
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'films-raw.json');

// Kaynak → hedef film sayısı
const SOURCES: Array<{ type: 'top_rated' | 'popular' | 'discover'; target: number }> = [
  { type: 'top_rated', target: 500 },
  { type: 'popular', target: 300 },
  { type: 'discover', target: 200 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printProgress(current: number, total: number, label: string): void {
  const width = 40;
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pct = Math.round((current / total) * 100).toString().padStart(3);
  process.stdout.write(`\r[${bar}] ${pct}%  ${label.padEnd(55)}`);
  if (current === total) process.stdout.write('\n');
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function tmdbGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  await sleep(DELAY_MS);

  const url = new URL(`${BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', API_KEY as string);
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`TMDb ${res.status} — ${endpoint}`);
  }
  return res.json() as Promise<T>;
}

async function fetchPage(
  type: 'top_rated' | 'popular' | 'discover',
  page: number,
): Promise<TmdbListResponse> {
  if (type === 'discover') {
    return tmdbGet<TmdbListResponse>('/discover/movie', {
      page: String(page),
      'vote_average.gte': '7',
      'vote_count.gte': '1000',
      sort_by: 'vote_average.desc',
    });
  }
  return tmdbGet<TmdbListResponse>(`/movie/${type}`, { page: String(page) });
}

async function fetchCreditsAndDetail(
  movieId: number,
): Promise<{ director: string | null; cast: string[]; countries: string[]; runtime: number | null }> {
  try {
    const [credits, detail] = await Promise.all([
      tmdbGet<TmdbCredits>(`/movie/${movieId}/credits`),
      tmdbGet<TmdbMovieDetail>(`/movie/${movieId}`),
    ]);

    const director =
      credits.crew.find((c) => c.job === 'Director')?.name ?? null;

    const cast = credits.cast
      .sort((a, b) => a.order - b.order)
      .slice(0, 5)
      .map((c) => c.name);

    const countries = detail.production_countries.map((c) => c.iso_3166_1);
    const runtime = detail.runtime ?? null;

    return { director, cast, countries, runtime };
  } catch {
    return { director: null, cast: [], countries: [], runtime: null };
  }
}

// ---------------------------------------------------------------------------
// Collect list films
// ---------------------------------------------------------------------------

async function collectFromSource(
  type: 'top_rated' | 'popular' | 'discover',
  target: number,
  seenIds: Set<number>,
): Promise<TmdbListMovie[]> {
  const collected: TmdbListMovie[] = [];
  let page = 1;

  const first = await fetchPage(type, page);
  const totalPages = Math.min(first.total_pages, 500);

  for (const m of first.results) {
    if (!seenIds.has(m.id)) { seenIds.add(m.id); collected.push(m); }
  }
  page++;

  while (collected.length < target && page <= totalPages) {
    printProgress(collected.length, target, `${type} — sayfa ${page}/${totalPages}`);
    const data = await fetchPage(type, page);
    for (const m of data.results) {
      if (!seenIds.has(m.id)) { seenIds.add(m.id); collected.push(m); }
    }
    page++;
  }
  printProgress(target, target, `${type} tamamlandı`);

  return collected.slice(0, target);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('MoodFlix — TMDb Film Verisi Çekme\n');

  // Mevcut dosyayı yükle (upsert için)
  const existingMap = new Map<number, RawFilm>();
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8')) as RawFilm[];
      for (const f of existing) existingMap.set(f.id, f);
      console.log(`Mevcut dosya yüklendi: ${existingMap.size} film\n`);
    } catch {
      console.warn('Mevcut dosya okunamadı, sıfırdan başlanıyor.\n');
    }
  }

  // 1. Adım: Liste filmlerini topla
  const seenIds = new Set<number>(existingMap.keys());
  const allListMovies: TmdbListMovie[] = [];

  for (const { type, target } of SOURCES) {
    console.log(`\n▶  ${type} — hedef: ${target} yeni film`);
    const movies = await collectFromSource(type, target, seenIds);
    allListMovies.push(...movies);
    console.log(`   ${movies.length} yeni film eklendi (toplam liste: ${allListMovies.length})`);
  }

  console.log(`\nToplam ${allListMovies.length} yeni film. Credits + detay çekiliyor...\n`);

  // 2. Adım: Her film için credits + detail
  const newFilms: RawFilm[] = [];

  for (let i = 0; i < allListMovies.length; i++) {
    const m = allListMovies[i];
    printProgress(i + 1, allListMovies.length, `${m.title}`);

    const { director, cast, countries, runtime } = await fetchCreditsAndDetail(m.id);

    newFilms.push({
      id: m.id,
      title: m.title,
      original_title: m.original_title,
      release_date: m.release_date,
      poster_path: m.poster_path,
      backdrop_path: m.backdrop_path,
      overview: m.overview,
      genre_ids: m.genre_ids,
      vote_average: m.vote_average,
      vote_count: m.vote_count,
      runtime,
      director,
      cast,
      countries,
    });
  }

  // 3. Adım: Mevcut dosyayla merge (upsert — yeni veri kazanır)
  for (const film of newFilms) {
    existingMap.set(film.id, film);
  }

  const finalFilms = Array.from(existingMap.values());

  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalFilms, null, 2), 'utf-8');

  console.log(`\n✓ Tamamlandı!`);
  console.log(`  Yeni / güncellenen: ${newFilms.length} film`);
  console.log(`  Toplam dosyada:     ${finalFilms.length} film`);
  console.log(`  Kayıt yeri:         ${OUTPUT_PATH}`);
}

main().catch((err: unknown) => {
  console.error('\nBeklenmedik hata:', err);
  process.exit(1);
});
