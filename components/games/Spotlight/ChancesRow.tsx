/**
 * ChancesRow — kalan hak göstergesi (görselin altında).
 *
 * Semantik: görsel netliği = İLERLEME, bu satır = RİSK. Havuz ortaktır:
 * yanlış harf de yanlış film tahmini de aynı noktadan harcar.
 * Dolu (altın) = kalan, içi boş (graphite) = harcanmış. Durumu renk değil
 * ŞEKİL taşır (dolu/boş). Noktalar sabit boyutlu — durum değişince düzen kaymaz.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';

import { chanceStates } from './chances';
import { chancesStyles as styles } from './chancesStyles';

interface ChancesRowProps {
  /** `puzzle.max_attempts` */
  max: number;
  /** `max − kullanılan`, 0'a kenetli */
  left: number;
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
      <View style={styles.dots} importantForAccessibility="no-hide-descendants">
        {states.map((filled, i) => (
          <View key={i} style={[styles.dot, filled ? styles.dotFilled : styles.dotSpent]} />
        ))}
      </View>
    </View>
  );
}
