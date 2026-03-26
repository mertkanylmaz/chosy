import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';

import styles from './styles';

/** Tek bir chip seçeneği */
export interface ChipOption {
  /** Boş string ('') = "Farketmez / Any" sentinel */
  id: string;
  label: string;
}

interface FilterChipsProps {
  /** Bölüm başlığı (ör. "YIL ARALIĞI") */
  label: string;
  options: ChipOption[];
  /**
   * Seçili chip id'leri.
   * Boş dizi = "Farketmez" durumu.
   */
  selected: string[];
  /** true → çoklu seçim; false → tek seçim */
  multiple: boolean;
  onSelect: (ids: string[]) => void;
}

/**
 * Yatay kaydırılabilir chip grubu.
 * Tek seçim modunda max 1 chip aktif olur; çoklu modda birden fazla olabilir.
 * Boş id ('') olan chip "Farketmez" anlamına gelir ve seçimi temizler.
 */
const FilterChips = React.memo(function FilterChips({
  label,
  options,
  selected,
  multiple,
  onSelect,
}: FilterChipsProps) {
  const isAnySelected = selected.length === 0;

  const handlePress = useCallback(
    (id: string) => {
      if (id === '') {
        onSelect([]);
        return;
      }

      if (!multiple) {
        // Tek seçim: aynı chip'e tekrar basılırsa farketmez'e döner
        onSelect(selected.includes(id) ? [] : [id]);
        return;
      }

      // Çoklu seçim
      if (selected.includes(id)) {
        onSelect(selected.filter((s) => s !== id));
      } else {
        onSelect([...selected, id]);
      }
    },
    [selected, multiple, onSelect],
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {options.map((opt) => {
          const isSelected = opt.id === '' ? isAnySelected : selected.includes(opt.id);
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handlePress(opt.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
});

export default FilterChips;
