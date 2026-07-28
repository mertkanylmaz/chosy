/**
 * RecommendedRoute — Suggests up to 3 unplayed games sorted by DNA impact.
 *
 * Calculates which unplayed games would most improve the user's weakest
 * Cinema DNA dimensions and shows them as a horizontal scroll of cards.
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  ChartBar,
  Pencil,
  Image,
  Users,
  ChatCircle,
  Flashlight,
  MagnifyingGlass,
} from 'phosphor-react-native';
import type { IconWeight } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { hapticLight } from '@/utils/haptics';
import { trackRecommendedRouteTapped } from '@/utils/gameAnalytics';

import { styles } from './styles';

/** Game type to DNA dimensions mapping */
const GAME_DNA_MAP: Record<string, string[]> = {
  cinemetrics: ['knowledge', 'deduction', 'auteur_sense'],
  logline: ['knowledge', 'deduction'],
  fadein: ['visual_sense', 'knowledge'],
  imposter: ['knowledge'],
  quoted: ['knowledge', 'deduction'],
  spotlight: ['knowledge', 'deduction'],
  detective: ['knowledge', 'deduction', 'visual_sense', 'auteur_sense'],
};

/** Game type to route path */
const GAME_ROUTES: Record<string, string> = {
  cinemetrics: '/games/cinemetrics',
  logline: '/games/logline',
  fadein: '/games/fadein',
  imposter: '/games/imposter',
  quoted: '/games/quoted',
  spotlight: '/games/spotlight',
  detective: '/games/detective',
};

/** Game title i18n keys */
const GAME_TITLES: Record<string, string> = {
  cinemetrics: 'games.cinemetrics.title',
  logline: 'games.logline.title',
  fadein: 'games.fadein.title',
  imposter: 'games.imposter.title',
  quoted: 'games.quoted.title',
  spotlight: 'games.spotlight.title',
  detective: 'games.detective.title',
};

/** Estimated XP per game (for display) */
const GAME_XP: Record<string, number> = {
  cinemetrics: 25,
  logline: 20,
  fadein: 15,
  imposter: 15,
  quoted: 20,
  spotlight: 25,
  detective: 30,
};

/** Phosphor icon per game type */
const GAME_ICONS: Record<string, React.ComponentType<{ size: number; color: string; weight: IconWeight }>> = {
  cinemetrics: ChartBar,
  logline: Pencil,
  fadein: Image,
  imposter: Users,
  quoted: ChatCircle,
  spotlight: Flashlight,
  detective: MagnifyingGlass,
};

/** Dimension display labels */
const DIM_LABELS: Record<string, { en: string; tr: string }> = {
  knowledge: { en: 'Knowledge', tr: 'Bilgi' },
  deduction: { en: 'Deduction', tr: '\u00c7\u0131kar\u0131m' },
  auteur_sense: { en: 'Auteur Sense', tr: 'Y\u00f6netmen Duyusu' },
  instinct: { en: 'Instinct', tr: '\u0130\u00e7g\u00fcd\u00fc' },
  consistency: { en: 'Consistency', tr: 'Tutarl\u0131l\u0131k' },
  visual_sense: { en: 'Visual Sense', tr: 'G\u00f6rsel Alg\u0131' },
};

interface Recommendation {
  gameType: string;
  impactScore: number;
  primaryDimension: string;
}

interface RecommendedRouteProps {
  /** Already played game types (to exclude) */
  playedGames: string[];
}

/**
 * RecommendedRoute shows top 3 unplayed games by DNA impact as
 * a horizontal scroll of compact cards.
 */
export function RecommendedRoute({ playedGames }: RecommendedRouteProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  useEffect(() => {
    computeRecommendations();
  }, [playedGames]);

  /** Fetch DNA and calculate impact scores for unplayed games */
  async function computeRecommendations() {
    try {
      const { data: dna } = await supabase
        .from('cinema_dna')
        .select('knowledge, deduction, auteur_sense, instinct, consistency, visual_sense')
        .single();

      const dims: Record<string, number> = {
        knowledge: dna?.knowledge ?? 50,
        deduction: dna?.deduction ?? 50,
        auteur_sense: dna?.auteur_sense ?? 50,
        instinct: dna?.instinct ?? 50,
        consistency: dna?.consistency ?? 50,
        visual_sense: dna?.visual_sense ?? 50,
      };

      const playedSet = new Set(playedGames);
      const allGames = Object.keys(GAME_DNA_MAP);
      const unplayed = allGames.filter((g) => !playedSet.has(g));

      if (unplayed.length === 0) return;

      const scored: Recommendation[] = unplayed.map((gameType) => {
        const gameDims = GAME_DNA_MAP[gameType] ?? [];
        let totalImpact = 0;
        let bestDim = '';
        let bestGap = -1;

        for (const dim of gameDims) {
          const gap = 100 - (dims[dim] ?? 50);
          totalImpact += gap;
          if (gap > bestGap) {
            bestGap = gap;
            bestDim = dim;
          }
        }

        return {
          gameType,
          impactScore: totalImpact,
          primaryDimension: bestDim,
        };
      });

      scored.sort((a, b) => b.impactScore - a.impactScore);
      setRecommendations(scored.slice(0, 3));
    } catch (err) {
      logger.warn('[RecommendedRoute] Compute error:', err);
    }
  }

  if (recommendations.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(150).duration(300)} style={styles.container}>
      <Text style={styles.sectionLabel}>
        {language === 'tr' ? '\u00d6nerilen Rota' : 'Recommended Route'}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {recommendations.map((rec, index) => {
          const IconComponent = GAME_ICONS[rec.gameType];
          const isHighest = index === 0;
          const dimLabel = DIM_LABELS[rec.primaryDimension]?.[language] ?? rec.primaryDimension;
          const xp = GAME_XP[rec.gameType] ?? 15;

          return (
            <TouchableOpacity
              key={rec.gameType}
              style={[styles.card, isHighest && styles.cardHighlight]}
              activeOpacity={0.7}
              onPress={() => {
                hapticLight();
                trackRecommendedRouteTapped(rec.gameType);
                const route = GAME_ROUTES[rec.gameType];
                if (route) router.push(route as never);
              }}
            >
              <View style={styles.iconRow}>
                <View style={styles.iconCircle}>
                  {IconComponent ? (
                    <IconComponent size={18} color={Colors.accentPrimary} weight="duotone" />
                  ) : null}
                </View>
                <View style={styles.xpBadge}>
                  <Text style={styles.xpText}>+{xp} XP</Text>
                </View>
              </View>
              <Text style={styles.gameName} numberOfLines={1}>
                {t(GAME_TITLES[rec.gameType] ?? '')}
              </Text>
              <Text style={styles.dimensionHint} numberOfLines={1}>
                {dimLabel}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
