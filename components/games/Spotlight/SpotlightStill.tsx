/**
 * SpotlightStill — oyunun kare kutusu (16:9, P-2).
 *
 * Oynanış ve sonuç AYNI kutuyu çizer. İki kat:
 *   - alt: bulanık kare (`blurRadius`, açılan harfe göre)
 *   - üst: net kare, yalnız sonuçta — opaklıkla belirir
 *
 * `expo-image` `blurRadius`'u animasyonlu değil; netleşme bu yüzden iki
 * katın çapraz geçişi. Kare oynanışta da istemcide (`puzzle_data`), sonuçta
 * göstermek çözüm sızıntısı değil (Spotlight kuralı 1). Paylaşım görseline
 * girmez — o ayrı `GameShareCard` (kural 5).
 */
import React, { useCallback, type ReactNode } from 'react';
import { Image, type ImageErrorEventData } from 'expo-image';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { EASE_OUT_QUART, SPOTLIGHT_STILL_REVEAL } from '@/constants/design/motion';
import { logger } from '@/utils/logger';

import type { createStyles } from './styles';

/**
 * `none` — oynanış, yalnız bulanık kat.
 * `animate` — oyun bu oturumda bitti: net kat çapraz geçişle belirir.
 * `static` — bitmiş oyun yeniden açıldı: animasyonsuz net.
 */
export type StillReveal = 'none' | 'animate' | 'static';

interface SpotlightStillProps {
  uri: string;
  /** Alt katın bulanıklığı — sonuçta bitiş anındaki değer (geçiş oradan başlar) */
  blurRadius: number;
  reveal: StillReveal;
  styles: ReturnType<typeof createStyles>;
  /** Kutunun üstünde yüzen chrome (kalan hak rozeti) */
  children?: ReactNode;
}

export function SpotlightStill({ uri, blurRadius, reveal, styles, children }: SpotlightStillProps) {
  const isReducedMotion = useReducedMotion();
  const animate = reveal === 'animate' && !isReducedMotion;
  const sharpOpacity = useSharedValue(animate ? 0 : 1);
  const sharpStyle = useAnimatedStyle(() => ({ opacity: sharpOpacity.value }));

  /** Geçiş net kat yüklenince başlar — yüklenmemiş katı belirtmek boş kare gösterirdi */
  const handleSharpLoad = useCallback(() => {
    if (!animate) return;
    sharpOpacity.value = withTiming(1, {
      duration: SPOTLIGHT_STILL_REVEAL.duration,
      easing: EASE_OUT_QUART,
    });
    // sharpOpacity kararlı referans
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate]);

  const handleSharpError = useCallback(
    (event: ImageErrorEventData) => {
      logger.error('[spotlight] Sonuc karesi yuklenemedi — bulanik kat kaldi', event.error, {
        code: 'SPOTLIGHT_STILL_LOAD',
        extra: { backdrop_url: uri },
      });
    },
    [uri],
  );

  return (
    <Animated.View
      entering={reveal === 'none' ? FadeIn.duration(400) : undefined}
      style={styles.stillWrap}
    >
      {reveal !== 'static' && (
        <Image
          source={{ uri }}
          style={styles.still}
          contentFit="cover"
          blurRadius={blurRadius}
          transition={reveal === 'none' ? 300 : 0}
        />
      )}
      {reveal !== 'none' && (
        <Animated.View style={[styles.stillLayer, sharpStyle]}>
          <Image
            source={{ uri }}
            style={styles.still}
            contentFit="cover"
            transition={0}
            onLoad={handleSharpLoad}
            onError={handleSharpError}
            accessible={false}
          />
        </Animated.View>
      )}
      {children}
    </Animated.View>
  );
}
