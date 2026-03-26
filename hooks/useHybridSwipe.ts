/**
 * useHybridSwipe — Hibrit swipe gesture hook'u (TikTok + Tinder).
 *
 * Mimari: Hook gesture handler fonksiyonlarını döndürür; Gesture.Pan()
 * bileşende oluşturulur ve bu handler'lara bağlanır.
 *
 * Yön kilidi:
 *   - 10px sonra açı hesaplanır
 *   - açı < 30° → YATAY (Tinder)
 *   - açı > 60° → DİKEY (TikTok)
 *   - 30-60° arası → abs(dx) > abs(dy) ? YATAY : DİKEY
 *   - Kilitlenince gesture bitene kadar değişmez
 *
 * Tüm animasyonlar UI thread'de (worklet direktifi). runOnJS sadece
 * onGestureEnd'de eşik geçilince callback için kullanılır.
 */

import { useCallback, useEffect, useRef } from 'react';
import { Dimensions } from 'react-native';

import {
  AnimatedStyle,
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { ViewStyle } from 'react-native';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Yön kilidi için minimum hareket mesafesi (px) */
const DIRECTION_LOCK_THRESHOLD = 10;

const SWIPE_X_THRESHOLD = SCREEN_WIDTH * 0.35;
const SWIPE_Y_THRESHOLD = SCREEN_HEIGHT * 0.25;
const VELOCITY_X_THRESHOLD = 800;
const VELOCITY_Y_THRESHOLD = 600;

/** Geri dönüş yayı — eşik geçilmeyince */
const SPRING_BACK = { damping: 20, stiffness: 200, mass: 0.8 };
/** Yatay fırlatma yayı */
const SPRING_EXIT_H = { damping: 30, stiffness: 120, mass: 1 };
/** Dikey geçiş yayı */
const SPRING_VERTICAL = { damping: 22, stiffness: 180, mass: 0.7 };

const FLING_X = SCREEN_WIDTH * 1.5;
const FLING_Y = SCREEN_HEIGHT;
const FLING_DURATION = 280;

/** Maksimum kart eğimi (derece) */
const MAX_TILT = 12;

/** Yön kilidi değerleri (string yerine sayı: worklet'te daha hızlı) */
const DIR_NONE = 0;
const DIR_HORIZONTAL = 1;
const DIR_VERTICAL = 2;

// ── Tipler ────────────────────────────────────────────────────────────────────

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface HybridSwipeResult {
  /** Kartın yatay pozisyonu */
  translateX: SharedValue<number>;
  /** Kartın dikey pozisyonu */
  translateY: SharedValue<number>;
  /** Kartın z-ekseni rotasyonu (derece, max ±12) */
  cardRotation: SharedValue<number>;
  /**
   * Overlay sinyal değeri:
   * - pozitif [0,1]: sağa swipe → Saved overlay
   * - negatif [-1,0]: sola swipe → Skip overlay
   * - 0: dikey swipe veya serbest
   */
  rawOverlay: SharedValue<number>;
  /**
   * Swipe ilerleme [0,1].
   * Arka kart scale animasyonu için kullanılır.
   */
  swipeProgress: SharedValue<number>;
  /** Gesture.Pan().onBegin'e bağlanır */
  onGestureStart: () => void;
  /** Gesture.Pan().onUpdate'e bağlanır — (e.translationX, e.translationY) */
  onGestureUpdate: (tx: number, ty: number) => void;
  /** Gesture.Pan().onEnd'e bağlanır — (e.translationX, e.translationY, e.velocityX, e.velocityY) */
  onGestureEnd: (tx: number, ty: number, vx: number, vy: number) => void;
  /** Aktif kartın transform animated stili (translate + rotate) */
  activeCardStyle: AnimatedStyle<ViewStyle>;
  /** Arka kartın animated stili (scale + translateY) */
  backCardStyle: AnimatedStyle<ViewStyle>;
  /** Tüm değerleri anında sıfırla (swipe sonrası JS thread'de çağrılır) */
  resetValues: () => void;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param onSwipeComplete - Eşik aşılıp animasyon tamamlanınca yön bildir
 */
export function useHybridSwipe(
  onSwipeComplete: (direction: SwipeDirection) => void,
): HybridSwipeResult {
  // ── Shared values (UI thread) ──────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  const rawOverlay = useSharedValue(0);
  const swipeProgress = useSharedValue(0);
  const directionLock = useSharedValue(DIR_NONE);

  // ── Stable callback ref ────────────────────────────────────────────────────

  /**
   * Ref ile en güncel onSwipeComplete'e erişim.
   * useCallback([], ...) ile stable bir JS fonksiyonu oluşturulur;
   * worklet'te runOnJS bunu kullanır.
   */
  const onSwipeRef = useRef(onSwipeComplete);
  useEffect(() => {
    onSwipeRef.current = onSwipeComplete;
  }, [onSwipeComplete]);

  const callComplete = useCallback((dir: SwipeDirection) => {
    onSwipeRef.current(dir);
  }, []);

  // ── Gesture handler'lar (worklet) ─────────────────────────────────────────

  /**
   * Gesture başlangıcı — yön kilidini sıfırla.
   */
  const onGestureStart = () => {
    'worklet';
    directionLock.value = DIR_NONE;
  };

  /**
   * Gesture güncelleme — yön kilitle ve animasyonları uygula.
   */
  const onGestureUpdate = (tx: number, ty: number) => {
    'worklet';

    // ── Yön belirleme (10px sonra açı bazlı) ────────────────────────────────
    if (directionLock.value === DIR_NONE) {
      const absX = Math.abs(tx);
      const absY = Math.abs(ty);
      const total = Math.sqrt(absX * absX + absY * absY);

      if (total > DIRECTION_LOCK_THRESHOLD) {
        const angleDeg = (Math.atan2(absY, absX) * 180) / Math.PI;
        if (angleDeg < 30) {
          directionLock.value = DIR_HORIZONTAL;
        } else if (angleDeg > 60) {
          directionLock.value = DIR_VERTICAL;
        } else {
          directionLock.value = absX > absY ? DIR_HORIZONTAL : DIR_VERTICAL;
        }
      }
      return; // kilitlenene kadar pozisyonu değiştirme
    }

    // ── Yatay (Tinder) ──────────────────────────────────────────────────────
    if (directionLock.value === DIR_HORIZONTAL) {
      translateX.value = tx;
      translateY.value = 0;
      cardRotation.value = (tx / SCREEN_WIDTH) * MAX_TILT;
      rawOverlay.value = interpolate(
        tx,
        [-SWIPE_X_THRESHOLD, 0, SWIPE_X_THRESHOLD],
        [-1, 0, 1],
        Extrapolation.CLAMP,
      );
      swipeProgress.value = interpolate(
        Math.abs(tx),
        [0, SWIPE_X_THRESHOLD],
        [0, 0.8],
        Extrapolation.CLAMP,
      );
    }

    // ── Dikey (TikTok) ──────────────────────────────────────────────────────
    if (directionLock.value === DIR_VERTICAL) {
      translateY.value = ty;
      translateX.value = 0;
      cardRotation.value = 0;
      rawOverlay.value = 0;
      swipeProgress.value = interpolate(
        Math.abs(ty),
        [0, SWIPE_Y_THRESHOLD],
        [0, 0.8],
        Extrapolation.CLAMP,
      );
    }
  };

  /**
   * Gesture bitti — eşik kontrolü; geçildiyse fırlat, geçilmediyse geri dön.
   * Hızlı flick: düşük mesafede bile tetiklenir (velocity fallback).
   */
  const onGestureEnd = (tx: number, ty: number, vx: number, vy: number) => {
    'worklet';

    const lock = directionLock.value;
    const absX = Math.abs(tx);
    const absY = Math.abs(ty);
    const velX = Math.abs(vx);
    const velY = Math.abs(vy);

    // ── Yatay fırlatma ──────────────────────────────────────────────────────
    if (lock === DIR_HORIZONTAL) {
      const flick = velX > VELOCITY_X_THRESHOLD && absX > SWIPE_X_THRESHOLD / 2;
      const passed = absX > SWIPE_X_THRESHOLD || flick;

      if (passed) {
        const isRight = tx > 0;
        const fling = isRight ? FLING_X : -FLING_X;
        const finalRot = isRight ? MAX_TILT + 5 : -(MAX_TILT + 5);

        cardRotation.value = withSpring(finalRot, SPRING_EXIT_H);
        rawOverlay.value = withTiming(isRight ? 1 : -1, { duration: 200 });
        swipeProgress.value = withTiming(1, { duration: FLING_DURATION });
        translateX.value = withTiming(fling, { duration: FLING_DURATION }, (finished) => {
          'worklet';
          if (finished) {
            runOnJS(callComplete)(isRight ? 'right' : 'left');
          }
        });
        return;
      }
    }

    // ── Dikey geçiş (snap-to-page) ──────────────────────────────────────────
    if (lock === DIR_VERTICAL) {
      const flick = velY > VELOCITY_Y_THRESHOLD && absY > SWIPE_Y_THRESHOLD / 2;
      const passed = absY > SWIPE_Y_THRESHOLD || flick;

      if (passed) {
        const isDown = ty > 0;
        const fling = isDown ? FLING_Y : -FLING_Y;

        swipeProgress.value = withTiming(1, { duration: FLING_DURATION });
        translateY.value = withSpring(fling, SPRING_VERTICAL, (finished) => {
          'worklet';
          if (finished) {
            runOnJS(callComplete)(isDown ? 'down' : 'up');
          }
        });
        return;
      }
    }

    // ── Eşik geçilmedi — yaylanarak geri dön ────────────────────────────────
    translateX.value = withSpring(0, SPRING_BACK);
    translateY.value = withSpring(0, SPRING_BACK);
    cardRotation.value = withSpring(0, SPRING_BACK);
    rawOverlay.value = withSpring(0, SPRING_BACK);
    swipeProgress.value = withSpring(0, SPRING_BACK);
    directionLock.value = DIR_NONE;
  };

  // ── Animated styles ────────────────────────────────────────────────────────

  /** Üstteki kartın transform'u */
  const activeCardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${cardRotation.value}deg` },
    ],
  }));

  /**
   * 2. kartın scale + translateY.
   * Swipe ilerledikçe 0.92→1.0 scale, 14→0 translateY.
   */
  const backCardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          swipeProgress.value,
          [0, 1],
          [0.92, 1.0],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          swipeProgress.value,
          [0, 1],
          [14, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // ── Reset ──────────────────────────────────────────────────────────────────

  /** Tüm animasyon değerlerini anında sıfırla (JS thread, swipe sonrası) */
  const resetValues = useCallback(() => {
    translateX.value = 0;
    translateY.value = 0;
    cardRotation.value = 0;
    rawOverlay.value = 0;
    swipeProgress.value = 0;
    directionLock.value = DIR_NONE;
  }, [translateX, translateY, cardRotation, rawOverlay, swipeProgress, directionLock]);

  return {
    translateX,
    translateY,
    cardRotation,
    rawOverlay,
    swipeProgress,
    onGestureStart,
    onGestureUpdate,
    onGestureEnd,
    activeCardStyle,
    backCardStyle,
    resetValues,
  };
}
