/**
 * useTrailer — sonuç ekranı fragman anahtarı (Faz 2-4d). İlk boyamayı BLOKLAMAZ: ilk render
 * `null` döner (düğme çizilmez), istek arkadan gider, bulununca düğme belirir.
 * Mevcut katmanlar yeniden kullanılır: `readTmdbId` (films.tmdb_id) + `fetchMovieVideos` (TMDB).
 * Sonuç oturum boyu bellekte `filmId|dil` ile önbelleklenir (kalıcı depo yok).
 * Ağ hatası önbelleğe yazılmaz (sonraki açılışta yeniden denenir); hatalar zaten
 * `readTmdbId` (Sentry) ve `reportTmdbFailure` (Sentry/breadcrumb) tarafından kaydedilir.
 */
import { useEffect, useState } from 'react';

import { readTmdbId } from '@/components/gauntlet/WatchProviders/useWatchProviders';
import { fetchMovieVideos } from '@/services/tmdb';
import { pickTrailerKey } from '@/utils/trailerPick';

const memo = new Map<string, string | null>();

async function loadTrailerKey(filmId: string, lang: string): Promise<string | null | undefined> {
  const lookup = await readTmdbId(filmId);
  if (lookup.kind !== 'ok') return lookup.kind === 'none' ? null : undefined;
  const videos = await fetchMovieVideos(lookup.tmdbId, lang);
  if (videos.length === 0) return undefined; // veri yok mu hata mı ayırt edilemez → önbelleğe yazma
  return pickTrailerKey(videos, lang);
}

export function useTrailer(filmId: string, lang: string): string | null {
  const k = `${filmId}|${lang}`;
  const [key, setKey] = useState<string | null>(memo.get(k) ?? null);

  useEffect(() => {
    if (memo.has(k)) {
      setKey(memo.get(k) ?? null);
      return;
    }
    setKey(null);
    let cancelled = false;
    void loadTrailerKey(filmId, lang).then((found) => {
      if (found === undefined) return;
      memo.set(k, found);
      if (!cancelled) setKey(found);
    });
    return () => {
      cancelled = true;
    };
  }, [filmId, lang, k]);

  return key;
}
