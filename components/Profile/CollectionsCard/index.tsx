/**
 * CollectionsCard — Progressive milestone collections display for Profile.
 *
 * Fetches collection progress on mount and renders a compact card
 * with each collection as a row showing icon, name, level badge,
 * progress bar, and count.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import {
  FilmSlate,
  MaskHappy,
  Fire,
  Target,
  CalendarCheck,
  Trophy,
} from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCollectionProgress } from '@/services/gamification';
import type { CollectionProgress } from '@/services/gamification';
import { logger } from '@/utils/logger';

import { styles } from './styles';

// ─── Icon Mapping ─────────────────────────────────────────────────────────────

/** Maps collection icon string to Phosphor component */
const ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  'film-slate': FilmSlate,
  'masks-theater': MaskHappy,
  'fire': Fire,
  'target': Target,
  'calendar-check': CalendarCheck,
  'trophy': Trophy,
};

/**
 * Renders a single collection row.
 */
function CollectionRow({
  item,
  isFirst,
  t,
}: {
  item: CollectionProgress;
  isFirst: boolean;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const IconComponent = ICON_MAP[item.collection.icon] ?? Trophy;
  const isMaxLevel = item.nextLevel === null && item.currentLevel > 0;
  const hasProgress = item.currentLevel > 0 || item.currentCount > 0;

  return (
    <View style={[styles.row, !isFirst && styles.rowBorder]}>
      {/* Icon */}
      <View style={styles.iconContainer}>
        <IconComponent
          size={16}
          weight="duotone"
          color={isMaxLevel ? Colors.accentPrimary : hasProgress ? Colors.gold : Colors.textSecondary}
        />
      </View>

      {/* Name + Level Badge */}
      <View style={styles.nameContainer}>
        <View style={styles.nameLevelRow}>
          <Text style={styles.name} numberOfLines={1}>
            {t(`games.${item.collection.nameKey}`)}
          </Text>
          {item.currentLevel > 0 && (
            <View
              style={[
                styles.levelBadge,
                isMaxLevel ? styles.levelBadgeMax : styles.levelBadgeActive,
              ]}
            >
              <Text
                style={[
                  styles.levelText,
                  isMaxLevel ? styles.levelTextMax : styles.levelTextActive,
                ]}
              >
                {isMaxLevel
                  ? t('games.collections.max_level')
                  : t('games.collections.level', { level: item.currentLevel })}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Progress bar + count */}
      <View style={styles.progressContainer}>
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              isMaxLevel ? styles.progressBarComplete : styles.progressBarActive,
              { width: `${Math.min(item.progressPercent, 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.countText}>
          {item.nextLevel
            ? `${item.currentCount}/${item.nextLevel.threshold}`
            : isMaxLevel
              ? `${item.currentCount}`
              : '0'}
        </Text>
      </View>
    </View>
  );
}

/**
 * CollectionsCard — shows all milestone collections with progress.
 * Returns null if no collection data is available.
 */
export default function CollectionsCard() {
  const { t } = useLanguage();
  const [collections, setCollections] = useState<CollectionProgress[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const data = await getCollectionProgress();
      setCollections(data);
    } catch (err) {
      logger.warn('[CollectionsCard] fetch error:', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Don't render until loaded; render nothing if no collections
  if (!loaded || collections.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {collections.map((item, idx) => (
          <CollectionRow
            key={item.collection.id}
            item={item}
            isFirst={idx === 0}
            t={t}
          />
        ))}
      </View>
    </View>
  );
}
