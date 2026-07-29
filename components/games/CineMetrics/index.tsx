/**
 * CineMetrics — Wordle-tarzı film tahmin oyunu.
 *
 * 6 sütun (Yıl, Tür, Yönetmen, Puan, Süre, Ülke) × max 6 tahmin.
 * Feedback sunucudan gelir (green/yellow/gray + yön okları).
 * Çözüm istemciye İNMEZ — submit-guess Edge Function doğrulama yapar.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CircleIcon as Circle, ArrowUp, ArrowDown } from 'phosphor-react-native';

import { ResultCard } from '@/components/games/ResultCard';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  FadeInUp,
} from 'react-native-reanimated';
import { hapticLight, hapticMedium } from '@/utils/haptics';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/utils/logger';
import {
  trackGameOpened,
  trackGuessSubmitted,
  trackGameCompleted,
  trackResultCardViewed,
} from '@/utils/gameAnalytics';
import { getDailyChallenge, submitGuess } from '@/services/gameApi';
import { GameShell } from '@/components/games/GameShell';
import { GameStateView } from '@/components/games/GameStateView';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import type { FilmSearchResult } from '@/services/gameTypes';
import type {
  DailyChallenge,
  FeedbackCell,
  FeedbackRow,
  GuessEntry,
  GuessResult,
  RevealedFilm,
  WhyThisMovieText,
} from '@/types/game';

import { styles, DATA_COL_W, FILM_COL_W } from './styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'playing' | 'completed';

/** Feedback sütun anahtarları (grid sırası) */
const COLUMN_KEYS: (keyof FeedbackRow)[] = [
  'year', 'genres', 'director', 'rating', 'runtime', 'country',
];

// ─── Flip Cell Component ─────────────────────────────────────────────────────

interface FlipCellProps {
  feedback: FeedbackCell;
  value: string;
  index: number;
  columnKey: keyof FeedbackRow;
  animate: boolean;
}

/** Tek bir grid hücresi — flip animasyonu ile feedback gösterir */
function FlipCell({ feedback, value, index, columnKey, animate }: FlipCellProps) {
  const rotateY = useSharedValue(animate ? 90 : 0);
  const [showResult, setShowResult] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const delay = index * 80;

    rotateY.value = withDelay(
      delay,
      withSequence(
        withTiming(90, { duration: 80 }),
        withTiming(0, { duration: 80 }),
      ),
    );

    // Reveal sonucu flip'in ortasında göster
    const timer = setTimeout(() => {
      setShowResult(true);
      // Haptic — son hücrede medium, diğerlerinde light
      if (index === 5) {
        hapticMedium();
      } else {
        hapticLight();
      }
    }, delay + 80);

    return () => clearTimeout(timer);
  }, [animate, index, rotateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${rotateY.value}deg` }],
  }));

  const hasDirection = feedback.direction &&
    (columnKey === 'year' || columnKey === 'rating' || columnKey === 'runtime');

  const cellBgStyle = showResult
    ? feedback.result === 'green' ? styles.cellGreen
      : feedback.result === 'yellow' ? styles.cellYellow
        : styles.cellGray
    : styles.cellEmpty;

  const textStyle = showResult
    ? feedback.result === 'green' ? styles.cellTextGreen
      : feedback.result === 'yellow' ? styles.cellTextYellow
        : styles.cellTextGray
    : styles.cellTextGray;

  return (
    <Animated.View style={[styles.cell, cellBgStyle, animatedStyle]}>
      <Text style={[styles.cellText, textStyle]} numberOfLines={1}>
        {showResult ? value : ''}
      </Text>
      {showResult && hasDirection && feedback.result !== 'green' && (
        <View style={styles.directionArrow}>
          {feedback.direction === 'up' ? (
            <ArrowUp size={10} color={feedback.result === 'yellow' ? Colors.bgPrimary : Colors.white} weight="duotone" />
          ) : (
            <ArrowDown size={10} color={feedback.result === 'yellow' ? Colors.bgPrimary : Colors.white} weight="duotone" />
          )}
        </View>
      )}
    </Animated.View>
  );
}

// ─── Countdown Hook ──────────────────────────────────────────────────────────

/** Gece yarısına geri sayım */
function useCountdown(): string {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setTimeLeft(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      );
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return timeLeft;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CineMetricsGame() {
  const { t } = useLanguage();
  const router = useRouter();
  const countdown = useCountdown();

  // State
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [guesses, setGuesses] = useState<GuessEntry[]>([]);
  const [selectedFilm, setSelectedFilm] = useState<FilmSearchResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [animatingRow, setAnimatingRow] = useState<number | null>(null);

  // Completed state
  const [won, setWon] = useState(false);
  /** Gunun bulmaca numarasi — paylasim kartinda film adi YERINE gosterilir */
  const [puzzleNo, setPuzzleNo] = useState(0);
  /** Film kesfi koprusu metni — sunucudan gelir */
  const [whyThisMovie, setWhyThisMovie] = useState<WhyThisMovieText | null>(null);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [revealedFilm, setRevealedFilm] = useState<RevealedFilm | null>(null);

  // Timing
  const openTimeRef = useRef(Date.now());

  // ─── Load Puzzle ─────────────────────────────────────────────────────────

  const loadPuzzle = useCallback(async () => {
    try {
      setLoadError(false);
      setScreenState('loading');

      const puzzleDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
      const data = await getDailyChallenge('cinemetrics', puzzleDate);

      setChallenge(data);

      setPuzzleNo(data.puzzle_no);
      setWhyThisMovie(data.why_this_movie ?? null);
      if (data.revealed_solution) setRevealedFilm(data.revealed_solution);

      // Mevcut ilerleme varsa yükle
      if (data.progress) {
        setGuesses(data.progress.guesses);
        if (data.progress.completed) {
          setWon(data.progress.won);
          setScreenState('completed');
          return;
        }
      }

      setScreenState('playing');

      // Telemetri
      trackGameOpened('cinemetrics', data.puzzle_no, 'hub');

      openTimeRef.current = Date.now();
    } catch (err) {
      logger.error('[CineMetrics] Load hatası:', err);
      setLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Reset state
      setGuesses([]);
      setSelectedFilm(null);
      setIsSubmitting(false);
      setAnimatingRow(null);
      setWon(false);
      setXpAwarded(0);
      setDnaUpdated(false);
      setRevealedFilm(null);
      loadPuzzle();
    }, [loadPuzzle]),
  );

  // ─── Submit Guess ────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!selectedFilm || !challenge || isSubmitting) return;

    // UUID zorunlu — DB aramasından gelmeli
    const filmUuid = selectedFilm.uuid;
    if (!filmUuid) {
      logger.error('[CineMetrics] Film UUID bulunamadı — TMDb fallback kullanılamaz');
      return;
    }

    setIsSubmitting(true);
    const startMs = Date.now();

    try {
      const result: GuessResult = await submitGuess(
        challenge.puzzle.id,
        filmUuid,
      );

      // Feedback row'u GuessEntry'e çevir
      if (result.feedback) {
        const newGuess: GuessEntry = {
          film_id: String(selectedFilm.id),
          title: selectedFilm.title,
          feedback: result.feedback,
          timestamp: new Date().toISOString(),
          values: result.guess_values ?? undefined,
        };

        const newGuesses = [...guesses, newGuess];
        setAnimatingRow(newGuesses.length - 1);
        setGuesses(newGuesses);
        setSelectedFilm(null);

        // Telemetri
        trackGuessSubmitted('cinemetrics', newGuesses.length, Date.now() - startMs);

        // Animasyon bitimini bekle (6 hücre × 80ms + 160ms buffer)
        const animDuration = 6 * 80 + 160;
        await new Promise((r) => setTimeout(r, animDuration));
        setAnimatingRow(null);

        // Oyun tamamlandı mı?
        if (result.completed) {
          setWon(result.won);
          setXpAwarded(result.xp_awarded);
          setDnaUpdated(result.dna_updated);
          setRevealedFilm(result.revealed_solution);
          setWhyThisMovie(result.why_this_movie ?? null);
          setScreenState('completed');

          // Telemetri
          const timeToSolve = Math.round((Date.now() - openTimeRef.current) / 1000);
          trackGameCompleted({
            gameId: 'cinemetrics',
            won: result.won,
            guessesUsed: result.guesses_used,
            timeToSolveS: timeToSolve,
            xp: result.xp_awarded,
            extra: { hard_mode: false },
          });
        }
      }
    } catch (err) {
      logger.error('[CineMetrics] Submit hatası:', err);
      // Kullanıcıya görünür hata — sessiz yutma YASAK
      // Alert yerine inline state ile göster
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFilm, challenge, isSubmitting, guesses]);

  // ─── Computed Values ─────────────────────────────────────────────────────

  const maxAttempts = challenge?.puzzle.max_attempts ?? 6;
  const isGameOver = guesses.length >= maxAttempts || screenState === 'completed';

  const difficultyInfo = useMemo(() => {
    const d = challenge?.puzzle.difficulty ?? 3;
    if (d <= 2) return { color: Colors.greenBright, label: t('games.cinemetrics.difficulty.easy') };
    if (d <= 3) return { color: Colors.gold, label: t('games.cinemetrics.difficulty.medium') };
    return { color: Colors.error, label: t('games.cinemetrics.difficulty.hard') };
  }, [challenge?.puzzle.difficulty, t]);

  /** Hücre değerini formatla — gerçek metadata değerleri gösterir */
  const formatCellValue = useCallback((key: keyof FeedbackRow, guess: GuessEntry): string => {
    // guess.values varsa gerçek metadata değerlerini göster (yakınsama hissi)
    if (guess.values) {
      switch (key) {
        case 'year': return String(guess.values.year);
        case 'rating': return guess.values.rating.toFixed(1);
        case 'runtime': return `${guess.values.runtime}m`;
        case 'genres': {
          const g = guess.values.genres;
          if (g.length === 0) return '?';
          // Kısa gösterim: ilk türü göster, 2+ ise +N
          return g.length > 1 ? `${g[0]} +${g.length - 1}` : g[0];
        }
        case 'director': {
          const d = guess.values.director;
          const name = Array.isArray(d) ? d[0] : d;
          // Soyadı göster (kısa sığsın)
          const parts = name.split(' ');
          return parts.length > 1 ? parts[parts.length - 1] : name;
        }
        case 'country': {
          const c = guess.values.country;
          return c.length > 0 ? c[0] : '?';
        }
        default: return '?';
      }
    }

    // Fallback — eski format (values yoksa, önceki kayıtlı progress için)
    const cell = guess.feedback[key];
    if (cell.result === 'green') return '✓';
    if (cell.result === 'yellow') return '~';
    return '✗';
  }, []);

  /** Sonuc ekrani bir kez olculur */
  const hasTrackedResultRef = useRef(false);
  useEffect(() => {
    if (screenState === 'completed' && !hasTrackedResultRef.current) {
      hasTrackedResultRef.current = true;
      trackResultCardViewed('cinemetrics', won);
    }
  }, [screenState, won]);

  // Paylasim artik ResultCard'da — game_share_* telemetrisi oradan akiyor.

  // ─── Render: Error ───────────────────────────────────────────────────────

  if (loadError) {
    return (
      <GameShell title={t('games.cinemetrics.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  // ─── Render: Loading ─────────────────────────────────────────────────────

  if (screenState === 'loading') {
    return (
      <GameShell title={t('games.cinemetrics.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <GameStateView state="loading" />
      </GameShell>
    );
  }

  // ─── Render: Completed ───────────────────────────────────────────────────

  if (screenState === 'completed') {
    return (
      <GameShell
        title={t('games.cinemetrics.title')}
        currentAttempt={guesses.length}
        maxAttempts={maxAttempts}
        hideProgress
      >
        <ScrollView contentContainerStyle={styles.completedContainer} showsVerticalScrollIndicator={false}>
          <ResultCard
            solved={won}
            attempts={guesses.length}
            maxAttempts={maxAttempts}
            filmTitle={revealedFilm?.title ?? ''}
            filmYear={revealedFilm?.year ?? 0}
            filmPosterUrl={revealedFilm?.poster_url ?? null}
            filmUuid={revealedFilm?.film_id}
            streak={0}
            gameTitle={t('games.cinemetrics.title')}
            gameType="cinemetrics"
            puzzleNo={puzzleNo}
            xpAwarded={xpAwarded}
            dnaUpdated={dnaUpdated}
            whyThisMovie={whyThisMovie ?? undefined}
            resultMessage={
              won
                ? t('games.cinemetrics.result.won', { count: guesses.length, max: maxAttempts })
                : t('games.cinemetrics.try_tomorrow')
            }
            countdown={countdown}
            onBackToHub={() => router.back()}
          />
        </ScrollView>
      </GameShell>
    );
  }

  // ─── Render: Playing ─────────────────────────────────────────────────────

  const emptyRows = Math.max(0, maxAttempts - guesses.length);

  return (
    <GameShell
      title={t('games.cinemetrics.title')}
      currentAttempt={guesses.length}
      maxAttempts={maxAttempts}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header: Puzzle No + Difficulty */}
        <View style={styles.headerRow}>
          <Text style={styles.puzzleNo}>
            Chosy #{challenge?.puzzle_no ?? 0}
          </Text>
          <View style={styles.difficultyBadge}>
            <Circle size={10} color={difficultyInfo.color} weight="fill" />
            <Text style={[styles.difficultyText, { color: difficultyInfo.color }]}>
              {difficultyInfo.label}
            </Text>
          </View>
        </View>

        {/* Grid */}
        <View style={styles.gridContainer}>
          {/* Column Headers */}
          <View style={styles.columnHeaders}>
            <View style={styles.filmColHeader} />
            {COLUMN_KEYS.map((key) => (
              <View key={key} style={styles.colHeader}>
                <Text style={styles.colHeaderText}>
                  {t(`games.cinemetrics.columns.${key}`)}
                </Text>
              </View>
            ))}
          </View>

          {/* Filled rows */}
          {guesses.map((guess, rowIdx) => (
            <View key={`guess-${rowIdx}`} style={styles.guessRow}>
              <View style={styles.filmNameCol}>
                <Text style={styles.filmNameText} numberOfLines={1}>
                  {guess.title}
                </Text>
              </View>
              {COLUMN_KEYS.map((key, colIdx) => (
                <FlipCell
                  key={`${rowIdx}-${key}`}
                  feedback={guess.feedback[key]}
                  value={formatCellValue(key, guess)}
                  index={colIdx}
                  columnKey={key}
                  animate={animatingRow === rowIdx}
                />
              ))}
            </View>
          ))}

          {/* Empty rows — ilk sira aktif olarak vurgulanir */}
          {Array.from({ length: emptyRows }).map((_, i) => (
            <View key={`empty-${i}`} style={styles.emptyRow}>
              <View style={styles.emptyFilmCol} />
              {COLUMN_KEYS.map((key) => (
                <View
                  key={`empty-${i}-${key}`}
                  style={[
                    styles.cell,
                    styles.cellEmpty,
                    i === 0 && styles.cellActiveRow,
                  ]}
                />
              ))}
            </View>
          ))}
        </View>

        {/*
          Renk/ok dili aciklamasi. Grid ilk acilista 36 bos kutudan ibaretti ve
          hicbir yerde ne anlama geldikleri yazmiyordu.
        */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.cellGreen]} />
            <Text style={styles.legendText}>{t('games.cinemetrics.legend_green')}</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendSwatch, styles.cellYellow]} />
            <Text style={styles.legendText}>{t('games.cinemetrics.legend_yellow')}</Text>
          </View>
          <View style={styles.legendItem}>
            <ArrowUp size={12} color={Colors.textTertiary} weight="duotone" />
            <ArrowDown size={12} color={Colors.textTertiary} weight="duotone" />
            <Text style={styles.legendText}>{t('games.cinemetrics.legend_arrows')}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Input Area */}
      <View style={styles.inputArea}>
        <FilmSearchInput
          onSelect={(film) => setSelectedFilm(film)}
          disabled={isGameOver || isSubmitting}
          placeholder={t('games.search_placeholder')}
        />
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedFilm || isSubmitting) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedFilm || isSubmitting}
          activeOpacity={0.7}
        accessibilityRole="button"
        >
          <Text style={styles.submitButtonText}>
            {t('games.cinemetrics.submit')}
          </Text>
        </TouchableOpacity>
      </View>
    </GameShell>
  );
}
