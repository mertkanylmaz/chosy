/**
 * PlayNextBridge — Cross-game DNA gap visualization + "Play Next" suggestion.
 *
 * Oyun tamamlandıktan sonra, henüz oynanmamış diğer günlük oyunlardan
 * DNA profilini en çok geliştirecek olanı önerir.
 * META_PROGRESSION.md Section 4.1: "One More Game" Hook.
 *
 * Oneri hesabi ve DNA okumasi ortak koda tasindi (utils/gameRecommendation +
 * hooks/useCinemaDna) — eskiden burada kendi kopyasi vardi ve Hub'daki
 * siralamayla farkli sonuc uretebiliyordu.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Lightning } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCinemaDna } from '@/hooks/useCinemaDna';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { trackPlayNextTapped } from '@/utils/gameAnalytics';
import { rankByDnaImpact } from '@/utils/gameRecommendation';

import { styles } from './styles';

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
  dimensionLabel: string;
}

/**
 * Oyun sonrasi "sirada ne oynayayim" koprusu.
 * Onerilecek oyun kalmadiysa null doner.
 */
export function PlayNextBridge({ currentGame }: PlayNextBridgeProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const { dna } = useCinemaDna();
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  /** Bugün oynanmamış oyunlardan DNA profilini en çok geliştirecek olanı bul */
  const findSuggestion = useCallback(async () => {
    try {
      const puzzleDate = new Date().toLocaleDateString('en-CA');

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
      const playedGames: string[] = [currentGame];
      const availableGames: string[] = [];

      for (const p of puzzles) {
        availableGames.push(p.game_id);
        if (completedPuzzleIds.has(p.id)) playedGames.push(p.game_id);
      }

      // Hub ile ayni siralama — tek kaynak
      const best = rankByDnaImpact(dna, playedGames, availableGames)[0];
      if (!best?.primaryDimension) return;

      setSuggestion({
        gameType: best.gameType,
        gameTitle: t(`games.${best.gameType}.title`),
        dimensionLabel: t(`games.dna.${best.primaryDimension}`),
      });
    } catch (err) {
      logger.warn('[PlayNextBridge] Suggestion error:', err);
    }
  }, [currentGame, dna, t]);

  useEffect(() => {
    findSuggestion();
  }, [findSuggestion]);

  if (!suggestion) return null;

  return (
    <Animated.View entering={FadeInUp.delay(600).duration(400)}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        accessibilityRole="button"
        onPress={() => {
          trackPlayNextTapped(currentGame, suggestion.gameType);
          const route = GAME_ROUTES[suggestion.gameType];
          if (route) router.push(route as never);
        }}
      >
        <View style={styles.header}>
          <Lightning size={14} color={Colors.gold} weight="duotone" />
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
