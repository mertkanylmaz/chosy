/**
 * Home ekranı veri servisi.
 *
 * Kullanıcının profil özeti (display_name, archetype_id) ve
 * son eklenen watchlist filmini tek çağrıda paralel olarak döner.
 * Herhangi bir servisin başarısız olması diğerlerini engellemez.
 */

import { supabase } from './supabase';
import { getWatchlist } from './watchlist';
import type { WatchlistItem } from './watchlist';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Home ekranında kullanılan veri özeti */
export interface HomeData {
  /** Kullanıcının görüntü adı — null ise anonim kullanıcı */
  displayName: string | null;
  /** Kalibrasyon arketip ID'si (1–12) — null ise kalibre edilmemiş */
  archetypeId: number | null;
  /** Watchlist'e en son eklenen film — null ise hiç eklenmemiş */
  lastFilm: WatchlistItem | null;
  /** Toplam kaydedilen film sayısı */
  filmCount: number;
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

interface UserProfileRow {
  display_name: string | null;
  archetype_id: number | null;
}

/**
 * Kullanıcının users tablosundaki profil satırını çeker.
 * Oturum yoksa null döner.
 */
async function fetchUserProfile(): Promise<UserProfileRow | null> {
  const { data: authData } = await supabase.auth.getUser();
  const authUser = authData?.user;
  if (!authUser) return null;

  const { data } = await supabase
    .from('users')
    .select('display_name, archetype_id')
    .eq('auth_id', authUser.id)
    .single();

  return (data as UserProfileRow | null);
}

// ─── Ana Fonksiyon ────────────────────────────────────────────────────────────

/**
 * Home ekranı için gerekli tüm verileri paralel olarak yükler.
 *
 * @returns HomeData — eksik alanlar null / 0 ile döner
 */
export async function getHomeData(): Promise<HomeData> {
  const [profileResult, watchlistResult] = await Promise.allSettled([
    fetchUserProfile(),
    getWatchlist(),
  ]);

  const profile =
    profileResult.status === 'fulfilled' ? profileResult.value : null;
  const watchlist =
    watchlistResult.status === 'fulfilled' ? watchlistResult.value : [];

  return {
    displayName: profile?.display_name ?? null,
    archetypeId: profile?.archetype_id ?? null,
    lastFilm: watchlist[0] ?? null,
    filmCount: watchlist.length,
  };
}
