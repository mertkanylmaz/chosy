/**
 * Logline — Tümdengelim oyunu.
 *
 * 5 ipucu soyuttan somuta açılır.
 * Her yanlış tahminde sonraki ipucu açılır.
 * İlk ipucunda bilen = "Kusursuz Tahmin" rozeti.
 *
 * Edge Function tabanlı — tahmin doğrulaması sunucuda.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getGameStreak } from '@/services/gameService';
import { getDailyChallenge, submitGameGuess } from '@/services/gameApi';
import type { DailyChallenge, GuessResult, LoglineSemanticHints } from '@/types/game';
import type { DnaSignal } from '@/components/games/DnaXpReveal';
import type { GameState, FilmSearchResult } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { ResultCard } from '@/components/games/ResultCard';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useGamePaywall } from '@/hooks/useGamePaywall';
import { trackGameOpened, trackGuessSubmitted, trackGameCompleted } from '@/utils/gameAnalytics';

/** Logline ipucu */
interface LoglineClue {
  order: number;
  content: string;
}

export default function LoglineScreen() {
  const { t } = useLanguage();
  const { checkGamePaywall, paywallProps } = useGamePaywall();

  // Analytics timing refs
  const openTimeRef = useRef(Date.now());
  const guessStartTime = useRef(Date.now());

  const [gameState, setGameState] = useState<GameState>('loading');
  const [clues, setClues] = useState<LoglineClue[]>([]);
  const [revealedCount, setRevealedCount] = useState(1); // İlk ipucu açık başlar
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(5);
  const [puzzleId, setPuzzleId] = useState('');
  const [streak, setStreak] = useState(0);
  const [wrongGuess, setWrongGuess] = useState<string | null>(null);
  const [semanticHints, setSemanticHints] = useState<LoglineSemanticHints | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Result state (Edge Function response)
  const [solved, setSolved] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [dnaSignals, setDnaSignals] = useState<DnaSignal[]>([]);
  const [filmInfo, setFilmInfo] = useState<{
    title: string;
    year: number;
    posterPath: string | null;
    filmId: number;
  } | null>(null);

  // Her focus'ta tarih kontrolü
  useFocusEffect(
    useCallback(() => {
      setGameState('loading');
      setClues([]);
      setRevealedCount(1);
      setAttempts(0);
      setSolved(false);
      setFilmInfo(null);
      setWrongGuess(null);
      setSemanticHints(null);
      setLoadError(false);
      loadPuzzle();
    }, []),
  );

  /** Puzzle yükle — Edge Function */
  const loadPuzzle = useCallback(async () => {
    try {
      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const data: DailyChallenge = await getDailyChallenge('logline', puzzleDate);
      const puzzle = data.puzzle;
      const progress = data.progress;

      setPuzzleId(puzzle.id);
      setMaxAttempts(puzzle.max_attempts);

      // puzzle_data: { clues: [{ order, content }], poster_url?, tmdb_id?, film_title? }
      const pd = puzzle.puzzle_data;
      const clueList = (pd.clues as LoglineClue[]) ?? [];
      setClues(clueList.sort((a, b) => a.order - b.order));

      // Bugün zaten oynanmış mı?
      if (progress?.completed) {
        const streakInfo = await getGameStreak('logline');
        setStreak(streakInfo.currentStreak);
        setSolved(progress.won);
        setAttempts(progress.guesses?.length ?? 0);

        const filmTitle = pd.film_title as string | undefined;
        const tmdbId = pd.tmdb_id as number | undefined;
        const posterUrl = pd.poster_url as string | undefined;
        setFilmInfo({
          title: filmTitle ?? t('games.result.unknown_film'),
          year: 0,
          posterPath: posterUrl ?? null,
          filmId: tmdbId ?? 0,
        });

        setGameState('complete');
        return;
      }

      // Devam eden oyun — önceki tahmin sayısını yükle
      if (progress?.guesses) {
        const used = progress.guesses.length;
        setAttempts(used);
        setRevealedCount(Math.min(used + 1, clueList.length));
      }

      setGameState('playing');
      openTimeRef.current = Date.now();
      guessStartTime.current = Date.now();
      trackGameOpened('logline', 0, 'hub');
    } catch (err) {
      logger.error('[logline] Load hatası:', err);
      setLoadError(true);
    }
  }, []);

  /** Tahmin yap — Edge Function doğrular */
  const handleGuess = useCallback(
    async (film: FilmSearchResult) => {
      if (gameState !== 'playing') return;

      const filmUuid = film.uuid;
      if (!filmUuid) {
        logger.error('[logline] Film UUID bulunamadı — TMDb fallback kullanılamaz');
        return;
      }

      try {
        const result: GuessResult = await submitGameGuess(puzzleId, filmUuid);
        const newAttempts = result.guesses_used;
        setAttempts(newAttempts);
        trackGuessSubmitted('logline', newAttempts, Date.now() - guessStartTime.current);
        guessStartTime.current = Date.now();

        if (result.correct) {
          hapticSuccess();
          setSolved(true);
          setXpAwarded(result.xp_awarded);
          setDnaUpdated(result.dna_updated);
          if (result.dna_updated) {
            setDnaSignals([
              { dimension: 'deduction', delta: 0.5 },
              { dimension: 'knowledge', delta: 0.3 },
            ]);
          }

          setGameState('reveal');
          trackGameCompleted({
            gameId: 'logline',
            won: true,
            guessesUsed: newAttempts,
            timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
            xp: result.xp_awarded,
          });
          await new Promise((r) => setTimeout(r, 600));

          if (result.revealed_solution) {
            setFilmInfo({
              title: result.revealed_solution.title,
              year: result.revealed_solution.year,
              posterPath: result.revealed_solution.poster_url ?? null,
              filmId: 0,
            });
          }

          const streakInfo = await getGameStreak('logline');
          setStreak(streakInfo.currentStreak);
          setGameState('complete');
          checkGamePaywall(streakInfo.currentStreak, true);
        } else {
          hapticWarning();
          setWrongGuess(film.title);
          setSemanticHints(result.logline_hints ?? null);
          setTimeout(() => {
            setWrongGuess(null);
            setSemanticHints(null);
          }, 3000);

          // Sonraki ipucunu aç
          if (revealedCount < clues.length) {
            setRevealedCount((prev) => prev + 1);
          }

          // Son deneme — oyun biter
          if (result.completed) {
            hapticHeavy();
            setSolved(false);
            setXpAwarded(result.xp_awarded);
            setDnaUpdated(result.dna_updated);

            setGameState('reveal');
            trackGameCompleted({
              gameId: 'logline',
              won: false,
              guessesUsed: newAttempts,
              timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
              xp: result.xp_awarded,
            });
            await new Promise((r) => setTimeout(r, 600));

            if (result.revealed_solution) {
              setFilmInfo({
                title: result.revealed_solution.title,
                year: result.revealed_solution.year,
                posterPath: result.revealed_solution.poster_url ?? null,
                filmId: 0,
              });
            }

            const streakInfo = await getGameStreak('logline');
            setStreak(streakInfo.currentStreak);
            setGameState('complete');
          }
        }
      } catch (err) {
        logger.error('[logline] Submit hatası:', err);
      }
    },
    [gameState, puzzleId, revealedCount, clues.length, checkGamePaywall],
  );

  // Error
  if (loadError) {
    return (
      <GameShell title={t('games.logline.title')} currentAttempt={0} maxAttempts={maxAttempts}>
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
      <GameShell title={t('games.logline.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t('games.result.loading')}</Text>
        </View>
      </GameShell>
    );
  }

  // Complete
  if (gameState === 'complete' && filmInfo) {
    const isPerfect = solved && attempts === 1;
    return (
      <GameShell
        title={t('games.logline.title')}
        currentAttempt={attempts}
        maxAttempts={maxAttempts}
        hideProgress
      >
        <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          {isPerfect && (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.perfectBadge}>
              <Text style={styles.perfectEmoji}>🎯</Text>
              <Text style={styles.perfectText}>{t('games.logline.perfect')}</Text>
            </Animated.View>
          )}
          <ResultCard
            solved={solved}
            attempts={attempts}
            maxAttempts={maxAttempts}
            filmTitle={filmInfo.title}
            filmYear={filmInfo.year}
            filmPosterPath={filmInfo.posterPath}
            filmId={filmInfo.filmId}
            streak={streak}
            gameTitle={t('games.logline.title')}
            gameType="logline"
            xpAwarded={xpAwarded > 0 ? xpAwarded : undefined}
            dnaUpdated={dnaUpdated}
            dnaSignals={dnaSignals.length > 0 ? dnaSignals : undefined}
          />
        </ScrollView>
      </GameShell>
    );
  }

  // Playing
  return (
    <GameShell
      title={t('games.logline.title')}
      currentAttempt={attempts}
      maxAttempts={maxAttempts}
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
                    <Text style={styles.lockedText}>{t('games.logline.clue_locked')}</Text>
                  </View>
                )}
              </Animated.View>
            );
          })}
        </View>

        {/* Wrong guess feedback + semantic hints */}
        {wrongGuess && (
          <Animated.View entering={FadeInUp.duration(200)} style={styles.wrongGuessContainer}>
            <View style={styles.wrongGuess}>
              <Ionicons name="close-circle" size={16} color={Colors.error} />
              <Text style={styles.wrongText}>{wrongGuess}</Text>
            </View>
            {semanticHints && (
              <View style={styles.semanticHints}>
                <View style={styles.hintChip}>
                  <Ionicons
                    name={semanticHints.genre_match === 'same' ? 'checkmark-circle' : semanticHints.genre_match === 'close' ? 'swap-horizontal' : 'close-circle'}
                    size={14}
                    color={semanticHints.genre_match === 'same' ? Colors.success : semanticHints.genre_match === 'close' ? Colors.gold : Colors.textTertiary}
                  />
                  <Text style={[styles.hintChipText, {
                    color: semanticHints.genre_match === 'same' ? Colors.success : semanticHints.genre_match === 'close' ? Colors.gold : Colors.textTertiary,
                  }]}>
                    {t(`games.logline.hint_genre_${semanticHints.genre_match}`)}
                  </Text>
                </View>
                <View style={styles.hintChip}>
                  <Ionicons
                    name={semanticHints.decade_match === 'same' ? 'checkmark-circle' : semanticHints.decade_match === 'close' ? 'swap-horizontal' : 'close-circle'}
                    size={14}
                    color={semanticHints.decade_match === 'same' ? Colors.success : semanticHints.decade_match === 'close' ? Colors.gold : Colors.textTertiary}
                  />
                  <Text style={[styles.hintChipText, {
                    color: semanticHints.decade_match === 'same' ? Colors.success : semanticHints.decade_match === 'close' ? Colors.gold : Colors.textTertiary,
                  }]}>
                    {t(`games.logline.hint_decade_${semanticHints.decade_match}`)}
                  </Text>
                </View>
              </View>
            )}
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
      <ContextualPaywall {...paywallProps} />
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
  wrongGuessContainer: {
    marginTop: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  wrongGuess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Theme.borderRadius.sm,
  },
  wrongText: {
    fontSize: 14,
    color: Colors.error,
  },
  semanticHints: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.sm,
  },
  hintChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Theme.spacing.sm,
    backgroundColor: Colors.white05,
    borderRadius: Theme.borderRadius.sm,
  },
  hintChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  searchContainer: {
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
});
