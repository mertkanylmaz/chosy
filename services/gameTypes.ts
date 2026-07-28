/**
 * Mini Games — Shared type definitions.
 *
 * Tüm oyunlar bu tipleri kullanır. gameType string-based olduğu için
 * yeni oyun eklemek type değişikliği gerektirmez.
 */

/** Oyun durumu state machine */
export type GameState = 'loading' | 'playing' | 'reveal' | 'complete';

/** Tek bir ipucu/clue */
export interface GameClue {
  /** Açılma sırası (1 = en zor, N = en kolay) */
  order: number;
  /** İpucu tipi — oyuna göre değişir */
  type: string;
  /** İpucu içeriği — metin, URL veya JSON string */
  content: string;
}

/** Günlük bulmaca */
export interface DailyPuzzle {
  id: string;
  date: string;
  gameType: string;
  filmId: number;
  clues: GameClue[];
  maxAttempts: number;
}

/** Oyun sonucu */
export interface GameResult {
  puzzleId: string;
  date: string;
  gameType: string;
  solved: boolean;
  attempts: number;
  maxAttempts: number;
  filmId: number;
}

/** Oyun streak bilgisi */
export interface GameStreakInfo {
  gameType: string;
  currentStreak: number;
  longestStreak: number;
  totalPlayed: number;
  totalSolved: number;
}

/** Film arama sonucu (autocomplete için) */
export interface FilmSearchResult {
  id: number;
  /** Supabase films.id (UUID) — Edge Function tabanlı oyunlar için */
  uuid?: string;
  title: string;
  year: string;
  posterPath: string | null;
}

/** Imposter oyunu — seçenek */
export interface ImposterOption {
  id: number;
  name: string;
  /** Oyuncunun canlandırdığı karakter (opsiyonel — merak uyandırıcı) */
  character?: string;
  isImposter: boolean;
}

/** Hub'daki oyun kartı bilgisi */
export interface GameInfo {
  gameType: string;
  titleKey: string;
  descriptionKey: string;
  icon: string;
  played: boolean;
  streak: number;
}
