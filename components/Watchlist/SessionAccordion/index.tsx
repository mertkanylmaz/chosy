/**
 * SessionAccordion — Mood session bazlı watchlist grubu.
 *
 * Header: sparkles ikonu + mood prompt özeti + film sayısı + chevron
 * Body: 2-sütunlu WatchlistCard grid'i (expand/collapse animasyonlu)
 *
 * defaultExpanded=true olan grup (genellikle ilk grup) açık başlar.
 */
import React, { useCallback, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { WatchlistGroup } from '@/services/watchlist';
import { useLanguage } from '@/contexts/LanguageContext';

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Prompt metni uzunsa kısaltır */
function truncatePrompt(prompt: string, maxLen = 50): string {
  if (prompt.length <= maxLen) return prompt;
  return prompt.slice(0, maxLen).trimEnd() + '…';
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
    ? t('watchlist.sessionGroup', { prompt: truncatePrompt(group.prompt) })
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
        {/* Sol ikon */}
        <View style={styles.headerIconWrap}>
          <Ionicons name="sparkles-outline" size={15} color="#8B5CF6" />
        </View>

        {/* Orta — başlık + sayı */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerLabel} numberOfLines={1}>
            {headerLabel}
          </Text>
          <Text style={styles.headerMeta}>{filmCountText}</Text>
        </View>

        {/* Sağ — chevron (dönen) */}
        <Animated.View style={[styles.headerChevron, chevronStyle]}>
          <Ionicons name="chevron-down-outline" size={20} color="#A1A1AA" />
        </Animated.View>
      </TouchableOpacity>

      {/* Separator + Body (sadece expanded) */}
      {expanded && (
        <>
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
        </>
      )}
    </View>
  );
});

export default SessionAccordion;
