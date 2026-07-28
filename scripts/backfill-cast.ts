/**
 * Backfill cast_json for films in the puzzle pool (vote_count >= 15000)
 * that currently have null cast_json.
 *
 * Usage: npx tsx scripts/backfill-cast.ts
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_API_KEY!;

async function getFilmsNeedingCast() {
  // RPC or raw filter for jsonb cast — supabase-js doesn't support casting,
  // so we fetch all null-cast films with tmdb_id and filter client-side.
  const { data, error } = await supabase
    .from('films')
    .select('id, tmdb_id, title, metadata_json, curation_tier')
    .is('cast_json', null)
    .not('tmdb_id', 'is', null)
    .in('curation_tier', ['core', 'extended']);

  if (error) throw error;

  // Filter to puzzle pool: vote_count >= 15000
  return (data || []).filter((f) => {
    const vc = (f.metadata_json as Record<string, unknown>)?.vote_count;
    return vc != null && Number(vc) >= 15000;
  });
}

async function fetchCast(
  tmdbId: number,
): Promise<{ name: string; profile_path: string | null }[]> {
  const url = `https://api.themoviedb.org/3/movie/${tmdbId}/credits?api_key=${TMDB_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} for tmdb_id ${tmdbId}`);
  const json = await res.json();
  return (json.cast || []).slice(0, 5).map((c: { name: string; profile_path: string | null }) => ({
    name: c.name,
    profile_path: c.profile_path || null,
  }));
}

async function main() {
  const films = await getFilmsNeedingCast();
  console.log(`${films.length} film backfill edilecek\n`);

  let success = 0;
  let fail = 0;

  for (const film of films) {
    try {
      // TMDB rate limit: 40 req/10s
      await new Promise((r) => setTimeout(r, 300));

      const cast = await fetchCast(film.tmdb_id);

      const { error } = await supabase
        .from('films')
        .update({ cast_json: cast })
        .eq('id', film.id);

      if (error) throw error;

      const names = cast.map((c) => c.name).join(', ');
      console.log(`  OK  ${film.title} — ${names}`);
      success++;
    } catch (err) {
      console.error(`  FAIL  ${film.title}: ${err}`);
      fail++;
    }
  }

  console.log(`\nTamamlandi: ${success} basarili, ${fail} basarisiz`);
}

main();
