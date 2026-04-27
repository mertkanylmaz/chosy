/**
 * SessionAccordion — Mood session bazlı watchlist grubu.
 *
 * Header: stacked poster önizleme + mood prompt özeti + film sayısı + chevron
 * Body: 2-sütunlu WatchlistCard grid'i (FadeInDown animasyonlu)
 *
 * defaultExpanded=true olan grup (genellikle ilk grup) açık başlar.
 */
import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { WatchlistGroup, WatchlistItem } from '@/services/watchlist';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticSelection } from '@/utils/haptics';

import WatchlistCard from '../WatchlistCard';
import styles from './styles';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionAccordionProps {
  group: WatchlistGroup;
  /** Listedeki sıra — stagger animasyon için */
  groupIndex: number;
  onLongPress: (filmId: string, filmTitle: string) => void;
  /** true ise başlangıçta açık */
  defaultExpanded?: boolean;
}

// ─── StackedPosters ───────────────────────────────────────────────────────────

interface StackedPostersProps {
  films: WatchlistItem[];
}

/**
 * Kapalı accordion header'ında ilk 3 filmin üst üste binmiş küçük poster önizlemesi.
 * Sadece collapsed modda görünür.
 */
function StackedPosters({ films }: StackedPostersProps) {
  const previews = films.slice(0, 3);
  if (previews.length === 0) return null;

  return (
    <View style={styles.stackedPosters}>
      {previews.map((item, i) => {
        const uri = item.film.posterUrl
          ? item.film.posterUrl.startsWith('http')
            ? item.film.posterUrl
            : `https://image.tmdb.org/t/p/w185${item.film.posterUrl}`
          : undefined;

        return (
          <View
            key={item.film.id}
            style={[
              styles.stackPoster,
              { left: i * 10, zIndex: 3 - i },
            ]}
          >
            {uri ? (
              <Image
                source={{ uri }}
                style={styles.stackPosterImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <View style={[styles.stackPosterImage, styles.stackPosterPlaceholder]}>
                <Ionicons name="film-outline" size={10} color="#71717A" />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Tek bir mood session grubunu accordion olarak gösterir.
 */
const SessionAccordion = React.memo(function SessionAccordion({
  group,
  groupIndex: _groupIndex,
  onLongPress,
  defaultExpanded = false,
}: SessionAccordionProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(defaultExpanded);

  /** Chevron 0 → 1 (0° → 180°) */
  const chevronProgress = useSharedValue(defaultExpanded ? 1 : 0);

  const toggle = useCallback(() => {
    hapticSelection();
    setExpanded((prev) => {
      const next = !prev;
      chevronProgress.value = withTiming(next ? 1 : 0, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
      });
      return next;
    });
  }, [chevronProgress]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronProgress.value * 180}deg` }],
  }));

  /* ── Metin ──────────────────────────────────────────────────────────────── */
  const filmCountText =
    group.filmCount === 1
      ? t('watchlist.sessionFilmCountOne')
      : t('watchlist.sessionFilmCount', { count: group.filmCount });

  const headerLabel = group.prompt
    ? t('watchlist.sessionGroup', { prompt: group.prompt })
    : t('watchlist.sessionGroupNoPrompt');

  /* ── 2-sütunlu çiftler ──────────────────────────────────────────────────── */
  const filmPairs = group.films.reduce<
    Array<[typeof group.films[0], typeof group.films[0] | null]>
  >((acc, film, i) => {
    if (i % 2 === 0) {
      acc.push([film, group.films[i + 1] ?? null]);
    }
    return acc;
  }, []);

  /* ── Render ──────────────────────────────────────────────────────────────── */
  return (
    <View style={styles.container}>
      {/* Accordion Header */}
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.75}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={headerLabel}
      >
        {/* Sol — stacked poster önizleme (kapalıyken) veya sparkles ikonu (açıkken) */}
        {expanded ? (
          <View style={styles.headerIconWrap}>
            <Ionicons name="sparkles-outline" size={15} color="#EADBC6" />
          </View>
        ) : (
          <StackedPosters films={group.films} />
        )}

        {/* Orta — başlık (2 satır) + sayı */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel} numberOfLines={2}>
            {headerLabel}
          </Text>
          <Text style={styles.headerMeta}>{filmCountText}</Text>
        </View>

        {/* Sağ — chevron (dönen) */}
        <Animated.View style={[styles.headerChevron, chevronStyle]}>
          <Ionicons name="chevron-down-outline" size={20} color="#A1A1AA" />
        </Animated.View>
      </TouchableOpacity>

      {/* Separator + Body (sadece expanded, FadeInDown animasyonlu) */}
      {expanded && (
        <Animated.View entering={FadeInDown.duration(220).easing(Easing.out(Easing.cubic))}>
          <View style={styles.divider} />
          <View style={styles.body}>
            {filmPairs.map((pair, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.filmRow}>
                <WatchlistCard
                  item={pair[0]}
                  itemIndex={rowIndex * 2}
                  onLongPress={onLongPress}
                />
                {pair[1] ? (
                  <WatchlistCard
                    item={pair[1]}
                    itemIndex={rowIndex * 2 + 1}
                    onLongPress={onLongPress}
                  />
                ) : (
                  <View style={styles.emptySlot} />
                )}
              </View>
            ))}
          </View>
        </Animated.View>
      )}
    </View>
  );
});

export default SessionAccordion;
