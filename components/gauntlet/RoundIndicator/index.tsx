/**
 * RoundIndicator — tur göstergesi, ● ● ○ ○ deseni. DESIGN_OS §10.1, §13.
 *
 * Tur değişimi Kesme'dir (§7.1) — 0ms, animasyon yok. Nokta durumları
 * anında değişir.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';

import { styles } from './styles';

interface RoundIndicatorProps {
  /** Tamamlanan + mevcut tur, 1 tabanlı (§10.1: "Tur 1/3") */
  current: 1 | 2 | 3;
  total?: 3;
  showLabel?: boolean;
}

export function RoundIndicator({
  current,
  total = 3,
  showLabel = true,
}: RoundIndicatorProps): React.JSX.Element {
  const { t } = useLanguage();
  const label = t('gauntlet.roundLabel', { current, total });

  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={label}>
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[styles.dot, index < current && styles.dotActive]}
          />
        ))}
      </View>
      {showLabel && <Text style={styles.label}>{label}</Text>}
    </View>
  );
}
