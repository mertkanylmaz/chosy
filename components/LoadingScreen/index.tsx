/**
 * LoadingScreen — Premium animated splash/loading screen.
 *
 * Features:
 * - C-shaped film strip SVG rotates smoothly (3s per revolution)
 * - Subtle floating motion (2px vertical drift)
 * - Gentle glow pulse behind icon
 * - Static "chosy.ai" + subtitle text
 * - Fade-in on mount, fade-out before onComplete callback
 *
 * @example
 * <LoadingScreen
 *   visible={isLoading}
 *   onFadeOutComplete={() => navigateAway()}
 *   minDurationMs={3000}
 * />
 */
import React, { useEffect, useCallback } from 'react';
import { Text, View } from 'react-native';

import { StatusBar } from 'expo-status-bar';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

import { FilmStripIcon } from './FilmStripIcon';
import { styles } from './styles';

interface LoadingScreenProps {
  /** Controls visibility — triggers fade-out when set to false */
  visible: boolean;
  /** Called after the fade-out animation completes */
  onFadeOutComplete?: () => void;
  /** Minimum time the screen stays visible (default 3000ms) */
  minDurationMs?: number;
}

/** Fade durations */
const FADE_IN_MS = 600;
const FADE_OUT_MS = 500;

/** Film strip rotation period */
const ROTATION_MS = 3000;

/** Floating drift amplitude (px) */
const FLOAT_AMPLITUDE = 2;
const FLOAT_PERIOD_MS = 2400;

/** Glow pulse range */
const GLOW_MIN_OPACITY = 0.15;
const GLOW_MAX_OPACITY = 0.35;
const GLOW_PERIOD_MS = 2000;

export function LoadingScreen({
  visible,
  onFadeOutComplete,
}: LoadingScreenProps) {
  // ─── Shared values ──────────────────────────────────────────────────────────
  const screenOpacity = useSharedValue(0);
  const rotation = useSharedValue(0);
  const floatY = useSharedValue(0);
  const glowOpacity = useSharedValue(GLOW_MIN_OPACITY);

  const handleFadeOutDone = useCallback(() => {
    onFadeOutComplete?.();
  }, [onFadeOutComplete]);

  // ─── Mount: start all animations ─────────────────────────────────────────────
  useEffect(() => {
    // Fade in
    screenOpacity.value = withTiming(1, {
      duration: FADE_IN_MS,
      easing: Easing.out(Easing.cubic),
    });

    // Infinite smooth rotation
    rotation.value = withRepeat(
      withTiming(360, {
        duration: ROTATION_MS,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    // Subtle floating drift
    floatY.value = withRepeat(
      withSequence(
        withTiming(-FLOAT_AMPLITUDE, {
          duration: FLOAT_PERIOD_MS / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(FLOAT_AMPLITUDE, {
          duration: FLOAT_PERIOD_MS / 2,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );

    // Glow pulse
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(GLOW_MAX_OPACITY, {
          duration: GLOW_PERIOD_MS / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(GLOW_MIN_OPACITY, {
          duration: GLOW_PERIOD_MS / 2,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
      true,
    );
  }, []);

  // ─── Visibility change: fade out ─────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      screenOpacity.value = withTiming(
        0,
        {
          duration: FADE_OUT_MS,
          easing: Easing.in(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(handleFadeOutDone)();
          }
        },
      );
    }
  }, [visible]);

  // ─── Animated styles ─────────────────────────────────────────────────────────
  const containerStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const iconRotateStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <StatusBar style="light" />

      <View style={styles.content}>
        {/* Rotating film strip with glow */}
        <View style={styles.iconWrapper}>
          {/* Radial glow — pulsing */}
          <Animated.View style={[styles.glowCircle, glowStyle]} />

          {/* Film strip — rotating + floating */}
          <Animated.View style={iconRotateStyle}>
            <FilmStripIcon size={120} />
          </Animated.View>
        </View>

        {/* Static text — never animated */}
        <View style={styles.textSection}>
          <Text style={styles.brandName}>chosy.ai</Text>
          <Text style={styles.subtitle}>AI FILM RECOMMENDER</Text>
        </View>
      </View>
    </Animated.View>
  );
}
