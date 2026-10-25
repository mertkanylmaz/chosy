/**
 * TodaySearchCard — bugünkü aramanın destesini yeniden açan kart (MONEY-1C P0).
 * Yeni arama başlatmaz; cihazdaki anlık görüntüden desteyi kurar. Mood metni yalnız
 * cihazda gösterilir (analitiğe gitmez).
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { color, radius, space, type } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  moodText: string;
  count: number;
  onPress: () => void;
}

export default function TodaySearchCard({ moodText, count, onPress }: Props) {
  const { t } = useLanguage();
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${t('moodOffer.todayCardTitle')}. ${moodText}`}
    >
      <Ionicons name="film-outline" size={20} color={color.text.primary} />
      <Text style={styles.textBlock} numberOfLines={2}>
        <Text style={styles.title}>{t('moodOffer.todayCardTitle')}</Text>
        {'\n'}
        <Text style={styles.body}>{moodText}</Text>
      </Text>
      <Text style={styles.meta}>{t('moodOffer.todayCardCount', { count })}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.base,
    marginBottom: space.base,
    borderRadius: radius.surface,
    backgroundColor: color.accent.fill,
    borderWidth: 1,
    borderColor: color.accent.edge,
  },
  textBlock: { flex: 1 },
  title: { ...type['body-strong'], color: color.text.primary },
  body: { ...type.caption, color: color.text.secondary },
  meta: { ...type.meta, color: color.text.secondary },
});
