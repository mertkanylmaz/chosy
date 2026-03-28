/**
 * Chosy.ai temel tip tanımları
 */

// ─── Film ───────────────────────────────────────────────────────────────────

/** TMDb'den gelen ve veritabanında saklanan film verisi */
export interface Film {
  id: string;
  tmdb_id: number;
  title: string;
  year: number;
  poster_url: string;
  overview: string;
}

// ─── Taste Profile ──────────────────────────────────────────────────────────

/** 8 temel duyguyu [0-1] aralığında ifade eden vektör */
export interface EmotionalState {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
  anticipation: number;
  trust: number;
}

export type PacePreference = 'slow' | 'medium' | 'fast';

export type VisualStyle = 'minimalist' | 'cinematic' | 'experimental' | 'lush' | 'raw';

export type EndingPreference = 'hopeful' | 'bittersweet' | 'open' | 'tragic' | 'triumphant';

export type NarrativeStyle = 'linear' | 'nonlinear' | 'anthology' | 'dialogue-driven';

export type SocialContext = 'alone' | 'couple' | 'friends' | 'family';

/** Tercih edilen film dönemi aralığı */
export interface EraPreference {
  from: number;
  to: number;
}

/** 12 boyutlu kullanıcı / film zevk profili */
export interface TasteProfile {
  /** Boyut 1: 8 duygu vektörü [0-1] */
  emotional_state: EmotionalState;
  /** Boyut 2: 0.0 sakin — 1.0 enerjik */
  energy_level: number;
  /** Boyut 3: Film hızı tercihi */
  pace_preference: PacePreference;
  /** Boyut 4: Görsel stil */
  visual_style: VisualStyle;
  /** Boyut 5: 0.0 hafif — 1.0 derin */
  thematic_depth: number;
  /** Boyut 6: Bitiş tercihi */
  ending_preference: EndingPreference;
  /** Boyut 7: Tercih edilen dönem */
  era_preference: EraPreference;
  /** Boyut 8: Ülke / bölge tercihleri */
  cultural_context: string[];
  /** Boyut 9: Kaçınılacak temalar */
  avoid_signals: string[];
  /** Boyut 10: Anlatı biçimi */
  narrative_style: NarrativeStyle;
  /** Boyut 11: İzleme ortamı */
  social_context: SocialContext;
  /** Boyut 12: Tekrar izleme toleransı */
  rewatch_tolerance: boolean;
}

// ─── Film Profile ────────────────────────────────────────────────────────────

/** Bir filmin pgvector ile saklanan profili */
export interface FilmProfile {
  film_id: string;
  /** Düzleştirilmiş pgvector embedding */
  profile_vector: number[];
  /** Okunabilir boyut değerleri */
  dimensions: TasteProfile;
}

// ─── Session ────────────────────────────────────────────────────────────────

/** Kullanıcının bir mood girişinden oluşan oturum */
export interface Session {
  id: string;
  user_id: string;
  /** Kullanıcının yazdığı ham metin */
  raw_input: string;
  /** AI tarafından ayrıştırılmış profil */
  parsed_profile: TasteProfile;
}

// ─── Film Filters ────────────────────────────────────────────────────────────

/** Yıl aralığı filtre seçeneği; null = farketmez */
export type YearRangeFilter = 'pre1990' | '1990s' | '2000s' | '2010s' | '2020s' | null;

/** Minimum IMDb puanı filtresi; null = farketmez */
export type RatingFilter = 7 | 8 | 'top250' | null;

/** Kullanıcının öneri sorgusuna eklediği isteğe bağlı filtreler */
export interface FilmFilters {
  yearRange: YearRangeFilter;
  minRating: RatingFilter;
  /** Seçili bölge/sinema etiketleri; boş = farketmez */
  regions: string[];
  /** Seçili yönetmen isimleri; boş = farketmez */
  directors: string[];
}

// ─── Swipe ──────────────────────────────────────────────────────────────────

export type SwipeDirection = 'left' | 'right';

/** Kullanıcının bir filme verdiği swipe aksiyonu */
export interface Swipe {
  id: string;
  session_id: string;
  film_id: string;
  direction: SwipeDirection;
  timestamp: string;
}

// ─── Watchlist ───────────────────────────────────────────────────────────────

/** Kullanıcının izleme listesindeki bir film */
export interface WatchlistItem {
  id: string;
  user_id: string;
  film_id: string;
  /** Hangi session'dan eklendiği */
  added_from_session: string;
}

// ─── Gamification ─────────────────────────────────────────────────────────

/** Milestone kategori türleri */
export type MilestoneCategory = 'films' | 'streak' | 'watchlist' | 'mood';

/** Kullanıcının streak durumu (profil ekranı ve badge için) */
export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string | null;
}

// ─── History ──────────────────────────────────────────────────────────────

/** Swipe geçmişi filtreleme yönü */
export type HistoryDirection = 'left' | 'right' | null;
