/**
 * Film Metadata Gap Audit — read-only
 *
 * Reports NULL coverage for the fields generate-gauntlet's diversity rules
 * depend on (director, original_language, imdb_votes) plus profile_vector
 * coverage, across the duel pool (core + extended + trending).
 *
 * Used as the before/after verification for scripts/backfill-film-metadata.ts.
 *
 * Usage: npx tsx --env-file=.env scripts/audit-film-metadata-gaps.ts
 * Env:   EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL), SUPABASE_SERVICE_ROLE_KEY
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

/** Tiers that make up the duel-eligible pool. */
const POOL_TIERS = ['core', 'extended', 'trending'];

interface FilmRow {
  id: string;
  tmdb_id: number | null;
  imdb_id: string | null;
  title: string;
  director: string | null;
  original_language: string | null;
  imdb_votes: number | null;
  curation_tier: string | null;
}

interface ProfileRow {
  film_id: string;
  profile_vector: unknown;
}

/** Builds a service-role Supabase client, exiting if credentials are absent. */
function getClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Range-paginated fetch of every row matching the (optionally filtered) query. */
async function fetchAll<T>(
  sb: SupabaseClient,
  table: string,
  select: string,
  tiers?: string[],
): Promise<T[]> {
  const PAGE = 1000;
  const rows: T[] = [];
  let from = 0;

  for (;;) {
    const base = sb.from(table).select(select).range(from, from + PAGE - 1);
    const query = tiers ? base.in('curation_tier', tiers) : base;
    const { data, error } = await query;

    if (error) throw new Error(`${table} fetch error: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...(data as unknown as T[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return rows;
}

/** Formats a count as "n (x.x%)" against a total. */
function pct(count: number, total: number): string {
  const share = total > 0 ? (count / total) * 100 : 0;
  return `${count} (${share.toFixed(1)}%)`;
}

async function main(): Promise<void> {
  const sb = getClient();

  const pool = await fetchAll<FilmRow>(
    sb,
    'films',
    'id, tmdb_id, imdb_id, title, director, original_language, imdb_votes, curation_tier',
    POOL_TIERS,
  );

  console.log('FILM METADATA GAP AUDIT');
  console.log('=======================\n');
  console.log(`Pool (core + extended + trending): ${pool.length} films\n`);

  const noDirector = pool.filter((f) => !f.director);
  const noLanguage = pool.filter((f) => !f.original_language);
  const noVotes = pool.filter((f) => f.imdb_votes == null);

  console.log('NULL COVERAGE');
  console.log(`  director:          ${pct(noDirector.length, pool.length)}`);
  console.log(`  original_language: ${pct(noLanguage.length, pool.length)}`);
  console.log(`  imdb_votes:        ${pct(noVotes.length, pool.length)}`);

  console.log('\nSOURCE REACHABILITY');
  console.log(
    `  director NULL with tmdb_id:          ${noDirector.filter((f) => f.tmdb_id != null).length} / ${noDirector.length}`,
  );
  console.log(
    `  original_language NULL with tmdb_id: ${noLanguage.filter((f) => f.tmdb_id != null).length} / ${noLanguage.length}`,
  );
  console.log(
    `  imdb_votes NULL with imdb_id:        ${noVotes.filter((f) => !!f.imdb_id).length} / ${noVotes.length}`,
  );
  console.log(
    `  imdb_id NULL across pool:            ${pct(pool.filter((f) => !f.imdb_id).length, pool.length)}`,
  );

  // ── Regresyon koruması: trending'de sahte sıfır ─────────────────────────
  // sync-trending bir dönem imdb_votes'a TMDb vote_count yazdı; oyu olmayan
  // filmlerde bu 0 olarak düştü. 0 gerçek değer gibi görünür ve tanınırlık
  // yüzdeliğini bozar — bilinmeyen değer NULL'dur. Kaynak düzeltildi
  // (sync-trending detailToRow → imdb_votes: null); bu kontrol geri bozulursa
  // görünür olsun diye duruyor.
  const trendingZeroVotes = pool.filter(
    (f) => f.curation_tier === 'trending' && f.imdb_votes === 0,
  );

  console.log('\nREGRESYON KONTROLÜ');
  if (trendingZeroVotes.length > 0) {
    console.log(`  ⚠ UYARI: trending tier'da imdb_votes = 0 olan ${trendingZeroVotes.length} film var.`);
    console.log("    0 gerçek değer gibi görünür ve tanınırlık yüzdeliğini bozar; beklenen değer NULL.");
    console.log('    Muhtemel sebep: sync-trending yeniden 0/vote_count yazıyor.');
    for (const f of trendingZeroVotes.slice(0, 10)) {
      console.log(`      - ${f.title} (tmdb=${f.tmdb_id})`);
    }
    if (trendingZeroVotes.length > 10) {
      console.log(`      ... +${trendingZeroVotes.length - 10} film`);
    }
  } else {
    console.log("  ✓ trending tier'da imdb_votes = 0 olan film yok");
  }

  // ── profile_vector coverage ────────────────────────────────────────────
  const profiles = await fetchAll<ProfileRow>(sb, 'film_profiles', 'film_id, profile_vector');
  const withVector = new Set(
    profiles.filter((p) => !!p.profile_vector).map((p) => p.film_id),
  );
  const hasProfileRow = new Set(profiles.map((p) => p.film_id));

  const poolNullVector = pool.filter((f) => hasProfileRow.has(f.id) && !withVector.has(f.id));
  const poolNoProfileRow = pool.filter((f) => !hasProfileRow.has(f.id));

  console.log('\nPROFILE VECTORS');
  console.log(`  film_profiles rows:            ${profiles.length}`);
  console.log(`  profile_vector NULL (global):  ${profiles.length - withVector.size}`);
  console.log(`  profile_vector NULL (in pool): ${poolNullVector.length}`);
  console.log(`  no profile row at all (pool):  ${poolNoProfileRow.length}`);

  // ── Duel-eligible pool ─────────────────────────────────────────────────
  const eligible = pool.filter(
    (f) => f.director && f.original_language && f.imdb_votes != null && withVector.has(f.id),
  );
  console.log('\nDUEL-ELIGIBLE (all three fields + profile_vector)');
  console.log(`  ${pct(eligible.length, pool.length)}`);

  // ── films-raw.json coverage for the AI profiling pipeline ──────────────
  const rawPath = path.join(process.cwd(), 'data', 'films-raw.json');
  if (fs.existsSync(rawPath)) {
    const raw: { tmdb_id: number }[] = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));
    const rawIds = new Set(raw.map((r) => r.tmdb_id));
    const needVector = [...poolNullVector, ...poolNoProfileRow];
    const covered = needVector.filter((f) => f.tmdb_id != null && rawIds.has(f.tmdb_id));
    console.log('\nAI PROFILING INPUT (data/films-raw.json)');
    console.log(`  entries: ${raw.length}`);
    console.log(`  pool films needing a vector present in films-raw.json: ${covered.length} / ${needVector.length}`);
  } else {
    console.log('\nAI PROFILING INPUT: data/films-raw.json NOT FOUND');
  }
}

main().catch((err: unknown) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
