/**
 * Kural tabanlı film profilleme scripti — v2
 *
 * 4 sinyal kaynağından 12 boyutlu TasteProfile üretir:
 *   1. Genre ağırlıkları (kalibre edilmiş, türe özgü distinct sinyaller)
 *   2. Overview keyword analizi (100+ keyword, 8 kategori)
 *   3. Runtime → pace (5 kova, 3 kategori)
 *   4. Vote average → kalite boost/malus
 *
 * Çalıştırmak için: npx tsx scripts/profile-films.ts
 *
 * Girdi:  data/films-raw.json
 * Çıktı:  data/films-profiled.json
 * Opsiyonel DB: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   → film_profiles tablosuna otomatik upsert
 */

import * as fs from 'fs';
import * as path from 'path';

import { createClient } from '@supabase/supabase-js';

import {
  tasteProfileToVector,
  type TasteProfile as VectorTasteProfile,
} from '../services/vectorEncoder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawFilm {
  id: number;
  title: string;
  original_title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  genre_ids: number[];
  vote_average: number;
  vote_count: number;
  runtime: number | null;
  director: string | null;
  cast: string[];
  countries: string[];
}

interface EmotionalState {
  joy: number;
  sadness: number;
  fear: number;
  anger: number;
  surprise: number;
  disgust: number;
  trust: number;
  anticipation: number;
}

interface SocialFit {
  alone: number;
  couple: number;
  friends: number;
  family: number;
}

interface TasteProfile {
  emotional_state: EmotionalState;
  energy_level: number;
  pace: 'slow' | 'medium' | 'fast';
  visual_style: 'minimalist' | 'cinematic' | 'experimental' | 'lush' | 'raw';
  thematic_depth: number;
  ending_tone: 'hopeful' | 'bittersweet' | 'open' | 'tragic' | 'triumphant';
  era_feel: string;
  cultural_context: string;
  content_warnings: string[];
  narrative_style: 'linear' | 'nonlinear' | 'anthology' | 'dialogue-driven';
  social_fit: SocialFit;
  rewatch_value: number;
}

interface ProfiledFilm extends RawFilm {
  taste_profile: TasteProfile;
}

interface FilmError {
  id: number;
  title: string;
  error: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const INPUT_PATH = path.join(process.cwd(), 'data', 'films-raw.json');
const OUTPUT_PATH = path.join(process.cwd(), 'data', 'films-profiled.json');
const ERRORS_PATH = path.join(process.cwd(), 'data', 'films-errors.json');
const BATCH_SIZE = 50;

// Terminalde örnek profil gösterilecek filmler
const SAMPLE_TITLES = ['inception', 'the notebook', 'the shining', 'dumb and dumber', 'schindler'];

// ---------------------------------------------------------------------------
// Genre baseline — Kalibre edilmiş, türe özgü distinct sinyaller
// Kullanıcı tarafından belirlenen ağırlıklar.
// Belirtilmemiş alanlar: makul varsayılanlar.
// ---------------------------------------------------------------------------

interface GenreProfile {
  emotional_state: Partial<EmotionalState>;
  energy_level: number;
  pace: 'slow' | 'medium' | 'fast';
  visual_style: 'minimalist' | 'cinematic' | 'experimental' | 'lush' | 'raw';
  thematic_depth: number;
  ending_tone: 'hopeful' | 'bittersweet' | 'open' | 'tragic' | 'triumphant';
  narrative_style: 'linear' | 'nonlinear' | 'anthology' | 'dialogue-driven';
  social_fit: SocialFit;
  content_warnings: string[];
}

const GENRE_PROFILES: Record<number, GenreProfile> = {
  // Aksiyon
  28: {
    emotional_state: { anticipation: 0.7, joy: 0.3, anger: 0.35, fear: 0.25 },
    energy_level: 0.8,
    pace: 'fast',
    visual_style: 'cinematic',
    thematic_depth: 0.3,
    ending_tone: 'triumphant',
    narrative_style: 'linear',
    social_fit: { friends: 0.8, couple: 0.6, alone: 0.4, family: 0.3 },
    content_warnings: ['violence'],
  },
  // Macera
  12: {
    emotional_state: { anticipation: 0.7, joy: 0.5, surprise: 0.45, trust: 0.4 },
    energy_level: 0.7,
    pace: 'fast',
    visual_style: 'lush',
    thematic_depth: 0.35,
    ending_tone: 'hopeful',
    narrative_style: 'linear',
    social_fit: { friends: 0.75, family: 0.65, couple: 0.55, alone: 0.5 },
    content_warnings: [],
  },
  // Animasyon
  16: {
    emotional_state: { joy: 0.6, trust: 0.6, anticipation: 0.45, surprise: 0.35 },
    energy_level: 0.5,
    pace: 'medium',
    visual_style: 'lush',
    thematic_depth: 0.3,
    ending_tone: 'hopeful',
    narrative_style: 'linear',
    social_fit: { family: 0.9, friends: 0.65, alone: 0.45, couple: 0.4 },
    content_warnings: [],
  },
  // Komedi
  35: {
    emotional_state: { joy: 0.8, surprise: 0.4, trust: 0.45, disgust: 0.1 },
    energy_level: 0.6,
    pace: 'medium',
    visual_style: 'raw',
    thematic_depth: 0.3,
    ending_tone: 'hopeful',
    narrative_style: 'linear',
    social_fit: { friends: 0.85, couple: 0.7, family: 0.6, alone: 0.4 },
    content_warnings: [],
  },
  // Suç
  80: {
    emotional_state: { anger: 0.5, fear: 0.4, anticipation: 0.6, disgust: 0.3 },
    energy_level: 0.5,
    pace: 'medium',
    visual_style: 'raw',
    thematic_depth: 0.6,
    ending_tone: 'bittersweet',
    narrative_style: 'nonlinear',
    social_fit: { alone: 0.75, couple: 0.55, friends: 0.4, family: 0.2 },
    content_warnings: ['violence'],
  },
  // Belgesel
  99: {
    emotional_state: { trust: 0.7, anticipation: 0.45, surprise: 0.35 },
    energy_level: 0.2,
    pace: 'slow',
    visual_style: 'raw',
    thematic_depth: 0.7,
    ending_tone: 'open',
    narrative_style: 'dialogue-driven',
    social_fit: { alone: 0.85, couple: 0.6, friends: 0.5, family: 0.4 },
    content_warnings: [],
  },
  // Drama
  18: {
    emotional_state: { sadness: 0.5, trust: 0.45, anticipation: 0.35, joy: 0.2 },
    energy_level: 0.3,
    pace: 'slow',
    visual_style: 'minimalist',
    thematic_depth: 0.7,
    ending_tone: 'bittersweet',
    narrative_style: 'linear',
    social_fit: { alone: 0.75, couple: 0.65, friends: 0.35, family: 0.3 },
    content_warnings: [],
  },
  // Aile
  10751: {
    emotional_state: { joy: 0.7, trust: 0.7, anticipation: 0.45, surprise: 0.3 },
    energy_level: 0.5,
    pace: 'medium',
    visual_style: 'lush',
    thematic_depth: 0.2,
    ending_tone: 'hopeful',
    narrative_style: 'linear',
    social_fit: { family: 0.95, friends: 0.55, couple: 0.45, alone: 0.3 },
    content_warnings: [],
  },
  // Fantezi
  14: {
    emotional_state: { surprise: 0.6, joy: 0.5, anticipation: 0.6, trust: 0.4 },
    energy_level: 0.6,
    pace: 'medium',
    visual_style: 'lush',
    thematic_depth: 0.45,
    ending_tone: 'hopeful',
    narrative_style: 'linear',
    social_fit: { friends: 0.7, family: 0.6, couple: 0.55, alone: 0.55 },
    content_warnings: [],
  },
  // Tarih
  36: {
    emotional_state: { trust: 0.5, sadness: 0.4, anticipation: 0.4, anger: 0.3 },
    energy_level: 0.3,
    pace: 'slow',
    visual_style: 'cinematic',
    thematic_depth: 0.8,
    ending_tone: 'bittersweet',
    narrative_style: 'linear',
    social_fit: { alone: 0.7, couple: 0.6, friends: 0.45, family: 0.4 },
    content_warnings: [],
  },
  // Korku
  27: {
    emotional_state: { fear: 0.9, disgust: 0.4, surprise: 0.5, anticipation: 0.5 },
    energy_level: 0.6,
    pace: 'fast',
    visual_style: 'raw',
    thematic_depth: 0.4,
    ending_tone: 'tragic',
    narrative_style: 'linear',
    social_fit: { friends: 0.8, couple: 0.7, alone: 0.35, family: 0.15 },
    content_warnings: ['horror', 'violence'],
  },
  // Müzik
  10402: {
    emotional_state: { joy: 0.6, trust: 0.55, anticipation: 0.45, surprise: 0.35 },
    energy_level: 0.7,
    pace: 'medium',
    visual_style: 'cinematic',
    thematic_depth: 0.4,
    ending_tone: 'hopeful',
    narrative_style: 'linear',
    social_fit: { alone: 0.7, couple: 0.65, friends: 0.6, family: 0.5 },
    content_warnings: [],
  },
  // Gizem
  9648: {
    emotional_state: { surprise: 0.7, anticipation: 0.7, fear: 0.4, trust: 0.25 },
    energy_level: 0.4,
    pace: 'medium',
    visual_style: 'minimalist',
    thematic_depth: 0.6,
    ending_tone: 'open',
    narrative_style: 'nonlinear',
    social_fit: { alone: 0.85, couple: 0.55, friends: 0.4, family: 0.25 },
    content_warnings: [],
  },
  // Romantik
  10749: {
    emotional_state: { trust: 0.8, joy: 0.6, sadness: 0.3, anticipation: 0.4 },
    energy_level: 0.3,
    pace: 'slow',
    visual_style: 'cinematic',
    thematic_depth: 0.4,
    ending_tone: 'hopeful',
    narrative_style: 'linear',
    social_fit: { couple: 0.92, alone: 0.55, friends: 0.4, family: 0.3 },
    content_warnings: [],
  },
  // Bilim Kurgu
  878: {
    emotional_state: { surprise: 0.7, anticipation: 0.6, fear: 0.3, trust: 0.3 },
    energy_level: 0.6,
    pace: 'medium',
    visual_style: 'cinematic',
    thematic_depth: 0.7,
    ending_tone: 'open',
    narrative_style: 'linear',
    social_fit: { alone: 0.65, friends: 0.65, couple: 0.55, family: 0.35 },
    content_warnings: [],
  },
  // TV Film
  10770: {
    emotional_state: { trust: 0.5, joy: 0.45, anticipation: 0.35 },
    energy_level: 0.4,
    pace: 'medium',
    visual_style: 'minimalist',
    thematic_depth: 0.35,
    ending_tone: 'hopeful',
    narrative_style: 'linear',
    social_fit: { family: 0.7, couple: 0.6, alone: 0.55, friends: 0.45 },
    content_warnings: [],
  },
  // Gerilim
  53: {
    emotional_state: { fear: 0.7, anticipation: 0.8, anger: 0.35, disgust: 0.2 },
    energy_level: 0.7,
    pace: 'fast',
    visual_style: 'raw',
    thematic_depth: 0.5,
    ending_tone: 'bittersweet',
    narrative_style: 'nonlinear',
    social_fit: { alone: 0.7, couple: 0.6, friends: 0.5, family: 0.25 },
    content_warnings: ['violence'],
  },
  // Savaş
  10752: {
    emotional_state: { anger: 0.6, sadness: 0.7, fear: 0.5, anticipation: 0.4 },
    energy_level: 0.7,
    pace: 'fast',
    visual_style: 'raw',
    thematic_depth: 0.8,
    ending_tone: 'tragic',
    narrative_style: 'linear',
    social_fit: { alone: 0.65, couple: 0.5, friends: 0.55, family: 0.3 },
    content_warnings: ['violence'],
  },
  // Western
  37: {
    emotional_state: { anticipation: 0.5, anger: 0.4, trust: 0.35, joy: 0.3 },
    energy_level: 0.55,
    pace: 'medium',
    visual_style: 'cinematic',
    thematic_depth: 0.45,
    ending_tone: 'triumphant',
    narrative_style: 'linear',
    social_fit: { alone: 0.7, friends: 0.6, couple: 0.45, family: 0.3 },
    content_warnings: ['violence'],
  },
};

/** Bilinmeyen genre için varsayılan */
const DEFAULT_GENRE: GenreProfile = {
  emotional_state: { trust: 0.4, anticipation: 0.4, joy: 0.3 },
  energy_level: 0.5,
  pace: 'medium',
  visual_style: 'cinematic',
  thematic_depth: 0.45,
  ending_tone: 'open',
  narrative_style: 'linear',
  social_fit: { alone: 0.6, couple: 0.6, friends: 0.6, family: 0.5 },
  content_warnings: [],
};

// ---------------------------------------------------------------------------
// Keyword Sinyal Tablosu — 8 kategori, 100+ keyword
// ---------------------------------------------------------------------------

interface KeywordSignal {
  keywords: string[];
  /** Uygulanan delta. Flag değerler (1) override olarak kullanılır. */
  delta: {
    joy?: number;
    sadness?: number;
    fear?: number;
    anger?: number;
    surprise?: number;
    disgust?: number;
    trust?: number;
    anticipation?: number;
    energy_level?: number;
    thematic_depth?: number;
    override_visual_cinematic?: true;
    override_visual_experimental?: true;
    override_ending_tragic?: true;
    override_ending_hopeful?: true;
    override_narrative_nonlinear?: true;
    warn?: string;
  };
}

const KEYWORD_SIGNALS: KeywordSignal[] = [
  // ── 1. Pozitif duygular → joy +0.15 ───────────────────────────────────────
  {
    keywords: [
      'love', 'beautiful', 'hope', 'dream', 'light', 'happiness', 'joy',
      'friendship', 'wedding', 'reunion', 'miracle', 'celebration', 'laughter',
      'wonder', 'delight', 'cheer', 'smile', 'warmth', 'paradise', 'bliss',
    ],
    delta: { joy: 0.15 },
  },

  // ── 2. Negatif duygular → sadness +0.15 ───────────────────────────────────
  {
    keywords: [
      'death', 'war', 'dark', 'loss', 'grief', 'pain', 'murder', 'kill',
      'tragedy', 'funeral', 'suffering', 'despair', 'betrayal', 'dying',
      'mourning', 'sorrow', 'anguish', 'heartbreak', 'tragedy', 'desolation',
      'abandon', 'forsaken', 'hopeless', 'bleak',
    ],
    delta: { sadness: 0.15, override_ending_tragic: true },
  },

  // ── 3. Gerilim → fear +0.15, anticipation +0.1 ────────────────────────────
  {
    keywords: [
      'chase', 'escape', 'danger', 'survive', 'hunt', 'trap', 'stalk',
      'kidnap', 'hostage', 'bomb', 'assassin', 'conspiracy', 'threat',
      'terror', 'menace', 'ambush', 'pursue', 'hide', 'fugitive', 'stalker',
      'abduct', 'ransom', 'sniper', 'explosive', 'siege',
    ],
    delta: { fear: 0.15, anticipation: 0.1, warn: 'violence' },
  },

  // ── 4. Aksiyon → energy +0.2, anticipation +0.1 ───────────────────────────
  {
    keywords: [
      'fight', 'battle', 'explosion', 'weapon', 'army', 'hero', 'mission',
      'rescue', 'attack', 'destroy', 'combat', 'warrior', 'soldier', 'shoot',
      'clash', 'brawl', 'raid', 'strike', 'invade', 'siege', 'uprising',
    ],
    delta: { energy_level: 0.2, anticipation: 0.1, anger: 0.1 },
  },

  // ── 5. Felsefi → thematic_depth +0.2 ─────────────────────────────────────
  {
    keywords: [
      'meaning', 'existence', 'reality', 'truth', 'consciousness', 'identity',
      'memory', 'time', 'parallel', 'dimension', 'simulation', 'philosophy',
      'destiny', 'fate', 'soul', 'mortality', 'purpose', 'illusion', 'nature',
      'universe', 'human condition', 'transcendence', 'awakening', 'duality',
      'paradox', 'perception', 'subconscious',
    ],
    delta: { thematic_depth: 0.2, override_narrative_nonlinear: true },
  },

  // ── 6. Romantik → trust +0.15 ─────────────────────────────────────────────
  {
    keywords: [
      'love', 'passion', 'heart', 'romance', 'affair', 'desire', 'kiss',
      'marry', 'soulmate', 'lover', 'devotion', 'longing', 'infatuation',
      'adore', 'cherish', 'tender', 'intimate', 'beloved', 'sweetheart',
    ],
    delta: { trust: 0.15, joy: 0.08, override_ending_hopeful: true },
  },

  // ── 7. Komedi → joy +0.15, thematic_depth -0.1 ───────────────────────────
  {
    keywords: [
      'hilarious', 'absurd', 'prank', 'slapstick', 'satire', 'parody',
      'gag', 'fool', 'comic', 'farce', 'ridiculous', 'silly', 'witty',
      'outrageous', 'bumbling', 'clumsy', 'misadventure', 'blunder',
    ],
    delta: { joy: 0.15, thematic_depth: -0.1 },
  },

  // ── 8. Bilim kurgu → surprise +0.1 ────────────────────────────────────────
  {
    keywords: [
      'space', 'alien', 'robot', 'future', 'planet', 'galaxy', 'technology',
      'mutation', 'spacecraft', 'extraterrestrial', 'android', 'cyborg',
      'dystopia', 'utopia', 'wormhole', 'quantum', 'teleport', 'clone',
      'artificial intelligence', 'interstellar', 'apocalypse',
    ],
    delta: { surprise: 0.1, thematic_depth: 0.08 },
  },

  // ── 9. Aile / Çocuk → trust +0.1 ─────────────────────────────────────────
  {
    keywords: [
      'family', 'father', 'mother', 'child', 'children', 'daughter', 'son',
      'brother', 'sister', 'parent', 'grandparent', 'grow up', 'coming of age',
    ],
    delta: { trust: 0.1, joy: 0.05 },
  },

  // ── 10. Şiddet / Rahatsız edici → disgust +0.12 ───────────────────────────
  {
    keywords: [
      'brutal', 'gore', 'bloodshed', 'massacre', 'torture', 'butcher',
      'carnage', 'slaughter', 'mutilate', 'gruesome', 'horrific', 'savage',
    ],
    delta: { disgust: 0.12, fear: 0.08, warn: 'graphic-violence' },
  },

  // ── 11. Kurtuluş / Umut → hopeful override ───────────────────────────────
  {
    keywords: [
      'redemption', 'second chance', 'new beginning', 'overcome', 'triumph',
      'rise', 'reborn', 'forgiveness', 'healing', 'recover',
    ],
    delta: { joy: 0.1, trust: 0.08, override_ending_hopeful: true },
  },

  // ── 12. Estetik / Görsel → cinematic boost ───────────────────────────────
  {
    keywords: [
      'stunning', 'breathtaking', 'gorgeous', 'spectacular', 'visually',
      'masterpiece', 'beautifully shot', 'cinematography', 'lush landscapes',
      'hauntingly beautiful',
    ],
    delta: { override_visual_cinematic: true, joy: 0.05 },
  },
];

// ---------------------------------------------------------------------------
// Auteur yönetmenler — thematic_depth ve cinematic boost
// ---------------------------------------------------------------------------

const AUTEUR_DIRECTORS: string[] = [
  'stanley kubrick', 'ingmar bergman', 'akira kurosawa', 'andrei tarkovsky',
  'federico fellini', 'jean-luc godard', 'werner herzog', 'wong kar-wai',
  'paul thomas anderson', 'terrence malick', 'david lynch', 'michael haneke',
  'christopher nolan', 'alfonso cuarón', 'alejandro gonzález iñárritu',
  'wes anderson', 'martin scorsese', 'francis ford coppola', 'robert altman',
  'joel coen', 'ethan coen', 'david fincher', 'ridley scott', 'denis villeneuve',
  'park chan-wook', 'bong joon-ho', 'darren aronofsky', 'pablo larraín',
  'kubrick', 'bergman', 'kurosawa', 'tarkovsky', 'fellini', 'godard',
  'lynch', 'haneke', 'malick', 'nolan', 'scorsese', 'coppola', 'fincher',
  'villeneuve', 'aronofsky',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Değeri [min, max] aralığında sıkıştırır. */
function clamp(value: number, min = 0.0, max = 1.0): number {
  return Math.max(min, Math.min(max, value));
}

/** 2 ondalık basamağa yuvarlar. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** İlerleme çubuğu */
function printProgress(current: number, total: number, label: string): void {
  const width = 40;
  const filled = Math.round((current / total) * width);
  const bar = '█'.repeat(filled) + '░'.repeat(width - filled);
  const pct = Math.round((current / total) * 100).toString().padStart(3);
  process.stdout.write(`\r[${bar}] ${pct}%  ${label.padEnd(50)}`);
  if (current === total) process.stdout.write('\n');
}

/** ISO 3166-1 ülke kodu → kültürel bağlam */
function countryToCulturalContext(countries: string[]): string {
  if (!countries || countries.length === 0) return 'Hollywood';
  const map: Record<string, string> = {
    US: 'Hollywood', GB: 'British', FR: 'French', DE: 'German',
    JP: 'East Asian', KR: 'Korean', IT: 'European', ES: 'European',
    IN: 'Indian', TR: 'Turkish', SE: 'Scandinavian', NO: 'Scandinavian',
    DK: 'Scandinavian', FI: 'Scandinavian', CN: 'East Asian', TW: 'East Asian',
    HK: 'East Asian', BR: 'Latin American', MX: 'Latin American',
    AU: 'Hollywood', RU: 'European', IR: 'Middle Eastern',
    AR: 'Latin American', PL: 'European', RO: 'European', PT: 'European',
  };
  return map[countries[0]] ?? 'International';
}

/** release_date → era_feel string */
function releaseYearToEraFeel(releaseDate: string): string {
  const year = parseInt(releaseDate?.slice(0, 4) ?? '0', 10);
  if (!year) return 'timeless';
  if (year < 1960) return 'classic Hollywood';
  if (year < 1970) return '1960s';
  if (year < 1980) return '1970s';
  if (year < 1990) return '1980s nostalgia';
  if (year < 2000) return '1990s';
  if (year < 2010) return '2000s';
  if (year < 2020) return '2010s';
  return 'modern';
}

/**
 * Runtime → pace
 * < 100dk:  fast
 * 100-135:  medium
 * > 135dk:  slow
 */
function runtimeToPace(runtime: number | null): 'slow' | 'medium' | 'fast' | null {
  if (!runtime) return null;
  if (runtime < 100) return 'fast';
  if (runtime > 135) return 'slow';
  return 'medium';
}

/**
 * Vote average → kalite boost / malus
 * > 8.5: thematic_depth +0.15, visual_style → cinematic
 * > 8.0: thematic_depth +0.10
 * > 7.5: thematic_depth +0.05
 * < 5.0: thematic_depth -0.10
 */
function voteQualityBoost(
  vote: number,
): { depthDelta: number; forceCinematic: boolean } {
  if (vote > 8.5) return { depthDelta: 0.15, forceCinematic: true };
  if (vote > 8.0) return { depthDelta: 0.10, forceCinematic: false };
  if (vote > 7.5) return { depthDelta: 0.05, forceCinematic: false };
  if (vote < 5.0) return { depthDelta: -0.10, forceCinematic: false };
  return { depthDelta: 0, forceCinematic: false };
}

/** vote_average → rewatch_value [0-1] */
function voteToRewatch(vote: number): number {
  return clamp((vote - 4) / 6);
}

/** Birden fazla genre'nin GenreProfile'larını aritmetik ortalama ile birleştirir. */
function blendGenreProfiles(genreIds: number[]): GenreProfile {
  const profiles = genreIds
    .map((id) => GENRE_PROFILES[id])
    .filter((p): p is GenreProfile => p !== undefined);

  if (profiles.length === 0) return DEFAULT_GENRE;
  if (profiles.length === 1) return profiles[0];

  const emotionKeys: (keyof EmotionalState)[] = [
    'joy', 'sadness', 'fear', 'anger', 'surprise', 'disgust', 'trust', 'anticipation',
  ];
  const socialKeys: (keyof SocialFit)[] = ['alone', 'couple', 'friends', 'family'];

  // Emotional state: her duygunun ortalaması
  const blendedEmo: Partial<EmotionalState> = {};
  for (const key of emotionKeys) {
    const vals = profiles
      .map((p) => p.emotional_state[key])
      .filter((v): v is number => v !== undefined);
    if (vals.length > 0) {
      blendedEmo[key] = r2(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }

  // Social fit: ortalama
  const blendedSocial: SocialFit = { alone: 0, couple: 0, friends: 0, family: 0 };
  for (const key of socialKeys) {
    const vals = profiles.map((p) => p.social_fit[key]);
    blendedSocial[key] = r2(vals.reduce((a, b) => a + b, 0) / vals.length);
  }

  // Sayısal alanlar: ortalama
  const avgEnergy = r2(profiles.reduce((s, p) => s + p.energy_level, 0) / profiles.length);
  const avgDepth = r2(profiles.reduce((s, p) => s + p.thematic_depth, 0) / profiles.length);

  // Kategorik alanlar: dominant genre (ilk) belirler
  const dominant = profiles[0];
  const warnings = [...new Set(profiles.flatMap((p) => p.content_warnings))];

  return {
    emotional_state: blendedEmo,
    energy_level: avgEnergy,
    pace: dominant.pace,
    visual_style: dominant.visual_style,
    thematic_depth: avgDepth,
    ending_tone: dominant.ending_tone,
    narrative_style: dominant.narrative_style,
    social_fit: blendedSocial,
    content_warnings: warnings,
  };
}

// ---------------------------------------------------------------------------
// Core profiler
// ---------------------------------------------------------------------------

/**
 * Tek film için TasteProfile üretir.
 * 4 sinyal kaynağını sırayla uygular:
 *   1. Genre baseline blend
 *   2. Overview keyword analizi
 *   3. Runtime → pace override
 *   4. Vote quality boost
 *   5. Auteur yönetmen sinyali
 */
function profileFilm(film: RawFilm): TasteProfile {
  // ── 1. Genre baseline ──────────────────────────────────────────────────────
  const base = blendGenreProfiles(film.genre_ids);

  const emo: EmotionalState = {
    joy:          base.emotional_state.joy          ?? 0.25,
    sadness:      base.emotional_state.sadness      ?? 0.20,
    fear:         base.emotional_state.fear         ?? 0.15,
    anger:        base.emotional_state.anger        ?? 0.15,
    surprise:     base.emotional_state.surprise     ?? 0.25,
    disgust:      base.emotional_state.disgust      ?? 0.10,
    trust:        base.emotional_state.trust        ?? 0.35,
    anticipation: base.emotional_state.anticipation ?? 0.40,
  };

  let energyLevel   = base.energy_level;
  let visualStyle   = base.visual_style;
  let thematicDepth = base.thematic_depth;
  let endingTone    = base.ending_tone;
  let narrativeStyle = base.narrative_style;
  const warnings    = [...base.content_warnings];

  // ── 2. Keyword analizi ────────────────────────────────────────────────────
  const text = (film.title + ' ' + (film.overview ?? '')).toLowerCase();

  for (const signal of KEYWORD_SIGNALS) {
    const hit = signal.keywords.some((kw) => text.includes(kw));
    if (!hit) continue;

    const d = signal.delta;
    if (d.joy             !== undefined) emo.joy          = clamp(emo.joy + d.joy);
    if (d.sadness         !== undefined) emo.sadness      = clamp(emo.sadness + d.sadness);
    if (d.fear            !== undefined) emo.fear         = clamp(emo.fear + d.fear);
    if (d.anger           !== undefined) emo.anger        = clamp(emo.anger + d.anger);
    if (d.surprise        !== undefined) emo.surprise     = clamp(emo.surprise + d.surprise);
    if (d.disgust         !== undefined) emo.disgust      = clamp(emo.disgust + d.disgust);
    if (d.trust           !== undefined) emo.trust        = clamp(emo.trust + d.trust);
    if (d.anticipation    !== undefined) emo.anticipation = clamp(emo.anticipation + d.anticipation);
    if (d.energy_level    !== undefined) energyLevel      = clamp(energyLevel + d.energy_level);
    if (d.thematic_depth  !== undefined) thematicDepth    = clamp(thematicDepth + d.thematic_depth);

    if (d.override_visual_cinematic)    visualStyle    = 'cinematic';
    if (d.override_visual_experimental) visualStyle    = 'experimental';

    // tragic override her zaman uygulanır
    if (d.override_ending_tragic) endingTone = 'tragic';
    // hopeful sadece tragic değilse uygulanır
    if (d.override_ending_hopeful && endingTone !== 'tragic') endingTone = 'hopeful';

    if (d.override_narrative_nonlinear) narrativeStyle = 'nonlinear';

    if (d.warn && !warnings.includes(d.warn)) warnings.push(d.warn);
  }

  // ── 3. Runtime → pace ─────────────────────────────────────────────────────
  const runtimePace = runtimeToPace(film.runtime);
  const pace = runtimePace ?? base.pace;

  // ── 4. Vote quality boost ─────────────────────────────────────────────────
  const { depthDelta, forceCinematic } = voteQualityBoost(film.vote_average);
  thematicDepth = clamp(thematicDepth + depthDelta);
  if (forceCinematic) visualStyle = 'cinematic';

  // ── 5. Auteur yönetmen sinyali ────────────────────────────────────────────
  if (film.director) {
    const dirLower = film.director.toLowerCase();
    if (AUTEUR_DIRECTORS.some((a) => dirLower.includes(a))) {
      thematicDepth = clamp(thematicDepth + 0.12);
      visualStyle = 'cinematic';
    }
  }

  return {
    emotional_state: {
      joy:          r2(emo.joy),
      sadness:      r2(emo.sadness),
      fear:         r2(emo.fear),
      anger:        r2(emo.anger),
      surprise:     r2(emo.surprise),
      disgust:      r2(emo.disgust),
      trust:        r2(emo.trust),
      anticipation: r2(emo.anticipation),
    },
    energy_level:    r2(energyLevel),
    pace,
    visual_style:    visualStyle,
    thematic_depth:  r2(thematicDepth),
    ending_tone:     endingTone,
    era_feel:        releaseYearToEraFeel(film.release_date),
    cultural_context: countryToCulturalContext(film.countries ?? []),
    content_warnings: [...new Set(warnings)],
    narrative_style:  narrativeStyle,
    social_fit: {
      alone:   r2(base.social_fit.alone),
      couple:  r2(base.social_fit.couple),
      friends: r2(base.social_fit.friends),
      family:  r2(base.social_fit.family),
    },
    rewatch_value: r2(voteToRewatch(film.vote_average)),
  };
}

// ---------------------------------------------------------------------------
// Supabase upsert
// ---------------------------------------------------------------------------

/** TasteProfile'ı era_feel → era_preference dönüşümü ile VectorTasteProfile'a adapte eder. */
function eraFeel2Range(eraFeel: string): { from: number; to: number } {
  const s = eraFeel.toLowerCase();
  if (s.includes('2020') || s.includes('modern')) return { from: 2010, to: 2030 };
  if (s.includes('2010'))                          return { from: 2010, to: 2020 };
  if (s.includes('2000'))                          return { from: 2000, to: 2010 };
  if (s.includes('1990') || s.includes('90'))      return { from: 1990, to: 2000 };
  if (s.includes('1980') || s.includes('80'))      return { from: 1980, to: 1990 };
  if (s.includes('1970') || s.includes('70'))      return { from: 1970, to: 1980 };
  if (s.includes('1960') || s.includes('60'))      return { from: 1960, to: 1970 };
  if (s.includes('classic'))                       return { from: 1920, to: 1970 };
  return { from: 1900, to: 2030 };
}

/** social_fit nesnesinden en yüksek skora sahip değeri döndürür. */
function pickSocialContext(fit: SocialFit): VectorTasteProfile['social_context'] {
  const entries = [
    ['alone',   fit.alone],
    ['couple',  fit.couple],
    ['friends', fit.friends],
    ['family',  fit.family],
  ] as const;
  return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
}

/** TasteProfile → VectorTasteProfile */
function adaptToVectorProfile(p: TasteProfile): VectorTasteProfile {
  return {
    emotional_state:   p.emotional_state,
    energy_level:      p.energy_level,
    pace_preference:   p.pace,
    visual_style:      p.visual_style,
    thematic_depth:    p.thematic_depth,
    ending_preference: p.ending_tone,
    era_preference:    eraFeel2Range(p.era_feel),
    cultural_context:  p.cultural_context ? [p.cultural_context] : [],
    avoid_signals:     p.content_warnings ?? [],
    narrative_style:   p.narrative_style,
    social_context:    pickSocialContext(p.social_fit),
    rewatch_tolerance: p.rewatch_value >= 0.5,
  };
}

/** Diziyi N'lik parçalara böler. */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Profilleri Supabase film_profiles tablosuna upsert eder.
 * Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
async function upsertToSupabase(profiledFilms: ProfiledFilm[]): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.log(
      '\nSupabase env vars bulunamadı (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).' +
      '\nSadece JSON dosyası yazıldı — DB upsert atlandı.',
    );
    return;
  }

  console.log('\nSupabase upsert başlıyor...');
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1. tmdb_id → UUID eşlemesini çek
  const tmdbIds = profiledFilms.map((f) => f.id);
  const idMap = new Map<number, string>();
  const ID_BATCH = 500;

  for (let i = 0; i < tmdbIds.length; i += ID_BATCH) {
    const batch = tmdbIds.slice(i, i + ID_BATCH);
    const { data, error } = await sb.from('films').select('id, tmdb_id').in('tmdb_id', batch);
    if (error) throw new Error(`films UUID sorgusu hatası: ${error.message}`);
    for (const row of data ?? []) idMap.set(row.tmdb_id as number, row.id as string);
  }

  console.log(`  ${idMap.size} film UUID'i eşlendi.`);

  // 2. Profil satırlarını oluştur
  const rows: { film_id: string; profile_vector: number[]; dimensions_json: TasteProfile }[] = [];
  const skipped: number[] = [];

  for (const film of profiledFilms) {
    const filmUuid = idMap.get(film.id);
    if (!filmUuid) { skipped.push(film.id); continue; }
    rows.push({
      film_id:        filmUuid,
      profile_vector: tasteProfileToVector(adaptToVectorProfile(film.taste_profile)),
      dimensions_json: film.taste_profile,
    });
  }

  if (skipped.length > 0) {
    console.warn(`  Uyarı: ${skipped.length} film için UUID bulunamadı, atlandı.`);
  }

  // 3. Upsert (batch'ler hâlinde)
  const batches = chunk(rows, BATCH_SIZE);
  let inserted = 0;

  for (const batch of batches) {
    const { error } = await sb
      .from('film_profiles')
      .upsert(batch, { onConflict: 'film_id' });

    if (error) throw new Error(`film_profiles upsert hatası: ${error.message}`);
    inserted += batch.length;
    printProgress(inserted, rows.length, `film_profiles — ${inserted}/${rows.length}`);
  }

  console.log(`\nfilm_profiles: ${inserted} satır upsert edildi.`);
}

// ---------------------------------------------------------------------------
// Örnek profil gösterimi
// ---------------------------------------------------------------------------

function printSampleProfiles(profiledFilms: ProfiledFilm[]): void {
  const samples = SAMPLE_TITLES
    .map((title) =>
      profiledFilms.find((f) => f.title.toLowerCase().includes(title)),
    )
    .filter((f): f is ProfiledFilm => f !== undefined)
    .slice(0, 3);

  if (samples.length === 0) return;

  console.log('\n─── Örnek Profiller ───────────────────────────────────────────');
  for (const film of samples) {
    const p = film.taste_profile;
    const emo = p.emotional_state;
    console.log(`\n📽  ${film.title} (${film.release_date?.slice(0, 4)}, vote: ${film.vote_average})`);
    console.log(
      `    Duygular  → joy:${emo.joy} sadness:${emo.sadness} fear:${emo.fear} ` +
      `anger:${emo.anger} surprise:${emo.surprise} trust:${emo.trust} anticipation:${emo.anticipation}`,
    );
    console.log(
      `    energy:${p.energy_level}  pace:${p.pace}  visual:${p.visual_style}  ` +
      `depth:${p.thematic_depth}  ending:${p.ending_tone}  narrative:${p.narrative_style}`,
    );
    console.log(
      `    era:${p.era_feel}  culture:${p.cultural_context}  rewatch:${p.rewatch_value}`,
    );
    if (p.content_warnings.length > 0) {
      console.log(`    ⚠️  warnings: ${p.content_warnings.join(', ')}`);
    }
  }
  console.log('\n───────────────────────────────────────────────────────────────');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Hata: ${INPUT_PATH} bulunamadı. Önce fetch-films.ts çalıştır.`);
    process.exit(1);
  }

  const rawFilms: RawFilm[] = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf-8'));
  console.log(`${rawFilms.length} film yüklendi. Profilleme başlıyor...\n`);

  const profiled: ProfiledFilm[] = [];
  const errors: FilmError[] = [];

  for (let i = 0; i < rawFilms.length; i++) {
    const film = rawFilms[i];
    printProgress(i + 1, rawFilms.length, film.title);
    try {
      const taste_profile = profileFilm(film);
      profiled.push({ ...film, taste_profile });
    } catch (err: unknown) {
      errors.push({ id: film.id, title: film.title, error: String(err) });
    }
  }

  // JSON çıktısı
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(profiled, null, 2), 'utf-8');
  console.log(`\nProfillendi: ${profiled.length} film → ${OUTPUT_PATH}`);

  if (errors.length > 0) {
    fs.writeFileSync(ERRORS_PATH, JSON.stringify(errors, null, 2), 'utf-8');
    console.log(`Hatalar: ${errors.length} → ${ERRORS_PATH}`);
  } else {
    console.log('Hata: yok.');
  }

  // Örnek profiller
  printSampleProfiles(profiled);

  // Supabase upsert (opsiyonel)
  await upsertToSupabase(profiled);
}

main().catch((err: unknown) => {
  console.error('\nBeklenmedik hata:', err);
  process.exit(1);
});
