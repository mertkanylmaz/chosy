/**
 * DetectiveGame — gunluk dedektif oyunu (tek fazli eleme).
 *
 * Sorusturma: 12 film grid, her yanlis tahmin 1 eleme + 1 yeni ipucu.
 * 6 yanlis tahminde kayip. Bitis: skor, histogram, ipucu cozumlemesi, kesif.
 *
 * Ikinci faz (karsilastirmali feedback) kaldirildi — 1. fazda ogrenilen
 * ipuclarini tekrar ediyor, yeni bilgi uretmiyordu.
 *
 * Cozum istemciye INMEZ — tum dogrulama submit-guess Edge Function'da.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { CalendarBlank, FilmSlate, Star, Timer, UsersThree, VideoCamera, XCircle } from 'phosphor-react-native';

import { DnaXpReveal } from '@/components/games/DnaXpReveal';
import { GameShareCard, useShareCapture } from '@/components/ShareCards';
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
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/utils/logger';
import * as Sentry from '@sentry/react-native';
import {
  trackGameOpened,
  trackGuessSubmitted,
  trackGameCompleted,
  trackResultCardViewed,
  trackShareRendered,
  trackShareCompleted,
} from '@/utils/gameAnalytics';
import { getDailyChallenge, submitDetectiveGuess } from '@/services/gameApi';
import { GameShell } from '@/components/games/GameShell';
import { GameStateView } from '@/components/games/GameStateView';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import type { FilmSearchResult } from '@/services/gameTypes';
import type {
  CommunityStats,
  DailyChallenge,
  DetectiveGuessResult,
  DetectivePuzzleData,
  RevealedFilm,
  SpotlightClue,
  SpotlightOption,
  WhyThisMovieText,
  DetectiveClueBreakdown,
} from '@/types/game';

import { CaseHeader } from './CaseHeader';
import { formatClueValue } from './formatClue';
import { DetectiveScoreCard } from './DetectiveScoreCard';
import { CommunityHistogram } from './CommunityHistogram';
import { WhyThisMovieCard } from './WhyThisMovie';
import { WhyThisMovieFunnel } from '@/components/games/WhyThisMovie';
import { styles, CARD_W_SMALL, CARD_H_SMALL, CARD_W, CARD_H } from './styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'stage1' | 'completed';

/**
 * Izin verilen yanlis tahmin sayisi — sunucudaki DETECTIVE_MAX_GUESSES ile
 * ayni. 6 ipucu = 6 hak.
 */
const DETECTIVE_MAX_GUESSES = 6;

// ─── Clue icon mapping ──────────────────────────────────────────────────────

const CLUE_ICON: Record<string, React.ReactNode> = {
  year_range: <CalendarBlank size={16} color={Colors.gold} weight="duotone" />,
  genres: <FilmSlate size={16} color={Colors.gold} weight="duotone" />,
  runtime: <Timer size={16} color={Colors.gold} weight="duotone" />,
  imdb_rating: <Star size={16} color={Colors.gold} weight="duotone" />,
  cast: <UsersThree size={16} color={Colors.gold} weight="duotone" />,
  director: <VideoCamera size={16} color={Colors.gold} weight="duotone" />,
};

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

// ─── Film Card (Investigation) ──────────────────────────────────────────────

interface InvestigationCardProps {
  option: SpotlightOption;
  selected: boolean;
  result: 'none' | 'correct' | 'wrong';
  eliminated: boolean;
  onPress: () => void;
  disabled: boolean;
  small?: boolean;
}

/** Film kart componenti — 3x4 sorusturma grid'i */
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
      hapticHeavy();
    } else if (result === 'wrong') {
      shakeX.value = withSequence(
        withTiming(-10, { duration: 75 }),
        withTiming(10, { duration: 75 }),
        withTiming(-10, { duration: 75 }),
        withTiming(0, { duration: 75 }),
      );
      hapticMedium();
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
    hapticLight();
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
      accessibilityRole="button"
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
            <FilmSlate size={small ? 24 : 32} color={Colors.textTertiary} weight="duotone" />
          </View>
        )}
        <View style={styles.filmInfoBar}>
          <Text style={[styles.filmTitle, small && styles.filmTitleSmall]} numberOfLines={1}>
            {option.title}
          </Text>
        </View>
        {eliminated && (
          <View style={styles.eliminatedOverlay}>
            <XCircle size={small ? 28 : 36} color={Colors.white} weight="fill" />
          </View>
        )}
      </TouchableOpacity>
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

  // Completed state
  const [won, setWon] = useState(false);
  /** Gunun bulmaca numarasi — paylasim kartinda film adi YERINE gosterilir */
  const [puzzleNo, setPuzzleNo] = useState(0);
  const { cardRef, share, isCapturing, isShareAvailable } = useShareCapture({
    cardType: 'game',
    trackingProps: { game_id: 'detective' },
  });
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [revealedFilm, setRevealedFilm] = useState<RevealedFilm | null>(null);
  const [detectiveScore, setDetectiveScore] = useState(0);
  const [whyThisMovie, setWhyThisMovie] = useState<WhyThisMovieText | null>(null);
  const [clueBreakdown, setClueBreakdown] = useState<DetectiveClueBreakdown | null>(null);
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

      setPuzzleNo(data.puzzle_no);

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

        // Ikinci faz kaldirildi — eski `stage: 2` kayitlari da eleme ekraninda
        // acilir; elenen filmler korunur, oyuncu kaldigi yerden devam eder.
        const turn = restoredEliminated.length + 1;
        setVisibleClues(pd.clues.filter(c => c.turn <= turn));
        setScreenState('stage1');
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
      setIsSubmitting(false);
      setCardResult({});
      setEliminatedIds([]);
      setWon(false);
      setXpAwarded(0);
      setDnaUpdated(false);
      setRevealedFilm(null);
      setDetectiveScore(0);
      setWhyThisMovie(null);
      setClueBreakdown(null);
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
      );

      const newTotal = (totalGuesses + 1);
      setTotalGuesses(newTotal);

      trackGuessSubmitted('detective', newTotal, Date.now() - startMs);

      if (result.correct) {
        setCardResult({ [selectedFilmId]: 'correct' });
        await new Promise(r => setTimeout(r, 800));

        setWon(true);
        setDetectiveScore(result.detective_score ?? 0);
        setXpAwarded(result.xp_awarded);
        setDnaUpdated(result.dna_updated);
        setRevealedFilm(result.revealed_solution ?? null);
        setWhyThisMovie(result.why_this_movie ?? null);
        setClueBreakdown(result.clue_breakdown ?? null);
        setCommunityStats(result.community_stats ?? null);
        setScreenState('completed');

        trackGameCompleted({
          gameId: 'detective',
          won: true,
          guessesUsed: newTotal,
          timeToSolveS: Math.round((Date.now() - (timerStartRef.current ?? Date.now())) / 1000),
          xp: result.xp_awarded,
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

        // Deneme hakki bitti mi
        if (result.completed) {
          setWon(false);
          setDetectiveScore(result.detective_score ?? 0);
          setXpAwarded(result.xp_awarded);
          setDnaUpdated(result.dna_updated);
          setRevealedFilm(result.revealed_solution ?? null);
          setWhyThisMovie(result.why_this_movie ?? null);
          setClueBreakdown(result.clue_breakdown ?? null);
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

  // ─── Computed ─────────────────────────────────────────────────────────────

  const difficultyInfo = useMemo(() => {
    const d = challenge?.puzzle.difficulty ?? 3;
    if (d <= 2) return { color: Colors.greenBright, label: t('games.detective.difficulty.easy') };
    if (d <= 3) return { color: Colors.gold, label: t('games.detective.difficulty.medium') };
    return { color: Colors.error, label: t('games.detective.difficulty.hard') };
  }, [challenge?.puzzle.difficulty, t]);

  const remainingCount = allOptions.length - eliminatedIds.length;
  const timeSeconds = Math.floor((Date.now() - timerStartMs) / 1000);

  // Film kesfi (film sayfasi + watchlist) artik WhyThisMovieFunnel'da —
  // Detective'e ozel kopya handler'lar kaldirildi.

  /** Sonuc ekrani bir kez olculur */
  const hasTrackedResultRef = useRef(false);
  useEffect(() => {
    if (screenState === 'completed' && !hasTrackedResultRef.current) {
      hasTrackedResultRef.current = true;
      trackResultCardViewed('detective', won);
    }
  }, [screenState, won]);

  /** Sonucu paylas — kapi metrigi game_share_* uzerinden okunur */
  const handleShare = useCallback(async () => {
    trackShareRendered('detective');
    const shared = await share();
    if (shared) trackShareCompleted('detective', 'image');
  }, [share]);

  // ─── Render: Error ─────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <GameShell title={t('games.detective.title')} currentAttempt={0} maxAttempts={DETECTIVE_MAX_GUESSES}>
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  // ─── Render: Loading ───────────────────────────────────────────────────────

  if (screenState === 'loading') {
    return (
      <GameShell title={t('games.detective.title')} currentAttempt={0} maxAttempts={DETECTIVE_MAX_GUESSES}>
        <GameStateView state="loading" />
      </GameShell>
    );
  }

  // ─── Render: Completed (Stage 3) ──────────────────────────────────────────

  if (screenState === 'completed') {
    return (
      <GameShell
        title={t('games.detective.title')}
        currentAttempt={totalGuesses}
        maxAttempts={DETECTIVE_MAX_GUESSES}
        hideProgress
      >
        {/* Offscreen paylasim karti — PNG capture icin (film adi YOK) */}
        <View style={styles.offscreenCard} pointerEvents="none">
          <GameShareCard
            ref={cardRef}
            gameTitle={t('games.detective.title')}
            solved={won}
            attempts={totalGuesses}
            maxAttempts={DETECTIVE_MAX_GUESSES}
            streak={0}
            gameType="detective"
            puzzleNo={puzzleNo}
          />
        </View>

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

          {/* XP + DNA */}
          <DnaXpReveal
            xpAwarded={xpAwarded}
            dnaUpdated={dnaUpdated}
            solved={won}
          />

          {/* Kesif koprusu — birincil CTA'lar, diger oyunlarla ayni component */}
          {revealedFilm && (
            <WhyThisMovieFunnel
              whyText={whyThisMovie?.why_text}
              funFact={whyThisMovie?.fun_fact}
              filmTitle={revealedFilm.title}
              filmUuid={revealedFilm.film_id}
              gameType="detective"
            />
          )}

          {/* Detective Score Card */}
          <DetectiveScoreCard
            score={detectiveScore}
            totalGuesses={totalGuesses}
            hintsUsed={hintsUsed}
            timeSeconds={timeSeconds}
            won={won}
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

          {/* Ipucu cozumlemesi — hangi ipucu neyi isaret ediyordu */}
          {clueBreakdown && (
            <WhyThisMovieCard
              clueExplanations={clueBreakdown.clue_explanations}
              decoyConnections={clueBreakdown.decoy_connections}
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
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              disabled={isCapturing || !isShareAvailable}
              accessibilityRole="button"
              accessibilityState={{ disabled: isCapturing || !isShareAvailable }}
            >
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

  // ─── Render: Stage 1 (Investigation) ──────────────────────────────────────

  const hasSelection = selectedFilmId != null;
  const hasCardResultPending = Object.keys(cardResult).length > 0;

  return (
    <GameShell
      title={t('games.detective.title')}
      currentAttempt={totalGuesses}
      maxAttempts={DETECTIVE_MAX_GUESSES}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Case Header */}
        <CaseHeader
          caseNumber={challenge?.puzzle_no ?? 0}
          remainingCount={remainingCount}
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
                {formatClueValue(clue.type, clue.value, t)}
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
        accessibilityRole="button"
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
