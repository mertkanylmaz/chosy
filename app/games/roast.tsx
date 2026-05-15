/**
 * Replik Oyunu (Roast) — Gercek film repliginden filmi tahmin et.
 *
 * Ikonik bir film repligi gosterilir, kullanici filmi tahmin eder.
 * Yanlis tahminlerde ipuclari acilir: karakter adi > basrol > yonetmen+yil.
 * Max 4 deneme hakki (1 replik + 3 ipucu).
 */
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticSuccess, hapticWarning } from '@/utils/haptics';
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

export default function RoastScreen() {
  const { t } = useLanguage();

  const [gameState, setGameState] = useState<GameState>('loading');
  const [quoteText, setQuoteText] = useState('');
  const [hints, setHints] = useState<GameClue[]>([]);
  const [revealedHints, setRevealedHints] = useState(0);
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

  const maxAttempts = 4; // 1 replik + 3 ipucu

  // Her focus'ta tarih kontrolü — yeni gün = yeni puzzle
  useFocusEffect(
    useCallback(() => {
      setGameState('loading');
      setQuoteText('');
      setHints([]);
      setRevealedHints(0);
      setAttempts(0);
      setResult(null);
      setFilmInfo(null);
      setWrongGuess(null);
      setLoadError(false);
      loadPuzzle();
    }, []),
  );

  /** Puzzle yukle — cache veya fresh */
  const loadPuzzle = useCallback(async () => {
    try {
      const cached = await getCachedResult('roast');
      if (cached) {
        const film = await getFilmAnswer(cached.filmId);
        const streakInfo = await getGameStreak('roast');
        setResult(cached);
        setFilmInfo(film);
        setStreak(streakInfo.currentStreak);
        setGameState('complete');
        return;
      }

      const puzzle = await fetchDailyPuzzle('roast');
      if (!puzzle) {
        logger.error('[roast] Puzzle yuklenemedi');
        setLoadError(true);
        return;
      }

      const sortedClues = puzzle.clues.sort((a, b) => a.order - b.order);
      // Ilk clue = replik (type: 'quote'), geri kalan = ipuclari
      const quoteClue = sortedClues[0];
      const hintClues = sortedClues.slice(1);

      setQuoteText(quoteClue?.content ?? '');
      setHints(hintClues);
      setPuzzleFilmId(puzzle.filmId);
      setPuzzleId(puzzle.id);

      const film = await getFilmAnswer(puzzle.filmId);
      setFilmInfo(film);

      setGameState('playing');
    } catch (err) {
      logger.error('[roast] Load hatasi:', err);
      setLoadError(true);
    }
  }, []);

  /** Tahmin yap */
  const handleGuess = useCallback(
    async (film: FilmSearchResult) => {
      if (gameState !== 'playing') return;

      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      const solved = film.id === puzzleFilmId;

      if (solved) {
        hapticSuccess();
        await finishGame(true, newAttempts);
      } else {
        hapticWarning();
        setWrongGuess(film.title);
        setTimeout(() => setWrongGuess(null), 1500);

        // Sonraki ipucunu ac
        if (revealedHints < hints.length) {
          setRevealedHints((prev) => prev + 1);
        }

        // Son deneme
        if (newAttempts >= maxAttempts) {
          hapticHeavy();
          await finishGame(false, newAttempts);
        }
      }
    },
    [gameState, attempts, puzzleFilmId, puzzleId, revealedHints, hints.length],
  );

  /** Oyunu bitir */
  const finishGame = useCallback(
    async (solved: boolean, totalAttempts: number) => {
      setGameState('reveal');
      await new Promise((r) => setTimeout(r, 600));

      const today = getTodayDate();
      const gameResult: GameResult = {
        puzzleId,
        date: today,
        gameType: 'roast',
        solved,
        attempts: totalAttempts,
        maxAttempts,
        filmId: puzzleFilmId,
      };

      await submitGameScore(gameResult);
      const streakInfo = await getGameStreak('roast');

      setResult(gameResult);
      setStreak(streakInfo.currentStreak);
      setGameState('complete');
    },
    [puzzleId, puzzleFilmId],
  );

  // ─── Error ───
  if (loadError) {
    return (
      <GameShell title={t('games.roast.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>🎬</Text>
          <Text style={styles.errorText}>{t('games.result.error_title')}</Text>
          <Text style={styles.errorSubtext}>{t('games.result.error_subtitle')}</Text>
        </View>
      </GameShell>
    );
  }

  // ─── Loading ───
  if (gameState === 'loading') {
    return (
      <GameShell title={t('games.roast.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t('games.result.loading')}</Text>
        </View>
      </GameShell>
    );
  }

  // ─── Complete ───
  if (gameState === 'complete' && result && filmInfo) {
    return (
      <GameShell
        title={t('games.roast.title')}
        currentAttempt={result.attempts}
        maxAttempts={maxAttempts}
        hideProgress
      >
        <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          {/* Repligi tekrar goster */}
          <View style={styles.quoteCardSmall}>
            <Ionicons name="chatbubble-ellipses" size={18} color={Colors.gold} />
            <Text style={styles.quoteTextSmall} numberOfLines={3}>
              {`"${quoteText}"`}
            </Text>
          </View>
          <ResultCard
            solved={result.solved}
            attempts={result.attempts}
            maxAttempts={result.maxAttempts}
            filmTitle={filmInfo.title}
            filmYear={filmInfo.year}
            filmPosterPath={filmInfo.posterPath}
            filmId={result.filmId}
            streak={streak}
            gameTitle={t('games.roast.title')}
            gameType="roast"
          />
        </ScrollView>
      </GameShell>
    );
  }

  // ─── Playing ───
  return (
    <GameShell
      title={t('games.roast.title')}
      currentAttempt={attempts}
      maxAttempts={maxAttempts}
    >
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Film ikonu badge */}
        <View style={styles.quoteBadge}>
          <Ionicons name="film-outline" size={20} color={Colors.gold} />
          <Text style={styles.quoteBadgeLabel}>{t('games.roast.quoteLabel')}</Text>
        </View>

        {/* Replik karti */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.quoteCard}>
          <Ionicons name="chatbubble-ellipses" size={28} color={Colors.gold} style={styles.quoteIcon} />
          <Text style={styles.quoteMainText}>{`"${quoteText}"`}</Text>
        </Animated.View>

        {/* Acilan ipuclari */}
        {hints.slice(0, revealedHints).map((hint, index) => (
          <Animated.View
            key={hint.order}
            entering={FadeInUp.delay(index * 100).duration(300)}
            style={styles.hintRow}
          >
            <Ionicons name="bulb" size={16} color={Colors.gold} />
            <Text style={styles.hintText}>{hint.content}</Text>
          </Animated.View>
        ))}

        {/* Yanlis tahmin */}
        {wrongGuess && (
          <Animated.View entering={FadeInUp.duration(200)} style={styles.wrongGuess}>
            <Ionicons name="close-circle" size={16} color={Colors.error} />
            <Text style={styles.wrongText}>{wrongGuess}</Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Film arama */}
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
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  quoteCardSmall: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quoteTextSmall: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  scrollContent: {
    flex: 1,
  },
  quoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
  },
  quoteBadgeLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  quoteCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginVertical: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quoteIcon: {
    marginBottom: Theme.spacing.sm,
  },
  quoteMainText: {
    fontSize: 20,
    color: Colors.textWhite,
    lineHeight: 30,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.sm,
    marginTop: Theme.spacing.sm,
  },
  hintText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '500',
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
