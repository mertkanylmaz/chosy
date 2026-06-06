/**
 * ArchetypeShareCard — Arketip reveal paylasim template'i (1080x1350 PNG).
 *
 * "I'm a [Archetype]" + icon + renk tema + Chosy.ai branding.
 * Instagram story / WhatsApp / Twitter paylasimi icin tasarlandi.
 */
import React, { forwardRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@/constants/Colors';
import { i18n } from '@/constants/i18n';
import { getArchetype } from '@/constants/archetypes';
import { CARD_WIDTH, CARD_HEIGHT } from './styles';

export interface ArchetypeShareCardProps {
  /** 1-12 arketip ID veya null (Mystery) */
  archetypeId: number | null;
}

/**
 * Offscreen render edilen share card — useShareCapture ile capture edilir.
 * 360x450 RN boyutu → 3x scale → 1080x1350 PNG.
 */
const ArchetypeShareCard = forwardRef<View, ArchetypeShareCardProps>(
  ({ archetypeId }, ref) => {
    const archetype = archetypeId !== null ? getArchetype(archetypeId) : null;
    const colorPrimary = archetype?.colorPrimary ?? Colors.accentPrimary;
    const colorDim = archetype?.colorDim ?? Colors.accentDim;
    const name = archetype
      ? i18n.t(archetype.nameKey)
      : i18n.t('onboarding.mysteryType');
    const desc = archetype
      ? i18n.t(archetype.descKey)
      : i18n.t('onboarding.mysteryDesc');

    return (
      <View ref={ref} style={cardStyles.card}>
        <LinearGradient
          colors={[Colors.background, colorDim as string, Colors.background]}
          locations={[0, 0.45, 1]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Decorative particles */}
        <Text style={[cardStyles.particle, { top: 30, left: 40, color: colorPrimary }]}>✦</Text>
        <Text style={[cardStyles.particle, { top: 60, right: 50, color: colorPrimary, opacity: 0.5 }]}>✧</Text>
        <Text style={[cardStyles.particle, { bottom: 100, left: 30, color: colorPrimary, opacity: 0.4 }]}>·</Text>
        <Text style={[cardStyles.particle, { bottom: 80, right: 40, color: colorPrimary, opacity: 0.6 }]}>✦</Text>

        {/* Header label */}
        <Text style={cardStyles.headerLabel}>
          {i18n.t('share.archetypeLabel')}
        </Text>

        {/* Center content */}
        <View style={cardStyles.center}>
          {/* Glow ring */}
          <View style={[cardStyles.glowRing, { borderColor: `${colorPrimary}4D` }]} />

          {/* Icon circle */}
          <View style={[cardStyles.iconCircle, { borderColor: colorPrimary, backgroundColor: colorDim as string }]}>
            {archetype ? (
              <Image
                source={archetype.image}
                style={cardStyles.iconImage}
                contentFit="contain"
              />
            ) : (
              <Text style={cardStyles.iconFallback}>✦</Text>
            )}
          </View>

          {/* Name */}
          <Text style={[cardStyles.name, { color: colorPrimary }]}>{name}</Text>

          {/* Description */}
          <Text style={cardStyles.desc} numberOfLines={3}>{desc}</Text>
        </View>

        {/* Footer — branding */}
        <View style={cardStyles.footer}>
          <Text style={cardStyles.brand}>Chosy.ai</Text>
          <Text style={cardStyles.tagline}>
            {i18n.t('share.archetypeTagline')}
          </Text>
        </View>
      </View>
    );
  },
);

ArchetypeShareCard.displayName = 'ArchetypeShareCard';
export default ArchetypeShareCard;

// ── Styles ────────────────────────────────────────────────────────────────────

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: Colors.background,
    borderRadius: 24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },

  particle: {
    position: 'absolute',
    fontSize: 14,
  },

  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  center: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },

  glowRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
  },

  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  iconImage: {
    width: 64,
    height: 64,
  },

  iconFallback: {
    fontSize: 48,
  },

  name: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 8,
  },

  desc: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 20,
  },

  footer: {
    alignItems: 'center',
    gap: 2,
  },

  brand: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: Colors.accentPrimary,
  },

  tagline: {
    fontSize: 11,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
  },
});
