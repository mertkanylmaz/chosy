/**
 * PROTOTİP — dört çerçeve. Her çerçeve SON yerinde (2×2) mutlak konumlu; şeritteki hâli
 * transform ofsetidir (`p`: 0 = şeritte, 1 = ızgarada). Çıkışta yalnız transform değişir.
 *
 * Poster katmanı = mevcut PosterTile (retry → kalıcı placeholder davranışı AYNEN). Üstünde
 * aynı URL'nin bulanık kopyası: görsel yüklenince söner (bulanık → net). Bulanık kat yüklenemezse
 * hemen kalkar; posterin kendi hata yolu (PosterTile) geçerli kalır — sessiz boşluk yok.
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  FadeOut,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { PosterTile } from '@/components/gauntlet/PosterTile';
import { CINEMATIC_PROTO_MOTION as M, EASE_OUT_QUART, MOOD_MOTION, REDUCED_MOTION_DURATION } from '@/constants/design/motion';
import type { GauntletFilm } from '@/types/gauntlet';

import type { FrameSlot, StripPose } from './geometry';
import { styles } from './styles';

/**
 * Süreyi bu bileşen yönetir (Reduce Motion dahil): Reanimated'in varsayılanı `ReduceMotion.System`
 * sistem ayarı açıkken animasyonu süresiz atlar; 100 ms çapraz geçiş ancak `Never` ile oynar.
 */
const RM = ReduceMotion.Never;

export type ScenePhase = 'waiting' | 'reveal';

interface PosterSettleProps {
  uri: string;
  height: number;
  blur: boolean;
  reduced: boolean;
  onLoad: () => void;
  onError: () => void;
}

function PosterSettle({ uri, height, blur, reduced, onLoad, onError }: PosterSettleProps): React.JSX.Element {
  const o = useSharedValue(blur ? 1 : 0);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <Animated.View style={[styles.blurLayer, { height }, style]} pointerEvents="none">
      <Image
        source={{ uri }}
        style={styles.blurImage}
        contentFit="cover"
        blurRadius={M.blurRadius}
        onLoad={() => {
          onLoad();
          o.value = withTiming(0, {
            duration: reduced ? REDUCED_MOTION_DURATION.crossFade : M.blurSettle,
            easing: EASE_OUT_QUART,
            reduceMotion: RM,
          });
        }}
        onError={() => {
          o.value = 0;
          onError();
        }}
      />
    </Animated.View>
  );
}

interface FrameProps {
  index: number;
  slot: FrameSlot;
  pose: StripPose;
  phase: ScenePhase;
  reduced: boolean;
  /** 'another': giriş kısalır (projektör gecikmesi yok). */
  fastIntro: boolean;
  film: GauntletFilm | null;
  blur: boolean;
  onImageLoad: (index: number) => void;
  onImageError: (index: number) => void;
}

export function Frame({
  index,
  slot,
  pose,
  phase,
  reduced,
  fastIntro,
  film,
  blur,
  onImageLoad,
  onImageError,
}: FrameProps): React.JSX.Element {
  const p = useSharedValue(reduced ? 1 : 0);
  const o = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      // Statik sahne: çerçeve ızgarada durur, yalnız opaklık çapraz geçer.
      p.value = 1;
      o.value = withTiming(1, { duration: REDUCED_MOTION_DURATION.crossFade, reduceMotion: RM });
      return;
    }
    if (phase === 'waiting') {
      p.value = withTiming(0, { duration: M.exitFrames, easing: EASE_OUT_QUART, reduceMotion: RM });
      const delay = fastIntro ? 0 : M.introFramesDelay + index * M.introFrameStagger;
      o.value = withDelay(
        delay,
        withTiming(1, { duration: fastIntro ? M.introAnother : M.introProjector, reduceMotion: RM }),
        RM,
      );
      return;
    }
    // Çıkış: o anki değerden (giriş yarıda kalmış olabilir) ızgaraya.
    p.value = withTiming(1, { duration: M.exitFrames, easing: EASE_OUT_QUART, reduceMotion: RM });
    o.value = withTiming(1, { duration: M.exitPosterDelay, reduceMotion: RM });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced]);

  const style = useAnimatedStyle(() => {
    const q = 1 - p.value;
    return {
      opacity: o.value,
      transform: [
        { translateX: pose.tx * q },
        { translateY: pose.ty * q },
        { rotate: `${pose.rotateDeg * q}deg` },
        { scale: pose.scale + (1 - pose.scale) * p.value },
      ],
    };
  });

  const entering = reduced
    ? FadeIn.duration(REDUCED_MOTION_DURATION.crossFade).reduceMotion(RM)
    : FadeIn.delay(M.exitPosterDelay + index * M.exitPosterStagger)
        .duration(MOOD_MOTION.stageTransition)
        .reduceMotion(RM);
  const exiting = FadeOut.duration(reduced ? REDUCED_MOTION_DURATION.crossFade : M.introAnother).reduceMotion(RM);

  return (
    <Animated.View
      style={[styles.frame, { left: slot.x, top: slot.y, width: slot.w, height: slot.tileH }, style]}
      pointerEvents="none"
    >
      <View style={[styles.frameOutline, { height: slot.posterH }]} />
      {film !== null && (
        <Animated.View key={film.id} entering={entering} exiting={exiting}>
          <PosterTile film={film} interactive={false} metaMode="yearOnly" />
          <PosterSettle
            uri={film.posterUrl}
            height={slot.posterH}
            blur={blur}
            reduced={reduced}
            onLoad={() => onImageLoad(index)}
            onError={() => onImageError(index)}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}
