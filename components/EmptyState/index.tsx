/**
 * EmptyState — Boş durum ekranı.
 *
 * İllüstrasyon:
 *   - `illustration` prop verilirse Lumi yerine o render edilir (örn. FilmReelAnimation)
 *   - Verilmezse varsayılan: Lumi maskot (mood prop'uyla)
 *
 * Giriş animasyonları:
 *   - İllüstrasyon/Lumi: scale 0→1 spring (delay 0)
 *   - Title: opacity + translateY 10→0 (delay 300ms)
 *   - Subtitle: opacity + translateY 10→0 (delay 450ms)
 *   - Button: opacity + translateY 10→0 (delay 600ms)
 *
 * Reduced motion: animasyonlar atlanır, Lumi yerine statik orb gösterilir.
 */
import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { hapticLight } from '@/utils/haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

import Lumi, { LumiProps } from '@/components/Lumi';
import { Colors } from '@/constants/Colors';
import { styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const SIZE_MAP = { small: 32, medium: 64, large: 140 } as const;

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface EmptyStateProps {
  /**
   * Özel illüstrasyon node'u — verilirse Lumi'nin yerine render edilir.
   * Örn: `<FilmReelAnimation />` (watchlist empty state)
   */
  illustration?: React.ReactNode;
  /** Lumi'nin duygu durumu — illustration yoksa zorunlu */
  lumiMood?: LumiProps['mood'];
  /** Lumi boyutu (varsayılan: 'medium') */
  lumiSize?: LumiProps['size'];
  /** Ana başlık */
  title: string;
  /** Alt açıklama (opsiyonel) */
  subtitle?: string;
  /** Aksiyon buton etiketi (opsiyonel) */
  actionLabel?: string;
  /** Buton tıklama callback'i */
  onAction?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Boş durum bileşeni — İllüstrasyon (veya Lumi) + başlık + opsiyonel aksiyon butonu.
 */
export default function EmptyState({
  illustration,
  lumiMood,
  lumiSize = 'medium',
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setIsReducedMotion);
  }, []);

  // ── Shared Values ─────────────────────────────────────────────────────────
  const lumiScale = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(10);
  const subtitleOpacity = useSharedValue(0);
  const subtitleY = useSharedValue(10);
  const buttonOpacity = useSharedValue(0);
  const buttonY = useSharedValue(10);

  // ── Animasyonları başlat ──────────────────────────────────────────────────
  useEffect(() => {
    if (isReducedMotion) {
      lumiScale.value = 1;
      titleOpacity.value = 1;
      titleY.value = 0;
      subtitleOpacity.value = 1;
      subtitleY.value = 0;
      buttonOpacity.value = 1;
      buttonY.value = 0;
      return;
    }

    lumiScale.value = withSpring(1, { damping: 12, stiffness: 150 });
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
    titleY.value = withDelay(300, withTiming(0, { duration: 400 }));
    subtitleOpacity.value = withDelay(450, withTiming(1, { duration: 400 }));
    subtitleY.value = withDelay(450, withTiming(0, { duration: 400 }));
    buttonOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    buttonY.value = withDelay(600, withTiming(0, { duration: 400 }));
  }, [isReducedMotion]);

  // ── Animated Styles ───────────────────────────────────────────────────────
  const lumiStyle = useAnimatedStyle(() => {
    'worklet';
    return { transform: [{ scale: lumiScale.value }] };
  });

  const titleStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: titleOpacity.value,
      transform: [{ translateY: titleY.value }],
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: subtitleOpacity.value,
      transform: [{ translateY: subtitleY.value }],
    };
  });

  const buttonStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: buttonOpacity.value,
      transform: [{ translateY: buttonY.value }],
    };
  });

  const sz = SIZE_MAP[lumiSize];

  const handleAction = () => {
    hapticLight();
    onAction?.();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <Animated.View style={lumiStyle}>
        {illustration != null ? (
          illustration
        ) : isReducedMotion ? (
          <View
            style={[styles.staticOrb, { width: sz, height: sz, borderRadius: sz / 2 }]}
          />
        ) : (
          <Lumi size={lumiSize} mood={lumiMood ?? 'calm'} showGlow />
        )}
      </Animated.View>

      <Animated.Text style={[styles.title, titleStyle]}>
        {title}
      </Animated.Text>

      {subtitle != null && (
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          {subtitle}
        </Animated.Text>
      )}

      {actionLabel != null && onAction != null && (
        <Animated.View style={buttonStyle}>
          <TouchableOpacity onPress={handleAction} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.accentPrimary, Colors.accentHover]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.button}
            >
              <Text style={styles.buttonText}>{actionLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}
