/**
 * DetectiveGame — 3-asamali gunluk dedektif oyunu.
 *
 * Stage 1 (Investigation): 12 film grid, her yanlis 1 eleme + 1 yeni ipucu.
 * Stage 2 (Deduction): Kalan <=6 film, poster-first UI + CineMetrics feedback.
 * Stage 3 (Case Closed): Skor, histogram, why-this-movie, film koprusu.
 *
 * Cozum istemciye INMEZ — tum dogrulama submit-guess Edge Function'da.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  ArrowDown,
  ArrowUp,
  CalendarBlank,
  FilmSlate,
  Star,
  Timer,
  UsersThree,
  VideoCamera,
  XCircle,
} from 'phosphor-react-native';

import { DnaXpReveal } from '@/components/games/DnaXpReveal';
import { PlayNextBridge } from '@/components/games/PlayNextBridge';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/react-native';
import { addToWatchlist } from '@/services/watchlist';
import {
  trackGameOpened,
  trackGuessSubmitted,
  trackGameCompleted,
  trackFilmPageOpened,
  trackWatchlistAdded,
} from '@/utils/gameAnalytics';
import { getDailyChallenge, submitDetectiveGuess } from '@/services/gameApi';
import { GameShell } from '@/components/games/GameShell';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import type { FilmSearchResult } from '@/services/gameTypes';
import type {
  CommunityStats,
  DailyChallenge,
  DetectiveGuessResult,
  DetectivePuzzleData,
  DetectiveStage,
  FeedbackCell,
  FeedbackRow,
  GuessEntry,
  GuessValues,
  RevealedFilm,
  SpotlightClue,
  SpotlightOption,
  WhyThisMovie,
} from '@/types/game';

import { CaseHeader } from './CaseHeader';
import { StageTransition } from './StageTransition';
import { DetectiveScoreCard } from './DetectiveScoreCard';
import { CommunityHistogram } from './CommunityHistogram';
import { WhyThisMovieCard } from './WhyThisMovie';
import { FilmDiscoveryBridge } from './FilmDiscoveryBridge';
import { styles, CARD_W_SMALL, CARD_H_SMALL, CARD_W, CARD_H } from './styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'stage1' | 'transition' | 'stage2' | 'completed';

/** Feedback sutun anahtarlari (grid sirasi) */
const COLUMN_KEYS: (keyof FeedbackRow)[] = [
  'year', 'genres', 'director', 'rating', 'runtime', 'country',
];

// ─── Clue icon mapping ──────────────────────────────────────────────────────

const CLUE_ICON: Record<string, React.ReactNode> = {
  year_range: <CalendarBlank size={16} color="#0D9488" weight="duotone" />,
  genres: <FilmSlate size={16} color="#0D9488" weight="duotone" />,
  runtime: <Timer size={16} color="#0D9488" weight="duotone" />,
  imdb_rating: <Star size={16} color="#0D9488" weight="duotone" />,
  cast: <UsersThree size={16} color="#0D9488" weight="duotone" />,
  director: <VideoCamera size={16} color="#0D9488" weight="duotone" />,
};

/** Ipucu degerini gosterim formatina cevirir */
function formatClueValue(clue: SpotlightClue, t: (key: string) => string): string {
  switch (clue.type) {
    case 'year_range':
      return String(clue.value);
    case 'genres':
      return Array.isArray(clue.value) ? clue.value.join(', ') : String(clue.value);
    case 'runtime':
      return `${clue.value} ${t('games.detective.clue_labels.minutes')}`;
    case 'imdb_rating':
      return `${clue.value} IMDb`;
    case 'cast':
      return Array.isArray(clue.value) ? clue.value.join(', ') : String(clue.value);
    case 'director':
      return String(clue.value);
    default:
      return String(clue.value);
  }
}

/** Hucre degerini formatla */
function formatCellValue(key: keyof FeedbackRow, guess: GuessEntry): string {
  if (guess.values) {
    switch (key) {
      case 'year': return String(guess.values.year);
      case 'rating': return guess.values.rating.toFixed(1);
      case 'runtime': return `${guess.values.runtime}m`;
      case 'genres': {
        const g = guess.values.genres;
        if (g.length === 0) return '?';
        return g.length > 1 ? `${g[0]} +${g.length - 1}` : g[0];
      }
      case 'director': {
        const d = guess.values.director;
        const name = Array.isArray(d) ? d[0] : d;
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
  const cell = guess.feedback[key];
  if (cell.result === 'green') return '✓';
  if (cell.result === 'yellow') return '~';
  return '✗';
}

// ─── Countdown Hook ──────────────────────────────────────────────────────────

/** Gece yarisina geri sayim */
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

// ─── Film Card (Stage 1 — Investigation) ────────────────────────────────────

interface InvestigationCardProps {
  option: SpotlightOption;
  selected: boolean;
  result: 'none' | 'correct' | 'wrong';
  eliminated: boolean;
  onPress: () => void;
  disabled: boolean;
  small?: boolean;
}

/** Film kart componenti — Stage 1 (3x4) ve Stage 2 (2x3) icin kullanilir */
function FilmCard({ option, selected, result, eliminated, onPress, disabled, small }: InvestigationCardProps) {
  const scale = useSharedValue(1);
  const shakeX = useSharedValue(0);
  const opacity = useSharedValue(eliminated ? 0.35 : 1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: shakeX.value }],
    opacity: opacity.value,
  }));

  useEffect(() => {
    if (result === 'correct') {
      scale.value = withTiming(1.05, { duration: 200 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } else if (result === 'wrong') {
      shakeX.value = withSequence(
        withTiming(-10, { duration: 75 }),
        withTiming(10, { duration: 75 }),
        withTiming(-10, { duration: 75 }),
        withTiming(0, { duration: 75 }),
      );
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      opacity.value = withDelay(300, withTiming(0.35, { duration: 400 }));
    }
  }, [result, scale, shakeX, opacity]);

  useEffect(() => {
    if (eliminated && result === 'none') {
      opacity.value = 0.35;
    }
  }, [eliminated, result, opacity]);

  const handlePress = () => {
    if (disabled || eliminated) return;
    scale.value = withSequence(
      withTiming(0.95, { duration: 75 }),
      withTiming(1, { duration: 75 }),
    );
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const cardW = small ? CARD_W_SMALL : CARD_W;
  const cardH = small ? CARD_H_SMALL : CARD_H;

  const borderStyle =
    result === 'correct' ? styles.filmCardCorrect
      : result === 'wrong' ? styles.filmCardWrong
        : selected ? styles.filmCardSelected
          : eliminated ? styles.filmCardEliminated
            : undefined;

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.filmCard, { width: cardW }, borderStyle]}
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={disabled || eliminated}
      >
        {option.poster_url ? (
          <Image
            source={{ uri: option.poster_url }}
            style={[styles.filmPoster, { height: cardH }]}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.filmPosterPlaceholder, { height: cardH }]}>
            <Ionicons name="film-outline" size={small ? 24 : 32} color={Colors.textTertiary} />
          </View>
        )}
        <View style={styles.filmInfoBar}>
          <Text style={[styles.filmTitle, small && styles.filmTitleSmall]} numberOfLines={1}>
            {option.title}
          </Text>
        </View>
        {eliminated && (
          <View style={styles.eliminatedOverlay}>
            <XCircle size={small ? 28 : 36} color="#FFFFFF" weight="fill" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Flip Cell (Stage 2 Feedback) ───────────────────────────────────────────

interface FlipCellProps {
  feedback: FeedbackCell;
  value: string;
  index: number;
  columnKey: keyof FeedbackRow;
  animate: boolean;
}

/** Tek bir grid hucresi — flip animasyonu ile feedback gosterir */
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
    const timer = setTimeout(() => {
      setShowResult(true);
      if (index === 5) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <Animated.View style={[styles.feedbackCell, cellBgStyle, animatedStyle]}>
      <Text style={[styles.feedbackCellText, textStyle]} numberOfLines={1}>
        {showResult ? value : ''}
      </Text>
      {showResult && hasDirection && feedback.result !== 'green' && (
        <View style={styles.directionArrow}>
          {feedback.direction === 'up' ? (
            <ArrowUp size={10} color={feedback.result === 'yellow' ? '#0A0A0F' : '#FFFFFF'} weight="duotone" />
          ) : (
            <ArrowDown size={10} color={feedback.result === 'yellow' ? '#0A0A0F' : '#FFFFFF'} weight="duotone" />
          )}
        </View>
      )}
    </Animated.View>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DetectiveGame() {
  const { t } = useLanguage();
  const router = useRouter();
  const countdown = useCountdown();

  // Core state
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [puzzleData, setPuzzleData] = useState<DetectivePuzzleData | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Stage 1 state
  const [allOptions, setAllOptions] = useState<SpotlightOption[]>([]);
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [visibleClues, setVisibleClues] = useState<SpotlightClue[]>([]);
  const [selectedFilmId, setSelectedFilmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardResult, setCardResult] = useState<Record<string, 'none' | 'correct' | 'wrong'>>({});
  const [totalGuesses, setTotalGuesses] = useState(0);

  // Stage 2 state
  const [stage2Options, setStage2Options] = useState<SpotlightOption[]>([]);
  const [stage2Guesses, setStage2Guesses] = useState<GuessEntry[]>([]);
  const [selectedStage2Film, setSelectedStage2Film] = useState<string | null>(null);
  const [stage2Eliminated, setStage2Eliminated] = useState<string[]>([]);
  const [animatingRow, setAnimatingRow] = useState<number | null>(null);
  const [selectedFeedbackFilm, setSelectedFeedbackFilm] = useState<string | null>(null);

  // Completed state
  const [won, setWon] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [revealedFilm, setRevealedFilm] = useState<RevealedFilm | null>(null);
  const [watchlistAdded, setWatchlistAdded] = useState(false);
  const [detectiveScore, setDetectiveScore] = useState(0);
  const [luckySpot, setLuckySpot] = useState(false);
  const [whyThisMovie, setWhyThisMovie] = useState<WhyThisMovie | null>(null);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);

  // Timing
  const timerStartRef = useRef(Date.now());
  const [timerStartMs, setTimerStartMs] = useState(Date.now());

  // ─── Load Puzzle ──────────────────────────────────────────────────────────

  const loadPuzzle = useCallback(async () => {
    try {
      setLoadError(false);
      setScreenState('loading');

      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const data = await getDailyChallenge('detective', puzzleDate);
      setChallenge(data);

      const pd = data.puzzle.puzzle_data as unknown as DetectivePuzzleData;
      setPuzzleData(pd);
      setAllOptions(pd.options);

      // Mevcut ilerleme varsa yukle
      if (data.progress?.completed) {
        setWon(data.progress.won);
        setTotalGuesses(data.progress.total_guesses ?? 0);
        setHintsUsed(data.progress.hints_used ?? 0);
        setScreenState('completed');

        // Community stats from get-daily-challenge
        if (data.community_stats) {
          setCommunityStats(data.community_stats);
        }
        return;
      }

      // Restore in-progress state
      const progress = data.progress;
      if (progress) {
        const restoredEliminated: string[] = progress.eliminated_ids ?? [];
        setEliminatedIds(restoredEliminated);
        setTotalGuesses(progress.total_guesses ?? restoredEliminated.length);
        setHintsUsed(progress.hints_used ?? 0);

        // Timer restore
        if (progress.timer_start_ms) {
          setTimerStartMs(progress.timer_start_ms);
          timerStartRef.current = progress.timer_start_ms;
        }

        // Determine current stage
        const stage = progress.stage ?? 1;
        if (stage === 2) {
          // Restore Stage 2
          const remaining = pd.options.filter(o => !restoredEliminated.includes(o.film_id));
          setStage2Options(remaining);
          setStage2Guesses(progress.stage2_guesses ?? []);

          // Stage 2 eliminated (wrong guesses in stage 2)
          const s2Elim = (progress.stage2_guesses ?? [])
            .filter((g: GuessEntry) => {
              const fb = g.feedback;
              return !Object.values(fb).every((c: FeedbackCell) => c.result === 'green');
            })
            .map((g: GuessEntry) => g.film_id);
          setStage2Eliminated(s2Elim);

          // Show all clues
          setVisibleClues(pd.clues);
          setScreenState('stage2');
        } else {
          // Restore Stage 1
          const turn = restoredEliminated.length + 1;
          setVisibleClues(pd.clues.filter(c => c.turn <= turn));
          setScreenState('stage1');
        }
      } else {
        // Fresh game
        setVisibleClues(pd.clues.filter(c => c.turn <= 1));
        const now = Date.now();
        setTimerStartMs(now);
        timerStartRef.current = now;
        setScreenState('stage1');
      }

      trackGameOpened('detective', data.puzzle_no, 'hub');
    } catch (err) {
      logger.error('[Detective] Load hatasi:', err);
      setLoadError(true);
      setScreenState('loading');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Reset all state
      setSelectedFilmId(null);
      setSelectedStage2Film(null);
      setSelectedFeedbackFilm(null);
      setIsSubmitting(false);
      setCardResult({});
      setEliminatedIds([]);
      setStage2Eliminated([]);
      setStage2Guesses([]);
      setStage2Options([]);
      setAnimatingRow(null);
      setWon(false);
      setXpAwarded(0);
      setDnaUpdated(false);
      setRevealedFilm(null);
      setDetectiveScore(0);
      setLuckySpot(false);
      setWhyThisMovie(null);
      setCommunityStats(null);
      setHintsUsed(0);
      setTotalGuesses(0);
      loadPuzzle();
    }, [loadPuzzle]),
  );

  // ─── Stage 1 Submit (Investigation) ───────────────────────────────────────

  const handleStage1Submit = useCallback(async () => {
    if (!selectedFilmId || !challenge || isSubmitting) return;

    setIsSubmitting(true);
    const startMs = Date.now();

    try {
      const result: DetectiveGuessResult = await submitDetectiveGuess(
        challenge.puzzle.id,
        selectedFilmId,
        1,
      );

      const newTotal = (totalGuesses + 1);
      setTotalGuesses(newTotal);

      trackGuessSubmitted('detective', newTotal, Date.now() - startMs, { stage: 1 });

      if (result.correct) {
        // Lucky Spot — solved in Stage 1!
        setCardResult({ [selectedFilmId]: 'correct' });
        await new Promise(r => setTimeout(r, 800));

        setWon(true);
        setLuckySpot(result.lucky_spot ?? true);
        setDetectiveScore(result.detective_score ?? 0);
        setXpAwarded(result.xp_awarded);
        setDnaUpdated(result.dna_updated);
        setRevealedFilm(result.revealed_solution ?? null);
        setWhyThisMovie(result.why_this_movie ?? null);
        setCommunityStats(result.community_stats ?? null);
        setScreenState('completed');

        trackGameCompleted({
          gameId: 'detective',
          won: true,
          guessesUsed: newTotal,
          timeToSolveS: Math.round((Date.now() - (timerStartRef.current ?? Date.now())) / 1000),
          xp: result.xp_awarded,
          extra: { lucky_spot: true },
        });
      } else {
        // Wrong — eliminate + next clue
        setCardResult({ [selectedFilmId]: 'wrong' });

        const newEliminated = result.eliminated_ids ?? [...eliminatedIds, selectedFilmId];
        setEliminatedIds(newEliminated);

        await new Promise(r => setTimeout(r, 800));
        setCardResult({});
        setSelectedFilmId(null);

        // New clue
        if (result.next_clue) {
          setVisibleClues(prev => [...prev, result.next_clue!]);
        }

        // Stage transition?
        if (result.stage_transition) {
          // Build remaining options for Stage 2
          const remaining = allOptions.filter(o => !newEliminated.includes(o.film_id));
          setStage2Options(remaining);
          setVisibleClues(puzzleData?.clues ?? []);
          setScreenState('transition');
        }

        // Check if game over (all 12 used in stage 1 — shouldn't happen normally)
        if (result.completed && !result.correct) {
          setWon(false);
          setDetectiveScore(result.detective_score ?? 0);
          setXpAwarded(result.xp_awarded);
          setDnaUpdated(result.dna_updated);
          setRevealedFilm(result.revealed_solution ?? null);
          setWhyThisMovie(result.why_this_movie ?? null);
          setCommunityStats(result.community_stats ?? null);
          setScreenState('completed');
        }
      }
    } catch (err) {
      logger.error('[Detective] Stage 1 submit hatasi:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFilmId, challenge, isSubmitting, totalGuesses, eliminatedIds, allOptions, puzzleData]);

  // ─── Stage 2 Submit (Deduction — poster select) ──────────────────────────

  const handleStage2Submit = useCallback(async () => {
    if (!selectedStage2Film || !challenge || isSubmitting) return;

    setIsSubmitting(true);
    const startMs = Date.now();

    try {
      const result: DetectiveGuessResult = await submitDetectiveGuess(
        challenge.puzzle.id,
        selectedStage2Film,
        2,
      );

      const newTotal = totalGuesses + 1;
      setTotalGuesses(newTotal);

      trackGuessSubmitted('detective', newTotal, Date.now() - startMs, { stage: 2 });

      if (result.correct) {
        setCardResult({ [selectedStage2Film]: 'correct' });
        await new Promise(r => setTimeout(r, 800));

        setWon(true);
        setDetectiveScore(result.detective_score ?? 0);
        setXpAwarded(result.xp_awarded);
        setDnaUpdated(result.dna_updated);
        setRevealedFilm(result.revealed_solution ?? null);
        setWhyThisMovie(result.why_this_movie ?? null);
        setCommunityStats(result.community_stats ?? null);
        setScreenState('completed');

        trackGameCompleted({
          gameId: 'detective',
          won: true,
          guessesUsed: newTotal,
          timeToSolveS: Math.round((Date.now() - (timerStartRef.current ?? Date.now())) / 1000),
          xp: result.xp_awarded,
          extra: { detective_score: result.detective_score ?? 0 },
        });
      } else {
        // Wrong — show feedback, dim poster
        setCardResult({ [selectedStage2Film]: 'wrong' });

        if (result.feedback) {
          const newGuess: GuessEntry = {
            film_id: selectedStage2Film,
            title: stage2Options.find(o => o.film_id === selectedStage2Film)?.title ?? '',
            feedback: result.feedback,
            timestamp: new Date().toISOString(),
            values: result.guess_values ?? undefined,
          };
          const newGuesses = [...stage2Guesses, newGuess];
          setAnimatingRow(newGuesses.length - 1);
          setStage2Guesses(newGuesses);
          setSelectedFeedbackFilm(selectedStage2Film);
        }

        setStage2Eliminated(prev => [...prev, selectedStage2Film]);

        await new Promise(r => setTimeout(r, 800));
        setCardResult({});
        setSelectedStage2Film(null);
        setAnimatingRow(null);

        // Game over?
        if (result.completed) {
          await new Promise(r => setTimeout(r, 600));
          setWon(false);
          setDetectiveScore(result.detective_score ?? 0);
          setXpAwarded(result.xp_awarded);
          setDnaUpdated(result.dna_updated);
          setRevealedFilm(result.revealed_solution ?? null);
          setWhyThisMovie(result.why_this_movie ?? null);
          setCommunityStats(result.community_stats ?? null);
          setScreenState('completed');

          trackGameCompleted({
            gameId: 'detective',
            won: false,
            guessesUsed: newTotal,
            timeToSolveS: Math.round((Date.now() - (timerStartRef.current ?? Date.now())) / 1000),
            xp: result.xp_awarded,
          });
        }
      }
    } catch (err) {
      logger.error('[Detective] Stage 2 submit hatasi:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedStage2Film, challenge, isSubmitting, totalGuesses, stage2Options, stage2Guesses]);

  // ─── Transition Continue ─────────────────────────────────────────────────

  const handleTransitionContinue = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setScreenState('stage2');
  }, []);

  // ─── Computed ─────────────────────────────────────────────────────────────

  const difficultyInfo = useMemo(() => {
    const d = challenge?.puzzle.difficulty ?? 3;
    if (d <= 2) return { color: '#22C55E', label: t('games.detective.difficulty.easy') };
    if (d <= 3) return { color: '#D4A843', label: t('games.detective.difficulty.medium') };
    return { color: '#EF4444', label: t('games.detective.difficulty.hard') };
  }, [challenge?.puzzle.difficulty, t]);

  const remainingCount = allOptions.length - eliminatedIds.length;
  const timeSeconds = Math.floor((Date.now() - timerStartMs) / 1000);

  // Last feedback for selected film in Stage 2
  const lastFeedbackForSelected = useMemo(() => {
    if (!selectedFeedbackFilm) return null;
    return stage2Guesses.find(g => g.film_id === selectedFeedbackFilm) ?? null;
  }, [selectedFeedbackFilm, stage2Guesses]);

  // ─── Film kesfi ─────────────────────────────────────────────────────────

  /** Cozum filminin detay sayfasina gider */
  const handleOpenFilm = useCallback(() => {
    if (!revealedFilm?.film_id) return;
    trackFilmPageOpened('detective', 0);
    router.push(`/film/${revealedFilm.film_id}`);
  }, [revealedFilm, router]);

  /** Cozum filmini izleme listesine ekler */
  const handleAddToWatchlist = useCallback(async () => {
    if (!revealedFilm?.film_id || watchlistAdded) return;
    try {
      await addToWatchlist({
        id: revealedFilm.film_id,
        title: revealedFilm.title,
        year: revealedFilm.year,
        posterUrl: revealedFilm.poster_url ?? '',
        matchScore: 0,
        moodTags: [],
        whyThisFilm: '',
        director: revealedFilm.director ?? undefined,
      });
      trackWatchlistAdded('detective', 0);
      setWatchlistAdded(true);
    } catch (err) {
      // Hard Rule 5: sessiz fallback yok
      logger.error('[Detective] Watchlist ekleme hatasi:', err);
      Sentry.captureException(err, { tags: { game: 'detective', action: 'watchlist_add' } });
    }
  }, [revealedFilm, watchlistAdded]);

  // ─── Render: Error ─────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <GameShell title={t('games.detective.title')} currentAttempt={0} maxAttempts={12}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{t('games.result.error_title')}</Text>
          <Text style={styles.errorSubtext}>{t('games.result.error_subtitle')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadPuzzle}>
            <Text style={styles.retryButtonText}>{t('games.cinemetrics.retry')}</Text>
          </TouchableOpacity>
        </View>
      </GameShell>
    );
  }

  // ─── Render: Loading ───────────────────────────────────────────────────────

  if (screenState === 'loading') {
    return (
      <GameShell title={t('games.detective.title')} currentAttempt={0} maxAttempts={12}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Animated.View entering={FadeInDown.duration(300)} style={styles.skeletonPanel} />
          <View style={styles.cardGridSmall}>
            {Array.from({ length: 12 }).map((_, i) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(i * 50).duration(300)}
                style={styles.skeletonCardSmall}
              />
            ))}
          </View>
        </ScrollView>
      </GameShell>
    );
  }

  // ─── Render: Stage Transition ──────────────────────────────────────────────

  if (screenState === 'transition') {
    return (
      <GameShell
        title={t('games.detective.title')}
        currentAttempt={totalGuesses}
        maxAttempts={12}
        hideProgress
      >
        <StageTransition
          remainingCount={stage2Options.length}
          onContinue={handleTransitionContinue}
        />
      </GameShell>
    );
  }

  // ─── Render: Completed (Stage 3) ──────────────────────────────────────────

  if (screenState === 'completed') {
    return (
      <GameShell
        title={t('games.detective.title')}
        currentAttempt={totalGuesses}
        maxAttempts={12}
        hideProgress
      >
        <ScrollView
          contentContainerStyle={styles.completedContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Film Poster */}
          {revealedFilm?.poster_url && (
            <Image
              source={{ uri: revealedFilm.poster_url }}
              style={styles.completedPoster}
              contentFit="cover"
              transition={300}
            />
          )}

          {/* Film Title */}
          {revealedFilm && (
            <Text style={styles.completedTitle}>{revealedFilm.title}</Text>
          )}

          {/* Result Message */}
          {won ? (
            <Animated.View entering={FadeInUp.delay(200).duration(300)}>
              <Text style={styles.wonMessage}>{t('games.detective.result_solved')}</Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.delay(200).duration(300)}>
              <Text style={styles.lostMessage}>{t('games.detective.result_cold')}</Text>
            </Animated.View>
          )}

          {/* Detective Score Card */}
          <DetectiveScoreCard
            score={detectiveScore}
            totalGuesses={totalGuesses}
            hintsUsed={hintsUsed}
            timeSeconds={timeSeconds}
            won={won}
            luckySpot={luckySpot}
          />

          {/* XP + DNA */}
          <DnaXpReveal
            xpAwarded={xpAwarded}
            dnaUpdated={dnaUpdated}
            solved={won}
          />

          {/* Community Histogram */}
          {communityStats && (
            <CommunityHistogram
              distribution={communityStats.distribution}
              totalPlayers={communityStats.total_players}
              percentile={communityStats.percentile}
              userGuesses={totalGuesses}
              won={won}
            />
          )}

          {/* Why This Movie */}
          {whyThisMovie && (
            <WhyThisMovieCard
              clueExplanations={whyThisMovie.clue_explanations}
              decoyConnections={whyThisMovie.decoy_connections}
              funFact={whyThisMovie.fun_fact}
            />
          )}

          {/* Film Discovery Bridge */}
          {revealedFilm && (
            <FilmDiscoveryBridge
              filmTitle={revealedFilm.title}
              onWatch={handleOpenFilm}
              onWatchlist={handleAddToWatchlist}
              onReviews={handleOpenFilm}
            />
          )}

          {/* Countdown */}
          <View style={styles.countdownSection}>
            <Text style={styles.countdownLabel}>{t('games.detective.next_case')}</Text>
            <Text style={styles.countdownTime}>{countdown}</Text>
          </View>

          {/* Play Next */}
          <PlayNextBridge currentGame="detective" />

          {/* Actions */}
          <View style={styles.completedActions}>
            <TouchableOpacity style={styles.shareButton} onPress={() => {}}>
              <Text style={styles.shareButtonText}>{t('games.detective.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.hubButton} onPress={() => router.back()}>
              <Text style={styles.hubButtonText}>{t('games.detective.back_to_hub')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </GameShell>
    );
  }

  // ─── Render: Stage 2 (Deduction) ──────────────────────────────────────────

  if (screenState === 'stage2') {
    const hasSelection = selectedStage2Film != null;
    const hasCardResultPending = Object.keys(cardResult).length > 0;

    return (
      <GameShell
        title={t('games.detective.title')}
        currentAttempt={totalGuesses}
        maxAttempts={12}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Case Header */}
          <CaseHeader
            caseNumber={challenge?.puzzle_no ?? 0}
            stage={2}
            timerStartMs={timerStartMs}
          />

          {/* Stage 2: Poster Grid (2x3) — always visible */}
          <View style={styles.cardGrid}>
            {stage2Options.map((option, i) => {
              const isEliminated = stage2Eliminated.includes(option.film_id);
              return (
                <Animated.View
                  key={`s2-${option.film_id}`}
                  entering={FadeInDown.delay(i * 60).duration(250)}
                >
                  <FilmCard
                    option={option}
                    selected={selectedStage2Film === option.film_id}
                    result={cardResult[option.film_id] ?? 'none'}
                    eliminated={isEliminated}
                    onPress={() => {
                      if (!hasCardResultPending && !isEliminated) {
                        setSelectedStage2Film(option.film_id);
                        setSelectedFeedbackFilm(option.film_id);
                      }
                    }}
                    disabled={isSubmitting || hasCardResultPending}
                  />
                </Animated.View>
              );
            })}
          </View>

          {/* Feedback Panel — shows evidence for selected film */}
          {selectedFeedbackFilm && lastFeedbackForSelected && (
            <Animated.View entering={FadeInUp.duration(300)} style={styles.feedbackPanel}>
              <Text style={styles.feedbackPanelTitle}>
                {t('games.detective.evidence_for', {
                  film: lastFeedbackForSelected.title,
                })}
              </Text>
              <View style={styles.feedbackRow}>
                {COLUMN_KEYS.map((key, idx) => (
                  <View key={key} style={styles.feedbackColWrap}>
                    <Text style={styles.feedbackColLabel}>
                      {t(`games.detective.columns.${key}`)}
                    </Text>
                    <FlipCell
                      feedback={lastFeedbackForSelected.feedback[key]}
                      value={formatCellValue(key, lastFeedbackForSelected)}
                      index={idx}
                      columnKey={key}
                      animate={animatingRow === stage2Guesses.indexOf(lastFeedbackForSelected)}
                    />
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Previous guesses feedback summary */}
          {stage2Guesses.length > 0 && (
            <View style={styles.previousGuesses}>
              {stage2Guesses.map((guess, idx) => (
                <TouchableOpacity
                  key={`prev-${idx}`}
                  style={[
                    styles.prevGuessRow,
                    selectedFeedbackFilm === guess.film_id && styles.prevGuessRowActive,
                  ]}
                  onPress={() => setSelectedFeedbackFilm(guess.film_id)}
                >
                  <Text style={styles.prevGuessTitle} numberOfLines={1}>
                    {guess.title}
                  </Text>
                  <View style={styles.prevGuessDots}>
                    {COLUMN_KEYS.map(key => {
                      const r = guess.feedback[key].result;
                      return (
                        <View
                          key={key}
                          style={[
                            styles.prevGuessDot,
                            r === 'green' ? styles.dotGreen
                              : r === 'yellow' ? styles.dotYellow
                                : styles.dotGray,
                          ]}
                        />
                      );
                    })}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Deduce Button */}
          <TouchableOpacity
            style={[
              styles.guessButton,
              (!hasSelection || isSubmitting || hasCardResultPending) && styles.guessButtonDisabled,
            ]}
            onPress={handleStage2Submit}
            disabled={!hasSelection || isSubmitting || hasCardResultPending}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.guessButtonText,
                (!hasSelection || isSubmitting || hasCardResultPending) && styles.guessButtonTextDisabled,
              ]}
            >
              {t('games.detective.deduce_button')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </GameShell>
    );
  }

  // ─── Render: Stage 1 (Investigation) ──────────────────────────────────────

  const hasSelection = selectedFilmId != null;
  const hasCardResultPending = Object.keys(cardResult).length > 0;

  return (
    <GameShell
      title={t('games.detective.title')}
      currentAttempt={totalGuesses}
      maxAttempts={12}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Case Header */}
        <CaseHeader
          caseNumber={challenge?.puzzle_no ?? 0}
          stage={1}
          timerStartMs={timerStartMs}
        />

        {/* Clue Panel */}
        <View style={styles.cluePanel}>
          <Text style={styles.cluePanelTitle}>
            {t('games.detective.clues_title')}
          </Text>
          {visibleClues.map((clue, i) => (
            <Animated.View
              key={`clue-${clue.turn}`}
              entering={i === visibleClues.length - 1 ? FadeInDown.duration(300) : undefined}
              style={styles.clueRow}
            >
              <View style={styles.clueIconWrap}>
                {CLUE_ICON[clue.type]}
              </View>
              <Text style={styles.clueLabel}>
                {t(`games.detective.clue_labels.${clue.type}`)}
              </Text>
              <Text style={styles.clueValue} numberOfLines={2}>
                {formatClueValue(clue, t)}
              </Text>
            </Animated.View>
          ))}
        </View>

        {/* Turn Indicator */}
        <View style={styles.turnIndicator}>
          <Text style={styles.turnText}>
            {t('games.detective.remaining', { count: String(remainingCount) })}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(eliminatedIds.length / (allOptions.length - 1)) * 100}%` },
              ]}
            />
          </View>
        </View>

        {/* Film Cards 3×4 Grid */}
        <View style={styles.cardGridSmall}>
          {allOptions.map((option, i) => {
            const isEliminated = eliminatedIds.includes(option.film_id);
            return (
              <Animated.View
                key={`s1-${option.film_id}`}
                entering={FadeInDown.delay(i * 40).duration(250)}
              >
                <FilmCard
                  option={option}
                  selected={selectedFilmId === option.film_id}
                  result={cardResult[option.film_id] ?? 'none'}
                  eliminated={isEliminated}
                  onPress={() => {
                    if (!hasCardResultPending && !isEliminated) {
                      setSelectedFilmId(option.film_id);
                    }
                  }}
                  disabled={isSubmitting || hasCardResultPending}
                  small
                />
              </Animated.View>
            );
          })}
        </View>

        {/* Investigate Button */}
        <TouchableOpacity
          style={[
            styles.guessButton,
            (!hasSelection || isSubmitting || hasCardResultPending) && styles.guessButtonDisabled,
          ]}
          onPress={handleStage1Submit}
          disabled={!hasSelection || isSubmitting || hasCardResultPending}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.guessButtonText,
              (!hasSelection || isSubmitting || hasCardResultPending) && styles.guessButtonTextDisabled,
            ]}
          >
            {t('games.detective.investigate_button')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </GameShell>
  );
}
