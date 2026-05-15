/**
 * 5 İpucu (Pinpoint) — Tümdengelim oyunu.
 *
 * 5 ipucu soyuttan somuta açılır.
 * Her yanlış tahminde sonraki ipucu açılır.
 * İlk ipucunda bilen = "Kusursuz Tahmin" rozeti.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import {
  fetchDailyPuzzle,
  submitGameScore,
  getGameStreak,
  getCachedResult,
  getFilmAnswer,
  getTodayDate,
} from '@/services/gameService';
import type { GameState, GameClue, GameResult, FilmSearchResult } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { ResultCard } from '@/components/games/ResultCard';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';

export default function PinpointScreen() {
  const { t } = useLanguage();

  const [gameState, setGameState] = useState<GameState>('loading');
  const [clues, setClues] = useState<GameClue[]>([]);
  const [revealedCount, setRevealedCount] = useState(1); // İlk ipucu açık başlar
  const [attempts, setAttempts] = useState(0);
  const [puzzleFilmId, setPuzzleFilmId] = useState(0);
  const [puzzleId, setPuzzleId] = useState('');
  const [result, setResult] = useState<GameResult | null>(null);
  const [filmInfo, setFilmInfo] = useState<{
    title: string;
    year: number;
    posterPath: string | null;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [wrongGuess, setWrongGuess] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Load puzzle
  useEffect(() => {
    loadPuzzle();
  }, []);

  const loadPuzzle = useCallback(async () => {
    try {
      const cached = await getCachedResult('pinpoint');
      if (cached) {
        const film = await getFilmAnswer(cached.filmId);
        const streakInfo = await getGameStreak('pinpoint');
        setResult(cached);
        setFilmInfo(film);
        setStreak(streakInfo.currentStreak);
        setGameState('complete');
        return;
      }

      const puzzle = await fetchDailyPuzzle('pinpoint');
      if (!puzzle) {
        logger.error('[pinpoint] Puzzle yüklenemedi');
        setLoadError(true);
        return;
      }

      setClues(puzzle.clues.sort((a, b) => a.order - b.order));
      setPuzzleFilmId(puzzle.filmId);
      setPuzzleId(puzzle.id);

      const film = await getFilmAnswer(puzzle.filmId);
      setFilmInfo(film);

      setGameState('playing');
    } catch (err) {
      logger.error('[pinpoint] Load hatası:', err);
      setLoadError(true);
    }
  }, []);

  const handleGuess = useCallback(
    async (film: FilmSearchResult) => {
      if (gameState !== 'playing') return;

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      const solved = film.id === puzzleFilmId;

      if (solved) {
        hapticSuccess();
        setGameState('reveal');

        await new Promise((r) => setTimeout(r, 600));

        const today = getTodayDate();
        const gameResult: GameResult = {
          puzzleId,
          date: today,
          gameType: 'pinpoint',
          solved: true,
          attempts: newAttempts,
          maxAttempts: 5,
          filmId: puzzleFilmId,
        };

        await submitGameScore(gameResult);
        const streakInfo = await getGameStreak('pinpoint');

        setResult(gameResult);
        setStreak(streakInfo.currentStreak);
        setGameState('complete');
      } else {
        hapticWarning();
        setWrongGuess(film.title);
        setTimeout(() => setWrongGuess(null), 1500);

        // Sonraki ipucunu aç
        if (revealedCount < clues.length) {
          setRevealedCount((prev) => prev + 1);
        }

        // Son deneme — oyun biter
        if (newAttempts >= 5) {
          hapticHeavy();
          setGameState('reveal');

          await new Promise((r) => setTimeout(r, 600));

          const today = getTodayDate();
          const gameResult: GameResult = {
            puzzleId,
            date: today,
            gameType: 'pinpoint',
            solved: false,
            attempts: newAttempts,
            maxAttempts: 5,
            filmId: puzzleFilmId,
          };

          await submitGameScore(gameResult);
          const streakInfo = await getGameStreak('pinpoint');

          setResult(gameResult);
          setStreak(streakInfo.currentStreak);
          setGameState('complete');
        }
      }
    },
    [gameState, attempts, puzzleFilmId, puzzleId, revealedCount, clues.length],
  );

  // Error
  if (loadError) {
    return (
      <GameShell title={t('games.pinpoint.title')} currentAttempt={0} maxAttempts={5}>
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
      <GameShell title={t('games.pinpoint.title')} currentAttempt={0} maxAttempts={5}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t('games.result.loading')}</Text>
        </View>
      </GameShell>
    );
  }

  // Complete
  if (gameState === 'complete' && result && filmInfo) {
    const isPerfect = result.solved && result.attempts === 1;
    return (
      <GameShell
        title={t('games.pinpoint.title')}
        currentAttempt={result.attempts}
        maxAttempts={5}
        hideProgress
      >
        <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          {isPerfect && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.perfectBadge}>
              <Text style={styles.perfectEmoji}>🎯</Text>
              <Text style={styles.perfectText}>{t('games.pinpoint.perfect')}</Text>
            </Animated.View>
          )}
          <ResultCard
            solved={result.solved}
            attempts={result.attempts}
            maxAttempts={result.maxAttempts}
            filmTitle={filmInfo.title}
            filmYear={filmInfo.year}
            filmPosterPath={filmInfo.posterPath}
            filmId={result.filmId}
            streak={streak}
            gameTitle={t('games.pinpoint.title')}
            gameType="pinpoint"
          />
        </ScrollView>
      </GameShell>
    );
  }

  // Playing
  return (
    <GameShell
      title={t('games.pinpoint.title')}
      currentAttempt={attempts}
      maxAttempts={5}
    >
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Clues */}
        <View style={styles.cluesContainer}>
          {clues.map((clue, index) => {
            const isRevealed = index < revealedCount;
            return (
              <Animated.View
                key={clue.order}
                entering={isRevealed ? FadeInUp.delay(index * 100).duration(300) : undefined}
                style={[styles.clueRow, isRevealed ? styles.clueRevealed : styles.clueLocked]}
              >
                <View style={styles.clueNumber}>
                  <Text style={styles.clueNumberText}>{clue.order}</Text>
                </View>
                {isRevealed ? (
                  <Text style={styles.clueText}>{clue.content}</Text>
                ) : (
                  <View style={styles.lockedRow}>
                    <Ionicons name="lock-closed" size={14} color={Colors.textTertiary} />
                    <Text style={styles.lockedText}>{t('games.pinpoint.clue_locked')}</Text>
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* Wrong guess feedback */}
        {wrongGuess && (
          <Animated.View entering={FadeInUp.duration(200)} style={styles.wrongGuess}>
            <Ionicons name="close-circle" size={16} color={Colors.error} />
            <Text style={styles.wrongText}>{wrongGuess}</Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Search input — fixed at bottom */}
      <View style={styles.searchContainer}>
        <FilmSearchInput
          onSelect={handleGuess}
          disabled={gameState !== 'playing'}
        />
      </View>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Theme.spacing.lg,
  },
  perfectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.md,
    marginBottom: Theme.spacing.md,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.md,
  },
  perfectEmoji: {
    fontSize: 24,
  },
  perfectText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.gold,
  },
  scrollContent: {
    flex: 1,
  },
  cluesContainer: {
    gap: Theme.spacing.sm,
    paddingTop: Theme.spacing.md,
  },
  clueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    padding: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    minHeight: 52,
  },
  clueRevealed: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  clueLocked: {
    backgroundColor: Colors.white05,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  clueNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clueNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.accentPrimary,
  },
  clueText: {
    flex: 1,
    fontSize: 15,
    color: Colors.textWhite,
    lineHeight: 22,
  },
  lockedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  lockedText: {
    fontSize: 14,
    color: Colors.textTertiary,
  },
  wrongGuess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Theme.borderRadius.sm,
  },
  wrongText: {
    fontSize: 14,
    color: Colors.error,
  },
  searchContainer: {
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
  },
});
