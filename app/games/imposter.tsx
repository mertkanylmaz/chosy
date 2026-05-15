/**
 * Imposter (Kim Yok?) — Tek hak oyunu.
 *
 * Film afişi + 4 oyuncu ismi gösterilir.
 * Kullanıcı filmde OLMAYAN oyuncuyu seçer.
 * Tek hak — yanlış seçim = oyun biter.
 */
import React, { useCallback, useState } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  FadeInUp,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticWarning, hapticSuccess } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getPosterUrl } from '@/services/tmdb';
import {
  fetchDailyPuzzle,
  submitGameScore,
  getGameStreak,
  getCachedResult,
  getFilmAnswer,
  getTodayDate,
} from '@/services/gameService';
import type { GameState, ImposterOption, GameResult } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { ResultCard } from '@/components/games/ResultCard';

const { width: SCREEN_W } = Dimensions.get('window');
/** Poster genisligi — ekranin %55'i, 2:3 aspect ratio */
const POSTER_W = SCREEN_W * 0.55;
const POSTER_H = POSTER_W * 1.5;

export default function ImposterScreen() {
  const { t } = useLanguage();

  // State
  const [gameState, setGameState] = useState<GameState>('loading');
  const [options, setOptions] = useState<ImposterOption[]>([]);
  const [filmPoster, setFilmPoster] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [filmInfo, setFilmInfo] = useState<{
    title: string;
    year: number;
    posterPath: string | null;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [loadError, setLoadError] = useState(false);

  // Flash animation
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  // Her focus'ta tarih kontrolü — yeni gün = yeni puzzle
  useFocusEffect(
    useCallback(() => {
      // State reset (ekran stack'te kalmışsa eski veriyi temizle)
      setGameState('loading');
      setOptions([]);
      setFilmPoster(null);
      setSelectedId(null);
      setResult(null);
      setFilmInfo(null);
      setLoadError(false);
      loadPuzzle();
    }, []),
  );

  const loadPuzzle = useCallback(async () => {
    try {
      // Bugün oynanmış mı?
      const cached = await getCachedResult('imposter');
      if (cached) {
        const film = await getFilmAnswer(cached.filmId);
        const streakInfo = await getGameStreak('imposter');
        setResult(cached);
        setFilmInfo(film);
        setStreak(streakInfo.currentStreak);
        setGameState('complete');
        return;
      }

      const puzzle = await fetchDailyPuzzle('imposter');
      if (!puzzle) {
        logger.error('[imposter] Puzzle yüklenemedi');
        setLoadError(true);
        return;
      }

      // Poster
      const film = await getFilmAnswer(puzzle.filmId);
      if (film?.posterPath) {
        setFilmPoster(getPosterUrl(film.posterPath, 'w500'));
      }
      setFilmInfo(film);

      // Options
      const clue = puzzle.clues[0];
      if (clue) {
        const parsed = JSON.parse(clue.content) as ImposterOption[];
        setOptions(parsed);
      }

      setGameState('playing');
    } catch (err) {
      logger.error('[imposter] Load hatası:', err);
      setLoadError(true);
    }
  }, []);

  const handleSelect = useCallback(
    async (option: ImposterOption) => {
      if (gameState !== 'playing' || selectedId !== null) return;
      setSelectedId(option.id);

      const solved = option.isImposter;
      const today = getTodayDate();

      if (solved) {
        hapticSuccess();
      } else {
        hapticWarning();
        // Kırmızı flash
        flashOpacity.value = withSequence(
          withTiming(0.4, { duration: 150 }),
          withTiming(0, { duration: 300 }),
        );
      }

      setGameState('reveal');

      // Kısa gecikme — animasyon görsün
      await new Promise((r) => setTimeout(r, 800));

      const puzzle = await fetchDailyPuzzle('imposter');
      const gameResult: GameResult = {
        puzzleId: puzzle?.id ?? `local_${today}_imposter`,
        date: today,
        gameType: 'imposter',
        solved,
        attempts: 1,
        maxAttempts: 1,
        filmId: puzzle?.filmId ?? 0,
      };

      await submitGameScore(gameResult);
      const streakInfo = await getGameStreak('imposter');

      setResult(gameResult);
      setStreak(streakInfo.currentStreak);
      setGameState('complete');
    },
    [gameState, selectedId, flashOpacity],
  );

  const getButtonStyle = useCallback(
    (option: ImposterOption) => {
      if (selectedId === null) return styles.optionDefault;
      if (option.isImposter) return styles.optionCorrect;
      if (option.id === selectedId) return styles.optionWrong;
      return styles.optionDefault;
    },
    [selectedId],
  );

  // Error
  if (loadError) {
    return (
      <GameShell title={t('games.imposter.title')} currentAttempt={0} maxAttempts={1}>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>🎬</Text>
          <Text style={styles.errorText}>{t('games.result.error_title')}</Text>
          <Text style={styles.errorSubtext}>{t('games.result.error_subtitle')}</Text>
        </View>
      </GameShell>
    );
  }

  // Loading
  if (gameState === 'loading') {
    return (
      <GameShell title={t('games.imposter.title')} currentAttempt={0} maxAttempts={1}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t('games.result.loading')}</Text>
        </View>
      </GameShell>
    );
  }

  // Complete
  if (gameState === 'complete' && result && filmInfo) {
    return (
      <GameShell
        title={t('games.imposter.title')}
        currentAttempt={1}
        maxAttempts={1}
        hideProgress
      >
        <View style={styles.resultContainer}>
          <ResultCard
            solved={result.solved}
            attempts={result.attempts}
            maxAttempts={result.maxAttempts}
            filmTitle={filmInfo.title}
            filmYear={filmInfo.year}
            filmPosterPath={filmInfo.posterPath}
            filmId={result.filmId}
            streak={streak}
            gameTitle={t('games.imposter.title')}
            gameType="imposter"
          />
        </View>
      </GameShell>
    );
  }

  // Playing / Reveal
  return (
    <GameShell
      title={t('games.imposter.title')}
      currentAttempt={selectedId !== null ? 1 : 0}
      maxAttempts={1}
    >
      {/* Flash overlay */}
      <Animated.View style={[styles.flashOverlay, flashStyle]} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Poster — 2:3 oranında, ortalanmış */}
        <View style={styles.posterContainer}>
          {filmPoster && (
            <Image
              source={{ uri: filmPoster }}
              style={styles.poster}
              contentFit="cover"
              transition={300}
            />
          )}
        </View>

        {/* Question */}
        <Text style={styles.question}>{t('games.imposter.question')}</Text>

        {/* Options — 2x2 grid */}
        <Animated.View entering={FadeInUp.delay(200).duration(300)} style={styles.optionsGrid}>
          {options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[styles.optionButton, getButtonStyle(option)]}
              onPress={() => handleSelect(option)}
              disabled={gameState !== 'playing'}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.optionText,
                  selectedId !== null && option.isImposter && styles.optionTextCorrect,
                  selectedId === option.id && !option.isImposter && styles.optionTextWrong,
                ]}
                numberOfLines={1}
              >
                {option.name}
              </Text>
              {option.character ? (
                <Text
                  style={[
                    styles.optionCharacter,
                    selectedId !== null && option.isImposter && styles.optionTextCorrect,
                    selectedId === option.id && !option.isImposter && styles.optionTextWrong,
                  ]}
                  numberOfLines={1}
                >
                  {`as "${option.character}"`}
                </Text>
              ) : null}
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: Theme.spacing.md,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    marginBottom: Theme.spacing.sm,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Theme.spacing.xl,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.error,
    zIndex: 100,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: Theme.spacing.md,
  },
  posterContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: Theme.borderRadius.lg,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
    width: SCREEN_W - Theme.spacing.md * 2,
  },
  optionButton: {
    width: (SCREEN_W - Theme.spacing.md * 2 - Theme.spacing.sm) / 2,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  optionDefault: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  optionCorrect: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: Colors.success,
  },
  optionWrong: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: Colors.error,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  optionCharacter: {
    fontSize: 11,
    fontStyle: 'italic',
    color: Colors.textGrey,
    textAlign: 'center',
    marginTop: 2,
  },
  optionTextCorrect: {
    color: Colors.success,
  },
  optionTextWrong: {
    color: Colors.error,
  },
});
