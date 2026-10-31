/**
 * MoodLockCard — mood destesinin ücretsiz bölümünün sonundaki kilit kartı (MONEY-1C).
 *
 * Gizli filmlerin posteri/adı/mood metni BURADA YOK: yalnız stilize siluetler (düz
 * View). `skeleton` yetki okunurken aynı yerde kilit yerine iskelet gösterir —
 * kilidin bir kare bile yanlış görünmemesi için.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import SkeletonLoader from '@/components/SkeletonLoader';
import { color, radius, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  variant: 'lock' | 'skeleton';
  visible: number;
  total: number;
  height: number;
  /** Alt gezinme çubuğu payı — içerik üstüne itilir. */
  bottomOffset?: number;
  /** Yalnız ÜSTTEKİ kart etkileşimlidir; alttaki yığın katmanı yalnız çizilir. */
  interactive?: boolean;
  onPressCta: () => void;
}

/** Üç silüet: poster oranında, hafif eğik, birbirinin üstüne binen düz yüzeyler. */
const SILHOUETTES = [
  { rotate: '-7deg', translateX: -64, opacity: 0.5 },
  { rotate: '6deg', translateX: 64, opacity: 0.5 },
  { rotate: '0deg', translateX: 0, opacity: 0.85 },
] as const;

export default function MoodLockCard({
  variant,
  visible,
  total,
  height,
  bottomOffset = 0,
  interactive = true,
  onPressCta,
}: Props) {
  const { t } = useLanguage();

  if (variant === 'skeleton') {
    return (
      <View style={[styles.root, { height }]} pointerEvents="none">
        <SkeletonLoader width="70%" height={height * 0.4} borderRadius={radius.poster} />
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { height, paddingBottom: bottomOffset }]}
      pointerEvents={interactive ? 'auto' : 'none'}
      accessibilityElementsHidden={!interactive}
      importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
    >
      <View style={styles.silhouetteRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {SILHOUETTES.map((s, i) => (
          <View
            key={i}
            style={[
              styles.silhouette,
              { opacity: s.opacity, transform: [{ translateX: s.translateX }, { rotate: s.rotate }] },
            ]}
          />
        ))}
      </View>

      <Text style={styles.title}>{t('moodLock.title')}</Text>
      <Text style={styles.counter}>{t('moodLock.counter', { visible, total })}</Text>

      <TouchableOpacity
        style={styles.cta}
        onPress={onPressCta}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('moodLock.cta', { total })}
        accessibilityHint={t('moodLock.a11yLocked')}
      >
        <Text style={styles.ctaText}>{t('moodLock.cta', { total })}</Text>
      </TouchableOpacity>

      <Text style={styles.keep}>{t('moodLock.keep', { visible })}</Text>
    </View>
  );
}

const SILHOUETTE_W = 120;

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: color.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  silhouetteRow: {
    width: SILHOUETTE_W,
    height: SILHOUETTE_W * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xl,
  },
  silhouette: {
    position: 'absolute',
    width: SILHOUETTE_W,
    height: SILHOUETTE_W * 1.5,
    borderRadius: radius.poster,
    backgroundColor: color.surface.raised,
    borderWidth: 1,
    borderColor: color.surface.border,
  },
  title: {
    ...type['display-m'],
    color: color.text.primary,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  counter: {
    ...type.meta,
    color: color.text.secondary,
    textAlign: 'center',
    marginBottom: space.lg,
  },
  cta: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: space.base,
    borderRadius: radius.pill,
    backgroundColor: color.accent.fill,
    borderWidth: 1,
    borderColor: color.accent.edgeStrong,
    marginBottom: space.md,
  },
  ctaText: {
    ...type['body-strong'],
    color: color.text.primary,
  },
  keep: {
    ...type.caption,
    color: withAlpha(color.text.primary, 0.6),
    textAlign: 'center',
  },
});
