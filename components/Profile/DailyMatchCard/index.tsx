/**
 * DailyMatchCard — Günlük kişiselleştirilmiş film önerisi kartı.
 *
 * Özellikler:
 *  - 3:4 oranında tam genişlik poster görsel
 *  - Alt gradient overlay: arketip etiketi + film adı + eşleşme skoru
 *  - Dokunma → film detay ekranına yönlendirme
 *  - Loading: iskelet animasyonu
 *  - Profil yoksa: ipucu kartı
 *
 * Tasarım: design-reference/05-profile.png — "Today's Pick" bölümü
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArchetype } from '@/constants/archetypes';
import { hapticLight } from '@/utils/haptics';

import type { Film } from '@/types/film';

// ─── Prop tipi ────────────────────────────────────────────────────────────────

export interface DailyMatchCardProps {
  /** Öneri filmi; null ise "henüz profil yok" durumu gösterilir */
  film: Film | null;
  /** Yükleniyor mu? true ise iskelet gösterilir */
  loading: boolean;
  /** Kullanıcının arketip ID'si (1-12); arketip etiketini kişiselleştirir */
  archetypeId: number | null;
}

// ─── İskelet bileşeni ─────────────────────────────────────────────────────────

/**
 * Yükleme sırasında gösterilen titreşen iskelet kartı.
 */
function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.card, styles.skeletonCard, { opacity }]} />
  );
}

// ─── Boş durum bileşeni ───────────────────────────────────────────────────────

/**
 * Tat profili henüz oluşturulmamışken gösterilen ipucu kartı.
 */
function EmptyCard() {
  const { t } = useLanguage();
  return (
    <View style={[styles.card, styles.emptyCard]}>
      <Ionicons name="film-outline" size={32} color={Colors.accentPrimary} style={styles.emptyIcon} />
      <Text style={styles.emptyTitle}>{t('dailyMatch.noProfile')}</Text>
      <Text style={styles.emptyHint}>{t('dailyMatch.noProfileHint')}</Text>
    </View>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * Günlük kişiselleştirilmiş film önerisi kartı.
 * Profile tab'ında Daily Streak'in üstüne yerleştirilir.
 */
export default function DailyMatchCard({ film, loading, archetypeId }: DailyMatchCardProps) {
  const { t } = useLanguage();
  const router = useRouter();

  if (loading) return <SkeletonCard />;
  if (!film) return <EmptyCard />;

  const archetype = getArchetype(archetypeId);
  const archetypeName = archetype ? t(archetype.nameKey) : null;
  const accentColor = archetype?.colorPrimary ?? Colors.accentPrimary;

  function handlePress() {
    hapticLight();
    router.push(`/film/${film!.id}`);
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={film.title}
    >
      {/* Poster görseli */}
      {film.posterUrl ? (
        <Image
          source={{ uri: film.posterUrl }}
          style={styles.poster}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.poster, styles.posterPlaceholder]}>
          <Ionicons name="film-outline" size={48} color={Colors.textLightGrey} />
        </View>
      )}

      {/* Üst: arketip etiket rozeti */}
      {archetypeName && (
        <View style={[styles.archetypeBadge, { backgroundColor: accentColor + '22' }]}>
          <Text style={[styles.archetypeBadgeText, { color: accentColor }]}>
            {t('dailyMatch.pickedFor', { archetype: archetypeName })}
          </Text>
        </View>
      )}

      {/* Sağ üst: Eşleşme skoru */}
      <View style={styles.matchBadge}>
        <Text style={styles.matchBadgeText}>
          {t('dailyMatch.matchScore', { score: film.matchScore })}
        </Text>
      </View>

      {/* Alt gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(10,10,15,0.55)', 'rgba(10,10,15,0.92)']}
        locations={[0, 0.45, 1]}
        style={styles.gradient}
      >
        {/* Film adı */}
        <Text style={styles.filmTitle} numberOfLines={2}>
          {film.title}
        </Text>

        {/* Alt satır: yıl + dokunma ipucu */}
        <View style={styles.metaRow}>
          <Text style={styles.filmYear}>{film.year}</Text>
          {film.voteAverage != null && film.voteAverage > 0 && (
            <View style={styles.imdbBadge}>
              <Text style={styles.imdbText}>{film.voteAverage.toFixed(1)}</Text>
            </View>
          )}
          <View style={styles.tapHint}>
            <Ionicons name="play-circle-outline" size={14} color={Colors.textGrey} />
            <Text style={styles.tapHintText}>{t('dailyMatch.tapToExplore')}</Text>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },

  // ── Poster ──
  poster: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgElevated,
  },

  // ── Arketip rozeti (sol üst) ──
  archetypeBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    left: Theme.spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  archetypeBadgeText: {
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // ── Eşleşme rozeti (sağ üst) ──
  matchBadge: {
    position: 'absolute',
    top: Theme.spacing.sm,
    right: Theme.spacing.sm,
    backgroundColor: Colors.accentPrimary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.full,
  },
  matchBadgeText: {
    color: Colors.textOnAccent,
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // ── Alt gradient + metin ──
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 48,
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
  },
  filmTitle: {
    color: Colors.textWhite,
    fontSize: Theme.typography.h2.fontSize,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: Theme.typography.h2.lineHeight,
    marginBottom: Theme.spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filmYear: {
    color: Colors.textGrey,
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '600',
  },
  imdbBadge: {
    backgroundColor: Colors.imdbYellow,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  imdbText: {
    color: Colors.textOnAccent,
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '700',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  tapHintText: {
    color: Colors.textGrey,
    fontSize: Theme.typography.caption.fontSize,
  },

  // ── İskelet ──
  skeletonCard: {
    backgroundColor: Colors.bgElevated,
  },

  // ── Boş durum ──
  emptyCard: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Theme.spacing.xl,
    backgroundColor: Colors.bgCard,
    borderStyle: 'dashed',
    borderColor: Colors.accentPrimary + '44',
    borderWidth: 1.5,
    aspectRatio: undefined,
    minHeight: 160,
  },
  emptyIcon: {
    marginBottom: Theme.spacing.sm,
    opacity: 0.7,
  },
  emptyTitle: {
    color: Colors.textWhite,
    fontSize: Theme.typography.body.fontSize,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Theme.spacing.xs,
  },
  emptyHint: {
    color: Colors.textGrey,
    fontSize: Theme.typography.caption.fontSize,
    textAlign: 'center',
    lineHeight: Theme.typography.caption.lineHeight,
  },
});
