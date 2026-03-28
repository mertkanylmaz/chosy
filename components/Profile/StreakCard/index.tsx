/**
 * StreakCard — Profile ekranında streak detay kartı.
 *
 * İçerik:
 *   - 3 stat kutusu: current / best / total active
 *   - 14 günlük dot takvimi (aktif/pasif/bugün)
 *   - Sonraki milestone progress bar
 *
 * States:
 *   - loading: Skeleton
 *   - zero: Teşvik mesajı, tüm dot'lar pasif
 *   - active: Normal görünüm
 *
 * Spec: .claude/specs/GAMIFICATION_UI_SPEC.md — Component 3
 */
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { TIMING_CONFIG, STAGGER_DELAY_MS } from '@/constants/animations';
import SkeletonLoader from '@/components/SkeletonLoader';

import { styles } from './styles';

// ─── Tipler ──────────────────────────────────────────────────────────────────

export interface StreakCardProps {
  /** Streak bilgisi (gamification servisinden) */
  streakInfo: {
    currentStreak: number;
    longestStreak: number;
    totalActiveDays: number;
    lastActiveDate: string | null;
  } | null;
  /** Yükleniyor mu */
  loading: boolean;
  /** Sonraki milestone bilgisi (opsiyonel) */
  nextMilestone?: {
    title: string;
    threshold: number;
    currentProgress: number;
  } | null;
}

// ─── Yardımcılar ─────────────────────────────────────────────────────────────

/** Son 14 günün gün etiketleri (M T W T F S S ...) */
const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/**
 * Son 14 günün aktif/pasif/bugün durumunu hesaplar.
 * lastActiveDate ve currentStreak'ten türetir.
 */
function getLast14Days(
  lastActiveDate: string | null,
  currentStreak: number,
): Array<'active' | 'today' | 'inactive'> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result: Array<'active' | 'today' | 'inactive'> = [];

  // Son aktif tarihi bul
  const lastActive = lastActiveDate ? new Date(lastActiveDate) : null;
  if (lastActive) lastActive.setHours(0, 0, 0, 0);

  for (let i = 13; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(day.getDate() - i);

    if (i === 0) {
      // Bugün — lastActive bugünse active + today, değilse sadece today
      const isActiveToday = lastActive && lastActive.getTime() === today.getTime();
      result.push(isActiveToday ? 'today' : 'inactive');
    } else if (lastActive && currentStreak > 0) {
      // Streak boyunca aktif günleri işaretle
      const streakStart = new Date(lastActive);
      streakStart.setDate(streakStart.getDate() - (currentStreak - 1));
      const dayTime = day.getTime();
      const isInStreak = dayTime >= streakStart.getTime() && dayTime <= lastActive.getTime();
      result.push(isInStreak ? 'active' : 'inactive');
    } else {
      result.push('inactive');
    }
  }

  return result;
}

// ─── Alt Componentler ────────────────────────────────────────────────────────

/** Animasyonlu progress bar dolgusu */
function AnimatedProgressBar({ progress }: { progress: number }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(Math.min(progress, 1) * 100, TIMING_CONFIG);
  }, [progress, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View style={styles.progressBar}>
      <Animated.View style={[styles.progressFill, animatedStyle]} />
    </View>
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

const StreakCard: React.FC<StreakCardProps> = React.memo(({
  streakInfo,
  loading,
  nextMilestone,
}) => {
  // 14-gün dot verileri
  const days = useMemo(() => {
    if (!streakInfo) return Array(14).fill('inactive') as Array<'active' | 'today' | 'inactive'>;
    return getLast14Days(streakInfo.lastActiveDate, streakInfo.currentStreak);
  }, [streakInfo]);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🔥</Text>
        <Text style={styles.headerTitle}>Daily Streak</Text>
      </View>

      {loading ? (
        /* Loading Skeleton */
        <View style={styles.skeletonRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonBox}>
              <SkeletonLoader height={80} borderRadius={12} />
            </View>
          ))}
        </View>
      ) : !streakInfo || streakInfo.totalActiveDays === 0 ? (
        /* Zero State */
        <Text style={styles.emptyMessage}>
          Start your streak by discovering movies today!
        </Text>
      ) : (
        <>
          {/* 3-Stat Row */}
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statValueCurrent]}>
                {streakInfo.currentStreak}
              </Text>
              <Text style={styles.statSublabel}>days</Text>
              <Text style={styles.statLabel}>current</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statValueBest]}>
                {streakInfo.longestStreak}
              </Text>
              <Text style={styles.statSublabel}>best</Text>
              <Text style={styles.statLabel}>record</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, styles.statValueTotal]}>
                {streakInfo.totalActiveDays}
              </Text>
              <Text style={styles.statSublabel}>total</Text>
              <Text style={styles.statLabel}>active</Text>
            </View>
          </View>

          {/* 14-Gün Dot Row */}
          <View style={styles.dotRow}>
            {days.map((status, i) => (
              <Animated.View
                key={i}
                style={styles.dotWrapper}
                entering={undefined}
              >
                <View
                  style={[
                    styles.dot,
                    status === 'active'
                      ? styles.dotActive
                      : status === 'today'
                        ? styles.dotToday
                        : styles.dotInactive,
                  ]}
                />
                <Text style={styles.dayLabel}>
                  {DAY_LABELS[(new Date(Date.now() - (13 - i) * 86400000).getDay() + 6) % 7]}
                </Text>
              </Animated.View>
            ))}
          </View>

          {/* Progress Bar — Sonraki Milestone */}
          {nextMilestone ? (
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>
                  <Text style={styles.progressLabel}>Next: </Text>
                  <Text style={styles.progressMilestone}>
                    {nextMilestone.title} ({nextMilestone.threshold})
                  </Text>
                </Text>
                <Text style={styles.progressValue}>
                  {nextMilestone.currentProgress}/{nextMilestone.threshold}
                </Text>
              </View>
              <AnimatedProgressBar
                progress={nextMilestone.currentProgress / nextMilestone.threshold}
              />
            </View>
          ) : (
            <Text style={styles.allAchieved}>
              All streak milestones achieved! 🏆
            </Text>
          )}
        </>
      )}
    </View>
  );
});

StreakCard.displayName = 'StreakCard';

export default StreakCard;
