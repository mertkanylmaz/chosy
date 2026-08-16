/**
 * PosterTile — gauntlet'ın tek poster kartı. DESIGN_OS §10.1, §13.
 *
 * Üç geçiş durumu `animationState` ile sürülür — hepsi motion.ts'teki
 * kilitli sürelere bağlı, burada hardcode edilmez:
 *  - 'eliminated': aşağı 12px + opaklık 1→0.25 (§7.2)
 *  - 'remaining':  ölçek 1→1.06, spring(0.8, 0.9) (§7.2)
 *  - 'entering':   opaklık 0→1 + aşağıdan 16px (§7.2)
 * Reduce Motion açıkken tümü REDUCED_MOTION_DURATION.crossFade'e döner (§7.5).
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import SkeletonLoader from '@/components/SkeletonLoader';
import { useLanguage } from '@/contexts/LanguageContext';
import { color, radius } from '@/constants/design/semantic';
import {
  DISSOLVE_DURATION,
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
  REMAINING_POSTER_SPRING_SPEC,
} from '@/constants/design/motion';
import type { GauntletFilm } from '@/types/gauntlet';

import { styles } from './styles';

export type PosterTileAnimationState = 'idle' | 'eliminated' | 'remaining' | 'entering';

/** Poster yüklenemezse denenecek gecikmeler (ms) — sonrasında placeholder kalıcı olur. */
const POSTER_RETRY_DELAYS_MS = [500, 1500];

interface PosterTileProps {
  film: GauntletFilm;
  selected?: boolean;
  disabled?: boolean;
  animationState?: PosterTileAnimationState;
  onPress?: () => void;
}

export function PosterTile({
  film,
  selected = false,
  disabled = false,
  animationState = 'idle',
  onPress,
}: PosterTileProps): React.JSX.Element {
  const { t } = useLanguage();
  const isReducedMotion = useReducedMotion();

  const startsEntering = animationState === 'entering';
  const translateY = useSharedValue(startsEntering && !isReducedMotion ? 16 : 0);
  const opacity = useSharedValue(startsEntering ? 0 : 1);
  const scale = useSharedValue(1);
  const [posterFailed, setPosterFailed] = React.useState(false);
  const [posterLoaded, setPosterLoaded] = React.useState(false);
  const [retryAttempt, setRetryAttempt] = React.useState(0);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const handlePosterError = useCallback(() => {
    if (retryAttempt < POSTER_RETRY_DELAYS_MS.length) {
      retryTimeoutRef.current = setTimeout(() => {
        setRetryAttempt((n) => n + 1);
      }, POSTER_RETRY_DELAYS_MS[retryAttempt]);
    } else {
      setPosterFailed(true);
    }
  }, [retryAttempt]);

  useEffect(() => {
    if (isReducedMotion) {
      const duration = REDUCED_MOTION_DURATION.crossFade;
      if (animationState === 'eliminated') {
        opacity.value = withTiming(0.25, { duration });
      } else if (animationState === 'entering') {
        opacity.value = withTiming(1, { duration });
      } else {
        opacity.value = withTiming(1, { duration });
      }
      translateY.value = 0;
      scale.value = 1;
      return;
    }

    if (animationState === 'eliminated') {
      translateY.value = withTiming(12, {
        duration: DISSOLVE_DURATION.eliminatedPoster,
        easing: EASE_OUT_QUART,
      });
      opacity.value = withTiming(0.25, {
        duration: DISSOLVE_DURATION.eliminatedPoster,
        easing: EASE_OUT_QUART,
      });
    } else if (animationState === 'remaining') {
      scale.value = withSpring(1.06, {
        dampingRatio: REMAINING_POSTER_SPRING_SPEC.dampingRatio,
        mass: REMAINING_POSTER_SPRING_SPEC.mass,
        duration: DISSOLVE_DURATION.remainingPoster,
      });
    } else if (animationState === 'entering') {
      translateY.value = withTiming(0, {
        duration: DISSOLVE_DURATION.newContender,
        easing: EASE_OUT_QUART,
      });
      opacity.value = withTiming(1, {
        duration: DISSOLVE_DURATION.newContender,
        easing: EASE_OUT_QUART,
      });
    } else {
      translateY.value = 0;
      opacity.value = 1;
      scale.value = 1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationState, isReducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress?.();
  }, [disabled, onPress]);

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={handlePress}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={t('gauntlet.posterAccessibilityLabel', {
          title: film.title,
          year: film.year,
          runtime: film.runtime,
        })}
      >
        <View style={[styles.posterWrapper, selected && styles.posterWrapperSelected]}>
          {posterFailed ? (
            <View style={styles.placeholder}>
              <Ionicons name="film-outline" size={28} color={color.text.secondary} />
              <Text style={styles.placeholderText}>{t('gauntlet.posterUnavailable')}</Text>
            </View>
          ) : (
            <>
              <Image
                key={retryAttempt}
                source={{ uri: film.posterUrl }}
                style={styles.poster}
                contentFit="cover"
                onError={handlePosterError}
                onLoad={() => setPosterLoaded(true)}
              />
              {!posterLoaded && (
                <SkeletonLoader
                  style={styles.skeleton}
                  width="100%"
                  height={1}
                  borderRadius={radius.poster}
                />
              )}
            </>
          )}
        </View>

        <View style={styles.meta}>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {film.title}
          </Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {t('gauntlet.posterMeta', { year: film.year, runtime: film.runtime })}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
