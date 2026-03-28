/**
 * Sonsuz film akışını yöneten hook.
 *
 * Sorumluluklar:
 *   - 10'ar film bloğu yükleme (high → medium → low → surprise faz geçişleri)
 *   - currentIndex 7'ye gelince sonraki batch'i arka planda preload etme
 *   - Sürpriz kart etiketleme (her 6. film)
 *   - Poster prefetch (sonraki 3 film)
 *   - Swipe aksiyonlarını işleme (watchlist, kullanıcı vektörü)
 *   - Yeni mood ile feed'i sıfırlama
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Image } from 'react-native';

import { FilmFilters, TasteProfile } from '@/types';
import { Film } from '@/types/film';
import { recordActivity } from '@/services/gamification';
import { getRecommendations, getSurprisePicks } from '@/services/recommendations';
import { updateUserVector } from '@/services/userProfile';
import { addToWatchlist, getAppUserId } from '@/services/watchlist';
import { type ErrorType, toUserError } from '@/utils/errorHelpers';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Her batch'te yüklenen film sayısı */
const BATCH_SIZE = 10;

/** Kalan film sayısı bu değere düşünce sonraki batch arka planda yüklenir */
const PRELOAD_TRIGGER = 3; // currentIndex 7'ye gelince (10 - 7 = 3 kalan)

/** Bu film sayısından sonra surprise phase başlar */
const SURPRISE_THRESHOLD = 30;

/** Her kaçıncı filmde sürpriz kart eklenir */
const SURPRISE_INTERVAL = 6;

// ─── Tipler ───────────────────────────────────────────────────────────────────

export type FeedPhase = 'high' | 'medium' | 'low' | 'surprise';

export interface FeedState {
  films: Film[];
  currentIndex: number;
  isLoading: boolean;
  hasError: boolean;
  /** Hata sınıflandırması — ErrorState'e iletilir */
  errorType: ErrorType;
  currentPhase: FeedPhase;
  sessionId: string;
  excludeIds: string[];
}

type FeedAction =
  | { type: 'ADD_FILMS'; films: Film[] }
  | { type: 'NEXT_FILM' }
  | { type: 'SWIPE_RIGHT'; filmId: string }
  | { type: 'SWIPE_LEFT'; filmId: string }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; hasError: boolean; errorType?: ErrorType }
  | { type: 'RESET'; sessionId: string };

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/**
 * Görüntülenen film index'ine göre mevcut fazı döndürür.
 */
function phaseForIndex(index: number): FeedPhase {
  if (index < 10) return 'high';
  if (index < 20) return 'medium';
  if (index < SURPRISE_THRESHOLD) return 'low';
  return 'surprise';
}

/**
 * Mevcut yüklü film sayısına göre bir sonraki batch'in fazını döndürür.
 */
function phaseForBatch(loadedCount: number): FeedPhase {
  if (loadedCount < 10) return 'high';
  if (loadedCount < 20) return 'medium';
  if (loadedCount < SURPRISE_THRESHOLD) return 'low';
  return 'surprise';
}

/**
 * Her SURPRISE_INTERVAL'da bir filmi sürpriz kart olarak işaretler.
 * Tür sırayla döngüseldir: hidden_gem → ai_pick → unexpected → …
 *
 * @param films      - Etiketlenecek film dizisi
 * @param startIndex - Bu batch'in feed içindeki başlangıç index'i
 */
function markSurpriseCards(films: Film[], startIndex: number): Film[] {
  const types: NonNullable<Film['surpriseType']>[] = ['hidden_gem', 'ai_pick', 'unexpected'];
  return films.map((film, i) => {
    const globalPos = startIndex + i + 1; // 1-indexed
    if (globalPos % SURPRISE_INTERVAL === 0) {
      const typeIndex = Math.floor(globalPos / SURPRISE_INTERVAL - 1) % types.length;
      return { ...film, surpriseType: types[typeIndex] };
    }
    return film;
  });
}

/**
 * Zaman damgası + rastgelelik içeren session ID üretir.
 */
function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialState: FeedState = {
  films: [],
  currentIndex: 0,
  isLoading: false,
  hasError: false,
  errorType: 'unknown',
  currentPhase: 'high',
  sessionId: generateSessionId(),
  excludeIds: [],
};

/**
 * Feed state geçişlerini yönetir.
 * Tüm state mutasyonları buradan geçer — yan etki içermez.
 */
function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case 'ADD_FILMS': {
      const startIndex = state.films.length;
      const marked = markSurpriseCards(action.films, startIndex);
      const newFilms = [...state.films, ...marked];
      const newExcludeIds = [
        ...state.excludeIds,
        ...action.films.map((f) => f.id),
      ];
      return {
        ...state,
        films: newFilms,
        excludeIds: newExcludeIds,
        isLoading: false,
        currentPhase: phaseForIndex(state.currentIndex),
      };
    }

    case 'NEXT_FILM': {
      const next = state.currentIndex + 1;
      return { ...state, currentIndex: next, currentPhase: phaseForIndex(next) };
    }

    case 'SWIPE_RIGHT':
    case 'SWIPE_LEFT': {
      const next = state.currentIndex + 1;
      return { ...state, currentIndex: next, currentPhase: phaseForIndex(next) };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.loading };

    case 'SET_ERROR':
      return {
        ...state,
        hasError: action.hasError,
        errorType: action.errorType ?? state.errorType,
        isLoading: false,
      };

    case 'RESET':
      return {
        ...initialState,
        sessionId: action.sessionId,
        isLoading: true,
      };

    default:
      return state;
  }
}

// ─── Hook Public API ──────────────────────────────────────────────────────────

export interface FeedManager {
  /** Tüm yüklü filmler — SwipeCardFeed'e doğrudan verilir */
  films: Film[];
  /** Şu an gösterilen film; henüz yüklenmemişse undefined */
  currentFilm: Film | undefined;
  /** Bir sonraki film (preload için); henüz yüklenmemişse undefined */
  nextFilm: Film | undefined;
  /** Yükleme devam ediyor mu */
  isLoading: boolean;
  /**
   * Swipe aksiyonu (index tabanlı — eski API, geriye dönük uyumluluk için korundu).
   * - right: watchlist + kullanıcı vektörü (save)
   * - left: atla + kullanıcı vektörü (skip)
   * - down: sadece sonraki film (TikTok kaydırma)
   */
  onSwipe: (direction: 'left' | 'right' | 'down') => void;
  /**
   * Swipe aksiyonu (film objesi tabanlı — SwipeCardFeed için).
   * FlatList'te hangi kart swipe edildiği doğrudan Film nesnesiyle gelir.
   */
  onSwipeFilm: (film: Film, direction: 'left' | 'right') => void;
  /** Sonraki batch'i yükle — FlatList onEndReached tarafından tetiklenir */
  onLoadMore: () => void;
  /**
   * Feed'i sıfırla ve yeni profil ile baştan yükle.
   * Mood ekranından yeni analiz geldiğinde çağrılır.
   */
  resetFeed: (newProfile: TasteProfile, newFilters?: FilmFilters) => void;
  /** Mevcut fazı yansıtır (currentIndex bazlı) */
  currentPhase: FeedPhase;
  /** Toplam kaydırılan film sayısı (= currentIndex) */
  totalSwiped: number;
  /** Son yükleme başarısız oldu mu */
  hasError: boolean;
  /** Hata sınıflandırması — ErrorState'e doğrudan iletilir */
  errorType: ErrorType;
  /** Hata sonrası yeniden yüklemeyi dener */
  retryLoad: () => void;
}

/**
 * Sonsuz film feed'ini yöneten ana hook.
 *
 * @param moodProfile - AI tarafından ayrıştırılmış 12 boyutlu tat profili; null ise yükleme beklenir
 * @param filters     - Kullanıcının seçtiği isteğe bağlı filtreler
 */
export function useFeedManager(
  moodProfile: TasteProfile | null,
  filters: FilmFilters,
): FeedManager {
  const [state, dispatch] = useReducer(feedReducer, initialState);

  /** Arka plan yüklemesi devam ediyorsa duplicate isteği engeller */
  const isLoadingRef = useRef(false);

  /**
   * Güncel profil ve filtreler ref'te tutulur.
   * loadNextBatch callback'inin bayat kapatma sorunu olmaz.
   */
  const profileRef = useRef(moodProfile);
  const filtersRef = useRef(filters);

  useEffect(() => {
    profileRef.current = moodProfile;
    filtersRef.current = filters;
  }, [moodProfile, filters]);

  /** Kullanıcı DB UUID'si; surprise picks ve vektör güncellemesi için */
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    getAppUserId()
      .then((id) => {
        userIdRef.current = id;
      })
      .catch(() => {
        // Auth yoksa null kalır, surprise picks atlanır
      });
  }, []);

  /**
   * Hangi sessionId için yükleme başlatıldığını izler.
   * RESET sonrası yeni sessionId ile ilk batch'in yüklenmesini sağlar.
   */
  const loadedSessionRef = useRef('');

  // ─── Batch Yükleme ────────────────────────────────────────────────────────

  /**
   * Mevcut faza göre sonraki BATCH_SIZE filmi arka planda yükler.
   * Duplicate çağrıları isLoadingRef ile engeller.
   *
   * @param excludeIds    - Daha önce yüklenen film ID'leri
   * @param loadedCount   - Şimdiye kadar yüklenen toplam film sayısı
   */
  const loadNextBatch = useCallback(async (
    excludeIds: string[],
    loadedCount: number,
  ) => {
    if (isLoadingRef.current) return;
    if (!profileRef.current) return;
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log('[useFeedManager] Next batch loading...');
    }
    isLoadingRef.current = true;
    dispatch({ type: 'SET_LOADING', loading: true });

    try {
      const phase = phaseForBatch(loadedCount);

      if (phase === 'surprise' && userIdRef.current) {
        // 30+ film sonrası: kullanıcı profil vektörü bazlı öneriler
        const surpriseResult = await getSurprisePicks(
          userIdRef.current,
          BATCH_SIZE,
          excludeIds,
        );

        if (surpriseResult && surpriseResult.films.length > 0) {
          dispatch({ type: 'ADD_FILMS', films: surpriseResult.films });
        } else {
          // Soğuk başlangıç: surprise yoksa low phase ile devam et
          const fallback = await getRecommendations(
            profileRef.current,
            BATCH_SIZE,
            excludeIds,
            filtersRef.current,
          );
          dispatch({ type: 'ADD_FILMS', films: fallback.films });
        }
      } else {
        const result = await getRecommendations(
          profileRef.current,
          BATCH_SIZE,
          excludeIds,
          filtersRef.current,
        );

        if (result.films.length === 0 && loadedCount === 0) {
          // İlk batch'te 0 film — filtreler çok dar veya sonuç yok
          dispatch({ type: 'SET_ERROR', hasError: true, errorType: 'empty' });
          return;
        }

        dispatch({ type: 'ADD_FILMS', films: result.films });
      }
    } catch (err) {
      if (__DEV__) {
        console.error('[useFeedManager] loadNextBatch hatası:', err);
      }
      const userError = toUserError(err, 'feed');
      dispatch({ type: 'SET_ERROR', hasError: true, errorType: userError.type });
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  // ─── İlk Yükleme (mount + reset sonrası) ────────────────────────────────

  useEffect(() => {
    if (
      state.films.length === 0 &&
      !isLoadingRef.current &&
      state.sessionId !== loadedSessionRef.current &&
      profileRef.current !== null
    ) {
      loadedSessionRef.current = state.sessionId;
      loadNextBatch([], 0);
    }
  }, [state.films.length, state.sessionId, loadNextBatch]);

  useEffect(() => {
    if (__DEV__ && state.currentIndex > 0) {
      // eslint-disable-next-line no-console
      console.log('[useFeedManager] Current index:', state.currentIndex);
    }
  }, [state.currentIndex]);

  // ─── Otomatik Preload ────────────────────────────────────────────────────

  useEffect(() => {
    const remaining = state.films.length - state.currentIndex;
    if (
      state.films.length > 0 &&
      remaining <= PRELOAD_TRIGGER &&
      !isLoadingRef.current
    ) {
      loadNextBatch(state.excludeIds, state.films.length);
    }
  }, [state.currentIndex, state.films.length, state.excludeIds, loadNextBatch]);

  // ─── Poster Prefetch ─────────────────────────────────────────────────────

  useEffect(() => {
    const upcoming = state.films.slice(
      state.currentIndex + 1,
      state.currentIndex + 4,
    );
    upcoming.forEach((f) => {
      if (f.posterUrl) {
        Image.prefetch(f.posterUrl);
      }
    });
  }, [state.currentIndex, state.films]);

  // ─── Swipe Handler ───────────────────────────────────────────────────────

  /**
   * Swipe yönüne göre state günceller ve yan etkileri tetikler.
   * Watchlist ve kullanıcı vektörü güncellemeleri fire-and-forget'tir.
   */
  const onSwipe = useCallback(
    (direction: 'left' | 'right' | 'down') => {
      const film = state.films[state.currentIndex];
      if (!film) return;

      if (direction === 'right') {
        dispatch({ type: 'SWIPE_RIGHT', filmId: film.id });

        // NOT: addToWatchlist buradan çağrılmaz.
        // Watchlist işlemi yalnızca onSwipeFilm üzerinden yapılır.
        if (userIdRef.current) {
          updateUserVector(userIdRef.current, film.id).catch(() => {
            // Fire-and-forget — hata kullanıcıya yansıtılmaz
          });
        }
      } else if (direction === 'left') {
        dispatch({ type: 'SWIPE_LEFT', filmId: film.id });
      } else {
        // down: TikTok tarzı sonraki film
        dispatch({ type: 'NEXT_FILM' });
      }
    },
    [state.currentIndex, state.films],
  );

  // ─── Reset ───────────────────────────────────────────────────────────────

  /**
   * Feed'i tamamen sıfırlar ve yeni profil ile yeniden yükler.
   * Yeni mood analizi tamamlandığında çağrılır.
   *
   * @param newProfile  - Yeni 12 boyutlu tat profili
   * @param newFilters  - Güncellenmiş filtreler (opsiyonel)
   */
  const resetFeed = useCallback(
    (newProfile: TasteProfile, newFilters?: FilmFilters) => {
      profileRef.current = newProfile;
      if (newFilters) filtersRef.current = newFilters;
      isLoadingRef.current = false;
      dispatch({ type: 'RESET', sessionId: generateSessionId() });
    },
    [],
  );

  // ─── onSwipeFilm (film objesi tabanlı — SwipeCardFeed için) ────────────

  /**
   * FlatList tabanlı SwipeCardFeed'den gelen swipe aksiyonunu işler.
   * Hangi Film'in swipe edildiği doğrudan parametre olarak alınır.
   */
  const onSwipeFilm = useCallback(
    (film: Film, direction: 'left' | 'right') => {
      if (direction === 'right') {
        // addToWatchlist içinde updateUserVector zaten çağrılır
        addToWatchlist(film).catch((err) => {
          if (__DEV__) {
            console.error('[useFeedManager] addToWatchlist hatası:', err);
          }
        });
      }

      // Streak + milestone güncelleme (fire-and-forget, her swipe'da)
      recordActivity().catch(() => {
        // Gamification hataları kullanıcıyı etkilememeli
      });
    },
    [],
  );

  // ─── onLoadMore (FlatList onEndReached için) ─────────────────────────────

  const onLoadMore = useCallback(() => {
    if (!isLoadingRef.current) {
      loadNextBatch(state.excludeIds, state.films.length);
    }
  }, [loadNextBatch, state.excludeIds, state.films.length]);

  // ─── retryLoad (hata sonrası yeniden deneme) ─────────────────────────────

  const retryLoad = useCallback(() => {
    dispatch({ type: 'SET_ERROR', hasError: false });
    isLoadingRef.current = false;
    loadNextBatch(state.excludeIds, state.films.length);
  }, [loadNextBatch, state.excludeIds, state.films.length]);

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    films: state.films,
    currentFilm: state.films[state.currentIndex],
    nextFilm: state.films[state.currentIndex + 1],
    isLoading: state.isLoading,
    hasError: state.hasError,
    errorType: state.errorType,
    retryLoad,
    onSwipe,
    onSwipeFilm,
    onLoadMore,
    resetFeed,
    currentPhase: state.currentPhase,
    totalSwiped: state.currentIndex,
  };
}
