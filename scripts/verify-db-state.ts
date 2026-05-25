/**
 * Verify Database State — Post-seed sanity check
 *
 * Checks:
 *   - Total film count
 *   - NULL field counts (imdb_rating, director, country)
 *   - Tier distribution (ASCII chart)
 *   - Genre distribution
 *   - Decade distribution
 *   - Top/Bottom 10 IMDb rated films
 *
 * Usage: npx tsx scripts/verify-db-state.ts
 * Env:   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL =
  process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ASCII bar chart */
function asciiBar(value: number, maxValue: number, width: number = 30): string {
  const filled = Math.round((value / maxValue) * width);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled);
}

/** Paginated fetch — gets ALL rows using range-based pagination */
async function fetchAll(
  supabase: SupabaseClient,
  table: string,
  select: string,
): Promise<Record<string, unknown>[]> {
  const PAGE = 1000;
  const allRows: Record<string, unknown>[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(select)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`${table} fetch error: ${error.message}`);
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows.push(...data);
      from += PAGE;
      if (data.length < PAGE) hasMore = false;
    }
  }

  return allRows;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('MoodFlix — Database Verification');
  console.log('=================================\n');

  const supabase = createClient(
    SUPABASE_URL as string,
    SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } },
  );

  // 1. Total counts
  const { count: filmCount } = await supabase
    .from('films')
    .select('*', { count: 'exact', head: true });

  const { count: profileCount } = await supabase
    .from('film_profiles')
    .select('*', { count: 'exact', head: true });

  console.log(`TOTALS`);
  console.log(`  Films:         ${filmCount}`);
  console.log(`  Film Profiles: ${profileCount}`);

  // 2. Fetch all films for analysis
  const films = await fetchAll(
    supabase,
    'films',
    'tmdb_id, title, year, director, country, imdb_rating, imdb_votes, curation_tier, genres, original_language',
  );

  // 3. NULL checks
  const nullImdbRating = films.filter((f) => f.imdb_rating == null).length;
  const nullDirector = films.filter((f) => !f.director).length;
  const nullCountry = films.filter((f) => !f.country).length;
  const nullTier = films.filter((f) => !f.curation_tier).length;

  console.log(`\nNULL CHECKS`);
  console.log(`  imdb_rating NULL: ${nullImdbRating} ${nullImdbRating === 0 ? '✓' : '⚠'}`);
  console.log(`  director NULL:    ${nullDirector} ${nullDirector < 50 ? '✓' : '⚠'}`);
  console.log(`  country NULL:     ${nullCountry} ${nullCountry < 50 ? '✓' : '⚠'}`);
  console.log(`  curation_tier NULL: ${nullTier} ${nullTier === 0 ? '✓' : '⚠'}`);

  // 4. Tier distribution
  const tierCounts: Record<string, number> = { core: 0, extended: 0, archive: 0 };
  for (const f of films) {
    const tier = (f.curation_tier as string) || 'extended';
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  }

  const maxTier = Math.max(...Object.values(tierCounts));
  console.log(`\nCURATION TIER DISTRIBUTION`);
  for (const [tier, count] of Object.entries(tierCounts)) {
    const pct = ((count / films.length) * 100).toFixed(1);
    console.log(`  ${tier.padEnd(10)} ${asciiBar(count, maxTier)} ${count} (${pct}%)`);
  }

  // 5. Genre distribution
  const genreCounts: Record<string, number> = {};
  for (const f of films) {
    const genres = f.genres as string[] | null;
    if (genres) {
      for (const g of genres) {
        genreCounts[g] = (genreCounts[g] || 0) + 1;
      }
    }
  }

  const sortedGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  const maxGenre = sortedGenres[0]?.[1] ?? 1;

  console.log(`\nGENRE DISTRIBUTION (Top 15)`);
  for (const [genre, count] of sortedGenres) {
    console.log(`  ${genre.padEnd(16)} ${asciiBar(count, maxGenre, 20)} ${count}`);
  }

  // 6. Decade distribution
  const decadeCounts: Record<string, number> = {};
  for (const f of films) {
    const year = f.year as number | null;
    if (year) {
      const decade = `${Math.floor(year / 10) * 10}s`;
      decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
    }
  }

  const sortedDecades = Object.entries(decadeCounts).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );
  const maxDecade = Math.max(...sortedDecades.map(([, c]) => c));

  console.log(`\nDECADE DISTRIBUTION`);
  for (const [decade, count] of sortedDecades) {
    console.log(`  ${decade.padEnd(8)} ${asciiBar(count, maxDecade, 20)} ${count}`);
  }

  // 7. Top 10 IMDb
  const sorted = [...films]
    .filter((f) => f.imdb_rating != null)
    .sort((a, b) => (b.imdb_rating as number) - (a.imdb_rating as number));

  console.log(`\nTOP 10 IMDb RATED`);
  for (const f of sorted.slice(0, 10)) {
    console.log(
      `  ${(f.imdb_rating as number).toFixed(1)}  ${(f.title as string).padEnd(40)} (${f.year}) [${f.curation_tier}]`,
    );
  }

  // 8. Bottom 10 IMDb (sanity: should be >= 6.0 after filter)
  console.log(`\nBOTTOM 10 IMDb RATED (6.0 cutoff check)`);
  for (const f of sorted.slice(-10).reverse()) {
    console.log(
      `  ${(f.imdb_rating as number).toFixed(1)}  ${(f.title as string).padEnd(40)} (${f.year}) [${f.curation_tier}]`,
    );
  }

  // 9. Profile vector status
  const profiles = await fetchAll(supabase, 'film_profiles', 'film_id, profile_vector');
  const emptyVectors = profiles.filter((p) => !p.profile_vector).length;
  console.log(`\nPROFILE VECTORS`);
  console.log(`  Total profiles: ${profiles.length}`);
  console.log(`  With vector:    ${profiles.length - emptyVectors}`);
  console.log(`  Empty (Sprint 2): ${emptyVectors}`);

  console.log(`\n=================================`);
  console.log(`Verification complete.`);
}

main().catch((err: unknown) => {
  console.error('\nFATAL:', err);
  process.exit(1);
});
