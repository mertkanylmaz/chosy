/**
 * Fade In (Pikselli Afis) — Wordle-tarzi gunluk poster tahmin oyunu.
 *
 * Backend-first: edge function'lardan puzzle/guess alir.
 * Fallback: backend yoksa client-side gameService kullanir.
 *
 * Mekanik:
 *   - Poster blur'lu baslar, her yanlis tahminde blur azalir
 *   - 6 deneme hakki — her yanlista 1 ipucu acilir (backend archetype-aware)
 *   - Dogruyu bilirsen poster tamamen net acilir (reveal)
 *   - 6/6 yanlis → loss state + filmi kesfet CTA
 *
 * Blur seviyeleri: [50, 40, 28, 18, 10, 4]
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getPosterUrl } from '@/services/tmdb';
import { supabase } from '@/services/supabase';
import {
  fetchDailyPuzzle,
  submitGameScore,
  getGameStreak,
  getCachedResult,
  getFilmAnswer,
  getTodayDate,
} from '@/services/gameService';
import {
  fetchPosterlePuzzle,
  submitPosterleGuess,
  type PosterlePuzzleState,
  type PosterleHint,
} from '@/services/posterleApi';
import type { GameState, GameClue, GameResult, FilmSearchResult } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { ResultCard } from '@/components/games/ResultCard';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useGamePaywall } from '@/hooks/useGamePaywall';

// ─── Sabitler ───────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const POSTER_W = Math.floor(SCREEN_W * 0.7);
const POSTER_H = Math.floor(POSTER_W * 1.5);

/** Blur seviyeleri — index = kullanilan deneme sayisi */
const BLUR_LEVELS = [50, 40, 28, 18, 10, 4];
const MAX_ATTEMPTS = 6;

// ─── FadeInScreen ───────────────────────────────────────────────────────────

export default function FadeInScreen() {
  const { t } = useLanguage();
  const { checkGamePaywall, paywallProps } = useGamePaywall();

  // State
  const [gameState, setGameState] = useState<GameState>('loading');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [clues, setClues] = useState<GameClue[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [revealedHints, setRevealedHints] = useState(0);
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

  /** Backend hints (archetype-aware, from edge function) */
  const [backendHints, setBackendHints] = useState<PosterleHint[]>([]);

  /** Whether we're using backend mode */
  const isBackendMode = useRef(false);

  /** Backend puzzle film UUID (for guess submission) */
  const backendFilmUUID = useRef<string | null>(null);

  /** Mevcut blur seviyesi */
  const currentBlur = BLUR_LEVELS[Math.min(attempts, BLUR_LEVELS.length - 1)];

  // ── Load puzzle ─────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      setGameState('loading');
      setPosterUrl(null);
      setClues([]);
      setAttempts(0);
      setRevealedHints(0);
      setResult(null);
      setFilmInfo(null);
      setWrongGuess(null);
      setLoadError(false);
      setBackendHints([]);
      isBackendMode.current = false;
      backendFilmUUID.current = null;
      loadPuzzle();
    }, []),
  );

  const loadPuzzle = useCallback(async () => {
    // Try backend first
    try {
      const backendState = await fetchPosterlePuzzle();
      if (backendState) {
        logger.log('[fadein] Backend puzzle loaded');
        isBackendMode.current = true;
        applyBackendState(backendState);
        return;
      }
    } catch (err) {
      logger.warn('[fadein] Backend unavailable, using fallback:', err);
    }

    // Fallback to client-side
    logger.log('[fadein] Using client-side fallback');
    await loadClientSidePuzzle();
  }, []);

  /** Apply backend state to UI */
  const applyBackendState = useCallback((state: PosterlePuzzleState) => {
    // Poster URL
    if (state.puzzle.poster_url) {
      setPosterUrl(getPosterUrl(state.puzzle.poster_url, 'w500'));
    }

    // Attempts & hints
    setAttempts(state.attempt.attempts_used);
    setBackendHints(state.hints);
    setRevealedHints(state.hints.length);
    setStreak(state.streak.current_streak);

    // Game complete?
    if (state.attempt.result !== 'in_progress' && state.film) {
      const gameResult: GameResult = {
        puzzleId: `fadein_${state.puzzle.date}`,
        date: state.puzzle.date,
        gameType: 'fadein',
        solved: state.attempt.result === 'won',
        attempts: state.attempt.attempts_used,
        maxAttempts: MAX_ATTEMPTS,
        filmId: state.film.tmdb_id,
      };
      setResult(gameResult);
      setFilmInfo({
        title: state.film.title,
        year: state.film.year ?? 0,
        posterPath: state.film.poster_url,
      });
      setGameState('complete');
    } else {
      setGameState('playing');
    }
  }, []);

  /** Client-side fallback (same as before) */
  const loadClientSidePuzzle = useCallback(async () => {
    try {
      const cached = await getCachedResult('fadein');
      if (cached) {
        const film = await getFilmAnswer(cached.filmId);
        const streakInfo = await getGameStreak('fadein');
        setResult(cached);
        setFilmInfo(film);
        setStreak(streakInfo.currentStreak);
        if (film?.posterPath) {
          setPosterUrl(getPosterUrl(film.posterPath, 'w500'));
        }
        setGameState('complete');
        return;
      }

      const puzzle = await fetchDailyPuzzle('fadein');
      if (!puzzle) {
        logger.error('[fadein] Puzzle yuklenemedi');
        setLoadError(true);
        return;
      }

      const posterClue = puzzle.clues.find((c) => c.type === 'poster');
      if (posterClue?.content) {
        setPosterUrl(getPosterUrl(posterClue.content, 'w500'));
      }

      const hintClues = puzzle.clues
        .filter((c) => c.type === 'hint')
        .sort((a, b) => a.order - b.order);
      setClues(hintClues);

      setPuzzleFilmId(puzzle.filmId);
      setPuzzleId(puzzle.id);

      const film = await getFilmAnswer(puzzle.filmId);
      setFilmInfo(film);

      setGameState('playing');
    } catch (err) {
      logger.error('[fadein] Load hatasi:', err);
      setLoadError(true);
    }
  }, []);

  // ── Guess handler ─────────────────────────────────────────────────────────

  const handleGuess = useCallback(
    async (film: FilmSearchResult) => {
      if (gameState !== 'playing') return;

      if (isBackendMode.current) {
        await handleBackendGuess(film);
      } else {
        await handleClientSideGuess(film);
      }
    },
    [gameState, attempts, puzzleFilmId, puzzleId, revealedHints, clues.length],
  );

  /** Backend guess — server validates, returns hint + result */
  const handleBackendGuess = useCallback(
    async (film: FilmSearchResult) => {
      // Lookup film UUID from tmdb_id for backend submission
      let filmUUID: string | undefined;
      try {
        const { data } = await supabase
          .from('films')
          .select('id')
          .eq('tmdb_id', film.id)
          .maybeSingle();
        filmUUID = data?.id ?? undefined;
      } catch {
        // If UUID lookup fails, send text guess
      }

      const guessResult = await submitPosterleGuess(
        filmUUID,
        film.title,
      );

      if (!guessResult) {
        // Backend error — show wrong guess toast, don't advance
        hapticWarning();
        setWrongGuess(film.title);
        setTimeout(() => setWrongGuess(null), 1500);
        return;
      }

      setAttempts(guessResult.attempts_used);

      if (guessResult.correct) {
        // Win!
        hapticSuccess();
        setGameState('reveal');
        await new Promise((r) => setTimeout(r, 800));

        const today = getTodayDate();
        const gameResult: GameResult = {
          puzzleId: `fadein_${today}`,
          date: today,
          gameType: 'fadein',
          solved: true,
          attempts: guessResult.attempts_used,
          maxAttempts: MAX_ATTEMPTS,
          filmId: guessResult.film?.tmdb_id ?? film.id,
        };

        // Also save to local cache for other game systems
        await submitGameScore(gameResult);

        setResult(gameResult);
        if (guessResult.film) {
          setFilmInfo({
            title: guessResult.film.title,
            year: guessResult.film.year ?? 0,
            posterPath: guessResult.film.poster_url ?? null,
          });
        }
        setStreak(
          (guessResult.streak as Record<string, number>)?.current_streak ?? streak + 1,
        );
        setGameState('complete');
      } else {
        // Wrong
        hapticWarning();
        setWrongGuess(film.title);
        setTimeout(() => setWrongGuess(null), 1500);

        // Add server hint
        if (guessResult.hint) {
          setBackendHints((prev) => [
            ...prev,
            {
              attempt_number: guessResult.attempts_used,
              hint_type: guessResult.hint!.type,
              hint_value: guessResult.hint!.value,
            },
          ]);
          setRevealedHints((prev) => prev + 1);
        }

        // Game over?
        if (guessResult.result === 'lost') {
          hapticHeavy();
          setGameState('reveal');
          await new Promise((r) => setTimeout(r, 800));

          const today = getTodayDate();
          const gameResult: GameResult = {
            puzzleId: `fadein_${today}`,
            date: today,
            gameType: 'fadein',
            solved: false,
            attempts: guessResult.attempts_used,
            maxAttempts: MAX_ATTEMPTS,
            filmId: guessResult.film?.tmdb_id ?? film.id,
          };

          await submitGameScore(gameResult);

          setResult(gameResult);
          if (guessResult.film) {
            setFilmInfo({
              title: guessResult.film.title,
              year: guessResult.film.year ?? 0,
              posterPath: guessResult.film.poster_url ?? null,
            });
          }
          setStreak(0);
          setGameState('complete');
        }
      }
    },
    [streak],
  );

  /** Client-side guess — same logic as before */
  const handleClientSideGuess = useCallback(
    async (film: FilmSearchResult) => {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      const solved = film.id === puzzleFilmId;

      if (solved) {
        hapticSuccess();
        setGameState('reveal');
        await new Promise((r) => setTimeout(r, 800));

        const today = getTodayDate();
        const gameResult: GameResult = {
          puzzleId,
          date: today,
          gameType: 'fadein',
          solved: true,
          attempts: newAttempts,
          maxAttempts: MAX_ATTEMPTS,
          filmId: puzzleFilmId,
        };

        await submitGameScore(gameResult);
        const streakInfo = await getGameStreak('fadein');
        setResult(gameResult);
        setStreak(streakInfo.currentStreak);
        setGameState('complete');
        checkGamePaywall(streakInfo.currentStreak, true);
      } else {
        hapticWarning();
        setWrongGuess(film.title);
        setTimeout(() => setWrongGuess(null), 1500);

        if (revealedHints < clues.length) {
          setRevealedHints((prev) => prev + 1);
        }

        if (newAttempts >= MAX_ATTEMPTS) {
          hapticHeavy();
          setGameState('reveal');
          await new Promise((r) => setTimeout(r, 800));

          const today = getTodayDate();
          const gameResult: GameResult = {
            puzzleId,
            date: today,
            gameType: 'fadein',
            solved: false,
            attempts: newAttempts,
            maxAttempts: MAX_ATTEMPTS,
            filmId: puzzleFilmId,
          };

          await submitGameScore(gameResult);
          const streakInfo = await getGameStreak('fadein');
          setResult(gameResult);
          setStreak(streakInfo.currentStreak);
          setGameState('complete');
        }
      }
    },
    [attempts, puzzleFilmId, puzzleId, revealedHints, clues.length],
  );

  // ── Render helpers ────────────────────────────────────────────────────────

  /** Get displayable hints based on mode */
  const displayHints = isBackendMode.current
    ? backendHints.map((h, i) => ({
        order: h.attempt_number,
        type: 'hint' as const,
        content: `${h.hint_type}: ${h.hint_value}`,
      }))
    : clues.slice(0, revealedHints);

  // ── Render ────────────────────────────────────────────────────────────────

  /** Error state */
  if (loadError) {
    return (
      <GameShell title={t('games.fadein.title')} currentAttempt={0} maxAttempts={MAX_ATTEMPTS}>
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={Colors.textTertiary} />
          <Text style={styles.errorTitle}>{t('games.result.error_title')}</Text>
          <Text style={styles.errorSubtitle}>{t('games.result.error_subtitle')}</Text>
        </View>
      </GameShell>
    );
  }

  /** Loading state */
  if (gameState === 'loading') {
    return (
      <GameShell title={t('games.fadein.title')} currentAttempt={0} maxAttempts={MAX_ATTEMPTS}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('games.result.loading')}</Text>
        </View>
      </GameShell>
    );
  }

  /** Complete state */
  if (gameState === 'complete' && result && filmInfo) {
    return (
      <GameShell
        title={t('games.fadein.title')}
        currentAttempt={result.attempts}
        maxAttempts={MAX_ATTEMPTS}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.completeScroll}
        >
          {posterUrl && (
            <Animated.View entering={FadeIn.duration(600)} style={styles.revealPosterContainer}>
              <Image
                source={{ uri: posterUrl }}
                style={styles.revealPoster}
                contentFit="cover"
                transition={400}
              />
            </Animated.View>
          )}

          <ResultCard
            solved={result.solved}
            attempts={result.attempts}
            maxAttempts={MAX_ATTEMPTS}
            filmTitle={filmInfo.title}
            filmYear={filmInfo.year}
            filmPosterPath={filmInfo.posterPath}
            filmId={result.filmId}
            streak={streak}
            gameTitle={t('games.fadein.title')}
            gameType="fadein"
          />
        </ScrollView>
      </GameShell>
    );
  }

  // ── Playing / Reveal state ──────────────────────────────────────────────

  return (
    <GameShell
      title={t('games.fadein.title')}
      currentAttempt={attempts}
      maxAttempts={MAX_ATTEMPTS}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.playScroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Blur'lu poster */}
        <View style={styles.posterContainer}>
          {posterUrl && (
            <Animated.View entering={FadeIn.duration(500)}>
              <Image
                source={{ uri: posterUrl }}
                style={styles.poster}
                contentFit="cover"
                blurRadius={gameState === 'reveal' ? 0 : currentBlur}
                transition={300}
              />

              {gameState === 'playing' && (
                <View style={styles.blurBadge}>
                  <Ionicons name="eye-off-outline" size={14} color={Colors.textWhite} />
                  <Text style={styles.blurBadgeText}>
                    {t('games.fadein.blur_level', { level: attempts + 1, max: MAX_ATTEMPTS })}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>

        {/* Acilan ipuclari */}
        {displayHints.length > 0 && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.hintsContainer}>
            <Text style={styles.hintsTitle}>{t('games.fadein.hints_title')}</Text>
            {displayHints.map((hint, i) => (
              <Animated.View
                key={`hint-${hint.order}-${i}`}
                entering={FadeInDown.delay(i * 100).duration(300)}
                style={styles.hintRow}
              >
                <View style={styles.hintNumber}>
                  <Text style={styles.hintNumberText}>{i + 1}</Text>
                </View>
                <Text style={styles.hintText}>{hint.content}</Text>
              </Animated.View>
            ))}
          </Animated.View>
        )}

        {/* Yanlis tahmin toast */}
        {wrongGuess && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.wrongToast}>
            <Ionicons name="close-circle" size={18} color={Colors.error} />
            <Text style={styles.wrongText} numberOfLines={1}>
              {wrongGuess} — {t('games.fadein.wrong')}
            </Text>
          </Animated.View>
        )}

        {/* Deneme gostergesi */}
        {gameState === 'playing' && (
          <View style={styles.attemptsRow}>
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <View
                key={`attempt-${i}`}
                style={[
                  styles.attemptDot,
                  i < attempts ? styles.attemptDotUsed : styles.attemptDotEmpty,
                ]}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Film arama input'u */}
      {gameState === 'playing' && (
        <Animated.View entering={FadeInUp.duration(400)} style={styles.inputContainer}>
          <FilmSearchInput
            onSelect={handleGuess}
            placeholder={t('games.fadein.search_placeholder')}
          />
        </Animated.View>
      )}
      <ContextualPaywall {...paywallProps} />
    </GameShell>
  );
}

// ─── Stiller ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.textGrey,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  playScroll: {
    alignItems: 'center',
    paddingBottom: 80,
  },
  posterContainer: {
    alignItems: 'center',
    marginTop: Theme.spacing.md,
  },
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.bgCard,
  },
  blurBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(10,10,10,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Theme.borderRadius.full,
  },
  blurBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  revealPosterContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.lg,
  },
  revealPoster: {
    width: POSTER_W * 0.65,
    height: POSTER_H * 0.65,
    borderRadius: Theme.borderRadius.md,
  },
  hintsContainer: {
    width: '100%',
    marginTop: Theme.spacing.lg,
    gap: Theme.spacing.sm,
  },
  hintsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.white05,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
  },
  hintNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accentDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintNumberText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accentPrimary,
  },
  hintText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textWhite,
  },
  wrongToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  wrongText: {
    fontSize: 14,
    color: Colors.error,
    flex: 1,
  },
  attemptsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: Theme.spacing.lg,
  },
  attemptDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  attemptDotUsed: {
    backgroundColor: Colors.error,
  },
  attemptDotEmpty: {
    backgroundColor: Colors.bgSubtle,
  },
  inputContainer: {
    paddingHorizontal: 0,
    paddingBottom: Theme.spacing.sm,
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
  completeScroll: {
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: 40,
  },
});
