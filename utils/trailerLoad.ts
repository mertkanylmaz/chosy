/**
 * Fragman anahtarı yükleme + oturum önbelleği (Faz 2-4d) — saf, bağımlılıklar dışarıdan.
 *
 * Önbellek kuralı:
 *   - TMDB 200 + boş sonuç  → "video yok" (null) ÖNBELLEĞE yazılır; ikinci çağrı ağa gitmez
 *   - fragman seçilemedi (örn. yalnız Clip) → null önbelleğe yazılır
 *   - ağ hatası / non-2xx / istisna / tmdb_id okunamadı → önbelleğe YAZILMAZ (sonra yeniden denenir)
 *   - films.tmdb_id gerçekten yok → null önbelleğe yazılır
 */
import { pickTrailerKey, type TrailerCandidate } from './trailerPick';

export type TmdbIdLookupLike = { kind: 'ok'; tmdbId: number } | { kind: 'none' } | { kind: 'error' };

export interface TrailerLoadDeps {
  readTmdbId: (filmId: string) => Promise<TmdbIdLookupLike>;
  /** `null` = başarısız istek; `[]` = 200 + boş. */
  fetchVideos: (tmdbId: number, lang: string) => Promise<TrailerCandidate[] | null>;
}

export type TrailerMemo = Map<string, string | null>;

export const trailerMemoKey = (filmId: string, lang: string): string => `${filmId}|${lang}`;

/** `undefined` = çözülemedi (önbelleğe yazılmadı). */
export async function loadTrailerKey(
  filmId: string,
  lang: string,
  deps: TrailerLoadDeps,
  memo: TrailerMemo,
): Promise<string | null | undefined> {
  const k = trailerMemoKey(filmId, lang);
  if (memo.has(k)) return memo.get(k) ?? null;
  const lookup = await deps.readTmdbId(filmId);
  if (lookup.kind === 'error') return undefined;
  if (lookup.kind === 'none') {
    memo.set(k, null);
    return null;
  }
  const videos = await deps.fetchVideos(lookup.tmdbId, lang);
  if (videos === null) return undefined;
  const key = pickTrailerKey(videos, lang);
  memo.set(k, key);
  return key;
}
