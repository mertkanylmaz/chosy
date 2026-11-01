/**
 * useTrailer — sonuç ekranı fragman anahtarı (Faz 2-4d). İlk boyamayı BLOKLAMAZ: ilk render
 * `null` döner (düğme çizilmez), istek arkadan gider, bulununca düğme belirir.
 * Mevcut katmanlar: `readTmdbId` (films.tmdb_id) + `fetchMovieVideos` (TMDB). Önbellek kuralları
 * `utils/trailerLoad.ts`'te (boş yanıt "video yok" olarak önbelleğe yazılır, hata yazılmaz).
 */
import { useEffect, useState } from 'react';

import { readTmdbId } from '@/components/gauntlet/WatchProviders/useWatchProviders';
import { fetchMovieVideos } from '@/services/tmdb';
import { loadTrailerKey, trailerMemoKey, type TrailerLoadDeps, type TrailerMemo } from '@/utils/trailerLoad';

const memo: TrailerMemo = new Map();
const deps: TrailerLoadDeps = { readTmdbId, fetchVideos: fetchMovieVideos };

export function useTrailer(filmId: string, lang: string): string | null {
  const k = trailerMemoKey(filmId, lang);
  const [key, setKey] = useState<string | null>(memo.get(k) ?? null);

  useEffect(() => {
    setKey(memo.get(k) ?? null);
    if (memo.has(k)) return;
    let cancelled = false;
    void loadTrailerKey(filmId, lang, deps, memo).then((found) => {
      if (!cancelled && found !== undefined) setKey(found);
    });
    return () => {
      cancelled = true;
    };
  }, [filmId, lang, k]);

  return key;
}
