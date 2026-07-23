/**
 * GamesSection — Sinefil oyunlari 2x2 grid.
 *
 * Mevcut oyun listesini gosterir (fadein, imposter, logline, quoted).
 * Tap → /games/[route]
 */

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

// ─── Oyun Tanimlari ───────────────────────────────────────────────────────────

const GAMES = [
  {
    id: 'fadein',
    route: '/games/fadein',
    titleKey: 'games.fadein.title',
    descKey: 'games.fadein.description',
    icon: 'image' as const,
  },
  {
    id: 'imposter',
    route: '/games/imposter',
    titleKey: 'games.imposter.title',
    descKey: 'games.imposter.description',
    icon: 'people' as const,
  },
  {
    id: 'logline',
    route: '/games/logline',
    titleKey: 'games.logline.title',
    descKey: 'games.logline.description',
    icon: 'bulb' as const,
  },
  {
    id: 'quoted',
    route: '/games/quoted',
    titleKey: 'games.quoted.title',
    descKey: 'games.quoted.description',
    icon: 'chatbubble-ellipses' as const,
  },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface GamesSectionProps {
  /** Oyun tiklama analytics callback'i */
  onGamePress?: (gameId: string) => void;
}

// ─── Section ──────────────────────────────────────────────────────────────────

/** Sinefil oyunlari grid section'i */
export default function GamesSection({ onGamePress }: GamesSectionProps) {
  const { t } = useLanguage();
  const router = useRouter();

  const handlePress = (game: (typeof GAMES)[number]) => {
    hapticLight();
    onGamePress?.(game.id);
    router.push(game.route as never);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(500).duration(400).springify()}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('discoverTab.gamesTitle')}</Text>
      </View>

      <View style={styles.grid}>
        {GAMES.map((game) => (
          <TouchableOpacity
            key={game.id}
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => handlePress(game)}
          >
            <Ionicons
              name={game.icon}
              size={24}
              color={Colors.accentPrimary}
              style={styles.cardIcon}
            />
            <Text style={styles.cardTitle} numberOfLines={1}>
              {t(game.titleKey)}
            </Text>
            <Text style={styles.cardDescription} numberOfLines={2}>
              {t(game.descKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}
