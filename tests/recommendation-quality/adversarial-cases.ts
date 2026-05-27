/**
 * Chosy.ai Adversarial Quality Test Cases
 *
 * 30 cases across 5 categories testing diversity, TR personas,
 * anti-mainstream, mood subtlety, and strict negative constraints.
 *
 * These cases go beyond "did we return the right films" and ask
 * "is the recommendation QUALITY actually good?"
 */

import type { TasteProfile, EmotionalState } from '../../types';

// ─── Adversarial Case Interface ──────────────────────────────────────────────

export interface DiversityCheck {
  /** Max films from a single director in top 10 */
  max_per_director?: number;
  /** Min unique directors in top 10 */
  min_unique_directors?: number;
  /** Max films from a single decade in top 10 */
  max_per_decade?: number;
  /** Min unique decades represented */
  min_decades_represented?: number;
  /** Min decade span (max_decade - min_decade) */
  min_decades_span?: number;
  /** Max US films in top 10 */
  max_us_films?: number;
  /** Min unique countries */
  min_unique_countries?: number;
  /** Max films in a single genre */
  max_per_genre?: number;
  /** Min unique genres */
  min_genre_diversity?: number;
}

export interface MainstreamPenalty {
  /** Max US films in top 10 */
  max_us_films?: number;
  /** Max high-vote films (vote_average >= 8.0 as proxy for mainstream) */
  max_high_rated_films?: number;
}

export interface AdversarialTestCase {
  /** Unique test ID */
  id: string;
  /** Category */
  category: 'diversity' | 'tr_persona' | 'anti_mainstream' | 'mood_subtlety' | 'strict_negative';
  /** User mood input */
  mood_input: string;
  /** Language */
  language: 'tr' | 'en';
  /** Archetype for taste profile generation */
  archetype: string;
  /** The taste profile to use for vector search */
  taste_profile: TasteProfile;
  /** Diversity checks (category A) */
  diversity_check?: DiversityCheck;
  /** Mainstream penalty checks (category C) */
  mainstream_penalty?: MainstreamPenalty;
  /** Expected emotions balance */
  expected_emotions?: Record<string, { min?: number; max?: number }>;
  /** Expected genres in results */
  expected_genres?: string[];
  /** Films that MUST NOT appear (exact title match) */
  must_not_include_exact?: string[];
  /** Keywords that MUST NOT appear in genres/titles */
  must_not_include_keywords?: string[];
  /** Strict constraints: ALL top 10 must satisfy */
  strict_constraints?: {
    max_runtime?: number;
    min_year?: number;
    max_year?: number;
    allowed_languages?: string[];
  };
  /** Optional filters for RPC */
  filters?: {
    yearRange?: string | null;
    minRating?: number | null;
    regions?: string[];
    directors?: string[];
  };
  /** Description of what we are testing */
  description: string;
}

// ─── Helper: default emotional state ────────────────────────────────────────

function emo(overrides: Partial<EmotionalState> = {}): EmotionalState {
  return {
    joy: 0.2, sadness: 0.2, anger: 0.1, fear: 0.1,
    surprise: 0.2, disgust: 0.1, anticipation: 0.2, trust: 0.3,
    ...overrides,
  };
}

// ─── Adversarial Test Cases ──────────────────────────────────────────────────

export const ADVERSARIAL_CASES: AdversarialTestCase[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY A — DIVERSITY (5 cases)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'ADV-A1',
    category: 'diversity',
    mood_input: 'huzunlu bir film izlemek istiyorum',
    language: 'tr',
    archetype: 'Melancholy Soul',
    taste_profile: {
      emotional_state: emo({ sadness: 0.85, joy: 0.05, trust: 0.4 }),
      energy_level: 0.2,
      pace_preference: 'slow',
      visual_style: 'cinematic',
      thematic_depth: 0.8,
      ending_preference: 'bittersweet',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    diversity_check: {
      max_per_director: 2,
      max_per_decade: 5,
      min_genre_diversity: 3,
    },
    description: 'Sad film request should still return diverse directors, decades, and genres',
  },

  {
    id: 'ADV-A2',
    category: 'diversity',
    mood_input: 'bir yonetmenin imzasini tasiyan, ama tek yonetmenden olmasin',
    language: 'tr',
    archetype: 'Visual Poet',
    taste_profile: {
      emotional_state: emo({ trust: 0.6, joy: 0.4, surprise: 0.5 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.7,
      ending_preference: 'open',
      era_preference: { from: 1980, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    diversity_check: {
      max_per_director: 2,
      min_unique_directors: 6,
    },
    description: 'Explicitly asks for director diversity — must have 6+ unique directors',
  },

  {
    id: 'ADV-A3',
    category: 'diversity',
    mood_input: '70lerden bugune kadar uzanan sinema yolculugu',
    language: 'tr',
    archetype: 'Nostalgia Keeper',
    taste_profile: {
      emotional_state: emo({ trust: 0.7, joy: 0.4, sadness: 0.3, anticipation: 0.4 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.6,
      ending_preference: 'hopeful',
      era_preference: { from: 1970, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    diversity_check: {
      min_decades_represented: 4,
    },
    description: 'Asks for films spanning decades — needs 4+ different decades',
  },

  {
    id: 'ADV-A4',
    category: 'diversity',
    mood_input: 'dunya sinemasi, farkli ulkelerden filmler',
    language: 'tr',
    archetype: 'Truth Seeker',
    taste_profile: {
      emotional_state: emo({ trust: 0.6, surprise: 0.5, anticipation: 0.4 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.7,
      ending_preference: 'open',
      era_preference: { from: 1980, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    diversity_check: {
      min_unique_countries: 5,
      max_us_films: 4,
    },
    description: 'World cinema request — needs 5+ countries, max 4 US films',
  },

  {
    id: 'ADV-A5',
    category: 'diversity',
    mood_input: 'drama izleyecegim',
    language: 'tr',
    archetype: 'Melancholy Soul',
    taste_profile: {
      emotional_state: emo({ sadness: 0.6, trust: 0.5, joy: 0.3 }),
      energy_level: 0.35,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.65,
      ending_preference: 'bittersweet',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    diversity_check: {
      max_per_director: 2,
      min_decades_span: 30,
      max_us_films: 6,
    },
    description: 'Generic drama should still span directors, decades, and countries',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY B — TR USER PERSONAS (8 cases)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'ADV-B1',
    category: 'tr_persona',
    mood_input: 'Pazar sabahi kahve yaninda, agir olmayan ama dusunduruc',
    language: 'tr',
    archetype: 'Zen Wanderer',
    taste_profile: {
      emotional_state: emo({ joy: 0.5, trust: 0.6, sadness: 0.15, anticipation: 0.4 }),
      energy_level: 0.2,
      pace_preference: 'slow',
      visual_style: 'lush',
      thematic_depth: 0.5,
      ending_preference: 'hopeful',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: ['violence', 'horror'],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_emotions: {
      joy: { min: 0.3 },
      sadness: { max: 0.5 },
    },
    description: 'Sunday morning coffee — calm, thoughtful but not heavy',
  },

  {
    id: 'ADV-B2',
    category: 'tr_persona',
    mood_input: 'Is cikisi yorgun, esimle birlikte, anlamli olsun',
    language: 'tr',
    archetype: 'Hopeless Romantic',
    taste_profile: {
      emotional_state: emo({ trust: 0.7, joy: 0.4, sadness: 0.3, anticipation: 0.3 }),
      energy_level: 0.25,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.6,
      ending_preference: 'hopeful',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: ['horror', 'gore', 'violence'],
      narrative_style: 'linear',
      social_context: 'couple',
      rewatch_tolerance: true,
    },
    description: 'After-work tired couple watching — meaningful but not heavy',
  },

  {
    id: 'ADV-B3',
    category: 'tr_persona',
    mood_input: 'Cumartesi gecesi yalnizim, surukleyici bir sey istiyorum',
    language: 'tr',
    archetype: 'Adrenaline Junkie',
    taste_profile: {
      emotional_state: emo({ anticipation: 0.8, fear: 0.3, surprise: 0.6, joy: 0.3 }),
      energy_level: 0.7,
      pace_preference: 'fast',
      visual_style: 'cinematic',
      thematic_depth: 0.4,
      ending_preference: 'triumphant',
      era_preference: { from: 2005, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_emotions: {
      anticipation: { min: 0.5 },
    },
    description: 'Saturday night alone — gripping, engaging content',
  },

  {
    id: 'ADV-B4',
    category: 'tr_persona',
    mood_input: 'Annemle izleyecegim, 60+ yas icin uygun',
    language: 'tr',
    archetype: 'Joy Seeker',
    taste_profile: {
      emotional_state: emo({ joy: 0.6, trust: 0.8, sadness: 0.15, fear: 0.0, anger: 0.0 }),
      energy_level: 0.3,
      pace_preference: 'slow',
      visual_style: 'cinematic',
      thematic_depth: 0.35,
      ending_preference: 'hopeful',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: ['violence', 'sex', 'gore', 'horror', 'drugs'],
      narrative_style: 'linear',
      social_context: 'family',
      rewatch_tolerance: true,
    },
    must_not_include_keywords: ['horror', 'gore', 'slasher'],
    description: 'Watching with 60+ mom — family-friendly, no violence',
  },

  {
    id: 'ADV-B5',
    category: 'tr_persona',
    mood_input: 'Lise arkadaslarimla, nostalji agir basabilir',
    language: 'tr',
    archetype: 'Nostalgia Keeper',
    taste_profile: {
      emotional_state: emo({ joy: 0.6, trust: 0.7, sadness: 0.3, anticipation: 0.3 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.3,
      ending_preference: 'hopeful',
      era_preference: { from: 1990, to: 2010 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'friends',
      rewatch_tolerance: true,
    },
    expected_emotions: {
      joy: { min: 0.3 },
      trust: { min: 0.3 },
    },
    description: 'High school friends reunion — nostalgia, 90s/2000s films',
  },

  {
    id: 'ADV-B6',
    category: 'tr_persona',
    mood_input: 'Yagmurlu Carsamba gecesi, melankoli istiyorum ama umut da olsun',
    language: 'tr',
    archetype: 'Melancholy Soul',
    taste_profile: {
      emotional_state: emo({ sadness: 0.7, joy: 0.35, trust: 0.5, anticipation: 0.3 }),
      energy_level: 0.2,
      pace_preference: 'slow',
      visual_style: 'cinematic',
      thematic_depth: 0.7,
      ending_preference: 'bittersweet',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_emotions: {
      sadness: { min: 0.5 },
      joy: { min: 0.2 },
    },
    description: 'Rainy Wednesday — melancholy with hope, bittersweet balance',
  },

  {
    id: 'ADV-B7',
    category: 'tr_persona',
    mood_input: 'Sevgilime yeni bir sey gosterecegim, siradan degil',
    language: 'tr',
    archetype: 'Visual Poet',
    taste_profile: {
      emotional_state: emo({ surprise: 0.6, joy: 0.4, trust: 0.5, anticipation: 0.5 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'experimental',
      thematic_depth: 0.6,
      ending_preference: 'bittersweet',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'couple',
      rewatch_tolerance: false,
    },
    mainstream_penalty: {
      max_high_rated_films: 5,
    },
    description: 'Showing partner something new and unusual — not mainstream',
  },

  {
    id: 'ADV-B8',
    category: 'tr_persona',
    mood_input: 'Istanbulda cekilmis veya Istanbul atmosferi olan',
    language: 'tr',
    archetype: 'Truth Seeker',
    taste_profile: {
      emotional_state: emo({ trust: 0.6, sadness: 0.4, joy: 0.3, anticipation: 0.3 }),
      energy_level: 0.3,
      pace_preference: 'slow',
      visual_style: 'raw',
      thematic_depth: 0.7,
      ending_preference: 'open',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: ['TR'],
      avoid_signals: [],
      narrative_style: 'dialogue-driven',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    description: 'Istanbul-set or Turkish atmosphere films',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY C — ANTI-MAINSTREAM (5 cases)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'ADV-C1',
    category: 'anti_mainstream',
    mood_input: 'Marvel ve super kahraman olmasin, baska bir sey',
    language: 'tr',
    archetype: 'Truth Seeker',
    taste_profile: {
      emotional_state: emo({ trust: 0.5, anticipation: 0.5, surprise: 0.4 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.6,
      ending_preference: 'open',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: ['superhero'],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    must_not_include_keywords: ['marvel', 'superhero', 'dc', 'comic'],
    description: 'No superhero films — must not return Marvel/DC',
  },

  {
    id: 'ADV-C2',
    category: 'anti_mainstream',
    mood_input: 'Hollywood ezberi degil, alternatif sinema',
    language: 'tr',
    archetype: 'Visual Poet',
    taste_profile: {
      emotional_state: emo({ surprise: 0.6, trust: 0.4, anticipation: 0.5 }),
      energy_level: 0.35,
      pace_preference: 'medium',
      visual_style: 'experimental',
      thematic_depth: 0.8,
      ending_preference: 'open',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    mainstream_penalty: {
      max_us_films: 4,
      max_high_rated_films: 4,
    },
    description: 'Alternative cinema — max 4 US films, max 4 high-rated mainstream',
  },

  {
    id: 'ADV-C3',
    category: 'anti_mainstream',
    mood_input: 'Az bilinen, gizli kalmis filmler',
    language: 'tr',
    archetype: 'Truth Seeker',
    taste_profile: {
      emotional_state: emo({ surprise: 0.7, anticipation: 0.5, trust: 0.4 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'raw',
      thematic_depth: 0.7,
      ending_preference: 'open',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    mainstream_penalty: {
      max_high_rated_films: 3,
    },
    description: 'Hidden gems — most results should not be mainstream blockbusters',
  },

  {
    id: 'ADV-C4',
    category: 'anti_mainstream',
    mood_input: 'Yonetmenin ismini herkes bilmiyor olsun',
    language: 'tr',
    archetype: 'Truth Seeker',
    taste_profile: {
      emotional_state: emo({ surprise: 0.6, trust: 0.5, anticipation: 0.4 }),
      energy_level: 0.35,
      pace_preference: 'medium',
      visual_style: 'experimental',
      thematic_depth: 0.75,
      ending_preference: 'open',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    mainstream_penalty: {
      max_high_rated_films: 4,
    },
    description: 'Unknown directors — avoid big-name director films',
  },

  {
    id: 'ADV-C5',
    category: 'anti_mainstream',
    mood_input: 'Klasik bir sey ama herkesin gordugu degil',
    language: 'tr',
    archetype: 'Nostalgia Keeper',
    taste_profile: {
      emotional_state: emo({ trust: 0.7, joy: 0.3, sadness: 0.3, anticipation: 0.3 }),
      energy_level: 0.3,
      pace_preference: 'slow',
      visual_style: 'cinematic',
      thematic_depth: 0.7,
      ending_preference: 'bittersweet',
      era_preference: { from: 1960, to: 2000 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    mainstream_penalty: {
      max_high_rated_films: 4,
    },
    description: 'Classic but not the obvious ones — hidden classic gems',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY D — MOOD SUBTLETY (7 cases)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'ADV-D1',
    category: 'mood_subtlety',
    mood_input: 'Mutluyum ama icimde bir burukluk var',
    language: 'tr',
    archetype: 'Melancholy Soul',
    taste_profile: {
      emotional_state: emo({ joy: 0.6, sadness: 0.5, trust: 0.4, anticipation: 0.2 }),
      energy_level: 0.35,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.65,
      ending_preference: 'bittersweet',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_emotions: {
      joy: { min: 0.4 },
      sadness: { min: 0.3 },
    },
    description: 'Happy but wistful — bittersweet films, mixed emotions',
  },

  {
    id: 'ADV-D2',
    category: 'mood_subtlety',
    mood_input: 'Eglenmek istiyorum ama dusunduruc olsun',
    language: 'tr',
    archetype: 'Joy Seeker',
    taste_profile: {
      emotional_state: emo({ joy: 0.7, surprise: 0.5, anticipation: 0.4, trust: 0.3 }),
      energy_level: 0.55,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.65,
      ending_preference: 'hopeful',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_emotions: {
      joy: { min: 0.4 },
    },
    description: 'Entertainment with depth — smart comedies, thought-provoking fun',
  },

  {
    id: 'ADV-D3',
    category: 'mood_subtlety',
    mood_input: 'Kizginim ama siddet izlemek istemiyorum',
    language: 'tr',
    archetype: 'Dark Passenger',
    taste_profile: {
      emotional_state: emo({ anger: 0.7, anticipation: 0.5, fear: 0.2, joy: 0.1 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'raw',
      thematic_depth: 0.7,
      ending_preference: 'open',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: ['violence', 'gore', 'war'],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    expected_emotions: {
      anger: { min: 0.3 },
    },
    must_not_include_keywords: ['gore', 'slasher'],
    description: 'Angry but no violence — cathartic drama without graphic content',
  },

  {
    id: 'ADV-D4',
    category: 'mood_subtlety',
    mood_input: 'Romantik ama klise olmasin, yenilik istiyorum',
    language: 'tr',
    archetype: 'Hopeless Romantic',
    taste_profile: {
      emotional_state: emo({ joy: 0.5, sadness: 0.4, trust: 0.6, surprise: 0.5 }),
      energy_level: 0.4,
      pace_preference: 'medium',
      visual_style: 'experimental',
      thematic_depth: 0.65,
      ending_preference: 'bittersweet',
      era_preference: { from: 2005, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'nonlinear',
      social_context: 'couple',
      rewatch_tolerance: false,
    },
    must_not_include_exact: ['The Notebook', 'A Walk to Remember'],
    expected_genres: ['Romance', 'Drama'],
    description: 'Romantic but not cliche — unconventional romance',
  },

  {
    id: 'ADV-D5',
    category: 'mood_subtlety',
    mood_input: 'Korku istiyorum ama jump scare degil, atmosfer korkusu',
    language: 'tr',
    archetype: 'Dark Passenger',
    taste_profile: {
      emotional_state: emo({ fear: 0.8, anticipation: 0.6, surprise: 0.3, disgust: 0.3 }),
      energy_level: 0.3,
      pace_preference: 'slow',
      visual_style: 'experimental',
      thematic_depth: 0.8,
      ending_preference: 'open',
      era_preference: { from: 2010, to: 2026 },
      cultural_context: [],
      avoid_signals: ['slasher', 'jump scare'],
      narrative_style: 'nonlinear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    expected_genres: ['Horror', 'Thriller'],
    description: 'Atmospheric horror, not jump scares — slow-burn psychological',
  },

  {
    id: 'ADV-D6',
    category: 'mood_subtlety',
    mood_input: 'Aksiyon ama derinligi de olsun, beyin yormayan degil',
    language: 'tr',
    archetype: 'Adrenaline Junkie',
    taste_profile: {
      emotional_state: emo({ anticipation: 0.8, joy: 0.3, surprise: 0.5, fear: 0.3 }),
      energy_level: 0.7,
      pace_preference: 'fast',
      visual_style: 'cinematic',
      thematic_depth: 0.7,
      ending_preference: 'open',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    expected_genres: ['Action', 'Thriller'],
    description: 'Action with depth — intelligent action films, not mindless',
  },

  {
    id: 'ADV-D7',
    category: 'mood_subtlety',
    mood_input: 'Komedi ama low-brow degil, akilli mizah',
    language: 'tr',
    archetype: 'Joy Seeker',
    taste_profile: {
      emotional_state: emo({ joy: 0.8, surprise: 0.5, trust: 0.4, anticipation: 0.3 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.55,
      ending_preference: 'hopeful',
      era_preference: { from: 2000, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'friends',
      rewatch_tolerance: true,
    },
    expected_genres: ['Comedy'],
    description: 'Smart comedy, not low-brow — witty, clever humor',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CATEGORY E — STRICT NEGATIVE (5 cases)
  // ═══════════════════════════════════════════════════════════════════════════

  {
    id: 'ADV-E1',
    category: 'strict_negative',
    mood_input: 'Mutlaka 90 dakikadan kisa',
    language: 'tr',
    archetype: 'Escapist',
    taste_profile: {
      emotional_state: emo({ joy: 0.4, anticipation: 0.4, trust: 0.4 }),
      energy_level: 0.5,
      pace_preference: 'fast',
      visual_style: 'cinematic',
      thematic_depth: 0.4,
      ending_preference: 'hopeful',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    strict_constraints: {
      max_runtime: 90,
    },
    description: 'Strict: ALL top 10 must be under 90 minutes',
  },

  {
    id: 'ADV-E2',
    category: 'strict_negative',
    mood_input: 'Cocukla izleyecegim, kesinlikle yetiskin temalar yok',
    language: 'tr',
    archetype: 'Joy Seeker',
    taste_profile: {
      emotional_state: emo({ joy: 0.8, trust: 0.8, sadness: 0.05, fear: 0.0, anger: 0.0 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'lush',
      thematic_depth: 0.15,
      ending_preference: 'hopeful',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: [],
      avoid_signals: ['violence', 'sex', 'drugs', 'gore', 'horror'],
      narrative_style: 'linear',
      social_context: 'family',
      rewatch_tolerance: true,
    },
    must_not_include_keywords: ['violence', 'sex', 'drugs', 'horror'],
    description: 'Strict child-safe: no adult themes in top 10',
  },

  {
    id: 'ADV-E3',
    category: 'strict_negative',
    mood_input: 'Son 3 yildan, bayatlamis bir sey degil',
    language: 'tr',
    archetype: 'Escapist',
    taste_profile: {
      emotional_state: emo({ joy: 0.4, anticipation: 0.5, surprise: 0.4, trust: 0.3 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.5,
      ending_preference: 'hopeful',
      era_preference: { from: 2023, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    strict_constraints: {
      min_year: 2023,
    },
    filters: {
      yearRange: null,
      minRating: null,
      regions: [],
      directors: [],
    },
    description: 'Strict: ALL top 10 must be from 2023+',
  },

  {
    id: 'ADV-E4',
    category: 'strict_negative',
    mood_input: 'Ingilizce veya Turkce, alt yazi okumayacagim',
    language: 'tr',
    archetype: 'Escapist',
    taste_profile: {
      emotional_state: emo({ joy: 0.4, anticipation: 0.4, trust: 0.4 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'cinematic',
      thematic_depth: 0.5,
      ending_preference: 'hopeful',
      era_preference: { from: 1990, to: 2026 },
      cultural_context: ['US', 'GB', 'TR'],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: true,
    },
    strict_constraints: {
      allowed_languages: ['en', 'tr'],
    },
    description: 'Strict: ALL top 10 must be English or Turkish language',
  },

  {
    id: 'ADV-E5',
    category: 'strict_negative',
    mood_input: 'Korku filmi istiyorum ama It veya benzeri klasik tehlikeli karakter filmleri olmasin',
    language: 'tr',
    archetype: 'Dark Passenger',
    taste_profile: {
      emotional_state: emo({ fear: 0.8, anticipation: 0.6, surprise: 0.4, disgust: 0.3 }),
      energy_level: 0.5,
      pace_preference: 'medium',
      visual_style: 'raw',
      thematic_depth: 0.6,
      ending_preference: 'open',
      era_preference: { from: 2010, to: 2026 },
      cultural_context: [],
      avoid_signals: [],
      narrative_style: 'linear',
      social_context: 'alone',
      rewatch_tolerance: false,
    },
    expected_genres: ['Horror'],
    must_not_include_exact: ['It', 'It Chapter Two', 'It Follows'],
    description: 'CRITICAL: "It" false positive bug regression test — exact title match required',
  },
];
