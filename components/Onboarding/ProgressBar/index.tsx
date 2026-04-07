/**
 * ProgressBar — Taste Calibration için ilerleme çubuğu.
 *
 * Görseller:
 *   STEP 4 OF 6
 *   ═══════════════●═══════════
 *
 * Dolgu genişliği animasyonlu; aktif nokta dolgunun ucunda.
 */

import React from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import { styles } from './styles';

// ─── Tip ──────────────────────────────────────────────────────────────────────

interface ProgressBarProps {
  /** Mevcut soru indeksi (0-bazlı → +1 ile gösterilir) */
  currentQuestion: number;
  /** Toplam soru sayısı */
  totalQuestions: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Onboarding taste calibration için üst ilerleme çubuğu.
 * "STEP X OF Y" etiketi + animasyonlu dolgu çubuğu.
 */
export function ProgressBar({ currentQuestion, totalQuestions }: ProgressBarProps) {
  const { t } = useLanguage();

  /** Dolgu yüzdesi (0.0 – 1.0) */
  const progress = totalQuestions > 0 ? currentQuestion / totalQuestions : 0;

  const fillStyle = useAnimatedStyle(() => ({
    width: withTiming(`${progress * 100}%` as `${number}%`, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    }),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    left: withTiming(`${progress * 100}%` as `${number}%`, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    }),
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {t('onboarding.stepOf', { current: currentQuestion, total: totalQuestions })}
      </Text>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
        <Animated.View style={[styles.dot, dotStyle]} />
      </View>
    </View>
  );
}
