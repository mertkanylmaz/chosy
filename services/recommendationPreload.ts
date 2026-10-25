/**
 * Module-level recommendation preload cache.
 *
 * Problem: Kullanici MoodProfileResult ekraninda ~3-5 saniye profili okur,
 * sonra "Browse Movies"e basar. Bu sure boyunca getRecommendations() cagrilmaz
 * — deger yaratilmayan bos bekleme suresi.
 *
 * Cozum: setPhase('result') tetiklendigi anda getRecommendations() arka planda
 * baslatilir. Sonuc module-level cache'te tutulur. useFeedManager ilk batch'i
 * yuklerken once bu cache'e bakar — hazirsa network call atlanir.
 *
 * Kullanim:
 *   index.tsx (Home):      startPreload(profile, filters, moodText)
 *   useFeedManager.ts:     consumePreloadedRecommendations()
 */
import { Image } from 'expo-image';
import * as Sentry from '@sentry/react-native';

import type { FilmFilters, TasteProfile } from '@/types';
import { normalizePosterUrl } from '@/utils/posterUrl';
import type { RecommendationResult } from './recommendations';
import { getRecommendations } from './recommendations';
import { posthogAnalytics } from './posthog';
import {
  consumePendingSearchId,
  getSearchModeState,
  peekPendingSearchId,
  setPendingSearchId,
  type SearchMode,
} from './moodSearchState';

// ─── Cache State ────────────────────────────────────────────────────────────

/** Preload sonucu — resolve oldugunda dolu, henuz bitmemisse promise bekler */
let _preloadPromise: Promise<RecommendationResult> | null = null;

/** Preload sonucu resolve olmus mu */
let _preloadResult: RecommendationResult | null = null;

/** Hangi profil icin preload baslatildi — stale cache kontrolu */
let _preloadProfileKey: string | null = null;

/**
 * Profil icin benzersiz anahtar uretir.
 * Ayni profil icin tekrar preload baslatilmasini engeller.
 */
function profileKey(
  profile: TasteProfile,
  moodText: string,
  mode: SearchMode,
  searchId: string | null,
  filters: FilmFilters,
): string {
  // 3 boyut tek başına yetmez: farklı metin / mod / arama aynı boyutlara düşebilir
  // ve eski aramanın sonucu yeni aramaya taşınırdı. Filtreler de anahtarın parçası:
  // aynı metinle farklı filtre (PRO-0 B1) eski filtresiz sonucu yutmasın.
  const dims = `${profile.energy_level}_${profile.thematic_depth}_${profile.ending_preference}`;
  const filterKey = `${filters.yearRange ?? ''}:${filters.minRating ?? ''}`;
  return [dims, mode, searchId ?? '', moodText.trim().toLowerCase(), filterKey].join('|');
}

/**
 * Destedeki tum filmlerin (en fazla 8) posterini onceden yukler — deste acildiginda iskelet beklenmesin.
 * Kozmetik: hata akisi durdurmaz, yalnizca Sentry breadcrumb birakir.
 */
function prefetchPosters(result: RecommendationResult, limit?: number): void {
  // Ilk 3 ve 4..8 ayni yol: hicbiri await edilmez (fire-and-forget), gecikme eklemez.
  // `limit` (MONEY-1C kilit): ucretsiz sinirin otesindeki posterler HIC indirilmez.
  for (const film of limit === undefined ? result.films : result.films.slice(0, limit)) {
    // Kartla AYNI fonksiyon ve boyut: farklı URL önbelleği ıskalatır.
    const uri = normalizePosterUrl(film.posterUrl);
    if (!uri) continue;
    Image.prefetch(uri, 'memory-disk').catch((err: unknown) => {
      Sentry.addBreadcrumb({
        category: 'poster_prefetch',
        level: 'warning',
        message: 'poster prefetch basarisiz',
        data: { filmId: film.id, error: err instanceof Error ? err.message : String(err) },
      });
    });
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Arka planda getRecommendations() baslatir.
 * setPhase('result') aninda cagirilir — kullanici profili okurken
 * filmler paralel yuklenir.
 *
 * @param profile  - AI tarafindan ayristirilmis TasteProfile
 * @param filters  - Kullanicinin sectigi filtreler
 * @param moodText - Kullanicinin yazdigi metin (yalniz dedupe anahtari icin; AI'ya gitmez)
 * @param prefetchLimit - Verilirse yalniz ilk N posteri onceden yukler (kilitli deste); yoksa hepsi
 */
export function startPreload(
  profile: TasteProfile,
  filters: FilmFilters,
  moodText: string,
  prefetchLimit?: number,
): void {
  const key = profileKey(profile, moodText, getSearchModeState(), peekPendingSearchId(), filters);

  // Ayni arama (metin + mod + searchId + boyutlar + filtre) icin zaten preload varsa tekrar baslatma
  if (_preloadProfileKey === key && _preloadPromise) {
    // B1/B6 teşhisi: erken dönüş yeni aramanın RPC'sini başlatmaz — görünür olsun.
    posthogAnalytics.track('mood_preload_skipped', {
      reason: 'same_key',
      has_search_id: peekPendingSearchId() !== null,
      filter_min_rating: filters.minRating ?? null,
      filter_era: filters.yearRange ?? null,
    });
    return;
  }

  _preloadProfileKey = key;
  _preloadResult = null;

  // searchId'yi simdi peek et — consume, useFeedManager tarafindan yapilacak
  // AMA preload'un kendisi consume etmeli, yoksa useFeedManager
  // tekrar consume edince null bulur.
  const searchId = consumePendingSearchId();

  const promise: Promise<RecommendationResult> = getRecommendations(
    profile,
    8, // BATCH_SIZE
    [], // excludeIds — ilk batch, onceki film yok
    filters,
    searchId,
    true, // isFirstBatch — LLM reranker aktif
    'preload',
  )
    .then((result) => {
      // Arada yeni bir preload basladiysa (anahtar degisti) eski sonuc yenisini ezmesin
      if (_preloadPromise === promise) _preloadResult = result;
      prefetchPosters(result, prefetchLimit);
      return result;
    })
    .catch((err) => {
      // Preload basarisiz — useFeedManager kendi fetch'ini yapacak
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[recommendationPreload] Preload failed:', err);
      }
      if (_preloadPromise === promise) {
        // searchId'yi geri koy — fallback fetch kullanabilsin
        if (searchId) setPendingSearchId(searchId);
        _preloadPromise = null;
        _preloadProfileKey = null;
      }
      throw err;
    });
  _preloadPromise = promise;
  // Preload henüz tüketilmeden reddedilirse "yakalanmamış reddetme" olmasın: hata
  // tüketicide (useFeedManager) yeniden gözlenir; RPC zinciri hatası kaynakta zaten
  // Sentry'ye yazıldı (RPC_CHAIN_FAILED), burada yalnız iz bırakılır.
  promise.catch((err: unknown) => {
    Sentry.addBreadcrumb({
      category: 'recommendation_preload',
      level: 'warning',
      message: 'preload reddedildi (tuketicide yeniden gozlenecek)',
      data: { error: err instanceof Error ? err.message : String(err) },
    });
  });
}

/**
 * Hazir bir desteyi preload olarak yerlestirir (bugunku deste kurtarma, MONEY-1C).
 * `useFeedManager` ilk batch'te bunu tuketir: parse-mood / match_films / rerank CAGRISI YOK.
 */
export function seedPreload(films: RecommendationResult['films']): void {
  const result: RecommendationResult = { films, source: 'supabase', reranked: false };
  _preloadProfileKey = 'seeded';
  _preloadResult = result;
  _preloadPromise = Promise.resolve(result);
}

/**
 * Preload sonucunu consume eder (bir kez okunur, cache temizlenir).
 *
 * 3 durum:
 *   1. Preload tamamlandi → sonucu dondurur, cache temizler
 *   2. Preload devam ediyor → promise'i dondurur (await edilebilir)
 *   3. Preload baslatilmadi → null dondurur
 *
 * @returns Hazir sonuc, bekleyen promise, veya null
 */
export function consumePreloadedRecommendations(): {
  ready: RecommendationResult | null;
  pending: Promise<RecommendationResult> | null;
} {
  // Preload baslatilmadi
  if (!_preloadPromise) {
    return { ready: null, pending: null };
  }

  // Sonuc hazir — hemen dondur
  if (_preloadResult) {
    const result = _preloadResult;
    clearPreload();
    return { ready: result, pending: null };
  }

  // Sonuc bekliyor — promise'i dondur
  const promise = _preloadPromise;
  clearPreload();
  return { ready: null, pending: promise };
}

/**
 * Preload cache'ini temizler.
 * Yeni mood baslatildiginda veya consume sonrasi cagirilir.
 */
export function clearPreload(): void {
  _preloadPromise = null;
  _preloadResult = null;
  _preloadProfileKey = null;
}
