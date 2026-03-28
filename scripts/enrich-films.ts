/**
 * films tablosundaki her film için TMDb'den ek veri çeker ve günceller:
 *   - director   : Yönetmen adı (credits endpoint, job === "Director")
 *   - country    : Yapım ülkeleri — ISO 3166-1 kodları ARRAY (örn. ['US','GB'])
 *   - cast_json  : Başrol oyuncuları — ilk 5 (name + profile_url)
 *   - runtime    : Dakika cinsinden süre (varsa güncellenir)
 *
 * Çalıştırmak için: npx tsx scripts/enrich-films.ts
 *
 * Gerekli env var: TMDB_API_KEY
 *                  SUPABASE_URL (veya EXPO_PUBLIC_SUPABASE_URL)
 *                  SUPABASE_SERVICE_ROLE_KEY
 *
 * Yalnızca director alanı boş filmler işlenir.
 * --force flag'i ile tüm filmler yeniden çekilir.
 *
 * Rate limit: TMDb 40 istek / 10 saniye.
 *   Her istek arasında 250ms beklenir.
 *   429 / 5xx hatalarında 2 sn bekle + 1 retry.
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TmdbCrewMember {
  job: string;
  name: string;
}

interface TmdbCastMember {
  name: string;
  profile_path: string | null;
}

interface TmdbDetailWithCredits {
  id: number;
  runtime: number | null;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  credits: {
    cast: TmdbCastMember[];
    crew: TmdbCrewMember[];
  };
}

interface CastEntry {
  name: string;
  profile_url: string | null;
}

interface FilmRow {
  id: string;
  tmdb_id: number;
  title: string;
  director: string | null;
}

interface FilmUpdate {
  id: string;
  director: string | null;
  /** ISO 3166-1 kodları: ['US', 'GB'] */
  country: string[];
  cast_json: CastEntry[];
  runtime: number | null;
}

// ---------------------------------------------------------------------------
// Config + env
// ---------------------------------------------------------------------------

const TMDB_API_KEY = process.env.TMDB_API_KEY ?? process.env.EXPO_PUBLIC_TMDB_API_KEY;
if (!TMDB_API_KEY) {
  console.error('Hata: TMDB_API_KEY veya EXPO_PUBLIC_TMDB_API_KEY environment variable tanımlanmamış.');
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error('Hata: SUPABASE_URL veya EXPO_PUBLIC_SUPABASE_URL tanımlanmamış.');
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Hata: SUPABASE_SERVICE_ROLE_KEY tanımlanmamış.');
  process.exit(1);
}

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';
const MAX_CAST = 5;
/** Her istek arasındaki minimum bekleme (ms) */
const REQUEST_DELAY_MS = 250;
/** Hata sonrası retry bekleme süresi (ms) */
const RETRY_DELAY_MS = 2_000;
/** Her kaç filmde bir log satırı yazılır */
const LOG_INTERVAL = 50;
/** DB upsert batch boyutu */
const BATCH_SIZE = 50;

const FORCE_MODE = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Terminale tek satırlık ilerleme çubuğu basar. */
function printProgress(current: number, total: number, title: string): void {
  const width = 36;
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pct = Math.round((current / total) * 100).toString().padStart(3);
  process.stdout.write(`\r[${bar}] ${pct}%  ${title.slice(0, 45).padEnd(45)}`);
  if (current === total) process.stdout.write('\n');
}

// ---------------------------------------------------------------------------
// TMDb API
// ---------------------------------------------------------------------------

/**
 * TMDb GET isteği yapar.
 * - Her çağrıdan önce 250ms bekler (rate limit).
 * - 429 veya 5xx alırsa 2 sn bekleyip 1 kez retry atar.
 */
async function tmdbGet<T>(endpoint: string): Promise<T> {
  await sleep(REQUEST_DELAY_MS);

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', TMDB_API_KEY as string);
  url.searchParams.set('language', 'en-US');
  url.searchParams.set('append_to_response', 'credits');

  let res = await fetch(url.toString());

  if (res.status === 429 || res.status >= 500) {
    console.error(`\n  TMDb ${res.status} — 2sn sonra retry: ${endpoint}`);
    await sleep(RETRY_DELAY_MS);
    res = await fetch(url.toString());
  }

  if (!res.ok) {
    throw new Error(`TMDb API ${res.status} ${res.statusText} — ${endpoint}`);
  }

  return res.json() as Promise<T>;
}

/**
 * Film detayını ve oyuncu/ekip listesini tek API çağrısında getirir.
 */
async function fetchFilmDetail(tmdbId: number): Promise<TmdbDetailWithCredits> {
  return tmdbGet<TmdbDetailWithCredits>(`/movie/${tmdbId}`);
}

// ---------------------------------------------------------------------------
// Data extraction
// ---------------------------------------------------------------------------

/** Crew listesinden ilk "Director" kaydının adını döndürür. */
function extractDirector(crew: TmdbCrewMember[]): string | null {
  return crew.find((m) => m.job === 'Director')?.name ?? null;
}

/** Cast listesinden ilk MAX_CAST oyuncuyu CastEntry formatına çevirir. */
function extractCast(cast: TmdbCastMember[]): CastEntry[] {
  return cast.slice(0, MAX_CAST).map((m) => ({
    name: m.name,
    profile_url: m.profile_path ? `${TMDB_IMAGE_BASE}${m.profile_path}` : null,
  }));
}

/** Yapım ülkelerini ISO 3166-1 alpha-2 kod dizisi olarak döndürür. */
function extractCountries(countries: Array<{ iso_3166_1: string }>): string[] {
  return countries.map((c) => c.iso_3166_1);
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

/** İşlenecek filmleri çeker. --force yoksa yalnızca director=null olanlar. */
async function fetchFilmsToEnrich(
  sb: ReturnType<typeof createClient>,
): Promise<FilmRow[]> {
  let query = sb
    .from('films')
    .select('id, tmdb_id, title, director')
    .order('created_at', { ascending: true });

  if (!FORCE_MODE) {
    query = query.is('director', null);
  }

  const { data, error } = await query;
  if (error) throw new Error(`films sorgusu hatası: ${error.message}`);
  return (data ?? []) as FilmRow[];
}

/** Film güncellemelerini teker teker Supabase'e yazar. */
async function applyUpdates(
  sb: ReturnType<typeof createClient>,
  updates: FilmUpdate[],
): Promise<void> {
  for (const u of updates) {
    const { error } = await sb
      .from('films')
      .update({
        director:  u.director,
        country:   u.country,
        cast_json: u.cast_json,
        ...(u.runtime !== null ? { runtime: u.runtime } : {}),
      })
      .eq('id', u.id);

    if (error) {
      throw new Error(`güncelleme hatası (id: ${u.id}): ${error.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('MoodFlix — Film Zenginleştirme Scripti (v2)');
  console.log('==============================================');
  console.log(FORCE_MODE
    ? 'Mod: --force (tüm filmler yeniden çekilecek)'
    : 'Mod: yalnızca eksik veriler tamamlanacak (--force ile hepsini yenile)',
  );

  const sb = createClient(
    SUPABASE_URL as string,
    SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );

  // 1. İşlenecek filmleri çek
  console.log('\nİşlenecek filmler sorgulanıyor...');
  const films = await fetchFilmsToEnrich(sb);

  if (films.length === 0) {
    console.log('Tüm filmler zaten zenginleştirilmiş. Çıkılıyor.');
    return;
  }
  console.log(`${films.length} film işlenecek.\n`);

  // 2. TMDb'den veri çek + DB'ye yaz (BATCH_SIZE'lık gruplar)
  let processed = 0;
  let errorCount = 0;
  let directorCount = 0;
  let countryCount = 0;

  const pending: FilmUpdate[] = [];

  const flush = async () => {
    if (pending.length === 0) return;
    await applyUpdates(sb, pending);
    pending.length = 0;
  };

  for (let i = 0; i < films.length; i++) {
    const film = films[i];
    printProgress(i + 1, films.length, film.title);

    try {
      const detail = await fetchFilmDetail(film.tmdb_id);

      const director  = extractDirector(detail.credits?.crew ?? []);
      const countries = extractCountries(detail.production_countries ?? []);
      const cast      = extractCast(detail.credits?.cast ?? []);
      const runtime   = detail.runtime ?? null;

      if (director)        directorCount++;
      if (countries.length) countryCount++;

      pending.push({ id: film.id, director, country: countries, cast_json: cast, runtime });
    } catch (err) {
      errorCount++;
      process.stderr.write(
        `\n  ⚠ tmdb_id=${film.tmdb_id} (${film.title}): ${(err as Error).message}\n`,
      );
    }

    processed++;

    // Batch flush
    if (pending.length >= BATCH_SIZE) {
      await flush();
    }

    // Her LOG_INTERVAL filmde ilerleme log'u
    if (processed % LOG_INTERVAL === 0) {
      process.stdout.write(
        `\n  → ${processed}/${films.length} tamamlandı` +
        ` | director: ${directorCount} | country: ${countryCount} | hata: ${errorCount}\n`,
      );
    }
  }

  // Kalan kayıtları flush et
  await flush();

  // 3. Son istatistikler
  const success = processed - errorCount;
  const directorPct = processed > 0 ? ((directorCount / processed) * 100).toFixed(1) : '0.0';
  const countryPct  = processed > 0 ? ((countryCount  / processed) * 100).toFixed(1) : '0.0';

  console.log('\n══════════════════════════════════════════════');
  console.log('Tamamlandi!');
  console.log(`  İşlenen toplam  : ${processed} film`);
  console.log(`  Güncellenen     : ${success} film`);
  console.log(`  Hata / atlanan  : ${errorCount} film`);
  console.log(`  Director doluluk: %${directorPct} (${directorCount}/${processed})`);
  console.log(`  Country doluluk : %${countryPct}  (${countryCount}/${processed})`);
  console.log('══════════════════════════════════════════════');

  if (errorCount > 0) {
    console.log('\nİpucu: Hatalı filmler için `--force` ile tekrar çalıştırabilirsin.');
  }
}

main().catch((err: unknown) => {
  console.error('\nBeklenmedik hata:', err);
  process.exit(1);
});
