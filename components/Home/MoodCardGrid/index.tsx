/**
 * MoodCardGrid — Atmospheric 2-column mood selection grid.
 *
 * Replaces the old Era chips + IMDb chips + Quick Mood pills + Quick Mood grid
 * with a single, visually rich layer of mood cards.
 *
 * All 8 cards are equal size (120px height, half-width) in a clean 4x2 grid.
 * Each card has its own amber-family gradient, emoji glow, and tap → mood submit.
 */
import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import {
  CloudRain,
  Brain,
  Heart,
  Lightning,
  SmileyWink,
  Camera,
  Coffee,
  Drop,
} from 'phosphor-react-native';
import type { IconProps } from 'phosphor-react-native';

import { MoodCardGradients } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';

import { styles, CARD_GAP } from './styles';

// ─── Mood card data ────────────────────────────────────────────────────────

export interface MoodCardDef {
  id: string;
  /** Phosphor icon component for the card */
  Icon: React.ComponentType<IconProps>;
  titleKey: string;
  subtitleKey: string;
  /** i18n key whose translated value is sent as mood search text */
  searchQuery: string;
  gradientKey: string;
}

export const MOOD_CARDS: MoodCardDef[] = [
  {
    id: 'rainy',
    Icon: CloudRain,
    titleKey: 'mood.moodCardRainyTitle',
    subtitleKey: 'mood.moodCardRainySubtitle',
    searchQuery: 'mood.quickRainyPrompt',
    gradientKey: 'rainyDay',
  },
  {
    id: 'mindbending',
    Icon: Brain,
    titleKey: 'mood.moodCardMindTitle',
    subtitleKey: 'mood.moodCardMindSubtitle',
    searchQuery: 'mood.quickDeepPrompt',
    gradientKey: 'mindBending',
  },
  {
    id: 'datenight',
    Icon: Heart,
    titleKey: 'mood.moodCardDateTitle',
    subtitleKey: 'mood.moodCardDateSubtitle',
    searchQuery: 'mood.quickDatePrompt',
    gradientKey: 'dateNight',
  },
  {
    id: 'adrenaline',
    Icon: Lightning,
    titleKey: 'mood.moodCardAdrenalineTitle',
    subtitleKey: 'mood.moodCardAdrenalineSubtitle',
    searchQuery: 'mood.quickThrillPrompt',
    gradientKey: 'adrenaline',
  },
  {
    id: 'laugh',
    Icon: SmileyWink,
    titleKey: 'mood.moodCardLaughTitle',
    subtitleKey: 'mood.moodCardLaughSubtitle',
    searchQuery: 'mood.quickLaughPrompt',
    gradientKey: 'needLaugh',
  },
  {
    id: 'nostalgia',
    Icon: Camera,
    titleKey: 'mood.moodCardNostalgiaTitle',
    subtitleKey: 'mood.moodCardNostalgiaSubtitle',
    searchQuery: 'mood.quickNostalgiaPrompt',
    gradientKey: 'nostalgia',
  },
  {
    id: 'cozy',
    Icon: Coffee,
    titleKey: 'mood.moodCardCozyTitle',
    subtitleKey: 'mood.moodCardCozySubtitle',
    searchQuery: 'mood.quickChillPrompt',
    gradientKey: 'cozyNight',
  },
  {
    id: 'emotional',
    Icon: Drop,
    titleKey: 'mood.moodCardEmotionalTitle',
    subtitleKey: 'mood.moodCardEmotionalSubtitle',
    searchQuery: 'mood.quickCryPrompt',
    gradientKey: 'emotional',
  },
];

// ─── Props ──────────────────────────────────────────────────────────────────

interface MoodCardGridProps {
  /** Currently active mood text — used for visual highlight */
  activeMoodText: string;
  /** Called with the localized search query text when a card is tapped */
  onSelect: (searchQuery: string) => void;
}

// ─── Component ──────────────────────────────────────────────────────────────

/** Uniform 2-column mood card grid (4 rows x 2 columns). */
export default function MoodCardGrid({ activeMoodText, onSelect }: MoodCardGridProps) {
  const { t } = useLanguage();
  const { width: screenWidth } = useWindowDimensions();

  // Half-width cards: (screen - padding*2 - gap) / 2
  const cardWidth = (screenWidth - 40 - CARD_GAP) / 2;

  const handlePress = useCallback(
    (queryKey: string) => {
      hapticLight();
      onSelect(t(queryKey));
    },
    [onSelect, t],
  );

  /** Memoize rendered cards */
  const cards = useMemo(
    () =>
      MOOD_CARDS.map((card) => {
        const grad = MoodCardGradients[card.gradientKey];
        if (!grad) return null;
        const isActive = activeMoodText === t(card.searchQuery);

        return (
          <TouchableOpacity
            key={card.id}
            style={[
              styles.card,
              { width: cardWidth },
              {
                borderWidth: 1.5,
                borderColor: isActive
                  ? grad.accent + '70'
                  : grad.accent + '40',
              },
            ]}
            onPress={() => handlePress(card.searchQuery)}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[...grad.gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardGradient}
            >
              {/* Phosphor icon with glow */}
              <View style={styles.emojiContainer}>
                <View style={[styles.emojiGlow, { backgroundColor: grad.glow }]} />
                <card.Icon size={24} color="#E8A838" weight="duotone" />
              </View>

              {/* Title + Subtitle — bottom-left, never overlaps emoji top-right */}
              <View style={styles.textBlock}>
                <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
                  {t(card.titleKey)}
                </Text>
                <Text style={styles.subtitle} numberOfLines={2}>
                  {t(card.subtitleKey)}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        );
      }),
    [activeMoodText, cardWidth, handlePress, t],
  );

  return (
    <View style={styles.container}>
      <View style={styles.grid}>{cards}</View>
    </View>
  );
}
