/**
 * match_films_v4 satırı → `GauntletFilm` (kilitli tipe dokunulmaz; eşleme istemcide).
 * Eksik poster/yıl/süre uydurulmaz: poster boş string (PosterTile placeholder çizer),
 * yıl/süre 0 (meta satırı bunları gizlemeli — çağıran `hasMeta` ile bakar).
 */
import type { GauntletFilm } from '../types/gauntlet';

export interface MoodFilmLike {
  id: string;
  title: string;
  year: number | null;
  runtime: number | null;
  poster_url: string | null;
}

export function toGauntletFilm(row: MoodFilmLike, normalizePoster: (u: string | null) => string): GauntletFilm {
  return {
    id: row.id,
    title: row.title,
    year: row.year ?? 0,
    runtime: row.runtime ?? 0,
    posterUrl: normalizePoster(row.poster_url),
  };
}

/** Meta satırı (yıl · süre) için en az yıl var mı. */
export function hasMeta(film: Pick<GauntletFilm, 'year' | 'runtime'>): boolean {
  return film.year > 0 || film.runtime > 0;
}
