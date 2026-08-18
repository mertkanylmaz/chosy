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
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import {
  Dna,
  Smiley,
  SmileyMeh,
  SmileyAngry,
  SmileyNervous,
  Question,
  ThumbsDown,
  Timer,
  HandHeart,
} from 'phosphor-react-native';
import type { IconProps as PhosphorIconProps } from 'phosphor-react-native';

import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import { localizeGenre } from '@/utils/filmFilters';
import SkeletonLoader from '@/components/SkeletonLoader';
import type { SwipeInsight } from '@/types/profile';
import type { EmotionalState, TasteProfile } from '@/types/index';

import { styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

// EMOTION_COLORS — kompakt versiyon icin kaldirildi (barlar yok)
// const EMOTION_COLORS: Record<keyof EmotionalState, string> = { ... };

/** Her duygu icin Phosphor vektor ikon */
const EMOTION_PHOSPHOR: Record<keyof EmotionalState, React.ComponentType<PhosphorIconProps>> = {
  joy: Smiley,
  sadness: SmileyMeh,
  anger: SmileyAngry,
  fear: SmileyNervous,
  surprise: Question,
  disgust: ThumbsDown,
  anticipation: Timer,
  trust: HandHeart,
};

// PACE_OPTIONS, BAR_DURATION, BAR_STAGGER — kompakt versiyon icin kaldirildi

// ─── Yardimci Fonksiyonlar ────────────────────────────────────────────────────

/**
 * TasteProfile'dan okunabilir AI ozeti olusturur.
 * Not: t() ikinci argümanı ile interpolasyon yapılır — .replace() değil.
 * .replace() yaklaşımı i18n-js v4'te [missing "X" value] hatasına neden olur.
 */
function buildSummary(
  profile: TasteProfile,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
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

  return t('tasteDNA.summary', {
    pace: t(paceKey),
    emotion: t(emotionKeys[topEmotion] ?? 'tasteDNA.emoTrust'),
    depth: t(depthKey),
  });
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

// AnimatedBar — kompakt versiyon icin kaldirildi, gelecekte geri eklenebilir
// interface AnimatedBarProps { emotionKey: keyof EmotionalState; label: string; value: number; color: string; delay: number; }
// function AnimatedBar(...) { ... }

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

// AnimatedEnergyBar — kompakt versiyon icin kaldirildi, gelecekte geri eklenebilir
// function AnimatedEnergyBar({ value }: { value: number }) { ... }

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
 * Not: Arketip banner kaldirildi — profil header'inda PersonaBadge + aciklama var.
 */
function FilledContent({
  profile,
  insights,
}: {
  profile: TasteProfile;
  insights: SwipeInsight | null;
}) {
  const { t, language } = useLanguage();
  const topGenres = insights?.saved_genre_distribution.slice(0, 3) ?? [];
  const summary = buildSummary(profile, t);

  // Baskin duygu — tek satir ozet
  const rawEmotions = getTopEmotions(profile.emotional_state);
  const topEmotion = rawEmotions[0];
  const secondEmotion = rawEmotions[1];

  return (
    <>
      {/* Baskin duygu — kompakt tek satir */}
      {topEmotion && (() => {
        const TopIcon = EMOTION_PHOSPHOR[topEmotion.key] ?? Smiley;
        return (
          <View style={styles.dominantEmotionRow}>
            <TopIcon size={20} color="#E8A838" weight="duotone" />
            <Text style={styles.dominantEmotionText}>
              {t(`tasteDNA.emotion_${topEmotion.key}`)}
              {secondEmotion ? ` + ${t(`tasteDNA.emotion_${secondEmotion.key}`)}` : ''}
            </Text>
          </View>
        );
      })()}

      {/* Genre egilimler — top 3, pill chip */}
      {topGenres.length > 0 && (
        <View style={styles.genresBlock}>
          {topGenres.map((item, index) => (
            <AnimatedGenreChip
              key={item.genre}
              genre={localizeGenre(item.genre, language)}
              delay={index * 80}
            />
          ))}
        </View>
      )}

      {/* Duygu barlari — kompakt versiyon icin kaldirildi */}
      {/* Enerji bari — kompakt versiyon icin kaldirildi */}
      {/* Hiz tercihi — kompakt versiyon icin kaldirildi */}

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

  useEffect(() => {
    if (!loading && profile) {
      posthogAnalytics.track('dna_viewed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, !!profile]);

  return (
    <View style={styles.card}>
      {/* Baslik */}
      <View style={styles.header}>
        <Dna size={24} color="#E8A838" weight="duotone" />
        <Text style={styles.headerTitle}>{t('profile.tasteDNA')}</Text>
      </View>

      {loading ? (
        <SkeletonContent />
      ) : profile ? (
        <FilledContent profile={profile} insights={insights} />
      ) : (
        <Text style={styles.summary}>
          {t('tasteDNA.emptyHint')}
        </Text>
      )}
    </View>
  );
}
