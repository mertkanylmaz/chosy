/**
 * Film AI Profilleme — prompt ve dogrulama TEK KAYNAK
 *
 * Bu modul `scripts/ai-profile-films.ts` (Node/tsx CLI) ile
 * `supabase/functions/profile-missing-films` (Deno Edge Function)
 * tarafindan ORTAK kullanilir. Ikisi de ayni prompt'u ve ayni dogrulamayi
 * calistirir; kopya tutulmaz.
 *
 * Neden tek kaynak: prompt iki yerde yasarsa biri guncellenip digeri
 * unutulur ve ayni havuzda iki farkli vektor dagilimi dogar.
 * `CLAUDE_MODEL` / `PROFILING_METHOD` de burada: ayrisirlarsa
 * `film_profiles` satirlarinin hangi model ve surumle uretildigi artik
 * ayirt edilemez — sessiz veri bozulmasi.
 *
 * ⚠️ RUNTIME-LEAF KALMALI. Deno bu dosyayi `.ts` uzantisiyla dogrudan
 * import eder; Node/tsx tarafi uzantisiz import eder. Iki runtime'in
 * cozumleyicisi uyusmadigi icin buraya DEGER (value) import'u EKLENMEZ.
 * Asagidaki tip-only import guvenlidir: derlemede silinir, runtime'da iz
 * birakmaz. Ayni desen: `services/archetypeEngine.ts:19`.
 */

import type {
  TasteProfile,
  EmotionalState,
  PacePreference,
  VisualStyle,
  EndingPreference,
  NarrativeStyle,
  SocialContext,
} from './vectorEncoder.ts';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Claude model — CLI ve Edge Function ayni modeli kullanmak ZORUNDA. */
export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

/** `film_profiles.profiling_method` etiketi. Uretim surumunun tek kaydi. */
export const PROFILING_METHOD = 'ai_claude_haiku45_v1';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawFilmJSON {
  tmdb_id: number;
  title: string;
  original_title: string;
  original_language: string;
  overview: string;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  vote_count: number;
  genres: Array<{ id: number; name: string }>;
  production_countries: string[];
  director: string | null;
  cast: string[];
  keywords: string[];
  imdb_id: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  country: string | null;
  imdb_rating: number | null;
  imdb_votes: number | null;
  metascore: number | null;
  oscar_wins: number;
  oscar_nominations: number;
  content_rating: string | null;
}

/** Raw JSON response shape from LLM */
export interface LLMProfileResponse {
  emotional_state: {
    joy: number;
    sadness: number;
    fear: number;
    anger: number;
    surprise: number;
    trust: number;
    anticipation: number;
    disgust: number;
  };
  energy_level: number;
  preferred_pace: 'slow' | 'medium' | 'fast';
  visual_style: 'minimalist' | 'cinematic' | 'experimental' | 'lush' | 'raw';
  thematic_depth: number;
  ending_preference: 'hopeful' | 'bittersweet' | 'open' | 'tragic' | 'triumphant';
  preferred_era: [number, number];
  cultural_context: string[];
  narrative_style: 'linear' | 'nonlinear' | 'anthology' | 'dialogue-driven';
  social_context: string[];
  rewatch_tolerance: boolean;
  reasoning: string;
}

// ---------------------------------------------------------------------------
// Prompt Engineering
// ---------------------------------------------------------------------------

export const PROFILING_SYSTEM_PROMPT = `You are a deeply knowledgeable film curator. Your task is to extract the "emotional DNA" of a film.

RULES:
- Speak from the film's TRUE SPIRIT, not its marketing summary
- "The Notebook" is marketed as "romantic comedy" but is ACTUALLY a deep sadness film -> dominant emotion sadness
- "Manchester by the Sea" is about grieving -> dominant emotion sadness, energy very low
- "Eternal Sunshine" carries both sadness and strange hope -> sadness 0.8, joy 0.4
- "Whiplash" is socially destructive but energetic -> energy high, but trust low, anger high
- A film can carry MULTIPLE emotions at once, they don't all have to be 0
- Consider year, director, themes, actors, keywords — not just the overview
- Be precise with numbers: 0.0 means completely absent, 1.0 means overwhelmingly dominant
- Most emotions should be in the 0.1-0.7 range; 0.8+ is reserved for truly defining traits

OUTPUT FORMAT: JSON only, no other text.`;

/**
 * Builds the user prompt for a single film.
 */
export function buildPrompt(film: RawFilmJSON): string {
  const year = film.release_date?.slice(0, 4) ?? 'unknown';
  const genreNames = film.genres.map((g) => g.name).join(', ');
  const castStr = film.cast?.slice(0, 5).join(', ') || 'unknown';
  const keywordsStr = film.keywords?.length > 0
    ? `Themes: ${film.keywords.slice(0, 10).join(', ')}`
    : '';
  const oscarStr = film.oscar_wins > 0
    ? `Oscar: ${film.oscar_wins} wins, ${film.oscar_nominations} nominations`
    : film.oscar_nominations > 0
      ? `Oscar: ${film.oscar_nominations} nominations`
      : '';

  return `Film: "${film.title}" (${year})
Director: ${film.director ?? 'unknown'}
Genres: ${genreNames}
Runtime: ${film.runtime ?? 'unknown'} minutes
IMDb: ${film.imdb_rating ?? film.vote_average}/10 (${film.imdb_votes ?? film.vote_count} votes)
${oscarStr ? oscarStr + '\n' : ''}Cast: ${castStr}
${keywordsStr ? keywordsStr + '\n' : ''}Overview: ${film.overview}

Extract the emotional DNA of this film. JSON:
{
  "emotional_state": {
    "joy": 0.0-1.0,
    "sadness": 0.0-1.0,
    "fear": 0.0-1.0,
    "anger": 0.0-1.0,
    "surprise": 0.0-1.0,
    "trust": 0.0-1.0,
    "anticipation": 0.0-1.0,
    "disgust": 0.0-1.0
  },
  "energy_level": 0.0-1.0,
  "preferred_pace": "slow" | "medium" | "fast",
  "visual_style": "minimalist" | "cinematic" | "experimental" | "lush" | "raw",
  "thematic_depth": 0.0-1.0,
  "ending_preference": "hopeful" | "bittersweet" | "open" | "tragic" | "triumphant",
  "preferred_era": [${year}, ${year}],
  "cultural_context": ["tag1", "tag2", "tag3"],
  "narrative_style": "linear" | "nonlinear" | "anthology" | "dialogue-driven",
  "social_context": ["alone" | "couple" | "friends" | "family"],
  "rewatch_tolerance": true | false,
  "reasoning": "1-2 sentences: why you gave this profile"
}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_PACES: PacePreference[] = ['slow', 'medium', 'fast'];
const VALID_VISUAL_STYLES: VisualStyle[] = ['minimalist', 'cinematic', 'experimental', 'lush', 'raw'];
const VALID_ENDINGS: EndingPreference[] = ['hopeful', 'bittersweet', 'open', 'tragic', 'triumphant'];
const VALID_NARRATIVES: NarrativeStyle[] = ['linear', 'nonlinear', 'anthology', 'dialogue-driven'];
const VALID_SOCIAL: SocialContext[] = ['alone', 'couple', 'friends', 'family'];

/** Validates and clamps a number to [0, 1] */
function clampScore(val: unknown): number {
  const n = typeof val === 'number' ? val : parseFloat(String(val));
  if (isNaN(n)) return 0;
  return Math.max(0, Math.min(1, Math.round(n * 100) / 100));
}

/**
 * Validates LLM response and converts to vectorEncoder-compatible TasteProfile.
 * Throws on fatal validation errors.
 */
export function validateAndConvert(raw: LLMProfileResponse, film: RawFilmJSON): {
  profile: TasteProfile;
  reasoning: string;
} {
  // Validate emotional_state
  if (!raw.emotional_state || typeof raw.emotional_state !== 'object') {
    throw new Error('Missing or invalid emotional_state');
  }

  const emotionKeys: (keyof EmotionalState)[] = [
    'joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'anticipation', 'trust',
  ];

  const emotional_state: EmotionalState = {
    joy: 0, sadness: 0, anger: 0, fear: 0,
    surprise: 0, disgust: 0, anticipation: 0, trust: 0,
  };

  for (const key of emotionKeys) {
    emotional_state[key] = clampScore(raw.emotional_state[key]);
  }

  // Check at least one emotion is non-zero
  const hasEmotion = emotionKeys.some((k) => emotional_state[k] > 0);
  if (!hasEmotion) {
    throw new Error('All emotional_state values are 0 — likely a parsing error');
  }

  // Validate categoricals with fallbacks
  const pace_preference: PacePreference = VALID_PACES.includes(raw.preferred_pace as PacePreference)
    ? (raw.preferred_pace as PacePreference)
    : 'medium';

  const visual_style: VisualStyle = VALID_VISUAL_STYLES.includes(raw.visual_style as VisualStyle)
    ? (raw.visual_style as VisualStyle)
    : 'cinematic';

  const ending_preference: EndingPreference = VALID_ENDINGS.includes(raw.ending_preference as EndingPreference)
    ? (raw.ending_preference as EndingPreference)
    : 'bittersweet';

  const narrative_style: NarrativeStyle = VALID_NARRATIVES.includes(raw.narrative_style as NarrativeStyle)
    ? (raw.narrative_style as NarrativeStyle)
    : 'linear';

  // Social context: pick the first valid one, default 'alone'
  let social_context: SocialContext = 'alone';
  if (Array.isArray(raw.social_context) && raw.social_context.length > 0) {
    const first = raw.social_context[0] as SocialContext;
    if (VALID_SOCIAL.includes(first)) {
      social_context = first;
    }
  }

  // Era preference
  const year = parseInt(film.release_date?.slice(0, 4) ?? '2000', 10);
  let era_from = year;
  let era_to = year;
  if (Array.isArray(raw.preferred_era) && raw.preferred_era.length === 2) {
    era_from = typeof raw.preferred_era[0] === 'number' ? raw.preferred_era[0] : year;
    era_to = typeof raw.preferred_era[1] === 'number' ? raw.preferred_era[1] : year;
  }

  // Cultural context: ensure array of strings
  const cultural_context: string[] = Array.isArray(raw.cultural_context)
    ? raw.cultural_context.filter((s): s is string => typeof s === 'string').slice(0, 5)
    : [];

  const profile: TasteProfile = {
    emotional_state,
    energy_level: clampScore(raw.energy_level),
    pace_preference,
    visual_style,
    thematic_depth: clampScore(raw.thematic_depth),
    ending_preference,
    era_preference: { from: era_from, to: era_to },
    cultural_context,
    avoid_signals: [], // AI profiling does not generate avoid_signals for films
    narrative_style,
    social_context,
    rewatch_tolerance: typeof raw.rewatch_tolerance === 'boolean' ? raw.rewatch_tolerance : true,
  };

  const reasoning = typeof raw.reasoning === 'string'
    ? raw.reasoning.slice(0, 500)
    : '';

  return { profile, reasoning };
}
