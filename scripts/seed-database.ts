/**
 * Film ve profil verilerini Supabase'e yükler.
 * Çalıştırmak için: npx tsx scripts/seed-database.ts
 *
 * Gerekli env var: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Girdi:           data/films-raw.json
 *                  data/films-profiled.json
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

import {
  tasteProfileToVector,
  type TasteProfile as VectorTasteProfile,
} from '../services/vectorEncoder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawFilm {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  runtime: number | null;
}

interface EmotionalState {
  joy: number;
  sadness: number;
  fear: number;
  anger: number;
  surprise: number;
  disgust: number;
  trust: number;
  anticipation: number;
}

interface SocialFit {
  alone: number;
  couple: number;
  friends: number;
  family: number;
}

interface TasteProfile {
  emotional_state: EmotionalState;
  energy_level: number;
  pace: 'slow' | 'medium' | 'fast';
  visual_style: 'minimalist' | 'cinematic' | 'experimental' | 'lush' | 'raw';
  thematic_depth: number;
  ending_tone: 'hopeful' | 'bittersweet' | 'open' | 'tragic' | 'triumphant';
  era_feel: string;
  cultural_context: string;
  content_warnings: string[];
  narrative_style: 'linear' | 'nonlinear' | 'anthology' | 'dialogue-driven';
  social_fit: SocialFit;
  rewatch_value: number;
}

interface ProfiledFilm extends RawFilm {
  taste_profile: TasteProfile;
}

interface FilmRow {
  tmdb_id: number;
  title: string;
  year: number | null;
  poster_url: string | null;
  backdrop_url: string | null;
  overview: string;
  genres: string[];
  runtime: number | null;
  vote_average: number;
  metadata_json: Record<string, unknown>;
}

interface FilmProfileRow {
  film_id: string;
  profile_vector: number[];
  dimensions_json: TasteProfile;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error(
    'Hata: SUPABASE_URL veya EXPO_PUBLIC_SUPABASE_URL environment variable tanımlanmamış.',
  );
  process.exit(1);
}
if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Hata: SUPABASE_SERVICE_ROLE_KEY environment variable tanımlanmamış.');
  process.exit(1);
}

const RAW_PATH = path.join(process.cwd(), 'data', 'films-raw.json');
const PROFILED_PATH = path.join(process.cwd(), 'data', 'films-profiled.json');

/** Supabase'e tek seferde gönderilecek satır sayısı */
const BATCH_SIZE = 50;

/** TMDb genre ID → Türkçe isim */
const GENRE_MAP: Record<number, string> = {
  28: 'Aksiyon',
  12: 'Macera',
  16: 'Animasyon',
  35: 'Komedi',
  80: 'Suç',
  99: 'Belgesel',
  18: 'Drama',
  10751: 'Aile',
  14: 'Fantezi',
  36: 'Tarih',
  27: 'Korku',
  10402: 'Müzik',
  9648: 'Gizem',
  10749: 'Romantik',
  878: 'Bilim Kurgu',
  10770: 'TV Film',
  53: 'Gerilim',
  10752: 'Savaş',
  37: 'Western',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Terminale tek satırlık ilerleme çubuğu basar.
 */
function printProgress(current: number, total: number, label: string): void {
  const width = 40;
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pct = Math.round((current / total) * 100).toString().padStart(3);
  process.stdout.write(`\r[${bar}] ${pct}%  ${label.padEnd(50)}`);
  if (current === total) {
    process.stdout.write('\n');
  }
}

/**
 * genre_ids dizisini Türkçe tür isimlerine çevirir.
 */
function resolveGenres(genreIds: number[]): string[] {
  return genreIds.map((id) => GENRE_MAP[id] ?? `Tür#${id}`);
}

/**
 * release_date stringinden yıl çıkarır. Geçersizse null döner.
 */
function extractYear(releaseDate: string): number | null {
  if (!releaseDate) return null;
  const year = parseInt(releaseDate.slice(0, 4), 10);
  return isNaN(year) ? null : year;
}

/**
 * era_feel string'ini yıl aralığına dönüştürür.
 * Verinin olası değerleri: 'modern', "1980'ler nostaljisi", "2010'lar" vb.
 */
function eraFeel2Range(eraFeel: string): { from: number; to: number } {
  const s = eraFeel.toLowerCase();
  if (s.includes('2020') || s.includes('2010')) return { from: 2010, to: 2030 };
  if (s.includes('2000'))                        return { from: 2000, to: 2010 };
  if (s.includes('1990') || s.includes("90"))    return { from: 1990, to: 2000 };
  if (s.includes('1980') || s.includes("80"))    return { from: 1980, to: 1990 };
  if (s.includes('1970') || s.includes("70"))    return { from: 1970, to: 1980 };
  if (s.includes('1960') || s.includes("60"))    return { from: 1960, to: 1970 };
  if (s.includes('klasik') || s.includes('classic')) return { from: 1920, to: 1970 };
  if (s.includes('modern') || s.includes('çağdaş'))  return { from: 2000, to: 2030 };
  return { from: 1900, to: 2030 }; // zamansız / bilinmiyor
}

/**
 * social_fit nesnesinden en yüksek skora sahip social_context değerini döndürür.
 */
function pickSocialContext(
  fit: SocialFit,
): VectorTasteProfile['social_context'] {
  const entries = [
    ['alone',   fit.alone],
    ['couple',  fit.couple],
    ['friends', fit.friends],
    ['family',  fit.family],
  ] as const;
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

/**
 * films-profiled.json TasteProfile'ını vectorEncoder'ın beklediği
 * VectorTasteProfile formatına dönüştürür.
 *
 * Alan eşlemesi:
 *   pace          → pace_preference
 *   ending_tone   → ending_preference
 *   era_feel      → era_preference { from, to }
 *   cultural_ctx  → cultural_context string[]
 *   content_warn  → avoid_signals
 *   social_fit    → social_context (en yüksek skor seçilir)
 *   rewatch_value → rewatch_tolerance (>= 0.5)
 */
function adaptToVectorProfile(p: TasteProfile): VectorTasteProfile {
  return {
    emotional_state:   p.emotional_state,
    energy_level:      p.energy_level,
    pace_preference:   p.pace,
    visual_style:      p.visual_style,
    thematic_depth:    p.thematic_depth,
    ending_preference: p.ending_tone,
    era_preference:    eraFeel2Range(p.era_feel),
    cultural_context:  p.cultural_context ? [p.cultural_context] : [],
    avoid_signals:     p.content_warnings ?? [],
    narrative_style:   p.narrative_style,
    social_context:    pickSocialContext(p.social_fit),
    rewatch_tolerance: p.rewatch_value >= 0.5,
  };
}

/**
 * Diziyi BATCH_SIZE'lık parçalara böler.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Seed steps
// ---------------------------------------------------------------------------

/**
 * film_profiles tablosundaki mevcut kayıt sayısını döndürür.
 * Sorgu başarısız olursa -1 döner.
 */
async function checkFilmProfileCount(
  supabase: ReturnType<typeof createClient>,
): Promise<number> {
  const { count, error } = await supabase
    .from('film_profiles')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.warn('  film_profiles count sorgusu hatası:', error.message);
    return -1;
  }
  return count ?? 0;
}

/**
 * films tablosuna filmleri upsert eder.
 * Çakışma: tmdb_id sütununa göre.
 * Döndürür: tmdb_id → films.id (UUID) eşlemesi.
 */
async function seedFilms(
  supabase: ReturnType<typeof createClient>,
  rawFilms: RawFilm[],
): Promise<Map<number, string>> {
  console.log(`\nfilms tablosuna ${rawFilms.length} film yükleniyor...`);

  const rows: FilmRow[] = rawFilms.map((film) => ({
    tmdb_id: film.id,
    title: film.title,
    year: extractYear(film.release_date),
    poster_url: film.poster_path,
    backdrop_url: film.backdrop_path,
    overview: film.overview,
    genres: resolveGenres(film.genre_ids),
    runtime: film.runtime,
    vote_average: film.vote_average,
    metadata_json: { genre_ids: film.genre_ids, release_date: film.release_date },
  }));

  const batches = chunk(rows, BATCH_SIZE);
  let inserted = 0;

  for (const batch of batches) {
    const { error } = await supabase
      .from('films')
      .upsert(batch, { onConflict: 'tmdb_id' });

    if (error) {
      throw new Error(`films upsert hatası: ${error.message}`);
    }

    inserted += batch.length;
    printProgress(inserted, rows.length, `films — ${inserted}/${rows.length}`);
  }

  // tmdb_id → UUID eşlemesini çek (500'lük batch'ler hâlinde — URL limit aşımını önler)
  const idMap = new Map<number, string>();
  const tmdbIds = rawFilms.map((f) => f.id);
  const ID_BATCH = 500;

  for (let i = 0; i < tmdbIds.length; i += ID_BATCH) {
    const chunk = tmdbIds.slice(i, i + ID_BATCH);
    const { data, error: fetchError } = await supabase
      .from('films')
      .select('id, tmdb_id')
      .in('tmdb_id', chunk);

    if (fetchError) {
      throw new Error(`films UUID sorgusu hatası: ${fetchError.message}`);
    }

    for (const row of data ?? []) {
      idMap.set(row.tmdb_id as number, row.id as string);
    }
  }

  console.log(`films: ${idMap.size} satır eşlendi.`);
  return idMap;
}

/**
 * film_profiles tablosuna profilleri upsert eder.
 * Çakışma: film_id sütununa göre.
 */
async function seedFilmProfiles(
  supabase: ReturnType<typeof createClient>,
  profiledFilms: ProfiledFilm[],
  idMap: Map<number, string>,
): Promise<void> {
  console.log(`\nfilm_profiles tablosuna ${profiledFilms.length} profil yükleniyor...`);

  const rows: FilmProfileRow[] = [];
  const skipped: number[] = [];

  for (const film of profiledFilms) {
    const filmUuid = idMap.get(film.id);
    if (!filmUuid) {
      skipped.push(film.id);
      continue;
    }

    rows.push({
      film_id: filmUuid,
      profile_vector: tasteProfileToVector(adaptToVectorProfile(film.taste_profile)),
      dimensions_json: film.taste_profile,
    });
  }

  if (skipped.length > 0) {
    console.warn(`Uyarı: ${skipped.length} film için UUID bulunamadı, atlandı.`);
  }

  const batches = chunk(rows, BATCH_SIZE);
  let inserted = 0;

  for (const batch of batches) {
    const { error } = await supabase
      .from('film_profiles')
      .upsert(batch, { onConflict: 'film_id' });

    if (error) {
      throw new Error(`film_profiles upsert hatası: ${error.message}`);
    }

    inserted += batch.length;
    printProgress(inserted, rows.length, `film_profiles — ${inserted}/${rows.length}`);
  }

  console.log(`film_profiles: ${inserted} satır yüklendi.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('MoodFlix — Veritabanı Seed Scripti');
  console.log('====================================');

  // Girdi dosyalarını kontrol et
  if (!fs.existsSync(RAW_PATH)) {
    console.error(`Hata: ${RAW_PATH} bulunamadı. Önce fetch-films.ts çalıştır.`);
    process.exit(1);
  }
  if (!fs.existsSync(PROFILED_PATH)) {
    console.error(`Hata: ${PROFILED_PATH} bulunamadı. Önce profile-films.ts çalıştır.`);
    process.exit(1);
  }

  // JSON verilerini yükle
  console.log('\nVeri dosyaları okunuyor...');
  const rawFilms: RawFilm[] = JSON.parse(fs.readFileSync(RAW_PATH, 'utf-8'));
  const profiledFilms: ProfiledFilm[] = JSON.parse(fs.readFileSync(PROFILED_PATH, 'utf-8'));
  console.log(`  films-raw.json      : ${rawFilms.length} film`);
  console.log(`  films-profiled.json : ${profiledFilms.length} film`);

  // Supabase client (service_role — RLS bypass için gerekli)
  const supabase = createClient(
    SUPABASE_URL as string,
    SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );

  // Mevcut durumu kontrol et
  console.log('\nMevcut film_profiles sayısı kontrol ediliyor...');
  const existingCount = await checkFilmProfileCount(supabase);
  if (existingCount >= 0) {
    console.log(`  film_profiles: ${existingCount} kayıt mevcut`);
    if (existingCount > 0) {
      console.log('  Not: Mevcut kayıtlar upsert ile güncellenir (silinmez).');
    }
  }

  // 1. films tablosunu doldur
  const idMap = await seedFilms(supabase, rawFilms);

  // 2. film_profiles tablosunu doldur
  await seedFilmProfiles(supabase, profiledFilms, idMap);

  console.log('\nTamamlandi! Veritabanı seed islemi basariyla bitti.');
}

main().catch((err: unknown) => {
  console.error('\nBeklenmedik hata:', err);
  process.exit(1);
});
