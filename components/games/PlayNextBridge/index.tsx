/**
 * PlayNextBridge — Cross-game DNA gap visualization + "Play Next" suggestion.
 *
 * Oyun tamamlandıktan sonra, henüz oynanmamış diğer günlük oyunlardan
 * DNA profilini en çok geliştirecek olanı önerir.
 * META_PROGRESSION.md Section 4.1: "One More Game" Hook.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Lightning } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { trackPlayNextTapped } from '@/utils/gameAnalytics';

/** Oyun → güçlendirdiği DNA boyutları */
const GAME_DNA_MAP: Record<string, string[]> = {
  cinemetrics: ['knowledge', 'deduction', 'auteur_sense'],
  logline: ['knowledge', 'deduction'],
  fadein: ['visual_sense', 'knowledge'],
  imposter: ['knowledge'],
  quoted: ['knowledge', 'deduction'],
  spotlight: ['knowledge', 'deduction'],
  detective: ['knowledge', 'deduction', 'visual_sense', 'auteur_sense'],
};

/** Oyun → route path */
const GAME_ROUTES: Record<string, string> = {
  cinemetrics: '/games/cinemetrics',
  logline: '/games/logline',
  fadein: '/games/fadein',
  imposter: '/games/imposter',
  quoted: '/games/quoted',
  spotlight: '/games/spotlight',
  detective: '/games/detective',
};

interface PlayNextBridgeProps {
  /** Mevcut oyun tipi (bu oyunu önerme) */
  currentGame: string;
}

interface Suggestion {
  gameType: string;
  gameTitle: string;
  dimension: string;
  dimensionLabel: string;
}

/** DNA boyut display isimleri */
const DIM_LABELS: Record<string, { en: string; tr: string }> = {
  knowledge: { en: 'Knowledge', tr: 'Bilgi' },
  deduction: { en: 'Deduction', tr: 'Çıkarım' },
  visual_sense: { en: 'Visual Sense', tr: 'Görsel Algı' },
  auteur_sense: { en: 'Auteur Sense', tr: 'Yönetmen Duyusu' },
  instinct: { en: 'Instinct', tr: 'İçgüdü' },
  consistency: { en: 'Consistency', tr: 'Tutarlılık' },
};

export function PlayNextBridge({ currentGame }: PlayNextBridgeProps) {
  const { t, language } = useLanguage();
  const router = useRouter();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    findSuggestion();
  }, [currentGame]);

  /** Bugün oynanmamış oyunlardan DNA profilini en çok geliştirecek olanı bul */
  async function findSuggestion() {
    try {
      const puzzleDate = new Date().toLocaleDateString('en-CA');

      // Bugün tamamlanan oyunları bul
      const { data: scores } = await supabase
        .from('game_scores')
        .select('puzzle_id, completed_at')
        .not('completed_at', 'is', null);

      const { data: puzzles } = await supabase
        .from('public_daily_puzzles')
        .select('id, game_id')
        .eq('puzzle_date', puzzleDate);

      if (!puzzles?.length) return;

      // Bugün tamamlanan oyun tipleri
      const completedPuzzleIds = new Set(
        (scores ?? []).map((s: { puzzle_id: string }) => s.puzzle_id),
      );
      const completedGames = new Set<string>();
      const availableGames: string[] = [];

      for (const p of puzzles) {
        if (completedPuzzleIds.has(p.id)) {
          completedGames.add(p.game_id);
        } else if (p.game_id !== currentGame) {
          availableGames.push(p.game_id);
        }
      }
      completedGames.add(currentGame);

      // Oynanmamış oyunlar
      const unplayed = availableGames.filter((g) => !completedGames.has(g));
      if (unplayed.length === 0) return;

      // Kullanıcının DNA profilini çek
      const { data: dna } = await supabase
        .from('cinema_dna')
        .select('knowledge, deduction, visual_sense, auteur_sense, instinct')
        .single();

      // En düşük boyutu bul
      const dims: Record<string, number> = {
        knowledge: dna?.knowledge ?? 50,
        deduction: dna?.deduction ?? 50,
        visual_sense: dna?.visual_sense ?? 50,
        auteur_sense: dna?.auteur_sense ?? 50,
        instinct: dna?.instinct ?? 50,
      };

      // Her oynanmamış oyun için "potansiyel impact" hesapla
      let bestGame = unplayed[0];
      let bestDim = '';
      let bestScore = -1;

      for (const game of unplayed) {
        const gameDims = GAME_DNA_MAP[game] ?? [];
        for (const dim of gameDims) {
          // Düşük boyut → yüksek impact potansiyeli
          const gap = 100 - (dims[dim] ?? 50);
          if (gap > bestScore) {
            bestScore = gap;
            bestGame = game;
            bestDim = dim;
          }
        }
      }

      if (!bestDim) return;

      const gameKey = `games.${bestGame}.title`;
      const dimLabel = DIM_LABELS[bestDim];

      setSuggestion({
        gameType: bestGame,
        gameTitle: t(gameKey),
        dimension: bestDim,
        dimensionLabel: dimLabel?.[language] ?? bestDim,
      });
    } catch (err) {
      logger.warn('[PlayNextBridge] Suggestion error:', err);
    }
  }

  if (!suggestion) return null;

  return (
    <Animated.View entering={FadeInUp.delay(600).duration(400)}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => {
          trackPlayNextTapped(currentGame, suggestion.gameType);
          const route = GAME_ROUTES[suggestion.gameType];
          if (route) router.push(route as never);
        }}
      >
        <View style={styles.header}>
          <Lightning size={16} color={Colors.gold} weight="duotone" />
          <Text style={styles.headerText}>{t('games.play_next.title')}</Text>
        </View>
        <Text style={styles.suggestion}>
          {t('games.play_next.suggestion', {
            game: suggestion.gameTitle,
            dimension: suggestion.dimensionLabel,
          })}
        </Text>
        <View style={styles.playButton}>
          <Text style={styles.playButtonText}>
            {t('games.play_next.button', { game: suggestion.gameTitle })}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(218,165,32,0.2)',
    gap: Theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestion: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  playButton: {
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.sm,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    alignSelf: 'flex-start',
  },
  playButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.gold,
  },
});
