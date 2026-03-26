import { useEffect } from 'react';
import {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

/**
 * Ekrana giren elemanları kademeli belirtme hook'u.
 * Her eleman biraz gecikmeyle aşağıdan kayarak belirir.
 * index > 10 ise animasyon uygulanmaz (anında görünür).
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

  const opacity = useSharedValue(index > 10 ? 1 : 0);
  const translate = useSharedValue(index > 10 ? 0 : translateY);

  useEffect(() => {
    if (index > 10) return;
    const totalDelay = baseDelay + index * delay;
    opacity.value = withDelay(
      totalDelay,
      withTiming(1, { duration, easing: Easing.out(Easing.cubic) }),
    );
    translate.value = withDelay(totalDelay, withSpring(0, { damping: 14, stiffness: 100 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translate.value }],
  }));

  return animatedStyle;
}
