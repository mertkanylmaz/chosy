/**
 * QuotaIndicator — mood ekranında kalan arama hakkını gösteren kompakt badge.
 *
 * Gösterim kuralları:
 *   - remaining > 0: "3 searches left today" (yeşil-nötr)
 *   - remaining === 1: son hak vurgusu (turuncu)
 *   - remaining === 0: "Limit reached" (kırmızı)
 *   - Loading: skeleton shimmer
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import type { QuotaCheckResult } from '@/services/quotaEngine';

// ─── Props ───────────────────────────────────────────────────────────────────

interface QuotaIndicatorProps {
  /** Kota kontrol sonucu — null ise henüz yükleniyor */
  quota: QuotaCheckResult | null;
  /** Yükleniyor mu? */
  isLoading?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Mood ekranının başlık alanında kalan arama hakkını gösterir.
 */
export default function QuotaIndicator({ quota, isLoading }: QuotaIndicatorProps) {
  const { t } = useLanguage();

  if (isLoading || !quota) {
    return (
      <View style={[styles.container, styles.containerLoading]}>
        <View style={styles.shimmer} />
      </View>
    );
  }

  const { remaining, weeklyLimit, dailyLimit } = quota;

  // Renk ve ikon seçimi
  let color: string = Colors.success;
  let iconName: 'sparkles' | 'warning' | 'close-circle' = 'sparkles';

  if (remaining === 0) {
    color = Colors.error;
    iconName = 'close-circle';
  } else if (remaining === 1) {
    color = Colors.warning;
    iconName = 'warning';
  }

  // Metin: günlük mü haftalık mı?
  const isWeeklyLimited = dailyLimit * 7 > weeklyLimit;
  const text = remaining === 0
    ? t('quota.exhaustedTitle')
    : isWeeklyLimited
      ? t('quota.remainingWeekly', { count: remaining })
      : t('quota.remaining', { count: remaining });

  return (
    <View style={[styles.container, { borderColor: color + '30' }]}>
      <Ionicons name={iconName} size={14} color={color} />
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.white10,
    backgroundColor: Colors.bgElevated,
    alignSelf: 'flex-start',
  },
  containerLoading: {
    width: 140,
    height: 28,
  },
  shimmer: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.white05,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
