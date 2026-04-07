/**
 * TasteDNA — Kullanicinin film zevk profili ozet karti.
 *
 * P5.2 Revamp:
 *   - Arketip banner eklendi (FilledContent ust kismi)
 *   - Hardcoded strings → t() ile i18n
 *   - Pace/energy label'lari cevrildi
 *
 * Ozellikler:
 * - Arketip banner: hesaplanan sinefil tipi + aciklama
 * - Duygu barlari: react-native-reanimated ile 0→hedef genislik animasyonu (staggered)
 * - Genre chip'leri: fade-in animasyonlu
 * - Enerji bari: ayni animasyonla acilir
 * - Baslik: "Taste DNA" — Playfair Display, altin, emoji
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
import { useLanguage } from '@/contexts/LanguageContext';
import SkeletonLoader from '@/components/SkeletonLoader';
import { getArchetype } from '@/constants/archetypes';
import type { SwipeInsight } from '@/types/profile';
import type { EmotionalState, TasteProfile } from '@/types/index';

import { styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Her duygu icin ozel renk */
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

/** Her duygu icin emoji */
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

/** Hiz tercihi icin ikon */
const PACE_OPTIONS: { key: 'slow' | 'medium' | 'fast'; icon: string }[] = [
  { key: 'slow', icon: 'leaf-outline' },
  { key: 'medium', icon: 'car-outline' },
  { key: 'fast', icon: 'flash-outline' },
];

/** Bar animasyon suresi (ms) */
const BAR_DURATION = 800;

/** Barlar arasi gecikme (ms) */
const BAR_STAGGER = 100;

// ─── Yardimci Fonksiyonlar ────────────────────────────────────────────────────

/**
 * TasteProfile'dan okunabilir AI ozeti olusturur.
 */
function buildSummary(profile: TasteProfile, t: (key: string) => string): string {
  const emotionKeys: Record<string, string> = {
    joy: 'tasteDNA.emoJoy',
    sadness: 'tasteDNA.emoSadness',
    fear: 'tasteDNA.emoFear',
    anger: 'tasteDNA.emoAnger',
    surprise: 'tasteDNA.emoSurprise',
    disgust: 'tasteDNA.emoDisgust',
    anticipation: 'tasteDNA.emoAnticipation',
    trust: 'tasteDNA.emoTrust',
  };

  const topEmotion =
    (Object.entries(profile.emotional_state) as [string, number][])
      .sort(([, a], [, b]) => b - a)[0]?.[0] ?? 'trust';

  const depthKey =
    profile.thematic_depth > 0.6
      ? 'tasteDNA.depthPhilosophical'
      : profile.thematic_depth > 0.3
        ? 'tasteDNA.depthModerate'
        : 'tasteDNA.depthLight';

  const paceKey =
    profile.pace_preference === 'slow' ? 'tasteDNA.paceSlow' :
    profile.pace_preference === 'fast' ? 'tasteDNA.paceFast' :
    'tasteDNA.paceMedium';

  return t('tasteDNA.summary')
    .replace('%{pace}', t(paceKey))
    .replace('%{emotion}', t(emotionKeys[topEmotion] ?? 'tasteDNA.emoTrust'))
    .replace('%{depth}', t(depthKey));
}

/**
 * EmotionalState'den notrol (0.5) olmayan duygulari siralanmis dondurur.
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
  /** Swipe gecmisinden hesaplanan genre dagilimi */
  insights: SwipeInsight | null;
  /** Veri yukleneniyor mu */
  loading: boolean;
  /** Hesaplanan arketip ID'si (1-12) — null ise gosterilmez */
  archetypeId?: number | null;
}

// ─── Alt Bilesenkler ─────────────────────────────────────────────────────────

interface AnimatedBarProps {
  emoji: string;
  label: string;
  value: number;
  color: string;
  delay: number;
}

/**
 * Soldan saga reanimated animasyonlu duygu bari.
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
 * Enerji bari — withTiming animasyonu.
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

// ─── Arketip Banner ─────────────────────────────────────────────────────────

interface ArchetypeBannerProps {
  archetypeId: number;
}

/**
 * TasteDNA karti ici arketip banner'i.
 * Kullanicinin arketipini renkli arka plan + ikon + isim + aciklama ile gosterir.
 */
function ArchetypeBanner({ archetypeId }: ArchetypeBannerProps) {
  const { t } = useLanguage();
  const archetype = getArchetype(archetypeId);
  if (!archetype) return null;

  return (
    <View style={[styles.archetypeBanner, { borderLeftColor: archetype.colorPrimary, backgroundColor: archetype.colorDim }]}>
      <View style={styles.archetypeRow}>
        <Text style={styles.archetypeIcon}>{archetype.icon}</Text>
        <View style={styles.archetypeTextBlock}>
          <Text style={[styles.archetypeName, { color: archetype.colorPrimary }]}>
            {t(archetype.nameKey)}
          </Text>
          <Text style={styles.archetypeDesc}>{t(archetype.descKey)}</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Yukleniyor iskelet ───────────────────────────────────────────────────────

/**
 * Veri yuklenirken gosterilen iskelet icerik.
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

// ─── Dolu icerik ─────────────────────────────────────────────────────────────

/**
 * Profil verisi mevcutken gosterilen dolu icerik.
 */
function FilledContent({
  profile,
  insights,
  archetypeId,
}: {
  profile: TasteProfile;
  insights: SwipeInsight | null;
  archetypeId: number | null | undefined;
}) {
  const { t } = useLanguage();
  const topEmotions = getTopEmotions(profile.emotional_state);
  const topGenres = insights?.saved_genre_distribution.slice(0, 5) ?? [];
  const summary = buildSummary(profile, t);

  return (
    <>
      {/* Arketip banner — en uste */}
      {archetypeId != null && (
        <ArchetypeBanner archetypeId={archetypeId} />
      )}

      {/* Duygu dagilimi */}
      {topEmotions.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>{t('tasteDNA.moodDistribution')}</Text>
          <View style={styles.emotionsBlock}>
            {topEmotions.map(({ key, value }, index) => (
              <AnimatedBar
                key={key}
                emoji={EMOTION_EMOJI[key]}
                label={t(`tasteDNA.emotion_${key}`)}
                value={value}
                color={EMOTION_COLORS[key]}
                delay={index * BAR_STAGGER}
              />
            ))}
          </View>
        </View>
      )}

      {/* Genre egilimler */}
      {topGenres.length > 0 && (
        <View>
          <Text style={styles.sectionLabel}>{t('tasteDNA.genreTendencies')}</Text>
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
        <Text style={styles.sectionLabel}>{t('tasteDNA.energyLevel')}</Text>
        <View style={styles.energyRow}>
          <Text style={styles.energyLabel}>{t('tasteDNA.calm')}</Text>
          <AnimatedEnergyBar value={profile.energy_level} />
          <Text style={styles.energyLabelRight}>{t('tasteDNA.high')}</Text>
        </View>
      </View>

      {/* Hiz tercihi */}
      <View>
        <Text style={styles.sectionLabel}>{t('tasteDNA.pacePreference')}</Text>
        <View style={styles.paceBlock}>
          {PACE_OPTIONS.map(({ key, icon }) => {
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
                  {t(`tasteDNA.pace_${key}`)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* AI ozeti */}
      <Text style={styles.summary}>{summary}</Text>
    </>
  );
}

// ─── Ana Bilesen ──────────────────────────────────────────────────────────────

/**
 * Kullanicinin Taste DNA karti.
 * P5.2: arketip banner + i18n tum metinler.
 */
export default function TasteDNA({ profile, insights, loading, archetypeId }: Props) {
  const { t } = useLanguage();

  return (
    <View style={styles.card}>
      {/* Baslik */}
      <View style={styles.header}>
        <Text style={styles.headerDna}>🧬</Text>
        <Text style={styles.headerTitle}>{t('profile.tasteDNA')}</Text>
      </View>

      {loading ? (
        <SkeletonContent />
      ) : profile ? (
        <FilledContent profile={profile} insights={insights} archetypeId={archetypeId} />
      ) : (
        <Text style={styles.summary}>
          {t('tasteDNA.emptyHint')}
        </Text>
      )}
    </View>
  );
}
