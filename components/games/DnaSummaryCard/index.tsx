/**
 * DnaSummaryCard — Cinema DNA overview for the Games Hub.
 *
 * Fetches user's cinema_dna on mount and renders rank, score, and
 * 6 dimension bars. Returns null if no DNA data exists (new user).
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Dna } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { trackHubDnaCardViewed } from '@/utils/gameAnalytics';

import { styles } from './styles';

/** Rank ID to display name mapping */
const RANK_NAMES: Record<number, { en: string; tr: string }> = {
  1: { en: 'Movie Lover', tr: 'Film Sever' },
  2: { en: 'Film Explorer', tr: 'Film K\u00e2\u015fifi' },
  3: { en: 'Cinema Apprentice', tr: 'Sinema \u00c7\u0131ra\u011f\u0131' },
  4: { en: 'Film Scholar', tr: 'Film Bilgini' },
  5: { en: 'Cinephile', tr: 'Sinefil' },
  6: { en: 'Cinema Master', tr: 'Sinema Ustas\u0131' },
};

/** Dimension keys in display order */
const DIMENSIONS = [
  'knowledge',
  'deduction',
  'auteur_sense',
  'instinct',
  'consistency',
  'visual_sense',
] as const;

type DimensionKey = typeof DIMENSIONS[number];

/** Dimension display labels */
const DIM_LABELS: Record<DimensionKey, { en: string; tr: string }> = {
  knowledge: { en: 'Knowledge', tr: 'Bilgi' },
  deduction: { en: 'Deduction', tr: '\u00c7\u0131kar\u0131m' },
  auteur_sense: { en: 'Auteur Sense', tr: 'Y\u00f6netmen Duyusu' },
  instinct: { en: 'Instinct', tr: '\u0130\u00e7g\u00fcd\u00fc' },
  consistency: { en: 'Consistency', tr: 'Tutarl\u0131l\u0131k' },
  visual_sense: { en: 'Visual Sense', tr: 'G\u00f6rsel Alg\u0131' },
};

interface DnaData {
  knowledge: number;
  deduction: number;
  auteur_sense: number;
  instinct: number;
  consistency: number;
  visual_sense: number;
  cinema_score: number;
  rank_id: number;
  identity_title: string | null;
}

/**
 * DnaSummaryCard renders the user's Cinema DNA profile in the Games Hub.
 * Self-contained: fetches data on mount, returns null if none exists.
 */
export function DnaSummaryCard() {
  const { language } = useLanguage();
  const [dna, setDna] = useState<DnaData | null>(null);

  useEffect(() => {
    fetchDna();
    trackHubDnaCardViewed();
  }, []);

  /** Fetch cinema_dna from Supabase */
  async function fetchDna() {
    try {
      const { data, error } = await supabase
        .from('cinema_dna')
        .select('knowledge, deduction, auteur_sense, instinct, consistency, visual_sense, cinema_score, rank_id, identity_title')
        .single();

      if (error || !data) {
        logger.log('[DnaSummaryCard] No DNA data found');
        return;
      }

      setDna(data as DnaData);
    } catch (err) {
      logger.warn('[DnaSummaryCard] Fetch error:', err);
    }
  }

  if (!dna) return null;

  const rankName = RANK_NAMES[dna.rank_id]?.[language] ?? RANK_NAMES[1][language];

  return (
    <Animated.View entering={FadeInUp.duration(300)}>
      <View style={styles.card}>
        {/* Header: rank + score */}
        <View style={styles.headerRow}>
          <View style={styles.rankInfo}>
            <Text style={styles.rankName}>
              <Dna size={14} color={Colors.gold} weight="duotone" />{' '}
              {rankName}
            </Text>
            {dna.identity_title ? (
              <Text style={styles.identityTitle} numberOfLines={1}>
                {dna.identity_title}
              </Text>
            ) : null}
          </View>
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreNumber}>{Math.round(dna.cinema_score)}</Text>
            <Text style={styles.scoreLabel}>Score</Text>
          </View>
        </View>

        {/* Dimension bars */}
        <View style={styles.dimensionsContainer}>
          {DIMENSIONS.map((dim) => {
            const value = Math.round(dna[dim] ?? 0);
            const isComingSoon = dim === 'visual_sense' && value === 0;
            const label = DIM_LABELS[dim][language];

            return (
              <View key={dim} style={styles.dimensionRow}>
                <Text style={styles.dimensionLabel}>{label}</Text>
                <View style={styles.barTrack}>
                  {!isComingSoon && (
                    <View
                      style={[
                        styles.barFill,
                        { width: `${Math.min(value, 100)}%` },
                      ]}
                    />
                  )}
                  {isComingSoon && (
                    <View style={styles.comingSoonOverlay}>
                      <Text style={styles.comingSoonText}>
                        {language === 'tr' ? 'Yak\u0131nda' : 'Coming Soon'}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={styles.dimensionValue}>
                  {isComingSoon ? '--' : value}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}
