/**
 * CommunityHistogram — Topluluk tahmin dagilim grafigi.
 *
 * Yatay bar chart: her satir = N tahminle cozen oyuncu sayisi.
 * Oyuncunun satiri teal ile vurgulanir + "You" rozeti gosterilir.
 */
import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import { styles } from './styles';

interface CommunityHistogramProps {
  /** Tahmin sayisina gore oyuncu dagilimi: { "1": 12, "2": 34, ... "0": failed } */
  distribution: Record<string, number>;
  /** Toplam oyuncu sayisi */
  totalPlayers: number;
  /** Oyuncunun percentile'i (0-100) */
  percentile: number;
  /** Oyuncunun toplam tahmin sayisi */
  userGuesses: number;
  /** Oyuncu kazandi mi */
  won: boolean;
}

/**
 * CommunityHistogram — Bugunku vakayi herkes nasil cozdu grafigi.
 */
export function CommunityHistogram({
  distribution,
  totalPlayers,
  percentile,
  userGuesses,
  won,
}: CommunityHistogramProps) {
  const { t } = useLanguage();

  // Build bars: 1-12 guesses + 0 for failed
  const buckets = [...Array.from({ length: 12 }, (_, i) => String(i + 1)), '0'];
  const maxCount = Math.max(1, ...buckets.map(b => distribution[b] ?? 0));
  const userBucket = won ? String(userGuesses) : '0';

  return (
    <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.histogramContainer}>
      <Text style={styles.histogramHeaderText}>
        {t('games.detective.community_title')}
      </Text>

      {buckets.map(bucket => {
        const count = distribution[bucket] ?? 0;
        const isUser = bucket === userBucket;
        const fillPct = Math.max(2, (count / maxCount) * 100);
        const label = bucket === '0' ? t('games.detective.community_failed') : bucket;

        return (
          <View
            key={bucket}
            style={[styles.histogramBarRow, isUser && styles.histogramBarRowActive]}
          >
            <Text style={[styles.histogramLabel, isUser && styles.histogramLabelActive]}>
              {label}
            </Text>
            <View style={styles.histogramBarTrack}>
              <View
                style={[
                  styles.histogramBarFill,
                  isUser && styles.histogramBarFillActive,
                  { width: `${fillPct}%` },
                ]}
              />
            </View>
            <Text style={[styles.histogramCount, isUser && styles.histogramCountActive]}>
              {count}
            </Text>
            {isUser && (
              <View style={styles.histogramYouBadge}>
                <Text style={styles.histogramYouBadgeText}>
                  {t('games.detective.community_you')}
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {totalPlayers > 0 && (
        <Text style={styles.histogramPercentile}>
          {t('games.detective.percentile', { percent: String(percentile) })}
        </Text>
      )}
    </Animated.View>
  );
}
