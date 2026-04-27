/**
 * WatchlistCard — watchlist ekranındaki tek film kartı.
 *
 * - Giriş: useStaggeredEntry stagger animasyonu
 * - Çıkış: FadeOut (Reanimated exiting prop)
 * - Long press: wobble + haptic
 */
import React, { useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { WatchlistItem } from '@/services/watchlist';
import { Colors } from '@/constants/Colors';
import { hapticMedium } from '@/utils/haptics';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { useLanguage } from '@/contexts/LanguageContext';
import { localizeGenre } from '@/utils/filmFilters';

import styles from './styles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatchlistCardProps {
  item: WatchlistItem;
  itemIndex: number;
  onLongPress: (filmId: string, filmTitle: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Watchlist grid'inde tek film kartı bileşeni.
 * Hem düz liste hem de SessionAccordion içinde kullanılır.
 */
const WatchlistCard = React.memo(function WatchlistCard({
  item,
  itemIndex,
  onLongPress,
}: WatchlistCardProps) {
  const { film } = item;
  const router = useRouter();
  const { language } = useLanguage();
  const isReducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const staggerStyle = useStaggeredEntry(itemIndex, { delay: 60, baseDelay: 0 });

  const handlePress = useCallback(() => {
    if (!film?.id) return;
    router.push(`/film/${film.id}` as never);
  }, [router, film.id]);

  const handleLongPress = useCallback(() => {
    onLongPress(film.id, film.title);
    hapticMedium();

    if (!isReducedMotion) {
      rotation.value = withSequence(
        withTiming(-4, { duration: 55 }),
        withRepeat(
          withSequence(
            withTiming(4, { duration: 55 }),
            withTiming(-4, { duration: 55 }),
          ),
          3,
          false,
        ),
        withTiming(0, { duration: 55 }),
      );
    }
  }, [onLongPress, film.id, film.title, isReducedMotion, rotation]);

  const wobbleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const rawGenre = film.moodTags[0] ?? null;
  const genre = rawGenre ? localizeGenre(rawGenre, language) : null;
  const meta = genre ? `${film.year} · ${genre}` : String(film.year);
  const posterUri = film.posterUrl
    ? film.posterUrl.startsWith('http')
      ? film.posterUrl
      : `https://image.tmdb.org/t/p/w500${film.posterUrl}`
    : undefined;

  return (
    <Animated.View
      exiting={isReducedMotion ? undefined : FadeOut.duration(250)}
      style={[isReducedMotion ? undefined : staggerStyle, wobbleStyle, styles.card]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.85}
        delayLongPress={400}
      >
        {/* Poster + badge kapsayıcı */}
        <View style={styles.posterContainer}>
          {posterUri ? (
            <Image
              source={{ uri: posterUri }}
              style={styles.poster}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.poster, styles.posterPlaceholder]}>
              <Ionicons name="film-outline" size={32} color={Colors.textGrey} />
            </View>
          )}

          {/* Match Score Rozeti — glassmorphism, sağ alt köşe */}
          {film.matchScore > 0 && (
            <View style={styles.matchBadge}>
              <Text style={styles.matchBadgeText}>{film.matchScore}%</Text>
            </View>
          )}
        </View>

        {/* Yıl · Tür — film adı kaldırıldı */}
        <Text style={styles.cardMeta} numberOfLines={1}>
          {meta}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

export default WatchlistCard;
