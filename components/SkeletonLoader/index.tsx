/**
 * SkeletonLoader — Shimmer animasyonlu yükleme yer tutucusu.
 * Reanimated ile 60fps'te kayan parlak bant efekti uygular.
 *
 * Kullanim:
 *   <SkeletonLoader width="100%" height={200} borderRadius={16} />
 */
import React, { useEffect } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';

interface Props {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shimmer efektli skeleton bileşeni.
 * Kayan highlight bant + hafif opacity pulse ile premium loading hissi.
 *
 * @param width        - Genislik (sayi veya yuzde string). Varsayilan: '100%'
 * @param height       - Yukseklik (piksel)
 * @param borderRadius - Kose yuvarlama. Varsayilan: 8
 * @param style        - Ekstra stil gecersiz kilmalari
 */
export default function SkeletonLoader({
  width = '100%',
  height,
  borderRadius = 8,
  style,
}: Props) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(shimmer.value, [0, 0.5, 1], [0.4, 0.7, 0.4]);
    return { opacity };
  });

  return (
    <Animated.View
      style={[
        localStyles.base,
        { width: width as number, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

const localStyles = StyleSheet.create({
  base: {
    backgroundColor: Colors.bgElevated,
  },
});
