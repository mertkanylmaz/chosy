/**
 * Ekranlar arası film önerilerini tutan basit in-memory store.
 * HomeScreen önerileri yükler, DiscoverScreen okur.
 *
 * Context/Redux gerektirmeden MVP için yeterli.
 */
import { Film } from '../types/film';

interface Store {
  films: Film[] | null;
  source: 'supabase' | 'fallback' | null;
  seenFilmIds: string[];
}

const store: Store = { films: null, source: null, seenFilmIds: [] };

/** Öneri listesini ve kaynağını saklar */
export function setRecommendations(films: Film[], source: 'supabase' | 'fallback'): void {
  store.films = films;
  store.source = source;
}

/** Saklanan önerileri döndürür */
export function getStoredRecommendations(): Store {
  return { films: store.films, source: store.source, seenFilmIds: store.seenFilmIds };
}

/** Store'u temizler */
export function clearRecommendations(): void {
  store.films = null;
  store.source = null;
}

/** Görülen film ID'sini kaydeder (tekrar öneri olarak gelmesin) */
export function addSeenFilmId(id: string): void {
  if (!store.seenFilmIds.includes(id)) {
    store.seenFilmIds.push(id);
  }
}

/** Şimdiye kadar gösterilen tüm film ID'lerini döndürür */
export function getSeenFilmIds(): string[] {
  return [...store.seenFilmIds];
}
