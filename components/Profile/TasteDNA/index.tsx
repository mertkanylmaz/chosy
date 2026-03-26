/**
 * TasteDNA — Kullanıcının film zevk profili özet kartı.
 *
 * Özellikler:
 * - Duygu barları: react-native-reanimated ile 0→hedef genişlik animasyonu (staggered)
 * - Genre chip'leri: fade-in animasyonlu
 * - Enerji barı: aynı animasyonla açılır
 * - Başlık: "Your Taste DNA" — Playfair Display, altın, 🧬 emoji
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { SwipeInsight } from '@/types/profile';
import type { EmotionalState, TasteProfile } from '@/types/index';

import { styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Her duygu için özel renk */
const EMOTION_COLORS: Record<keyof EmotionalState, string> = {
  joy: '#4ADE80',
  sadness: '#60A5FA',
  fear: '#F87171',
  anger: '#EF4444',
  trust: '#A78BFA',
  anticipation: '#FBBF24',
  surprise: '#FB923C',
  disgust: '#6B7280',
};

/** Her duygu için emoji */
const EMOTION_EMOJI: Record<keyof EmotionalState, string> = {
  joy: '😄',
  sadness: '😢',
  fear: '😨',
  anger: '😠',
  trust: '🤝',
  anticipation: '⚡',
  surprise: '😲',
  disgust: '😒',
};

/** Hız tercihi için ikon ve etiket */
const PACE_OPTIONS: { key: 'slow' | 'medium' | 'fast'; icon: string; label: string }[] = [
  { key: 'slow', icon: 'leaf-outline', label: 'Slow' },
  { key: 'medium', icon: 'car-outline', label: 'Medium' },
  { key: 'fast', icon: 'flash-outline', label: 'Fast' },
];

/** Bar animasyon süresi (ms) */
const BAR_DURATION = 800;

/** Barlar arası gecikme (ms) */
const BAR_STAGGER = 100;

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────────

/**
 * TasteProfile'dan okunabilir AI özeti oluşturur.
 */
function buildSummary(profile: TasteProfile): string {
  const emotionLabels: Record<string, string> = {
    joy: 'joyful',
    sadness: 'melancholic',
    fear: 'tense',
    anger: 'intense',
    surprise: 'surprising',
    disgust: 'edgy',
    anticipation: 'suspenseful',
    trust: 'warm',
  };

  const topEmotion =
    (Object.entries(profile.emotional_state) as [string, number][])
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'reflective';

  const depthLabel =
    profile.thematic_depth > 0.6
      ? 'philosophical depth'
      : profile.thematic_depth > 0.3
        ? 'moderate depth'
        : 'light entertainment';

  const pace = profile.pace_preference;
  const emotionWord = emotionLabels[topEmotion] ?? topEmotion;

  return `You prefer ${pace}, ${emotionWord} films with ${depthLabel}.`;
}

/**
 * EmotionalState'den nötr (≈0.5) olmayan duyguları sıralayarak döndürür.
 */
function getTopEmotions(
  state: EmotionalState,
): { key: keyof EmotionalState; value: number }[] {
  return (Object.entries(state) as [keyof EmotionalState, number][])
    .filter(([, v]) => Math.abs(v - 0.5) >= 0.1)
    .sort(([, a], [, b]) => b - a)
    .map(([key, value]) => ({ key, value }));
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Son oturumun 12 boyutlu profili */
  profile: TasteProfile | null;
  /** Swipe geçmişinden hesaplanan genre dağılımı */
  insights: SwipeInsight | null;
  /** Veri yükleniyor mu */
  loading: boolean;
}

// ─── Alt Bileşenler ───────────────────────────────────────────────────────────

interface AnimatedBarProps {
  /** Sol taraftaki emoji */
  emoji: string;
  /** Duygu adı */
  label: string;
  /** 0-1 arası değer */
  value: number;
  /** Bar dolgu rengi */
  color: string;
  /** Başlangıç gecikmesi (ms) */
  delay: number;
}

/**
 * Soldan sağa reanimated animasyonlu duygu barı.
 * onLayout ile container genişliğini ölçer, piksel bazlı genişlik animasyonu yapar.
 */
function AnimatedBar({ emoji, label, value, color, delay }: AnimatedBarProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const barWidth = useSharedValue(0);

  useEffect(() => {
    if (trackWidth > 0) {
      barWidth.value = withDelay(
        delay,
        withTiming(value * trackWidth, {
          duration: BAR_DURATION,
          easing: Easing.out(Easing.cubic),
        }),
      );
    }
  }, [trackWidth, value, delay, barWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: barWidth.value,
  }));

  return (
    <View style={styles.emotionRow}>
      <Text style={styles.emotionEmoji}>{emoji}</Text>
      <Text style={styles.emotionName}>{label}</Text>
      <View
        style={styles.barTrack}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <Animated.View style={[styles.barFill, { backgroundColor: color }, animatedStyle]}>
          <Text style={styles.inBarPercent}>{Math.round(value * 100)}%</Text>
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * Fade-in animasyonlu genre chip.
 */
function AnimatedGenreChip({ genre, delay }: { genre: string; delay: number }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.genreChip, animatedStyle]}>
      <Text style={styles.genreChipText}>{genre}</Text>
    </Animated.View>
  );
}

/**
 * Enerji barı — aynı withTiming animasyonu.
 */
function AnimatedEnergyBar({ value }: { value: number }) {
  const [trackWidth, setTrackWidth] = useState(0);
  const barWidth = useSharedValue(0);

  useEffect(() => {
    if (trackWidth > 0) {
      barWidth.value = withTiming(value * trackWidth, {
        duration: BAR_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [trackWidth, value, barWidth]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: barWidth.value,
  }));

  return (
    <View
      style={styles.energyTrack}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
      <Animated.View style={[styles.energyFill, animatedStyle]} />
    </View>
  );
}

// ─── Yükleniyor iskelet ───────────────────────────────────────────────────────

/**
 * Veri yüklenirken gösterilen iskelet içerik.
 */
function SkeletonContent() {
  return (
    <View style={styles.skeletonRow}>
      <SkeletonLoader height={22} borderRadius={5} />
      <SkeletonLoader height={22} width="80%" borderRadius={5} />
      <SkeletonLoader height={22} width="60%" borderRadius={5} />
      <SkeletonLoader height={32} borderRadius={8} style={{ marginTop: 4 }} />
      <SkeletonLoader height={10} width="90%" borderRadius={5} style={{ marginTop: 4 }} />
    </View>
  );
}

// ─── Dolu içerik ─────────────────────────────────────────────────────────────

/**
 * Profil verisi mevcutken gösterilen dolu içerik.
 */
function FilledContent({
  profile,
  insights,
}: {
  profile: TasteProfile;
  insights: SwipeInsight | null;
}) {
  const topEmotions = getTopEmotions(profile.emotional_state);
  const topGenres = insights?.saved_genre_distribution.slice(0, 5) ?? [];
  const summary = buildSummary(profile);

  return (
    <>
      {/* Duygu dağılımı */}
      {topEmotions.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>Mood Distribution</Text>
          <View style={styles.emotionsBlock}>
            {topEmotions.map(({ key, value }, index) => (
              <AnimatedBar
                key={key}
                emoji={EMOTION_EMOJI[key]}
                label={key}
                value={value}
                color={EMOTION_COLORS[key]}
                delay={index * BAR_STAGGER}
              />
            ))}
          </View>
        </View>
      )}

      {/* Genre eğilimleri */}
      {topGenres.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>Genre Tendencies</Text>
          <View style={styles.genresBlock}>
            {topGenres.map((item, index) => (
              <AnimatedGenreChip
                key={item.genre}
                genre={item.genre}
                delay={index * 80}
              />
            ))}
          </View>
        </View>
      )}

      {/* Enerji tercihi */}
      <View style={styles.energyBlock}>
        <Text style={styles.sectionLabel}>Energy Level</Text>
        <View style={styles.energyRow}>
          <Text style={styles.energyLabel}>Calm</Text>
          <AnimatedEnergyBar value={profile.energy_level} />
          <Text style={styles.energyLabelRight}>High</Text>
        </View>
      </View>

      {/* Hız tercihi */}
      <View>
        <Text style={styles.sectionLabel}>Pace Preference</Text>
        <View style={styles.paceBlock}>
          {PACE_OPTIONS.map(({ key, icon, label }) => {
            const isActive = profile.pace_preference === key;
            return (
              <View
                key={key}
                style={[styles.paceOption, isActive && styles.paceOptionActive]}>
                <Ionicons
                  name={icon as keyof typeof Ionicons.glyphMap}
                  size={18}
                  color={isActive ? Colors.gold : Colors.textGrey}
                />
                <Text
                  style={[
                    styles.paceOptionText,
                    isActive && styles.paceOptionTextActive,
                  ]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* AI özeti */}
      <Text style={styles.summary}>{summary}</Text>
    </>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * Kullanıcının Taste DNA kartı.
 * Animasyonlu duygu barları, genre chip'leri, enerji/hız göstergesi ve AI özeti içerir.
 */
export default function TasteDNA({ profile, insights, loading }: Props) {
  return (
    <View style={styles.card}>
      {/* Başlık */}
      <View style={styles.header}>
        <Text style={styles.headerDna}>🧬</Text>
        <Text style={styles.headerTitle}>Your Taste DNA</Text>
      </View>

      {loading ? (
        <SkeletonContent />
      ) : profile ? (
        <FilledContent profile={profile} insights={insights} />
      ) : (
        <Text style={styles.summary}>
          Swipe more films to build your Taste DNA.
        </Text>
      )}
    </View>
  );
}
