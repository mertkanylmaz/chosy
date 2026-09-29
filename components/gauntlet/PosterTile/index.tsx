/**
 * PosterTile — gauntlet'ın tek poster kartı. DESIGN_OS §10.1, §13.
 *
 * Üç geçiş durumu `animationState` ile sürülür — hepsi motion.ts'teki
 * kilitli sürelere bağlı, burada hardcode edilmez:
 *  - 'eliminated': aşağı 12px + opaklık 1→0.25 (§7.2)
 *  - 'remaining':  ölçek 1→1.06, spring(0.8, 0.9) (§7.2)
 *  - 'entering':   opaklık 0→1 + aşağıdan 16px (§7.2)
 * Reduce Motion açıkken tümü REDUCED_MOTION_DURATION.crossFade'e döner (§7.5).
 *
 * İki dokunma onayı durumu — seçim sunucuya giderken, §7.1 Kesme (0ms,
 * Reduce Motion'da da aynı):
 *  - 'pending': seçilen poster, seçili kenar (§2.3 `beam`@24%)
 *  - 'dimmed':  diğer poster, opaklık PENDING_DIM_OPACITY
 * SALT GÖRSEL — tur/ilerleme bu durumlardan türetilmez (K-37).
 *
 * V-4 Tur B: başlık yüksekliği SATIR seviyesinde eşitlenir. Kart kendi
 * doğal satır sayısını (`onTitleLines`, en fazla 2) bildirir; üst bileşen
 * iki kartın büyüğünü `titleLines` olarak geri verir. Sabit 2 satırlık
 * `minHeight` kalktı — ikisi de tek satırsa tek satır yer ayrılır.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';

import { Image } from 'expo-image';
import { FilmSlate } from 'phosphor-react-native';
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
  PENDING_DIM_OPACITY,
  REDUCED_MOTION_DURATION,
  REMAINING_POSTER_SPRING_SPEC,
} from '@/constants/design/motion';
import type { GauntletFilm } from '@/types/gauntlet';

import { styles } from './styles';

/** Başlığın ayırdığı satır sayısı — `numberOfLines` ile aynı tavan. */
export type PosterTitleLines = 1 | 2;

export type PosterTileAnimationState =
  | 'idle'
  | 'pending'
  | 'dimmed'
  | 'eliminated'
  | 'remaining'
  | 'entering';

/** Poster yüklenemezse denenecek gecikmeler (ms) — sonrasında placeholder kalıcı olur. */
const POSTER_RETRY_DELAYS_MS = [500, 1500];

interface PosterTileProps {
  film: GauntletFilm;
  selected?: boolean;
  disabled?: boolean;
  animationState?: PosterTileAnimationState;
  onPress?: () => void;
  /**
   * V-4 Tur B: satırın başlık yüksekliği (iki kartın büyüğü). Yoksa başlık
   * doğal yüksekliğinde çizilir (ilk ölçüm karesi).
   */
  titleLines?: PosterTitleLines;
  /** Başlığın doğal satır sayısı — her metin düzeninde bildirilir. */
  onTitleLines?: (lines: PosterTitleLines) => void;
}

export function PosterTile({
  film,
  selected = false,
  disabled = false,
  animationState = 'idle',
  onPress,
  titleLines,
  onTitleLines,
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
    // Dokunma onayı — Kesme (§7.1): doğrudan atama, süren animasyonu da keser.
    // Reduce Motion dalından ÖNCE, çünkü Kesme orada da değişmez (§7.5).
    if (animationState === 'pending' || animationState === 'dimmed') {
      translateY.value = 0;
      scale.value = 1;
      opacity.value = animationState === 'dimmed' ? PENDING_DIM_OPACITY : 1;
      return;
    }

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

  const handleTitleLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      onTitleLines?.(e.nativeEvent.lines.length >= 2 ? 2 : 1);
    },
    [onTitleLines],
  );

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
        <View
          style={[
            styles.posterWrapper,
            (selected || animationState === 'pending') && styles.posterWrapperSelected,
          ]}
        >
          {posterFailed ? (
            <View style={styles.placeholder}>
              {/* V-3 Tur G1: Ionicons → Phosphor. Bağlam pill'i artık Phosphor
                  taşıyor; iki aile aynı ekranda yan yana görünmez (V-1 ortak kural). */}
              <FilmSlate size={28} color={color.text.secondary} />
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
          <Text
            style={[
              styles.title,
              titleLines === 1 && styles.titleOneLine,
              titleLines === 2 && styles.titleTwoLines,
            ]}
            numberOfLines={2}
            ellipsizeMode="tail"
            onTextLayout={handleTitleLayout}
          >
            {film.title}
          </Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {t('gauntlet.tileMeta', { year: film.year, runtime: film.runtime })}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
