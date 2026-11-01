/**
 * Film boyutları (Faz 2-3): gauntlet / sonuç çipleri ve "Why this fits you" satırı için
 * `film_profiles.dimensions_json` okuması. Tablo herkese okunur (RLS "public read"); yazım yok.
 * Kimlik gerekmez. Hata fırlatılır — çağıran (hook) Sentry'ye yazar ve çipleri çizmez.
 */
import { parseDims, type FilmDims } from '../utils/moodFilmFacts';
import { supabase } from './supabase';

export async function fetchFilmDims(filmIds: readonly string[]): Promise<Record<string, FilmDims>> {
  if (filmIds.length === 0) return {};
  const { data, error } = await supabase
    .from('film_profiles')
    .select('film_id, dimensions_json')
    .in('film_id', [...filmIds]);
  if (error) throw new Error(`film_profiles dims: ${error.code} — ${error.message}`);
  const out: Record<string, FilmDims> = {};
  for (const row of (data ?? []) as Array<{ film_id: string; dimensions_json: unknown }>) {
    out[row.film_id] = parseDims(row.dimensions_json);
  }
  return out;
}
