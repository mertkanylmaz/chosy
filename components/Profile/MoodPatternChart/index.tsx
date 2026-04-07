/**
 * MoodPatternChart — Son 14 gunun baskil duygu trendleri.
 *
 * Her gun icin en yuksek skorlu duygu horizontal bar olarak gosterilir.
 * Renkler TasteDNA'daki EMOTION_COLORS ile tutarli.
 *
 * Spec: .claude/specs/STATS_CHARTS_SPEC.md — Component 1
 */
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { STAGGER_DELAY_MS, TIMING_CONFIG } from '@/constants/animations';
import SkeletonLoader from '@/components/SkeletonLoader';

import { styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Duygu renkleri — TasteDNA ile ayni (single source of truth) */
const EMOTION_COLORS: Record<string, string> = {
  joy: '#4ADE80',
  sadness: '#60A5FA',
  fear: '#F87171',
  anger: '#EF4444',
  trust: '#A78BFA',
  anticipation: '#FBBF24',
  surprise: '#FB923C',
  disgust: '#6B7280',
};

/** Duygu emojileri */
const EMOTION_EMOJI: Record<string, string> = {
  joy: '\u{1F604}',
  sadness: '\u{1F622}',
  fear: '\u{1F628}',
  anger: '\u{1F620}',
  trust: '\u{1F91D}',
  anticipation: '\u{26A1}',
  surprise: '\u{1F632}',
  disgust: '\u{1F612}',
};

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface MoodPatternChartProps {
  /** Mood timeline verileri (services/history.ts'ten) */
  timeline: Array<{
    createdAt: string;
    profile: Record<string, unknown> | null;
  }>;
  /** Yukleniyor mu */
  loading: boolean;
}

/** Islenmis gunluk veri */
interface DayData {
  dateLabel: string;
  emotion: string;
  score: number;
}

// ─── Yardimcilar ──────────────────────────────────────────────────────────────

/**
 * Timeline verisini gunluk dominant duygu'ya donusturur.
 * Ayni gunde birden fazla session varsa ortalama alinir.
 */
function processTimeline(
  timeline: MoodPatternChartProps['timeline'],
): DayData[] {
  // Gunlere grupla
  const dayMap = new Map<string, Record<string, number[]>>();

  for (const entry of timeline) {
    if (!entry.profile) continue;

    const es = entry.profile.emotional_state as
      | Record<string, number>
      | undefined;
    if (!es) continue;

    const dateKey = entry.createdAt.slice(0, 10); // YYYY-MM-DD
    if (!dayMap.has(dateKey)) dayMap.set(dateKey, {});
    const dayEmotions = dayMap.get(dateKey)!;

    for (const [key, val] of Object.entries(es)) {
      if (typeof val !== 'number') continue;
      if (!dayEmotions[key]) dayEmotions[key] = [];
      dayEmotions[key].push(val);
    }
  }

  // Her gun icin dominant duygu bul
  const result: DayData[] = [];

  for (const [dateKey, emotions] of dayMap) {
    let bestEmotion = 'joy';
    let bestScore = 0;

    for (const [key, values] of Object.entries(emotions)) {
      const avg = values.reduce((a, b) => a + b, 0) / values.length;
      if (avg > bestScore) {
        bestScore = avg;
        bestEmotion = key;
      }
    }

    // Tarih formati: "Mar 16"
    const d = new Date(dateKey);
    const month = d.toLocaleDateString('en', { month: 'short' });
    const day = d.getDate();

    result.push({
      dateLabel: `${month} ${day}`,
      emotion: bestEmotion,
      score: bestScore,
    });
  }

  // Tarihe gore sirala (eskiden yeniye)
  result.sort((a, b) => a.dateLabel.localeCompare(b.dateLabel));

  return result.slice(-14); // son 14 gun
}

// ─── Animasyonlu Bar ──────────────────────────────────────────────────────────

/** Tek bar satirinda animasyonlu dolgu */
function AnimatedBar({
  day,
  index,
}: {
  day: DayData;
  index: number;
}) {
  const width = useSharedValue(0);
  const color = EMOTION_COLORS[day.emotion] ?? '#6B7280';

  useEffect(() => {
    width.value = withDelay(
      index * STAGGER_DELAY_MS,
      withTiming(day.score * 100, TIMING_CONFIG),
    );
  }, [day.score, index, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
    backgroundColor: color,
  }));

  return (
    <View style={styles.barRow}>
      <Text style={styles.dateLabel}>{day.dateLabel}</Text>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, fillStyle]} />
      </View>

      <View style={styles.emotionLabel}>
        <Text style={[styles.emotionName, { color }]}>
          {day.emotion}
        </Text>
        <Text style={styles.emotionScore}>
          {Math.round(day.score * 100)}%
        </Text>
      </View>
    </View>
  );
}

// ─── Legend ────────────────────────────────────────────────────────────────────

const LEGEND_KEYS = ['joy', 'sadness', 'trust', 'fear', 'anticipation', 'surprise'] as const;

function Legend() {
  return (
    <View style={styles.legend}>
      {LEGEND_KEYS.map((key) => (
        <View key={key} style={styles.legendItem}>
          <Text style={styles.legendEmoji}>
            {EMOTION_EMOJI[key]}
          </Text>
          <Text style={styles.legendText}>{key}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

const MoodPatternChart: React.FC<MoodPatternChartProps> = React.memo(({
  timeline,
  loading,
}) => {
  const days = useMemo(() => processTimeline(timeline), [timeline]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{'\u{1F3AD}'}</Text>
        <Text style={styles.headerTitle}>Mood Patterns</Text>
      </View>

      {/* Loading */}
      {loading ? (
        Array.from({ length: 7 }).map((_, i) => (
          <View key={i} style={styles.skeletonRow}>
            <SkeletonLoader width={52} height={16} borderRadius={4} />
            <View style={{ flex: 1, marginHorizontal: 8 }}>
              <SkeletonLoader width="100%" height={16} borderRadius={8} />
            </View>
          </View>
        ))
      ) : days.length === 0 ? (
        /* Empty */
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            Start exploring to see your mood patterns!
          </Text>
        </View>
      ) : (
        <>
          {/* Insufficient data notice */}
          {days.length < 3 && (
            <Text style={styles.insufficientText}>
              Keep exploring! Patterns appear after 3+ days.
            </Text>
          )}

          {/* Bars */}
          {days.map((day, index) => (
            <AnimatedBar key={day.dateLabel} day={day} index={index} />
          ))}

          {/* Legend */}
          <Legend />
        </>
      )}
    </View>
  );
});

MoodPatternChart.displayName = 'MoodPatternChart';

export default MoodPatternChart;
