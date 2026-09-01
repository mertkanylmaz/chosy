import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Ekrana giren elemanları kademeli belirtme hook'u.
 * Her eleman biraz gecikmeyle aşağıdan kayarak belirir.
 * index > 10 ise animasyon uygulanmaz (anında görünür).
 * Reduce Motion açıksa da (K-54) stagger atlanır, eleman final state'te render olur.
 * `useReducedMotion()` reaktiftir — ayar uygulama açıkken değişirse yeniden hesaplanır.
 */
export function useStaggeredEntry(
  index: number,
  options?: {
    /** her eleman arası ms (varsayılan 80) */
    delay?: number;
    /** ilk eleman başlangıç gecikmesi (varsayılan 100) */
    baseDelay?: number;
    /** başlangıç Y offset (varsayılan 30) */
    translateY?: number;
    /** animasyon süresi (varsayılan 500) */
    duration?: number;
  },
) {
  const { delay = 80, baseDelay = 100, translateY = 30, duration = 500 } = options ?? {};
  const isReducedMotion = useReducedMotion();
  const skip = index > 10 || isReducedMotion;

  const opacity = useSharedValue(skip ? 1 : 0);
  const translate = useSharedValue(skip ? 0 : translateY);

  useEffect(() => {
    if (skip) {
      opacity.value = 1;
      translate.value = 0;
      return;
    }
    const totalDelay = baseDelay + index * delay;
    opacity.value = withDelay(
      totalDelay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
    translate.value = withDelay(totalDelay, withSpring(0, { damping: 14, stiffness: 100 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));

  return animatedStyle;
}
