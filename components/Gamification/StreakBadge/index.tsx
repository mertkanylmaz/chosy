/**
 * StreakBadge — Kompakt pill badge, feed sağ üst köşede streak gösterir.
 *
 * States:
 *   - loading: SkeletonLoader
 *   - zero: Soluk görünüm (streak === 0)
 *   - active: Parlak violet görünüm (streak >= 1)
 *   - incrementing: Pulse animasyonu (1x → active'e dön)
 *
 * Spec: .claude/specs/GAMIFICATION_UI_SPEC.md — Component 1
 */
import React, { useEffect, useRef } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { BOUNCE_CONFIG } from '@/constants/animations';
import { hapticLight } from '@/utils/haptics';
import { GamificationIcons } from '@/constants/icons';
import SkeletonLoader from '@/components/SkeletonLoader';

import { styles } from './styles';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface StreakBadgeProps {
  /** Mevcut streak gün sayısı */
  currentStreak: number;
  /** Yükleniyor mu */
  loading?: boolean;
  /** Badge'e basıldığında (profil streak detayına navigate) */
  onPress?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const StreakBadge: React.FC<StreakBadgeProps> = React.memo(({
  currentStreak,
  loading = false,
  onPress,
}) => {
  const scale = useSharedValue(1);
  const prevStreakRef = useRef(currentStreak);

  // Streak artınca pulse animasyonu
  useEffect(() => {
    if (currentStreak > prevStreakRef.current && currentStreak > 0) {
      scale.value = withSequence(
        withSpring(1.2, BOUNCE_CONFIG),
        withSpring(1, BOUNCE_CONFIG),
      );
      hapticLight();
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Loading state
  if (loading) {
    return (
      <View style={styles.touchable}>
        <SkeletonLoader
          width={52}
          height={32}
          borderRadius={9999}
        />
      </View>
    );
  }

  const isActive = currentStreak >= 1;

  return (
    <TouchableOpacity
      style={styles.touchable}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={!onPress}
      accessible
      accessibilityLabel={`${currentStreak} day streak`}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      <Animated.View
        style={[
          styles.pill,
          isActive ? styles.pillActive : styles.pillZero,
          animatedStyle,
        ]}
      >
        <Image
          source={GamificationIcons.streakActive}
          style={[styles.emoji, !isActive && styles.emojiDim]}
          resizeMode="contain"
        />
        <Text style={[styles.count, isActive ? styles.countActive : styles.countZero]}>
          {currentStreak}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
});

StreakBadge.displayName = 'StreakBadge';

export default StreakBadge;
