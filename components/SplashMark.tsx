/**
 * Native splash ile aynı görünüm: ink zemin + ortada splash-mark.
 *
 * Gate ve (tabs) GateGuard'ı aynı kareyi çizsin diye tek kaynak (HOME-6): açılışta
 * yığın [gate, (tabs)] ve üstte (tabs) olduğundan native splash kalkınca ilk görünen
 * ekran GateGuard'dır; logosuz olursa C bir an kaybolup gate'e dönüşte geri solar.
 *
 * Boyut ve konum kesin pikseldir (HOME-5): yüzde/aspectRatio/flex cihazda
 * uygulanmadı. Native splash (app.json `splash`, resizeMode contain, tam ekran)
 * ile aynı: kare PNG ekran genişliğinde, ekranın ortasında (safe-area kayması yok).
 */
import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import type { ImageStyle, StyleProp } from 'react-native';

import { color } from '@/constants/design/semantic';

const SPLASH_MARK = require('../assets/images/splash-mark.png');

interface SplashMarkProps {
  /** Logoya uygulanan animasyon stili (yalnız gate sönmesi kullanır). */
  markStyle?: StyleProp<AnimatedStyle<StyleProp<ImageStyle>>>;
  /** Zemin içinde render edilir (ör. StatusBar). */
  children?: React.ReactNode;
}

export function SplashMark({ markStyle, children }: SplashMarkProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const markSize = screenWidth;

  return (
    <View style={styles.container}>
      {children}
      <Animated.Image
        source={SPLASH_MARK}
        style={[
          styles.mark,
          {
            width: markSize,
            height: markSize,
            left: (screenWidth - markSize) / 2,
            top: (screenHeight - markSize) / 2,
          },
          markStyle,
        ]}
        resizeMode="contain"
        onLayout={
          __DEV__
            ? (e) => {
                const { width, height } = e.nativeEvent.layout;
                console.log(
                  `[splash-mark] onLayout ${width}x${height} (beklenen ${markSize}x${markSize}, ekran ${screenWidth}x${screenHeight})`,
                );
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.surface.base,
  },
  mark: {
    position: 'absolute',
  },
});
