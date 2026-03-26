import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import {
  EmotionalState,
  PacePreference,
  TasteProfile,
} from '@/types';
import styles from './styles';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** EmotionalState içindeki en baskın duyguyu döndürür */
function dominantEmotionKey(state: EmotionalState): keyof EmotionalState {
  const entries = Object.entries(state) as [keyof EmotionalState, number][];
  return entries.reduce((a, b) => (a[1] > b[1] ? a : b))[0];
}

const EMOTION_VALUE: Record<keyof EmotionalState, string> = {
  joy: 'Joyful',
  sadness: 'Melancholic',
  anger: 'Intense',
  fear: 'Anxious',
  surprise: 'Curious',
  disgust: 'Critical',
  anticipation: 'Eager',
  trust: 'Serene',
};

const EMOTION_DESC: Record<keyof EmotionalState, string> = {
  joy: 'Uplifted and bright',
  sadness: 'Deep emotional resonance',
  anger: 'Passionate intensity',
  fear: 'Edge of your seat',
  surprise: 'Open to surprises',
  disgust: 'Discerning taste',
  anticipation: 'Eager for more',
  trust: 'Warm and trusting',
};

const EMOTION_ICON: Record<keyof EmotionalState, string> = {
  joy: '😊',
  sadness: '🌧',
  anger: '🔥',
  fear: '🌑',
  surprise: '✨',
  disgust: '🎭',
  anticipation: '🚀',
  trust: '🤝',
};

/** Enerji seviyesini etiket stringine dönüştürür */
function energyLabel(level: number): string {
  if (level < 0.2) return 'Very Low';
  if (level < 0.4) return 'Low';
  if (level < 0.55) return 'Medium-Low';
  if (level < 0.7) return 'Medium';
  if (level < 0.85) return 'Medium-High';
  return 'High';
}

function energyDesc(level: number): string {
  if (level < 0.4) return 'Lower physical energy.';
  if (level < 0.65) return 'Balanced energy level.';
  return 'High-energy state.';
}

const PACE_VALUE: Record<PacePreference, string> = {
  slow: 'Slow',
  medium: 'Balanced',
  fast: 'Fast-Paced',
};

const PACE_DESC: Record<PacePreference, string> = {
  slow: 'A leisurely tempo.',
  medium: 'Steady narrative flow.',
  fast: 'High-octane energy.',
};

/** thematic_depth → etiket */
function thematicDepthLabel(depth: number): string {
  if (depth < 0.3) return 'Light';
  if (depth < 0.55) return 'Moderate';
  if (depth < 0.75) return 'Deep';
  return 'Profound';
}

/** thematic_depth → açıklama */
function thematicDepthDesc(depth: number): string {
  if (depth < 0.3) return 'Easy and fun watching.';
  if (depth < 0.55) return 'Thought-provoking layers.';
  return 'Philosophical depth.';
}

/** Dominant emotion → profile name */
function profileName(emotionKey: keyof EmotionalState): string {
  const map: Record<keyof EmotionalState, string> = {
    joy: 'Joyful',
    sadness: 'Melancholic',
    anger: 'Intense',
    fear: 'Anxious',
    surprise: 'Curious',
    disgust: 'Critical',
    anticipation: 'Eager',
    trust: 'Calm',
  };
  return map[emotionKey];
}

// ─── Card sub-components ──────────────────────────────────────────────────────

/** Emotion boyutu kartı */
function EmotionCard({ emotionKey }: { emotionKey: keyof EmotionalState }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconBg}>
          <Text style={styles.cardIcon}>{EMOTION_ICON[emotionKey]}</Text>
        </View>
      </View>
      <Text style={styles.cardLabel}>Emotion</Text>
      <Text style={styles.cardValue}>{EMOTION_VALUE[emotionKey]}</Text>
      <Text style={styles.cardDesc}>{EMOTION_DESC[emotionKey]}</Text>
    </View>
  );
}

/** Energy Level boyutu kartı — progress bar ile */
function EnergyCard({ level }: { level: number }) {
  const pct = `${Math.round(level * 100)}%`;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconBg}>
          <Text style={styles.cardIcon}>⚡</Text>
        </View>
      </View>
      <Text style={styles.cardLabel}>Energy Level</Text>
      <Text style={styles.cardValue}>{energyLabel(level)}</Text>
      <Text style={styles.cardDesc}>{energyDesc(level)}</Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: pct as `${number}%` }]} />
      </View>
    </View>
  );
}

/** Pacing boyutu kartı */
function PacingCard({ pace }: { pace: PacePreference }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconBg}>
          <Text style={styles.cardIcon}>🎬</Text>
        </View>
      </View>
      <Text style={styles.cardLabel}>Pacing</Text>
      <Text style={styles.cardValue}>{PACE_VALUE[pace]}</Text>
      <Text style={styles.cardDesc}>{PACE_DESC[pace]}</Text>
    </View>
  );
}

/** Thematic Depth boyutu kartı — progress bar ile */
function ThematicDepthCard({ depth }: { depth: number }) {
  const pct = `${Math.round(depth * 100)}%`;
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardIconBg}>
          <Text style={styles.cardIcon}>🎭</Text>
        </View>
      </View>
      <Text style={styles.cardLabel}>Color Tone</Text>
      <Text style={styles.cardValue}>{thematicDepthLabel(depth)}</Text>
      <Text style={styles.cardDesc}>{thematicDepthDesc(depth)}</Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: pct as `${number}%` }]} />
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  /** Ayrıştırılmış 12 boyutlu profil */
  profile: TasteProfile;
  /** "Browse Movies" butonuna basıldığında çağrılır */
  onBrowseMovies: () => void;
  /** Geri okuna basıldığında çağrılır; sağlanmazsa router.back() çalışır */
  onBack?: () => void;
}

/**
 * Mood analizi sonucunu 2x2 boyut kartlarıyla gösteren ekran.
 * Kartlar staggered fade-in animasyonuyla açılır.
 * Tasarım referansı: design-reference/08-mood-profile-result.png
 */
export default function MoodProfileResult({ profile, onBrowseMovies, onBack }: Props) {
  const router = useRouter();

  const cardAnims = useRef(
    [0, 1, 2, 3].map(() => new Animated.Value(0))
  ).current;

  const headerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Header giriş
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Kartlar stagger
    Animated.stagger(
      90,
      cardAnims.map(anim =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        })
      )
    ).start();
  }, []);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const emotionKey = dominantEmotionKey(profile.emotional_state);
  const currentProfileName = profileName(emotionKey);

  const cardNodes = [
    <EmotionCard emotionKey={emotionKey} />,
    <EnergyCard level={profile.energy_level} />,
    <PacingCard pace={profile.pace_preference} />,
    <ThematicDepthCard depth={profile.thematic_depth} />,
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundGradient]}
        style={styles.gradient}
      >
        {/* Header bar */}
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={handleBack} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
          <View style={styles.trophyWrap}>
            <Ionicons name="trophy" size={20} color={Colors.gold} />
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <Animated.Text
            style={[
              styles.title,
              {
                opacity: headerAnim,
                transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              },
            ]}
          >
            Mood Profile Result
          </Animated.Text>

          {/* Profile name badge */}
          <Animated.View
            style={[
              styles.profileBadge,
              { opacity: headerAnim },
            ]}
          >
            <Text style={styles.profileBadgeLabel}>Current Profile:</Text>
            <Text style={styles.profileBadgeName}>{currentProfileName}.</Text>
          </Animated.View>

          {/* Description */}
          <Animated.Text
            style={[styles.description, { opacity: headerAnim }]}
          >
            This profile matches a reflective mood and preference for slow-paced storytelling.
          </Animated.Text>

          {/* 2x2 card grid */}
          <View style={styles.grid}>
            {cardNodes.map((node, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.animWrapper,
                  {
                    opacity: cardAnims[i],
                    transform: [
                      {
                        translateY: cardAnims[i].interpolate({
                          inputRange: [0, 1],
                          outputRange: [24, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {node}
              </Animated.View>
            ))}
          </View>

          {/* Browse Movies button */}
          <TouchableOpacity
            onPress={onBrowseMovies}
            activeOpacity={0.85}
            style={styles.browseWrapper}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.browseBtn}
            >
              <Text style={styles.browseBtnText}>Browse Movies</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}
