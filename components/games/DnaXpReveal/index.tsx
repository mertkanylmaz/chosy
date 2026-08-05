/**
 * DnaXpReveal — Animated XP badge + DNA dimension progress + rank proximity.
 *
 * Shown after game completion on all game types.
 * Staggered entrance: XP at 200ms, DNA at 400ms, each dimension +100ms.
 * Before/after bars animate when dimension_progress is available.
 * Rank proximity message shows distance to next rank.
 */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Star, Dna, ArrowUp, Trophy } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import type { DimensionProgress, RankProgress } from '@/types/game';
import { styles } from './styles';

/** DNA dimension signal with display info */
export interface DnaSignal {
  /** Dimension key (e.g. 'knowledge', 'deduction', 'visual_sense') */
  dimension: string;
  /** Signal strength delta */
  delta: number;
}

interface DnaXpRevealProps {
  /** XP earned for this game */
  xpAwarded: number;
  /** Whether Cinema DNA was updated */
  dnaUpdated: boolean;
  /** Optional: specific dimension changes to show */
  dnaSignals?: DnaSignal[];
  /** Whether the puzzle was solved */
  solved: boolean;
  /** Before/after dimension values (from server) */
  dimensionProgress?: DimensionProgress[];
  /** Rank proximity info (from server) */
  rankProgress?: RankProgress;
}

/** Map dimension keys to localized display names */
const DIMENSION_LABELS: Record<string, { en: string; tr: string }> = {
  knowledge: { en: 'Knowledge', tr: 'Bilgi' },
  deduction: { en: 'Deduction', tr: 'Cikarim' },
  visual_sense: { en: 'Visual Sense', tr: 'Gorsel Algi' },
  auteur_sense: { en: 'Auteur Sense', tr: 'Yonetmen Duyusu' },
  instinct: { en: 'Instinct', tr: 'Icgudu' },
  consistency: { en: 'Consistency', tr: 'Tutarlilik' },
};

/** Animated progress bar for a single dimension */
function DimensionBar({
  dimension,
  valueBefore,
  valueAfter,
  delay,
  language,
}: {
  dimension: string;
  valueBefore: number;
  valueAfter: number;
  delay: number;
  language: string;
}) {
  const barWidth = useSharedValue(valueBefore);

  useEffect(() => {
    barWidth.value = withDelay(delay + 300, withTiming(valueAfter, { duration: 600 }));
  }, [valueAfter, delay]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.min(barWidth.value, 100)}%`,
  }));

  const label = DIMENSION_LABELS[dimension]?.[language === 'tr' ? 'tr' : 'en'] ?? dimension;
  const delta = valueAfter - valueBefore;

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(300)} style={styles.dimRow}>
      <View style={styles.dimLabelRow}>
        <Text style={styles.dimLabel}>{label}</Text>
        <Text style={styles.dimValue}>
          {Math.round(valueAfter)}
          {delta > 0 && (
            <Text style={styles.dimDelta}> +{delta.toFixed(1)}</Text>
          )}
        </Text>
      </View>
      <View style={styles.barBg}>
        <Animated.View style={[styles.barFill, barStyle]} />
        {/* Before marker */}
        <View style={[styles.barMarker, { left: `${Math.min(valueBefore, 100)}%` }]} />
      </View>
    </Animated.View>
  );
}

/**
 * DnaXpReveal — Oyun tamamlandiktan sonra XP, DNA degisimleri ve rank ilerlemesini gosterir.
 */
export function DnaXpReveal({
  xpAwarded,
  dnaUpdated,
  dnaSignals,
  solved,
  dimensionProgress,
  rankProgress,
}: DnaXpRevealProps) {
  const { t, language } = useLanguage();

  if (xpAwarded <= 0 && !dnaUpdated) return null;

  const hasBars = dimensionProgress && dimensionProgress.length > 0;
  const hasRank = rankProgress != null;

  return (
    <View style={styles.container}>
      {/* XP Badge */}
      {xpAwarded > 0 && (
        <Animated.View entering={FadeInUp.delay(200).duration(300)} style={styles.xpChip}>
          <Star size={16} color={Colors.gold} weight="duotone" />
          <Text style={styles.xpText}>+{xpAwarded} XP</Text>
        </Animated.View>
      )}

      {/* DNA Dimension Bars (when server sends before/after) */}
      {hasBars ? (
        <View style={styles.barsContainer}>
          {dimensionProgress.map((dp, idx) => (
            <DimensionBar
              key={dp.dimension}
              dimension={dp.dimension}
              valueBefore={dp.value_before}
              valueAfter={dp.value_after}
              delay={400 + idx * 120}
              language={language}
            />
          ))}
        </View>
      ) : dnaUpdated && dnaSignals && dnaSignals.length > 0 ? (
        /* Fallback: chip-based signals when no bar data */
        dnaSignals.map((signal, idx) => (
          <Animated.View
            key={signal.dimension}
            entering={FadeInUp.delay(400 + idx * 100).duration(300)}
            style={styles.dnaChip}
          >
            <View style={styles.dnaSignalRow}>
              <Dna size={14} color={Colors.gold} weight="duotone" />
              <Text style={styles.dnaText}>
                {DIMENSION_LABELS[signal.dimension]?.[language === 'tr' ? 'tr' : 'en'] ?? signal.dimension}
              </Text>
              {/* Ödül katmanı: tema DEĞİL. Hardcoded #4ade80 idi — aynı değer,
                  artık token üzerinden (repodaki tek Colors-dışı hex'ti). */}
              <ArrowUp size={12} color={Colors.greenSoft} weight="bold" />
              <Text style={styles.dnaDelta}>
                +{Math.round(signal.delta * 10)}
              </Text>
            </View>
          </Animated.View>
        ))
      ) : dnaUpdated ? (
        <Animated.View entering={FadeInUp.delay(400).duration(300)} style={styles.dnaChip}>
          <Dna size={14} color={Colors.gold} weight="duotone" />
          <Text style={styles.dnaText}>
            {solved ? t('games.dna_updated') : t('games.dna_consistency')}
          </Text>
        </Animated.View>
      ) : null}

      {/* Rank Progress */}
      {hasRank && (
        <Animated.View
          entering={FadeInUp.delay(hasBars ? 400 + dimensionProgress!.length * 120 + 200 : 600).duration(300)}
          style={[
            styles.rankChip,
            rankProgress.rank_changed && styles.rankChipCelebrate,
          ]}
        >
          <Trophy
            size={16}
            color={rankProgress.rank_changed ? Colors.gold : Colors.textSecondary}
            weight="duotone"
          />
          {rankProgress.rank_changed ? (
            <Text style={styles.rankTextCelebrate}>
              {language === 'tr' ? 'Yeni Rank: ' : 'New Rank: '}
              {rankProgress.current_rank_name}!
            </Text>
          ) : rankProgress.next_rank_threshold != null ? (
            <Text style={styles.rankText}>
              {Math.ceil(rankProgress.next_rank_threshold - rankProgress.cinema_score)}{' '}
              {language === 'tr' ? 'puan — ' : 'pts to '}
              {rankProgress.next_rank_name}
            </Text>
          ) : (
            <Text style={styles.rankText}>{rankProgress.current_rank_name}</Text>
          )}
        </Animated.View>
      )}
    </View>
  );
}
