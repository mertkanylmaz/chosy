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
 *   index.tsx (Home):      startPreload(profile, filters)
 *   useFeedManager.ts:     consumePreloadedRecommendations()
 */
import type { FilmFilters, TasteProfile } from '@/types';
import type { RecommendationResult } from './recommendations';
import { getRecommendations } from './recommendations';
import { consumePendingSearchId, peekPendingSearchId, setPendingSearchId } from './moodSearchState';

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
function profileKey(profile: TasteProfile): string {
  return `${profile.energy_level}_${profile.thematic_depth}_${profile.ending_preference}`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Arka planda getRecommendations() baslatir.
 * setPhase('result') aninda cagirilir — kullanici profili okurken
 * filmler paralel yuklenir.
 *
 * @param profile  - AI tarafindan ayristirilmis TasteProfile
 * @param filters  - Kullanicinin sectigi filtreler
 */
export function startPreload(
  profile: TasteProfile,
  filters: FilmFilters,
): void {
  const key = profileKey(profile);

  // Ayni profil icin zaten preload baslatildiysa tekrar baslatma
  if (_preloadProfileKey === key && _preloadPromise) return;

  _preloadProfileKey = key;
  _preloadResult = null;

  // searchId'yi simdi peek et — consume, useFeedManager tarafindan yapilacak
  // AMA preload'un kendisi consume etmeli, yoksa useFeedManager
  // tekrar consume edince null bulur.
  const searchId = consumePendingSearchId();

  _preloadPromise = getRecommendations(
    profile,
    8, // BATCH_SIZE
    [], // excludeIds — ilk batch, onceki film yok
    filters,
    searchId,
    true, // isFirstBatch — LLM reranker aktif
  )
    .then((result) => {
      _preloadResult = result;
      return result;
    })
    .catch((err) => {
      // Preload basarisiz — useFeedManager kendi fetch'ini yapacak
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[recommendationPreload] Preload failed:', err);
      }
      // searchId'yi geri koy — fallback fetch kullanabilsin
      if (searchId) setPendingSearchId(searchId);
      _preloadPromise = null;
      _preloadProfileKey = null;
      throw err;
    });
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
