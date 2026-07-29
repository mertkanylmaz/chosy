/**
 * CineMetrics Game Types — Edge Function tabanlı oyun sistemi tipleri.
 *
 * Bu tipler sunucu tarafı (get-daily-challenge / submit-guess) Edge Function'lar
 * ile iletişim kuran CineMetrics oyununa özgüdür.
 * Mevcut gameTypes.ts'deki tipler (GameResult, DailyPuzzle vb.) diğer oyunlar
 * (imposter, logline, fadein, quoted) tarafından kullanılmaya devam eder.
 */

// ─── Feedback ────────────────────────────────────────────────────────────────

/** Tek bir hücrenin feedback sonucu */
export interface FeedbackCell {
  /** Eşleşme durumu */
  result: 'green' | 'yellow' | 'gray';
  /** Sayısal sütunlar için yön ipucu (year/rating/runtime) */
  direction?: 'up' | 'down';
}

/** Bir tahminin tüm sütunlarındaki feedback */
export interface FeedbackRow {
  year: FeedbackCell;
  genres: FeedbackCell;
  director: FeedbackCell;
  rating: FeedbackCell;
  runtime: FeedbackCell;
  country: FeedbackCell;
}

// ─── Guess Values ─────────────────────────────────────────────────────────────

/** Tahmin edilen filmin metadata değerleri (grid'de gösterilir) */
export interface GuessValues {
  year: number;
  genres: string[];
  director: string | string[];
  rating: number;
  runtime: number;
  country: string[];
}

// ─── Guess ───────────────────────────────────────────────────────────────────

/** Tek bir tahmin kaydı */
export interface GuessEntry {
  /** Tahmin edilen filmin UUID'si */
  film_id: string;
  /** Film adı (grid'de gösterilir) */
  title: string;
  /** Sunucu feedback'i */
  feedback: FeedbackRow;
  /** Tahmin zamanı ISO string */
  timestamp: string;
  /** Tahmin edilen filmin metadata değerleri (CineMetrics grid'de gösterilir) */
  values?: GuessValues;
}

// ─── Game Progress ───────────────────────────────────────────────────────────

/** Sunucudaki oyun ilerleme durumu */
export interface GameProgress {
  guesses: GuessEntry[];
  guess_timestamps: string[];
  completed: boolean;
  won: boolean;
  revealed_count?: number;
  turns_played?: number;
  spotlight_guesses?: Array<{ turn: number; film_id: string; title: string; correct: boolean }>;
  eliminated_ids?: string[];
  /** Spotlight V3 — denenmis harfler */
  spotlight_letters?: string[];
  /** Spotlight V3 — acilmis pozisyonlar ve harfleri */
  spotlight_revealed?: RevealedTitleChar[];
  /** FadeIn — oyuncunun açtığı ipuçlarının order değerleri (seçim sırasıyla) */
  revealed_hints?: number[];
  /** Açılan ipucu sayısı (FadeIn/Detective) */
  hints_used?: number;
  /** Imposter V2 — oynanmış round'ların özeti (resume için) */
  imposter_rounds?: Array<{ round: number; correct: boolean; confidence?: number }>;
  /**
   * Detective — aşama (1: eleme, 3: bitti).
   *
   * 2 artık üretilmiyor; ikinci faz kaldırıldı. Eski kayıtlarda 2 görülebilir,
   * istemci onu 1 gibi ele alır.
   */
  stage?: DetectiveStage;
  /** Detective — eleme tahminleri */
  stage1_guesses?: GuessEntry[];
  /** Detective — sunucudaki sayaç başlangıcı (resume'da süre kaybolmasın) */
  timer_start_ms?: number;
  /** Detective — iki aşamanın toplam tahmin sayısı */
  total_guesses?: number;
}

// ─── Daily Challenge ─────────────────────────────────────────────────────────

/** CineMetrics puzzle_data yapısı */
export interface CineMetricsPuzzleData {
  columns: {
    year: number;
    genres: string[];
    director: string | string[];
    rating: number;
    runtime: number;
    country: string[];
  };
  tmdb_id: number;
  /** Debug/log için — istemcide çözüm olarak GÖSTERİLMEZ */
  film_title: string;
  poster_url?: string;
}

/** get-daily-challenge Edge Function response'u */
export interface DailyChallenge {
  puzzle: {
    id: string;
    game_id: string;
    puzzle_date: string;
    difficulty: number;
    /** Oyun tipine göre farklı yapıda — CineMetricsPuzzleData | Record<string, unknown> */
    puzzle_data: Record<string, unknown>;
    max_attempts: number;
  };
  progress: GameProgress | null;
  puzzle_no: number;
  /** Imposter — güven bahsi seçenekleri ve çarpanları (yalnızca gösterim) */
  confidence_config?: ImposterConfidenceConfig;
  /** Detective — tamamlanmış oyunlarda topluluk dağılımı */
  community_stats?: CommunityStats;
  /**
   * Çözüm — YALNIZCA kullanıcı o bulmacayı tamamlamışsa gelir.
   * puzzle_data artık film adı/posteri taşımıyor (migration 064).
   */
  revealed_solution?: RevealedFilm;
  /** FadeIn — daha önce açılmış ipuçlarının içerikleri (resume) */
  revealed_hint_contents?: FadeInHint[];
  /** Film keşfi köprüsü — tamamlanmış oyunda resume'da da gösterilir */
  why_this_movie?: WhyThisMovieText;
}

// ─── Günlük Sandık ───────────────────────────────────────────────────────────

/**
 * get-daily-chest response'u.
 *
 * Tamamlama sayımı ve ödül yazımı sunucuda; `claimed` istemci state'i değil,
 * `daily_chest_log` kaydının varlığıdır.
 */
export interface DailyChestState {
  total: number;
  completed: number;
  unlocked: boolean;
  claimed: boolean;
  rewards?: {
    streak_shield_count?: number;
    double_xp_tomorrow?: boolean;
  };
}

// ─── Günlük Tema (Cross-Game Connection) ─────────────────────────────────────

/** Tema tipi — get-daily-theme yalnızca AÇIK durumda döner */
export type DailyThemeType = 'director' | 'actor' | 'genre' | 'decade' | 'country';

/** Temaya ait tamamlanmış bulmacanın filmi */
export interface DailyThemeFilm {
  game_id: string;
  title: string;
  year: number;
  poster_url: string | null;
}

/**
 * get-daily-theme response'u.
 *
 * KİLİTLİ durumda tema etiketi GELMEZ — etiket oynanmamış bulmaca için
 * çözüm ipucudur (Hard Rule 1). İstemci yalnızca sayaç gösterir.
 */
export type DailyThemeState =
  | { state: 'none' }
  | { state: 'locked'; completed: number; total: number; game_types: string[] }
  | {
      state: 'unlocked';
      theme_type: DailyThemeType;
      theme_label: string;
      completed: number;
      total: number;
      films: DailyThemeFilm[];
    };

/** Imposter güven bahsi config'i — app_config'ten gelir, skorlama yetkisi sunucuda */
export interface ImposterConfidenceConfig {
  levels: number[];
  correct_factor: Record<string, number>;
  wrong_factor: Record<string, number>;
}

// ─── Logline Semantic Hints ──────────────────────────────────────────────────

/** Eşleşme derecesi */
export type SemanticMatch = 'same' | 'close' | 'different';

/** Logline yanlış tahminlerinde dönen tür/dönem yakınlığı bilgisi */
export interface LoglineSemanticHints {
  genre_match: SemanticMatch;
  decade_match: SemanticMatch;
  guess_genre: string;
  guess_decade: string;
}

// ─── Guess Result ────────────────────────────────────────────────────────────

/** Çözüm açıklandığında dönen film bilgisi */
export interface RevealedFilm {
  /** Çözüm filminin UUID'si — oyun bittiğinde gelir, keşif akışı için */
  film_id?: string;
  title: string;
  year: number;
  director: string;
  poster_url?: string;
}

/** DNA boyut ilerleme bilgisi (submit-guess'ten doner) */
export interface DimensionProgress {
  dimension: string;
  value_before: number;
  value_after: number;
}

/** Rank ilerleme bilgisi (submit-guess'ten doner) */
export interface RankProgress {
  current_rank_id: number;
  current_rank_name: string;
  cinema_score: number;
  next_rank_threshold: number | null;
  next_rank_name: string | null;
  rank_changed: boolean;
  total_dailies: number;
}

/** Oyun sonrasi film kesfi koprusu metni (submit-guess'ten gelir) */
export interface WhyThisMovieText {
  why_text?: string;
  fun_fact?: string;
}

/** submit-guess Edge Function response'u */
export interface GuessResult {
  correct: boolean;
  feedback: FeedbackRow | null;
  /** Tahmin edilen filmin metadata değerleri (CineMetrics) */
  guess_values: GuessValues | null;
  logline_reveal?: { revealed_index: number; revealed_word: string } | null;
  /** Logline yanlış tahminlerinde tür/dönem yakınlığı bilgisi */
  logline_hints?: LoglineSemanticHints | null;
  guesses_used: number;
  completed: boolean;
  won: boolean;
  xp_awarded: number;
  dna_updated: boolean;
  revealed_solution: RevealedFilm | null;
  /** Film kesfi koprusu — yalnizca tamamlanmada gelir */
  why_this_movie?: WhyThisMovieText | null;
  /** DNA boyut before/after degerleri (opsiyonel — server destegiyle gelir) */
  dimension_progress?: DimensionProgress[];
  /** Rank ilerleme bilgisi (opsiyonel — server destegiyle gelir) */
  rank_progress?: RankProgress;
}

/** submit-guess Imposter V2 round response'u */
export interface ImposterGuessResult {
  /** Bu round doğru mu */
  round: number;
  round_correct: boolean;
  /** Toplam doğru round sayısı (şu ana kadar) */
  correct_count: number;
  /** Bu round'daki sahte aktörlerin isimleri (öğrenme anı) */
  revealed_imposters: string[];
  completed: boolean;
  won: boolean;
  xp_awarded: number;
  dna_updated: boolean;
  revealed_solution: RevealedFilm | null;
  /** Film kesfi koprusu — yalnizca tamamlanmada gelir */
  why_this_movie?: WhyThisMovieText | null;
  /** Bu round için gönderilen güven seviyesi (50 | 75 | 100) */
  confidence: number;
  /** Bu round'un XP çarpanı — güven × sonuç (reveal kartında gösterilir) */
  round_xp_factor: number;
  /** Oyun bitince: 3 round'un ortalama güven çarpanı */
  confidence_factor?: number;
}

// ─── FadeIn Types ─────────────────────────────────────────────────────────────

/** FadeIn ipucu kategorileri — generate-puzzles tarafından üretilir */
export type FadeInHintType = 'genre' | 'decade' | 'director' | 'actor' | 'overview';

/** FadeIn ipucu (puzzle_data.hints'ten) */
export interface FadeInHint {
  /** Bu ipucunun kimliği — açma isteğinde sunucuya bu değer gider */
  order: number;
  type: FadeInHintType;
  content: string;
}

/**
 * puzzle_data'dan gelen ipucu iskeleti — İÇERİK YOK.
 * İçerik `revealHint()` (yeni açılan) veya `revealed_hint_contents` (resume)
 * üzerinden gelir.
 */
export type FadeInHintStub = Pick<FadeInHint, 'order' | 'type'>;

/**
 * submit-guess ipucu açma response'u.
 *
 * İçerik yalnızca BURADAN gelir: migration 064'ten sonra puzzle_data yalnızca
 * `order` + `type` taşır, ipucu metni sunucuda yaşar (Hard Rule 1).
 */
export interface HintRevealResult {
  revealed_hints: number[];
  hints_used: number;
  hint: FadeInHint;
}

/** Imposter V2 round yapısı (puzzle_data'dan) */
export interface ImposterRound {
  round: number;
  film_title: string;
  poster_url: string | null;
  /**
   * profile_path TMDb oyuncu fotografi yolu. Eski bulmacalarda yok —
   * istemci fotografsiz duruma dusup bas harflerini gosterir.
   */
  options: Array<{ id: number; name: string; profile_path?: string | null }>;
}

// ─── Spotlight Types ──────────────────────────────────────────────────────────

/**
 * Baslik maskesinin tek karakteri.
 *
 * HARD RULE 1: Istemci basligin METNINI asla gormez — yalnizca hangi
 * pozisyonun tahmin edilecek yuva, hangisinin gorunur ayrac oldugunu bilir.
 * Acilmis harfler `SpotlightState.revealed` uzerinden gelir.
 */
export interface TitleMaskToken {
  /** 'slot' = tahmin edilecek karakter · 'sep' = gorunur ayrac (bosluk, tire...) */
  t: 'slot' | 'sep';
  /** Yalnizca 'sep' icin gorunen karakter */
  c?: string;
}

/** puzzle_data yapisi — V3: tek gorsel + baslik maskesi */
export interface SpotlightPuzzleData {
  /** Surum bayragi. 3 = harf acma mekanigi. Eski (V2, eleme) istemcide desteklenmez. */
  v?: number;
  /** Filmden bir kare — afis DEGIL (FadeIn afisle oynuyor) */
  backdrop_url: string;
  title_mask: TitleMaskToken[];
  letter_count: number;
}

/** Istemci tarafi oyun durumu */
export interface SpotlightProgress {
  completed: boolean;
  won: boolean;
  /** Denenmis harfler — klavyede isaretli gosterilir */
  spotlight_letters?: string[];
  /** Acilmis pozisyonlar ve harfleri (title_mask indeksleri) */
  spotlight_revealed?: RevealedTitleChar[];
  guesses?: Array<{ turn: number; film_id: string; title: string; correct: boolean }>;
}

/** Acilmis tek karakter — pozisyon ve harf */
export interface RevealedTitleChar {
  pos: number;
  ch: string;
}

/** submit-guess spotlight harf tahmini response'u */
export interface SpotlightLetterResult {
  letter: string;
  /** Harf baslikta var mi */
  hit: boolean;
  /** Bu harfin baslikta bulundugu pozisyonlar */
  positions: number[];
  tried_letters: string[];
  revealed: RevealedTitleChar[];
  attempts_used: number;
  max_attempts: number;
  out_of_attempts: boolean;
  /**
   * Haklar bitti ve oyun kapandi. Bu durumda asagidaki alanlar dolar —
   * istemci dogrudan sonuc ekranina gecer.
   */
  completed: boolean;
  won: boolean;
  xp_awarded: number;
  dna_updated: boolean;
  revealed_solution: RevealedFilm | null;
  why_this_movie?: WhyThisMovieText | null;
}

/** submit-guess spotlight film tahmini response'u */
export interface SpotlightGuessResult {
  correct: boolean;
  attempts_used: number;
  max_attempts: number;
  completed: boolean;
  won: boolean;
  xp_awarded: number;
  dna_updated: boolean;
  tried_letters: string[];
  revealed: RevealedTitleChar[];
  revealed_solution: RevealedFilm | null;
  /** Film kesfi koprusu — yalnizca tamamlanmada gelir */
  why_this_movie?: WhyThisMovieText | null;
}

// ─── Detective Types ────────────────────────────────────────────────────────

// Not: Asagidaki uc tip eskiden Spotlight'a aitti ve Detective onlari
// paylasiyordu. Spotlight V3'te eleme mekanigi kaldirilinca sahipligi
// Detective'e gecti; adlar degistirilmedi (Detective genelinde kullanimda).

/** Ipucu tipi — Detective'in 6 sirali ipucu */
export type SpotlightClueType =
  | 'year_range'
  | 'genres'
  | 'runtime'
  | 'imdb_rating'
  | 'cast'
  | 'director';

/** Tek bir tur ipucu */
export interface SpotlightClue {
  turn: number;
  type: SpotlightClueType;
  value: string | number | string[];
}

/** Film secenegi (poster karti) */
export interface SpotlightOption {
  film_id: string;
  title: string;
  year: number;
  poster_url: string | null;
}

/** Detective oyun aşaması */
export type DetectiveStage = 1 | 2 | 3;

/** Detective puzzle_data yapısı (istemci tarafı — çözüm stripped) */
export interface DetectivePuzzleData {
  /** 12 film adayı (Stage 1 grid) */
  options: SpotlightOption[];
  /** 6 sıralı ipucu */
  clues: SpotlightClue[];
}

/** Detective sunucu tarafı oyun ilerleme durumu */
export interface DetectiveProgress {
  stage: DetectiveStage;
  eliminated_ids: string[];
  stage1_guesses: Array<{
    film_id: string;
    title: string;
    correct: boolean;
  }>;
  guess_timestamps: string[];
  timer_start_ms: number;
  total_guesses: number;
  hints_used: number;
  completed: boolean;
  won: boolean;
}

/**
 * İpucu-çözüm ilişki açıklaması.
 *
 * Sunucu yalnızca ham değeri gönderir; etiket ve biçimlendirme istemcide
 * `formatClueValue` ile yapılır — aksi halde `genres: Action,Comedy` gibi
 * çevrilmemiş ham enum ekrana düşüyordu.
 */
export interface ClueExplanation {
  clue_type: SpotlightClueType;
  clue_value: string | number | string[];
}

/** Decoy-çözüm bağlantı açıklaması */
export interface DecoyConnection {
  decoy_title: string;
  shared_traits: string[];
}

/** Detective ipucu çözümlemesi — oyun sonu öğrenme kartı verisi */
export interface DetectiveClueBreakdown {
  clue_explanations: ClueExplanation[];
  decoy_connections: DecoyConnection[];
}

/** Topluluk tahmin dağılımı istatistikleri */
export interface CommunityStats {
  /** Tahmin sayısına göre oyuncu dağılımı: { "1": 12, "2": 34, ... "0": 5 (failed) } */
  distribution: Record<string, number>;
  total_players: number;
  percentile: number;
}

/** submit-guess detective response'u */
export interface DetectiveGuessResult {
  correct: boolean;
  /** Mevcut aşama — 1: eleme sürüyor, 3: bitti */
  stage: DetectiveStage;

  // Eleme alanları
  eliminated_ids?: string[];
  next_clue?: SpotlightClue | null;
  remaining_count?: number;

  // Completion fields
  completed: boolean;
  won: boolean;
  detective_score: number | null;
  xp_awarded: number;
  dna_updated: boolean;
  revealed_solution: RevealedFilm | null;

  // Post-game data (sadece completed=true ise)
  /** Film keşfi köprüsü metni — diğer oyunlarla aynı şekil */
  why_this_movie?: WhyThisMovieText | null;
  /** İpucu çözümlemesi — Detective'e özgü öğrenme kartı */
  clue_breakdown?: DetectiveClueBreakdown | null;
  community_stats?: CommunityStats | null;
  /** "Lucky Spot" — Stage 1'de çözdü mü */
  lucky_spot?: boolean;
}
