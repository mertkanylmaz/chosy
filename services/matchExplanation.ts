/**
 * matchExplanation servisi — kullanıcı mood'u ile film profilini eşleştiren
 * kısa açıklama üretir.
 *
 * İki katmanlı:
 *   1. Claude API (explain-match Edge Function) — batch, 10 film tek request
 *   2. Template fallback — dimensions_json'dan dominant boyutları çekip doldurur
 *
 * Cache: in-memory Map, aynı mood+film kombinasyonunu tekrar fetch etmez.
 */
import { TasteProfile } from '../types';
import { supabase } from './supabase';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** explainBatch'e iletilen film verisi */
export interface FilmForExplanation {
  filmId: string;
  /** film_profiles.dimensions_json içeriği */
  dimensions: Record<string, unknown> | null;
}

/** filmId → açıklama metni */
export type ExplanationMap = Record<string, string>;

// ─── In-memory cache ──────────────────────────────────────────────────────────

const _cache = new Map<string, string>();

function _cacheKey(profileKey: string, filmId: string): string {
  return `${profileKey}:${filmId}`;
}

/**
 * Mood profil için deterministik önbellek anahtarı üretir.
 * Dominant duygu + enerji seviyesi + tempo kombinasyonu kullanılır.
 */
function _profileCacheKey(profile: TasteProfile): string {
  const dominant = _dominantEmotion(profile);
  return `${dominant}_${Math.round(profile.energy_level * 10)}_${profile.pace_preference}`;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function _dominantEmotion(profile: TasteProfile): string {
  const emotions = profile.emotional_state;
  return Object.entries(emotions).sort(([, a], [, b]) => b - a)[0][0];
}

// ─── Template fallback ────────────────────────────────────────────────────────

const EMOTION_WORDS: Record<string, string> = {
  joy: 'joyful',
  sadness: 'melancholic',
  fear: 'tense',
  anger: 'intense',
  surprise: 'curious',
  disgust: 'critical',
  anticipation: 'expectant',
  trust: 'warm',
};

const VISUAL_THEMES: Record<string, string> = {
  cinematic: 'sweeping cinematic',
  minimalist: 'quiet, intimate',
  experimental: 'bold, unconventional',
  lush: 'rich visual',
  raw: 'gritty, authentic',
};

const PACE_WORDS: Record<string, string> = {
  slow: 'contemplative',
  medium: 'balanced',
  fast: 'propulsive',
};

/**
 * dimensions_json'dan dominant boyutları çekip template'e yerleştirir.
 */
function _templateFallback(film: FilmForExplanation, userProfile: TasteProfile): string {
  const dims = film.dimensions;
  const userEmotion = _dominantEmotion(userProfile);
  const filmPace = (dims?.pace_preference as string) ?? 'medium';
  const filmVisual = (dims?.visual_style as string) ?? 'cinematic';

  const emotion = EMOTION_WORDS[userEmotion] ?? 'reflective';
  const theme = VISUAL_THEMES[filmVisual] ?? 'captivating';
  const pace = PACE_WORDS[filmPace] ?? 'balanced';

  if (userProfile.energy_level > 0.6 && filmPace === 'fast') {
    return `The ${pace} pacing matches your current energy perfectly.`;
  }
  if (userProfile.thematic_depth > 0.6) {
    return `This film resonates with your ${emotion} mood through its ${theme} themes.`;
  }
  return `A great pick for when you're feeling ${emotion} — ${theme} at its finest.`;
}

// ─── Ana fonksiyon ────────────────────────────────────────────────────────────

/**
 * Birden fazla film için açıklama üretir.
 * Önce cache kontrolü yapar, eksik filmler için Edge Function çağırır,
 * hata durumunda template fallback devreye girer.
 *
 * @param userProfile - Kullanıcının mevcut mood profili
 * @param films - Açıklama üretilecek filmler (max 10 önerilir)
 * @returns filmId → açıklama metni haritası
 */
export async function explainBatch(
  userProfile: TasteProfile,
  films: FilmForExplanation[],
): Promise<ExplanationMap> {
  const profileKey = _profileCacheKey(userProfile);
  const result: ExplanationMap = {};
  const toFetch: FilmForExplanation[] = [];

  for (const film of films) {
    const key = _cacheKey(profileKey, film.filmId);
    const cached = _cache.get(key);
    if (cached !== undefined) {
      result[film.filmId] = cached;
    } else {
      toFetch.push(film);
    }
  }

  if (toFetch.length === 0) return result;

  // ── Katman 1: Claude API (Edge Function) ────────────────────────────────────
  try {
    const { data, error } = await supabase.functions.invoke('explain-match', {
      body: {
        userProfile,
        films: toFetch.map((f) => ({ filmId: f.filmId, dimensions: f.dimensions })),
      },
    });

    if (!error && data?.explanations && typeof data.explanations === 'object') {
      const explanations = data.explanations as Record<string, string>;

      for (const [filmId, explanation] of Object.entries(explanations)) {
        if (typeof explanation === 'string') {
          const key = _cacheKey(profileKey, filmId);
          _cache.set(key, explanation);
          result[filmId] = explanation;
        }
      }

      // Edge Function'ın döndürmediği filmler için fallback
      for (const film of toFetch) {
        if (!result[film.filmId]) {
          const fallback = _templateFallback(film, userProfile);
          _cache.set(_cacheKey(profileKey, film.filmId), fallback);
          result[film.filmId] = fallback;
        }
      }

      return result;
    }
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[matchExplanation] Edge function failed, using template fallback:', err);
    }
  }

  // ── Katman 2: Template fallback ─────────────────────────────────────────────
  for (const film of toFetch) {
    const fallback = _templateFallback(film, userProfile);
    _cache.set(_cacheKey(profileKey, film.filmId), fallback);
    result[film.filmId] = fallback;
  }

  return result;
}

/**
 * Belirli bir mood+film kombinasyonu için cache'i temizler.
 * Yeni mood aranırken tüm cache'i sıfırlamak için profileKey'siz çağır.
 */
export function clearExplanationCache(): void {
  _cache.clear();
}
