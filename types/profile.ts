/**
 * Profil ekranı tip tanımları.
 * user_stats view, mood_history view ve tonight_pick RPC için tipler.
 */

import { PacePreference } from './index';

// ─── Kullanıcı İstatistikleri ─────────────────────────────────────────────────

/** user_stats view'dan dönen kullanıcı istatistikleri */
export interface UserStats {
  /** Watchlist'teki toplam film sayısı */
  saved_films: number;
  /** Keşfedilen (görülen) toplam film sayısı */
  total_discovered: number;
  /** Toplam sağa swipe sayısı */
  total_saved: number;
  /** Toplam sola swipe sayısı */
  total_skipped: number;
  /** Toplam oturum (mood girişi) sayısı */
  total_sessions: number;
  /** En çok kaydedilen genre */
  favorite_genre: string | null;
  /** Top genre listesi */
  top_genres: string[] | null;
  /** Son mood metni */
  last_mood: string | null;
  /** Son profil JSON */
  last_profile_json: unknown | null;
  /** En uzun streak gün sayısı (gamification backend'den) */
  longest_streak?: number;
  /** Mevcut streak gün sayısı */
  current_streak?: number;
}

// ─── Mood Geçmişi ─────────────────────────────────────────────────────────────

/** mood_history view'dan dönen bir mood oturumu */
export interface MoodHistoryItem {
  /** Session UUID */
  session_id: string;
  /** Kullanıcı ID */
  user_id: string;
  /** Kullanıcının yazdığı ham mood metni */
  mood_text: string;
  /** Parsed profil JSON */
  parsed_profile_json: unknown | null;
  /** Oturum oluşturulma tarihi (ISO 8601) */
  created_at: string;
  /** Bu oturumda toplam swipe sayısı */
  total_swipes: number;
  /** Bu oturumda kaydedilen film sayısı */
  saved_count: number;
  /** Bu oturumda atlanan film sayısı */
  skipped_count: number;
  /** Kaydedilen filmlerin poster URL'leri */
  saved_posters: string[] | null;
}

// ─── Tonight's Pick ───────────────────────────────────────────────────────────

/** tonight_pick RPC'den dönen tek film önerisi */
export interface TonightPick {
  /** Film UUID */
  film_id: string;
  /** Film başlığı */
  title: string;
  /** Yapım yılı */
  year: number;
  /** TMDb poster URL'si (prefix'siz) */
  poster_url: string | null;
  /** IMDb puanı */
  imdb_rating: number | null;
  /** Film türleri */
  genres: string[];
  /** Benzerlik skoru [0-1] */
  similarity: number;
  /** Öneri sebebi etiketi */
  reason: 'preference_match' | 'trending' | 'hidden_gem' | 'director_favorite';
}

// ─── Swipe İçgörüleri ─────────────────────────────────────────────────────────

/** Kaydedilen filmlerin genre dağılımı */
export interface GenreDistribution {
  /** Genre adı */
  genre: string;
  /** Film sayısı */
  count: number;
  /** Yüzde [0-100] */
  percentage: number;
}

/** En çok kaydedilen yönetmenler */
export interface TopDirector {
  /** Yönetmen adı */
  director: string;
  /** Kaydedilen film sayısı */
  saved_count: number;
}

/** Swipe davranışından türetilen içgörüler */
export interface SwipeInsight {
  /** Kaydedilen filmlerin genre dağılımı (%) */
  saved_genre_distribution: GenreDistribution[];
  /** Skip edilen filmlerde öne çıkan özellikler */
  skipped_signals: string[];
  /** En çok kaydettiği yönetmenler (maks 5) */
  top_directors: TopDirector[];
  /** Toplam sağa swipe sayısı */
  total_saves: number;
  /** Toplam sola swipe sayısı */
  total_skips: number;
}

// ─── Taste DNA ────────────────────────────────────────────────────────────────

/** Kullanıcının genel zevk profilini özetleyen DNA kartı */
export interface TasteDNA {
  /** Baskın duygu etiketleri (ör. ["melancholic", "hopeful"]) */
  dominant_moods: string[];
  /** Favori genre'ler (maks 3) */
  favorite_genres: string[];
  /** Ortalama enerji seviyesi [0-1] */
  avg_energy: number;
  /** Baskın hız tercihi */
  preferred_pace: PacePreference;
  /** Tematik derinlik ortalaması [0-1] */
  avg_depth: number;
  /** Favori dönem etiketi (ör. "2000s", "Classic") */
  favorite_era: string | null;
}
