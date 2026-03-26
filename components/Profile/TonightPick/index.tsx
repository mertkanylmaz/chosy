/**
 * TonightPick — Kullanıcı için kişiselleştirilmiş akşam film önerisi kartı.
 *
 * Özellikler:
 * - Film backdrop_url ile bulanık arka plan (ImageBackground + BlurView)
 * - Backdrop yoksa gradient fallback (#1A1F35 → #0A0E27)
 * - Poster: gölgeli + 2 derece hafif tilt
 * - Match score: büyük yüzde (Playfair 32px, altın), glow efekti, entrance animasyonu
 * - "✨ Tonight's Pick" başlığı
 * - TouchableOpacity activeOpacity={0.85}
 * - Kart border: 1px rgba(212,168,67,0.3)
 */
import React, { useEffect } from 'react';
import { Image, ImageBackground, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import { hapticLight } from '@/utils/haptics';
import type { TonightPick as TonightPickData } from '@/types/profile';

import { styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const TMDB_POSTER_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w780';

const REASON_LABELS: Record<TonightPickData['reason'], string> = {
  preference_match: 'Perfect Match',
  trending: 'Trending',
  hidden_gem: 'Hidden Gem 💎',
  director_favorite: 'Your Director',
};

/** Similarity skoruna göre AI açıklaması üretir */
function buildExplanation(pick: TonightPickData): string {
  if (pick.similarity > 0.85) return 'Strongly aligns with your film taste.';
  if (pick.similarity > 0.7) return 'Aligns well with your reflective mood tonight.';
  if (pick.reason === 'hidden_gem') return 'A hidden gem that matches your depth preference.';
  if (pick.reason === 'director_favorite') return 'From a director you tend to enjoy.';
  return 'Perfect match for your mood tonight';
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** tonight_pick RPC'den dönen veri */
  pick: TonightPickData | null;
  /** Veri yükleniyor mu */
  loading: boolean;
}

// ─── Alt Bileşenler ───────────────────────────────────────────────────────────

/**
 * Animasyonlu match score dairesi — scale spring ile girer, glow efekti var.
 */
function AnimatedMatchCircle({ matchPct }: { matchPct: number }) {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withDelay(300, withSpring(1, { damping: 14, stiffness: 140 }));
  }, [scale]);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.matchCircle, circleStyle]}>
      <Text style={styles.matchPercent}>{matchPct}%</Text>
    </Animated.View>
  );
}

/**
 * Yükleniyor iskelet içerik.
 */
function SkeletonContent() {
  return (
    <View style={styles.skeletonBlock}>
      <View style={styles.skeletonRow}>
        <SkeletonLoader width={72} height={108} borderRadius={10} />
        <View style={styles.skeletonInfo}>
          <SkeletonLoader height={20} width="80%" borderRadius={5} />
          <SkeletonLoader height={12} width="40%" borderRadius={4} />
          <SkeletonLoader height={12} width="60%" borderRadius={4} />
        </View>
      </View>
      <SkeletonLoader height={52} borderRadius={10} />
    </View>
  );
}

/**
 * Film içerik bloğu — poster + bilgi + match score.
 */
function FilmContent({ pick }: { pick: TonightPickData }) {
  const posterUri = pick.poster_url ? `${TMDB_POSTER_BASE}${pick.poster_url}` : null;
  const backdropUri = (pick as TonightPickData & { backdrop_url?: string | null }).backdrop_url
    ? `${TMDB_BACKDROP_BASE}${(pick as TonightPickData & { backdrop_url?: string | null }).backdrop_url}`
    : null;
  const matchPct = Math.round(pick.similarity * 100);
  const explanation = buildExplanation(pick);

  return (
    <>
      {/* Backdrop katmanı */}
      {backdropUri ? (
        <ImageBackground
          source={{ uri: backdropUri }}
          style={styles.backdropAbsolute}
          resizeMode="cover">
          <LinearGradient
            colors={['rgba(10,14,39,0.7)', 'rgba(10,14,39,0.95)']}
            style={styles.blurFill}
          />
          <View style={styles.darkOverlay} />
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={['#1A1F35', '#0A0E27']}
          style={styles.backdropAbsolute}
        />
      )}

      {/* İçerik */}
      <View style={styles.contentPadding}>
        {/* Başlık */}
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>✨</Text>
          <Text style={styles.headerTitle}>Tonight's Pick</Text>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{REASON_LABELS[pick.reason]}</Text>
          </View>
        </View>

        {/* Film satırı: poster + bilgi */}
        <View style={styles.filmRow}>
          <View style={styles.posterWrapper}>
            {posterUri ? (
              <Image
                source={{ uri: posterUri }}
                style={styles.poster}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.posterPlaceholder} />
            )}
          </View>

          <View style={styles.filmInfo}>
            <Text style={styles.filmTitle} numberOfLines={2}>
              {pick.title}
            </Text>
            <Text style={styles.filmMeta}>
              {pick.year}
              {pick.imdb_rating != null ? `  ·  ★ ${pick.imdb_rating.toFixed(1)}` : ''}
            </Text>
            {pick.genres.length > 0 && (
              <View style={styles.genres}>
                {pick.genres.slice(0, 3).map((g) => (
                  <View key={g} style={styles.genreTag}>
                    <Text style={styles.genreTagText}>{g}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Match score + açıklama */}
        <View style={styles.matchRow}>
          <AnimatedMatchCircle matchPct={matchPct} />
          <View style={styles.matchTextBlock}>
            <Text style={styles.matchExplanation}>{explanation}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * Tonight's Pick kartı.
 * Backdrop blur arka plan, animasyonlu match dairesi, tıklanınca film detayına gider.
 */
export default function TonightPick({ pick, loading }: Props) {
  const router = useRouter();

  function handlePress() {
    if (!pick?.film_id) return;
    hapticLight();
    router.push(`/film/${pick.film_id}`);
  }

  if (loading) {
    return (
      <View style={styles.card}>
        <LinearGradient colors={['#1A1F35', '#0A0E27']} style={styles.backdropAbsolute} />
        <View style={styles.contentPadding}>
          <SkeletonContent />
        </View>
      </View>
    );
  }

  if (!pick) {
    return (
      <View style={styles.card}>
        <LinearGradient colors={['#1A1F35', '#0A0E27']} style={styles.backdropAbsolute} />
        <View style={styles.contentPadding}>
          <Text style={styles.empty}>Keep swiping to unlock your nightly pick.</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={handlePress}>
      <FilmContent pick={pick} />
    </TouchableOpacity>
  );
}
