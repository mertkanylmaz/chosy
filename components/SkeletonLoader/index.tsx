/**
 * SkeletonLoader — Yükleme sırasında içerik yerine gösterilen animasyonlu yer tutucu.
 * Opacity pulse animasyonu ile içeriğin yüklenmekte olduğunu belirtir.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, ViewStyle } from 'react-native';

import { styles } from './styles';

interface Props {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Titreşen gri kutu — yükleme iskelet bileşeni.
 *
 * @param width        - Genişlik (sayı veya yüzde string). Varsayılan: '100%'
 * @param height       - Yükseklik (piksel)
 * @param borderRadius - Köşe yuvarlama. Varsayılan: 8
 * @param style        - Ekstra stil geçersiz kılmaları
 */
export default function SkeletonLoader({
  width = '100%',
  height,
  borderRadius = 8,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 850,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 850,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.base, { width: width as number, height, borderRadius }, { opacity }, style]}
    />
  );
}
