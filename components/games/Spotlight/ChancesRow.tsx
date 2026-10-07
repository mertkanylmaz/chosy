/**
 * ChancesRow — kalan hak göstergesi (görselin altında).
 *
 * Semantik: görsel netliği = İLERLEME, bu satır = RİSK. Havuz ortaktır:
 * yanlış harf de yanlış film tahmini de aynı noktadan harcar.
 * Dolu (altın) = kalan, içi boş (graphite) = harcanmış. Durumu renk değil
 * ŞEKİL taşır (dolu/boş). Noktalar sabit boyutlu — durum değişince düzen kaymaz.
 */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
  SPOTLIGHT_FOCUS_STEP,
} from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';

import { chanceStates } from './chances';
import { chancesStyles as styles } from './chancesStyles';

interface ChancesRowProps {
  /** `puzzle.max_attempts` */
  max: number;
  /** `max − kullanılan`, 0'a kenetli */
  left: number;
}

/**
 * Tek hak noktası. Boş (harcanmış) halka HEP çizili; dolgu katmanının opaklığı
 * 1→0 iner (kısa, ease-out; pulse/parçacık/sarsıntı yok). İlk çizimde animasyon
 * yok. Reduce Motion: 100ms. Noktalar yalnız azalır.
 */
function ChanceDot({ filled }: { filled: boolean }): React.JSX.Element {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(filled ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, {
      duration: reduceMotion ? REDUCED_MOTION_DURATION.crossFade : SPOTLIGHT_FOCUS_STEP.duration,
      easing: EASE_OUT_QUART,
    });
    // fill kararlı referans
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filled, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  return (
    <View style={[styles.dot, styles.dotSpent]}>
      <Animated.View style={[styles.dotFilled, fillStyle]} />
    </View>
  );
}

export function ChancesRow({ max, left }: ChancesRowProps): React.JSX.Element {
  const { t } = useLanguage();
  const states = chanceStates(max, left);

  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('games.spotlight.chances_a11y', {
        left: Math.min(max, Math.max(0, left)),
        total: max,
      })}
    >
      <Text style={styles.label}>{t('games.spotlight.chances_label')}</Text>
      <View
        style={styles.dots}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {states.map((filled, i) => (
          <ChanceDot key={i} filled={filled} />
        ))}
      </View>
    </View>
  );
}
