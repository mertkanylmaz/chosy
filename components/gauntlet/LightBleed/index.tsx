/**
 * LightBleed — ışık sızması zemini. DESIGN_OS §5, §13.
 *
 * "Perdeden yayılan ışık, salonun duvarlarını boyar." (§5.1)
 *
 * Bu dosya YALNIZCA çizer. Sızmanın olup olmayacağı, rengi ve süresi
 * `useLightBleed` kararıdır. İki katman: altta opak `ink`, üstünde tek renk
 * sızma katmanı — sızmanın yalnız OPAKLIĞI animate edilir, rengi değil.
 * Rengi animate etmek iki renk arasında ara tonlar üretirdi; §5.3 tek renk
 * ister. Yeni renge geçişte opaklık önce 0'a çekilir, böylece geçiş ink
 * üzerinden olur ve ara ton oluşmaz.
 *
 * `dominantColor` yoksa sızma katmanı hiç RENDER EDİLMEZ — §5.2
 * `fallback: 'ink'`. Bu sessiz bir boşluk değil, açıkça yazılmış daldır.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';

import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BLEED_ALPHA } from '@/constants/design/semantic';
import type { OklchColor } from '@/types/gauntlet';

import { styles } from './styles';
import { useLightBleed } from './useLightBleed';

interface LightBleedProps {
  /** Sızmayı sürükleyen filmin hâkim rengi. Yoksa zemin saf `ink` kalır. */
  dominantColor?: OklchColor;
}

export function LightBleed({ dominantColor }: LightBleedProps): React.JSX.Element {
  const { bleedColor, durationMs } = useLightBleed(dominantColor);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (bleedColor === null) {
      opacity.value = 0;
      return;
    }
    // Yeni renk her zaman görünmezden başlar (ara ton yok), sonra §7.2'nin
    // 600ms LİNEER eğrisiyle tavana çıkar.
    opacity.value = 0;
    opacity.value = withTiming(BLEED_ALPHA, {
      duration: durationMs,
      easing: Easing.linear,
    });
  }, [bleedColor, durationMs, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.base}>
      {bleedColor !== null && (
        <Animated.View
          style={[styles.bleed, { backgroundColor: bleedColor }, animatedStyle]}
          pointerEvents="none"
        />
      )}
    </View>
  );
}
