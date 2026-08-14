/**
 * ConfidenceMeter — "Seni %35 tanıyorum ▓▓▓░░░░░░". PRODUCT_OS §5.4,
 * DESIGN_OS §10.4 (9 segment, dolu olanlar marquee).
 *
 * YALNIZCA gösterim — `userConfidence` DailyGauntlet'tan gelir, istemci
 * hesaplamaz. DNA ekranı C.2 kapsamı dışı.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';

import { styles } from './styles';

const SEGMENT_COUNT = 9;

interface ConfidenceMeterProps {
  /** 0-1 — DailyGauntlet.userConfidence */
  userConfidence: number;
}

export function ConfidenceMeter({ userConfidence }: ConfidenceMeterProps): React.JSX.Element {
  const { t } = useLanguage();
  const percent = Math.round(userConfidence * 100);
  const filled = Math.round(userConfidence * SEGMENT_COUNT);
  const label = t('gauntlet.confidence', { percent });

  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={label}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.segments} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: SEGMENT_COUNT }, (_, index) => (
          <View
            key={index}
            style={[styles.segment, index < filled && styles.segmentFilled]}
          />
        ))}
      </View>
    </View>
  );
}
