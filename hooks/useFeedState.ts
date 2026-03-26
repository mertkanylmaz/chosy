/**
 * useFeedState — Feed listesi + currentIndex + yön-bazlı swipe yönetimi.
 *
 * Mimari:
 * - feedRef (useRef): API'dan gelen filmler burada tutulur — useState DEĞİL.
 *   Slice/splice operasyonları race condition yaratmaz.
 * - setRenderTick: feedRef mutasyonu sonrası UI güncellemek için
 * - currentIndex (useState): dikey geçişlerde artır/azalt
 *
 * Swipe davranışları:
 * - RIGHT → onSwipeFilm (watchlist + vektör) + splice(idx) — film kalıcı silinir
 * - LEFT  → onSwipeFilm (skip + vektör)  + splice(idx) — film kalıcı silinir
 * - DOWN  → currentIndex++ — film feedRef'te kalır, geri dönülebilir
 * - UP    → currentIndex-- — dikey geçilen filme geri dön
 *
 * KRİTİK: Yatay swipe edilen filmler splice ile silindiği için
 * dikey scroll ile geri dönülemez. Sadece DOWN ile geçilen filmler
 * UP ile geri görülebilir.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { FilmFilters, TasteProfile } from '@/types';
import { Film } from '@/types/film';

import { useFeedManager } from './useFeedManager';
import { SwipeDirection } from './useHybridSwipe';

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface FeedStateResult {
  /** Görüntülenecek filmler (feedRef snapshot — her render'da güncel) */
  films: Film[];
  /** En üstte gösterilen kartın index'i */
  currentIndex: number;
  /** İlk yükleme devam ediyor mu */
  isLoading: boolean;
  /** Tüm filmler tükendi mi */
  isDone: boolean;
  /** Önceki filme dönülebilir mi (currentIndex > 0) */
  canGoBack: boolean;
  /**
   * Swipe tamamlandı — SwipeCardStack animasyon bittikten sonra çağırır.
   * Yöne göre splice veya index hareketi yapar.
   */
  onSwipeComplete: (direction: SwipeDirection) => void;
  /**
   * Feed'i sıfırla ve yeni profil ile baştan yükle.
   */
  resetFeed: (newProfile: TasteProfile, newFilters?: FilmFilters) => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param moodProfile - Mood ekranından gelen 12 boyutlu profil; null ise bekleme
 * @param filters     - Opsiyonel parametre filtreleri
 */
export function useFeedState(
  moodProfile: TasteProfile | null,
  filters: FilmFilters,
): FeedStateResult {
  const {
    films: managerFilms,
    isLoading,
    onSwipeFilm,
    onLoadMore,
    resetFeed: managerReset,
  } = useFeedManager(moodProfile, filters);

  // ── Feed yönetimi ──────────────────────────────────────────────────────────

  /**
   * Yerel film kopyası — splice-safe.
   * managerFilms'ten append-only senkronize edilir; yatay swipe'ta splice yapılır.
   */
  const feedRef = useRef<Film[]>([]);

  /**
   * Son senkronize edilen manager.films.length.
   * Yalnızca yeni filmler feedRef'e eklenir; splice yapılmış öğeler korunur.
   */
  const lastManagerLengthRef = useRef(0);

  /** feedRef mutasyonları sonrası render tetikler */
  const [, setRenderTick] = useState(0);
  const tick = () => setRenderTick((n) => n + 1);

  // ── Yeni filmler gelince feedRef'e ekle ──────────────────────────────────
  useEffect(() => {
    if (managerFilms.length > lastManagerLengthRef.current) {
      const newFilms = managerFilms.slice(lastManagerLengthRef.current);
      feedRef.current = [...feedRef.current, ...newFilms];
      lastManagerLengthRef.current = managerFilms.length;
      tick();
    }
  }, [managerFilms]);

  // ── Index yönetimi ────────────────────────────────────────────────────────

  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * currentIndex ref — onSwipeComplete'in stale closure'ını önler.
   */
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // ── Preload tetikleyici ───────────────────────────────────────────────────

  /**
   * feedRef'teki kalan film sayısı ≤ 3 ise bir sonraki batch'i yükle.
   * currentIndex değişince (DOWN/UP swipe) otomatik çalışır.
   */
  useEffect(() => {
    const remaining = feedRef.current.length - currentIndex;
    if (feedRef.current.length > 0 && remaining <= 3) {
      onLoadMore();
    }
  }, [currentIndex, onLoadMore]);

  // ── Swipe handler ─────────────────────────────────────────────────────────

  /**
   * Animasyon tamamlandıktan SONRA çağrılır (SwipeCardStack → runOnJS zinciri).
   *
   * RIGHT / LEFT: Film feedRef'ten kalıcı olarak splice edilir.
   *   currentIndex sabit kalır → bir sonraki film index'te hazır.
   * DOWN:  currentIndex++ → film feedRef'te, UP ile geri dönülebilir.
   * UP:    currentIndex-- → dikey olarak geçilen filmlere geri döner.
   */
  const onSwipeComplete = useCallback(
    (direction: SwipeDirection) => {
      const idx = currentIndexRef.current;
      const film = feedRef.current[idx];

      if (direction === 'right') {
        if (film) onSwipeFilm(film, 'right'); // watchlist + kullanıcı vektörü
        feedRef.current.splice(idx, 1);
        tick();
        // Splice sonrası kalan kontrol (index değişmediği için useEffect tetiklenmez)
        if (feedRef.current.length - idx <= 3) onLoadMore();
      } else if (direction === 'left') {
        if (film) onSwipeFilm(film, 'left'); // skip + kullanıcı vektörü
        feedRef.current.splice(idx, 1);
        tick();
        if (feedRef.current.length - idx <= 3) onLoadMore();
      } else if (direction === 'down') {
        setCurrentIndex((i) => i + 1);
      } else {
        // up — önceki filme geri dön
        setCurrentIndex((i) => Math.max(0, i - 1));
      }
    },
    [onSwipeFilm, onLoadMore],
  );

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetFeed = useCallback(
    (newProfile: TasteProfile, newFilters?: FilmFilters) => {
      feedRef.current = [];
      lastManagerLengthRef.current = 0;
      setCurrentIndex(0);
      managerReset(newProfile, newFilters);
    },
    [managerReset],
  );

  // ── Return ────────────────────────────────────────────────────────────────

  const films = feedRef.current;

  return {
    films,
    currentIndex,
    isLoading,
    isDone: !isLoading && currentIndex >= films.length && films.length > 0,
    canGoBack: currentIndex > 0,
    onSwipeComplete,
    resetFeed,
  };
}
