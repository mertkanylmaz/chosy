/**
 * FilterBottomSheet — Era + IMDb Rating filters in a bottom sheet.
 *
 * Moved from inline chip rows on Home screen into a compact trigger + modal sheet.
 * Filter state is owned by the parent — this component only renders UI.
 */
import React, { useCallback, useState } from 'react';
import { Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticSelection } from '@/utils/haptics';

import { styles } from './styles';

// ─── Chip types (mirrored from Home) ────────────────────────────────────────

type YearChipId = 'pre1990' | '1990s' | '2000s' | '2010s' | '2020s' | '';
type RatingChipId = '7' | '8' | 'top250' | '';

const YEAR_CHIPS: { id: YearChipId; labelKey: string }[] = [
  { id: '', labelKey: 'mood.chipAny' },
  { id: '2020s', labelKey: 'mood.chipRecent' },
  { id: '2010s', labelKey: 'mood.chip2010s' },
  { id: '2000s', labelKey: 'mood.chip2000s' },
  { id: '1990s', labelKey: 'mood.chip90s' },
  { id: 'pre1990', labelKey: 'mood.chipClassic' },
];

const RATING_CHIPS: { id: RatingChipId; labelKey: string }[] = [
  { id: '', labelKey: 'mood.chipAny' },
  { id: '7', labelKey: 'mood.chip7plus' },
  { id: '8', labelKey: 'mood.chip8plus' },
  { id: 'top250', labelKey: 'mood.chipTop250' },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface FilterBottomSheetProps {
  yearChip: YearChipId;
  ratingChip: RatingChipId;
  onYearChange: (id: YearChipId) => void;
  onRatingChange: (id: RatingChipId) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/** Trigger row + bottom-sheet modal for Era & IMDb Rating filters. */
export default function FilterBottomSheet({
  yearChip,
  ratingChip,
  onYearChange,
  onRatingChange,
}: FilterBottomSheetProps) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  // Local draft state so user can "apply" or "clear"
  const [draftYear, setDraftYear] = useState<YearChipId>(yearChip);
  const [draftRating, setDraftRating] = useState<RatingChipId>(ratingChip);

  const activeCount = (yearChip !== '' ? 1 : 0) + (ratingChip !== '' ? 1 : 0);

  const open = useCallback(() => {
    setDraftYear(yearChip);
    setDraftRating(ratingChip);
    setVisible(true);
  }, [yearChip, ratingChip]);

  const handleApply = useCallback(() => {
    hapticSelection();
    onYearChange(draftYear);
    onRatingChange(draftRating);
    setVisible(false);
  }, [draftYear, draftRating, onYearChange, onRatingChange]);

  const handleClear = useCallback(() => {
    hapticSelection();
    setDraftYear('');
    setDraftRating('');
  }, []);

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.triggerRow} onPress={open} activeOpacity={0.7}>
        <Ionicons name="options-outline" size={16} color={Colors.textSecondary} />
        <Text style={styles.triggerText}>{t('mood.filterTrigger')}</Text>
        {activeCount > 0 && (
          <View style={styles.triggerBadge}>
            <Text style={styles.triggerBadgeText}>
              {t('mood.filterActiveCount', { count: activeCount })}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* ── Bottom Sheet Modal ──────────────────────────────────── */}
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.sheet} onPress={() => { /* prevent close */ }}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{t('mood.filterSheetTitle')}</Text>

            {/* ERA */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{t('mood.eraLabel')}</Text>
              <View style={styles.chipRow}>
                {YEAR_CHIPS.map((chip) => {
                  const active = draftYear === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id || 'year-any'}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => { hapticSelection(); setDraftYear(chip.id); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t(chip.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* IMDb RATING */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>{t('mood.qualityLabel')}</Text>
              <View style={styles.chipRow}>
                {RATING_CHIPS.map((chip) => {
                  const active = draftRating === chip.id;
                  return (
                    <TouchableOpacity
                      key={chip.id || 'rating-any'}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => { hapticSelection(); setDraftRating(chip.id); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {t(chip.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.7}>
                <Text style={styles.clearBtnText}>{t('mood.filterClear')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={handleApply} activeOpacity={0.8}>
                <Text style={styles.applyBtnText}>{t('mood.filterApply')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
