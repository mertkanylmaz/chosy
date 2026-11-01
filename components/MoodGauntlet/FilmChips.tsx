/**
 * Film çipleri (Faz 2-3): tempo · yoğunluk · süre. Veri `film_profiles` boyutlarından ve
 * `films.runtime`'dan gelir (utils/moodFilmFacts). Eksik alan çizilmez; hiç çip yoksa null.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';
import { buildChips, type FilmDims } from '@/utils/moodFilmFacts';

import { styles } from './styles';

interface FilmChipsProps {
  dims: FilmDims | undefined;
  runtimeMinutes: number | null | undefined;
  /** Sonuç ekranında ortalanır. */
  centered?: boolean;
}

export function FilmChips({ dims, runtimeMinutes, centered = false }: FilmChipsProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const chips = buildChips(dims, runtimeMinutes);
  const labels: string[] = [];
  if (chips.pace !== null) labels.push(t(`moodGauntlet.chipPace.${chips.pace}`));
  if (chips.energy !== null) labels.push(t(`moodGauntlet.chipEnergy.${chips.energy}`));
  if (chips.runtime !== null) labels.push(chips.runtime);
  if (labels.length === 0) return null;
  return (
    <View style={[styles.filmChips, centered && styles.filmChipsCentered]} accessibilityLabel={labels.join(', ')}>
      {labels.map((l) => (
        <View key={l} style={styles.filmChip}>
          <Text style={styles.filmChipText} numberOfLines={1}>
            {l}
          </Text>
        </View>
      ))}
    </View>
  );
}
