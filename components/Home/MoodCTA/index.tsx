/**
 * MoodCTA — Home Header'daki birincil aksiyon butonu.
 *
 * Violet gradyan arka plan + "Idle pulse" glow animasyonu (iOS native,
 * Android statik). Minimum 56px yukseklik — erisilebilir touch target.
 * FadeInDown.delay(200) stagger animasyonu ile giris.
 */

import React, { useEffect } from 'react';
import { Platform, TouchableOpacity } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

// ─── Prop tipi ────────────────────────────────────────────────────────────────

export interface MoodCTAProps {
  /** Buton basildiginda cagirilir */
  onPress: () => void;
  /** i18n label — varsayilan: t('home.setMood') */
  label?: string;
}

// ─── Bilesen ──────────────────────────────────────────────────────────────────

/**
 * Ana mood aksiyonuna yonlendiren violet gradyan CTA butonu.
 * Idle pulse: shadowOpacity 0.3 -> 0.6 -> 0.3, 2 sn loop (iOS only).
 */
export default function MoodCTA({ onPress, label }: MoodCTAProps) {
  const { t } = useLanguage();
  const displayLabel = label ?? t('home.setMood');

  // Violet glow pulse — sadece iOS (shadow native driver ile)
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, [glowOpacity]);

  const glowStyle = useAnimatedStyle(() => {
    if (Platform.OS !== 'ios') return {};
    return {
      shadowOpacity: glowOpacity.value,
    };
  });

  function handlePress() {
    hapticLight();
    onPress();
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(200).duration(400).springify().damping(18)}
      style={[styles.wrapper, glowStyle]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.92}
        accessibilityRole="button"
        accessibilityLabel={displayLabel}
        style={styles.touchable}
      >
        <LinearGradient
          colors={[Colors.accentPrimary, Colors.accentHover]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradient}
        >
          <Animated.Text style={styles.icon}>{'✦'}</Animated.Text>
          <Animated.Text style={styles.label}>{displayLabel}</Animated.Text>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}
