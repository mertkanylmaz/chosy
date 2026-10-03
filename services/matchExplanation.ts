/**
 * matchExplanation servisi — kullanıcı mood'u ile film profilini eşleştiren
 * kısa açıklama üretir.
 *
 * İki katmanlı:
 *   1. Claude API (explain-match Edge Function) — batch, 10 film tek request
 *   2. Template fallback — dimensions_json'dan dominant boyutları çekip doldurur
 *      (i18n). Boyut eşleşmezse film sonuç haritasına HİÇ girmez.
 *
 * Cache: in-memory Map, aynı dil+mood+film kombinasyonunu tekrar fetch etmez.
 */
import * as Sentry from '@sentry/react-native';

import { GAUNTLET_EDGE_REGION } from '@/constants/edgeRegion';
import { i18n } from '@/constants/i18n';
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
 * Dil + dominant duygu + enerji seviyesi + tempo kombinasyonu kullanılır;
 * dil anahtarda olmazsa oturum içi dil değişiminde eski dildeki metin döner.
 */
function _profileCacheKey(profile: TasteProfile, locale: string): string {
  const dominant = _dominantEmotion(profile);
  return `${locale}_${dominant}_${Math.round(profile.energy_level * 10)}_${profile.pace_preference}`;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function _dominantEmotion(profile: TasteProfile): string {
  const emotions = profile.emotional_state;
  return Object.entries(emotions).sort(([, a], [, b]) => b - a)[0][0];
}

// ─── Template fallback ────────────────────────────────────────────────────────

/** filmDetail.matchEmotion.* altında karşılığı olan duygular */
const EMOTION_KEYS = new Set([
  'joy', 'sadness', 'fear', 'anger', 'surprise', 'disgust', 'anticipation', 'trust',
]);

/** filmDetail.matchVisual.* altında karşılığı olan görsel stiller */
const VISUAL_KEYS = new Set(['cinematic', 'minimalist', 'experimental', 'lush', 'raw']);

function _stringDim(dims: Record<string, unknown>, key: string): string | undefined {
  const value = dims[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * dimensions_json'dan dominant boyutları çekip template'e yerleştirir.
 * Boyut verisi yoksa ya da değer template sözlüğünde karşılık bulmuyorsa
 * null döner — varsayılan değer uydurulmaz, çağıran bölümü gizler.
 */
function _templateFallback(film: FilmForExplanation, userProfile: TasteProfile): string | null {
  const dims = film.dimensions;
  if (!dims) return null;

  // İki anahtar seti: 972 profil `pace`, kalanı `pace_preference` taşıyor (TEKNIK_BORC).
  const filmPace = _stringDim(dims, 'pace_preference') ?? _stringDim(dims, 'pace');
  if (userProfile.energy_level > 0.6 && filmPace === 'fast') {
    return i18n.t('filmDetail.matchTemplate.energyPace');
  }

  const userEmotion = _dominantEmotion(userProfile);
  const filmVisual = _stringDim(dims, 'visual_style');
  if (!EMOTION_KEYS.has(userEmotion) || filmVisual === undefined || !VISUAL_KEYS.has(filmVisual)) {
    return null;
  }

  const words = {
    emotion: i18n.t(`filmDetail.matchEmotion.${userEmotion}`),
    theme: i18n.t(`filmDetail.matchVisual.${filmVisual}`),
  };
  return userProfile.thematic_depth > 0.6
    ? i18n.t('filmDetail.matchTemplate.emotionTheme', words)
    : i18n.t('filmDetail.matchTemplate.emotionPick', words);
}

function _applyFallback(
  film: FilmForExplanation,
  userProfile: TasteProfile,
  profileKey: string,
  result: ExplanationMap,
): void {
  const fallback = _templateFallback(film, userProfile);
  if (fallback === null) return;
  _cache.set(_cacheKey(profileKey, film.filmId), fallback);
  result[film.filmId] = fallback;
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
  const locale = i18n.locale;
  const profileKey = _profileCacheKey(userProfile, locale);
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
        locale,
        films: toFetch.map((f) => ({ filmId: f.filmId, dimensions: f.dimensions })),
      },
      region: GAUNTLET_EDGE_REGION,
    });

    if (error) {
      // invoke HTTP hatasında fırlatmaz, `error` döndürür — catch'e düşmez.
      const context: unknown = (error as { context?: unknown }).context;
      Sentry.captureException(error, {
        tags: { component: 'matchExplanation', flow: 'explain-match' },
        extra: {
          http_status: context instanceof Response ? context.status : null,
          film_count: toFetch.length,
        },
      });
    } else if (data?.explanations && typeof data.explanations === 'object') {
      const explanations = data.explanations as Record<string, string | null>;

      for (const [filmId, explanation] of Object.entries(explanations)) {
        if (typeof explanation === 'string') {
          const key = _cacheKey(profileKey, filmId);
          _cache.set(key, explanation);
          result[filmId] = explanation;
        }
      }

      // `null` = sunucu açıklamayı doğrulamadan geçirmedi (reddetme/sistem dili);
      // template'e düşülmez, film sonuçta yer almaz, çağıran bölümü gizler.
      // Anahtarı hiç olmayan filmler (eski sunucu sürümü) için fallback sürer.
      for (const film of toFetch) {
        if (result[film.filmId] || explanations[film.filmId] === null) continue;
        _applyFallback(film, userProfile, profileKey, result);
      }

      return result;
    } else {
      Sentry.captureMessage('explain-match yanıtında explanations alanı yok', {
        level: 'warning',
        tags: { component: 'matchExplanation', flow: 'explain-match' },
        extra: { film_count: toFetch.length },
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: 'matchExplanation', flow: 'explain-match' },
      extra: { film_count: toFetch.length },
    });
  }

  // ── Katman 2: Template fallback ─────────────────────────────────────────────
  for (const film of toFetch) {
    _applyFallback(film, userProfile, profileKey, result);
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
