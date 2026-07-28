/**
 * Spotlight V2 — Eleme mekaniği film tahmin oyunu.
 *
 * 6 film baştan gösterilir (2x3 grid). Her turda 1 ipucu açılır.
 * Yanlış tahmin kartı eler (yerinde kalır, soluk + X). Doğru tahmin = oyun biter.
 * 5 yanlış = kayıp (son kart otomatik açılır).
 * Çözüm istemciye İNMEZ — submit-guess Edge Function doğrulama yapar.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { CalendarBlank, FilmSlate, Star, Timer, UsersThree, VideoCamera, XCircle } from 'phosphor-react-native';

import { DnaXpReveal } from '@/components/games/DnaXpReveal';
import { GameShareCard, useShareCapture } from '@/components/ShareCards';
import { WhyThisMovieFunnel } from '@/components/games/WhyThisMovie';
import { PlayNextBridge } from '@/components/games/PlayNextBridge';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  withRepeat,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/utils/logger';
import {
  trackGameOpened,
  trackGuessSubmitted,
  trackGameCompleted,
  trackResultCardViewed,
  trackShareRendered,
  trackShareCompleted,
} from '@/utils/gameAnalytics';
import { getDailyChallenge, submitSpotlightGuess } from '@/services/gameApi';
import { GameShell } from '@/components/games/GameShell';
import { GameStateView } from '@/components/games/GameStateView';
import type {
  DailyChallenge,
  RevealedFilm,
  SpotlightClue,
  SpotlightOption,
  SpotlightPuzzleData,
  WhyThisMovieText,
} from '@/types/game';

import { styles, CARD_W, CARD_H } from './styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'playing' | 'completed';

// ─── Clue icon mapping ──────────────────────────────────────────────────────

const CLUE_ICON: Record<string, React.ReactNode> = {
  year_range: <CalendarBlank size={16} color="#8B5CF6" weight="duotone" />,
  genres: <FilmSlate size={16} color="#8B5CF6" weight="duotone" />,
  runtime: <Timer size={16} color="#8B5CF6" weight="duotone" />,
  imdb_rating: <Star size={16} color="#8B5CF6" weight="duotone" />,
  cast: <UsersThree size={16} color="#8B5CF6" weight="duotone" />,
  director: <VideoCamera size={16} color="#8B5CF6" weight="duotone" />,
};

/** İpucu değerini gösterim formatına çevirir */
function formatClueValue(clue: SpotlightClue, t: (key: string) => string): string {
  switch (clue.type) {
    case 'year_range':
      return String(clue.value);
    case 'genres':
      return Array.isArray(clue.value) ? clue.value.join(', ') : String(clue.value);
    case 'runtime':
      return `${clue.value} ${t('games.spotlight.clue_labels.minutes')}`;
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

// ─── Film Card Component ────────────────────────────────────────────────────

interface FilmCardProps {
  option: SpotlightOption;
  selected: boolean;
  result: 'none' | 'correct' | 'wrong';
  eliminated: boolean;
  onPress: () => void;
  disabled: boolean;
}

function FilmCard({ option, selected, result, eliminated, onPress, disabled }: FilmCardProps) {
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
      // Shake sonrası soluklaştır
      opacity.value = withDelay(300, withTiming(0.35, { duration: 400 }));
    }
  }, [result, scale, shakeX, opacity]);

  // Eleme durumu restore edildiğinde (app restart)
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

  const borderStyle =
    result === 'correct' ? styles.filmCardCorrect
      : result === 'wrong' ? styles.filmCardWrong
        : selected ? styles.filmCardSelected
          : eliminated ? styles.filmCardEliminated
            : undefined;

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.filmCard, borderStyle]}
        onPress={handlePress}
        activeOpacity={0.85}
        disabled={disabled || eliminated}
      accessibilityRole="button"
      >
        {option.poster_url ? (
          <Image
            source={{ uri: option.poster_url }}
            style={styles.filmPoster}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={styles.filmPosterPlaceholder}>
            <FilmSlate size={32} color={Colors.textTertiary} weight="duotone" />
          </View>
        )}
        <View style={styles.filmInfoBar}>
          <Text style={styles.filmTitle} numberOfLines={1}>{option.title}</Text>
        </View>

        {/* Eleme overlay'i */}
        {eliminated && (
          <View style={styles.eliminatedOverlay}>
            <XCircle size={36} color="#FFFFFF" weight="fill" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Last Card Pulse Component ──────────────────────────────────────────────

/** Son kalan kartın pulse animasyonu (auto-loss) */
function LastCardPulse({ children }: { children: React.ReactNode }) {
  const borderOpacity = useSharedValue(0.3);

  useEffect(() => {
    borderOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0.3, { duration: 600 }),
      ),
      3,
      true,
    );
  }, [borderOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    borderWidth: 2,
    borderColor: `rgba(139,92,246,${borderOpacity.value})`,
    borderRadius: 12,
  }));

  return <Animated.View style={pulseStyle}>{children}</Animated.View>;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SpotlightGame() {
  const { t } = useLanguage();
  const router = useRouter();
  const countdown = useCountdown();

  // State
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [puzzleData, setPuzzleData] = useState<SpotlightPuzzleData | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Game state
  const [allOptions, setAllOptions] = useState<SpotlightOption[]>([]);
  const [eliminatedIds, setEliminatedIds] = useState<string[]>([]);
  const [currentTurn, setCurrentTurn] = useState(1);
  const [visibleClues, setVisibleClues] = useState<SpotlightClue[]>([]);
  const [selectedFilmId, setSelectedFilmId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardResult, setCardResult] = useState<Record<string, 'none' | 'correct' | 'wrong'>>({});
  const [autoLossCard, setAutoLossCard] = useState<string | null>(null);

  // Completed state
  const [won, setWon] = useState(false);
  /** Gunun bulmaca numarasi — paylasim kartinda film adi YERINE gosterilir */
  const [puzzleNo, setPuzzleNo] = useState(0);
  /** Film kesfi koprusu metni — sunucudan gelir */
  const [whyThisMovie, setWhyThisMovie] = useState<WhyThisMovieText | null>(null);
  const { cardRef, share, isCapturing, isShareAvailable } = useShareCapture({
    cardType: 'game',
    trackingProps: { game_id: 'spotlight' },
  });
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [revealedFilm, setRevealedFilm] = useState<RevealedFilm | null>(null);
  const [solvedTurn, setSolvedTurn] = useState(0);

  // Timing
  const openTimeRef = useRef(Date.now());

  // ─── Load Puzzle ──────────────────────────────────────────────────────────

  const loadPuzzle = useCallback(async () => {
    try {
      setLoadError(false);
      setScreenState('loading');

      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const data = await getDailyChallenge('spotlight', puzzleDate);

      setChallenge(data);

      const pd = data.puzzle.puzzle_data as unknown as SpotlightPuzzleData;
      setPuzzleData(pd);

      setPuzzleNo(data.puzzle_no);
      setWhyThisMovie(data.why_this_movie ?? null);
      if (data.revealed_solution) setRevealedFilm(data.revealed_solution);

      // Mevcut ilerleme varsa yükle
      if (data.progress?.completed) {
        setWon(data.progress.won);
        setSolvedTurn(data.progress.turns_played ?? 6);
        setScreenState('completed');
        return;
      }

      // Options yükle (V2: düz dizi)
      setAllOptions(pd.options);

      // Devam eden ilerlemeden tur belirle
      const restoredEliminated: string[] = data.progress?.eliminated_ids ?? [];
      setEliminatedIds(restoredEliminated);

      const turn = restoredEliminated.length + 1;
      setCurrentTurn(turn);

      // İlk tur(lar) ipucularını göster
      setVisibleClues(pd.clues.filter(c => c.turn <= turn));

      setScreenState('playing');

      trackGameOpened('spotlight', data.puzzle_no, 'hub');

      openTimeRef.current = Date.now();
    } catch (err) {
      logger.error('[Spotlight] Load hatası:', err);
      setLoadError(true);
      setScreenState('loading');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setSelectedFilmId(null);
      setIsSubmitting(false);
      setCardResult({});
      setEliminatedIds([]);
      setAutoLossCard(null);
      setWon(false);
      setXpAwarded(0);
      setDnaUpdated(false);
      setRevealedFilm(null);
      setSolvedTurn(0);
      loadPuzzle();
    }, [loadPuzzle]),
  );

  // ─── Submit Guess ─────────────────────────────────────────────────────────

  const handleSubmit = useCallback(async () => {
    if (!selectedFilmId || !challenge || isSubmitting) return;

    setIsSubmitting(true);
    const startMs = Date.now();

    try {
      const result = await submitSpotlightGuess(
        challenge.puzzle.id,
        selectedFilmId,
        currentTurn,
      );

      trackGuessSubmitted('spotlight', currentTurn, Date.now() - startMs);

      if (result.correct) {
        // Doğru — kartı yeşile boya
        setCardResult({ [selectedFilmId]: 'correct' });

        await new Promise(r => setTimeout(r, 800));

        setWon(true);
        setSolvedTurn(currentTurn);
        setXpAwarded(result.xp_awarded);
        setDnaUpdated(result.dna_updated);
        setRevealedFilm(result.revealed_solution ?? null);
        setWhyThisMovie(result.why_this_movie ?? null);
        setScreenState('completed');

        trackGameCompleted({
          gameId: 'spotlight',
          won: true,
          guessesUsed: currentTurn,
          timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
          xp: result.xp_awarded,
        });
      } else {
        // Yanlış — kırmızı + shake, kart soluklaşır
        setCardResult({ [selectedFilmId]: 'wrong' });

        // Sunucu state'i sync et
        const newEliminated = result.eliminated_ids;
        setEliminatedIds(newEliminated);

        await new Promise(r => setTimeout(r, 800));
        setCardResult({});
        setSelectedFilmId(null);

        if (result.completed) {
          // 5 yanlış — son kart auto-loss
          const remainingId = allOptions.find(o => !newEliminated.includes(o.film_id))?.film_id;
          if (remainingId) {
            setAutoLossCard(remainingId);
            // 1.5s pulse sonra kayıp ekranına geç
            await new Promise(r => setTimeout(r, 1500));
          }

          setWon(false);
          setSolvedTurn(currentTurn);
          setXpAwarded(result.xp_awarded);
          setDnaUpdated(result.dna_updated);
          setRevealedFilm(result.revealed_solution ?? null);
        setWhyThisMovie(result.why_this_movie ?? null);
          setScreenState('completed');

          trackGameCompleted({
            gameId: 'spotlight',
            won: false,
            guessesUsed: currentTurn,
            timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
            xp: result.xp_awarded,
          });
        } else {
          // Sonraki tur — yeni ipucu ekle
          const nextTurn = currentTurn + 1;
          setCurrentTurn(nextTurn);
          if (result.next_clue) {
            setVisibleClues(prev => [...prev, result.next_clue!]);
          }
        }
      }
    } catch (err) {
      logger.error('[Spotlight] Submit hatası:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedFilmId, challenge, isSubmitting, currentTurn, allOptions]);

  /** Sonuc ekrani bir kez olculur */
  const hasTrackedResultRef = useRef(false);
  useEffect(() => {
    if (screenState === 'completed' && !hasTrackedResultRef.current) {
      hasTrackedResultRef.current = true;
      trackResultCardViewed('spotlight', won);
    }
  }, [screenState, won]);

  /** Sonucu paylas — kapi metrigi game_share_* uzerinden okunur */
  const handleShare = useCallback(async () => {
    trackShareRendered('spotlight');
    const shared = await share();
    if (shared) trackShareCompleted('spotlight', 'image');
  }, [share]);

  // ─── Render: Error ────────────────────────────────────────────────────────

  if (loadError) {
    return (
      <GameShell title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={6}>
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  // ─── Render: Loading ──────────────────────────────────────────────────────

  if (screenState === 'loading') {
    return (
      <GameShell title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={6}>
        <GameStateView state="loading" />
      </GameShell>
    );
  }

  // ─── Render: Completed ────────────────────────────────────────────────────

  if (screenState === 'completed') {
    return (
      <GameShell
        title={t('games.spotlight.title')}
        currentAttempt={solvedTurn}
        maxAttempts={6}
        hideProgress
      >
        {/* Offscreen paylasim karti — PNG capture icin (film adi YOK) */}
        <View style={styles.offscreenCard} pointerEvents="none">
          <GameShareCard
            ref={cardRef}
            gameTitle={t('games.spotlight.title')}
            solved={won}
            attempts={currentTurn}
            maxAttempts={6}
            streak={0}
            gameType="spotlight"
            puzzleNo={puzzleNo}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.completedContainer}
          showsVerticalScrollIndicator={false}
        >
          {revealedFilm?.poster_url && (
            <Image
              source={{ uri: revealedFilm.poster_url }}
              style={styles.completedPoster}
              contentFit="cover"
              transition={300}
            />
          )}

          {revealedFilm && (
            <Text style={styles.completedTitle}>{revealedFilm.title}</Text>
          )}

          {won ? (
            <Text style={styles.wonMessage}>
              {t('games.spotlight.result_won', { turns: String(solvedTurn) })}
            </Text>
          ) : (
            <>
              <Text style={styles.lostMessage}>{t('games.spotlight.result_lost')}</Text>
              <Text style={styles.lostSubtext}>{t('games.spotlight.auto_loss')}</Text>
            </>
          )}

          {/* XP + DNA Reveal */}
          <DnaXpReveal
            xpAwarded={xpAwarded}
            dnaUpdated={dnaUpdated}
            solved={won}
          />

          {/* Film kesfi koprusu — oyun -> film donusumu buradan olculur */}
          {whyThisMovie && revealedFilm && (
            <WhyThisMovieFunnel
              whyText={whyThisMovie.why_text}
              funFact={whyThisMovie.fun_fact}
              filmTitle={revealedFilm.title}
              filmId={0}
              gameType="spotlight"
            />
          )}

          <View>
            <Text style={styles.countdownLabel}>{t('games.cinemetrics.next_puzzle')}</Text>
            <Text style={styles.countdownTime}>{countdown}</Text>
          </View>

          <PlayNextBridge currentGame="spotlight" />

          <View style={styles.completedActions}>
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShare}
              disabled={isCapturing || !isShareAvailable}
              accessibilityRole="button"
              accessibilityState={{ disabled: isCapturing || !isShareAvailable }}
            >
              <Text style={styles.shareButtonText}>{t('games.cinemetrics.share')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.hubButton} onPress={() => router.back()}>
              <Text style={styles.hubButtonText}>{t('games.cinemetrics.back_to_hub')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </GameShell>
    );
  }

  // ─── Render: Playing ──────────────────────────────────────────────────────

  const hasSelection = selectedFilmId != null;
  const hasCardResult = Object.keys(cardResult).length > 0;
  const remainingCount = allOptions.length - eliminatedIds.length;

  return (
    <GameShell
      title={t('games.spotlight.title')}
      currentAttempt={eliminatedIds.length}
      maxAttempts={6}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Clue Panel ─── */}
        <View style={styles.cluePanel}>
          <Text style={styles.cluePanelTitle}>
            {t('games.spotlight.clues_title')}
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
                {t(`games.spotlight.clue_labels.${clue.type}`)}
              </Text>
              <Text style={styles.clueValue} numberOfLines={2}>
                {formatClueValue(clue, t)}
              </Text>
            </Animated.View>
          ))}
        </View>

        {/* ─── Turn Indicator ─── */}
        <View style={styles.turnIndicator}>
          <Text style={styles.turnText}>
            {t('games.spotlight.turn_indicator', {
              current: String(remainingCount),
              total: '6',
            })}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(eliminatedIds.length / 5) * 100}%` }]} />
          </View>
        </View>

        {/* ─── Film Cards 2×3 Grid ─── */}
        <View style={styles.cardGrid}>
          {allOptions.map((option, i) => {
            const isEliminated = eliminatedIds.includes(option.film_id);
            const isAutoLoss = autoLossCard === option.film_id;

            const card = (
              <FilmCard
                option={option}
                selected={selectedFilmId === option.film_id}
                result={cardResult[option.film_id] ?? 'none'}
                eliminated={isEliminated}
                onPress={() => {
                  if (!hasCardResult && !isEliminated) setSelectedFilmId(option.film_id);
                }}
                disabled={isSubmitting || hasCardResult}
              />
            );

            return (
              <Animated.View
                key={`opt-${option.film_id}`}
                entering={FadeInDown.delay(i * 60).duration(250)}
              >
                {isAutoLoss ? <LastCardPulse>{card}</LastCardPulse> : card}
              </Animated.View>
            );
          })}
        </View>

        {/* ─── Guess Button ─── */}
        <TouchableOpacity
          style={[styles.guessButton, (!hasSelection || isSubmitting || hasCardResult) && styles.guessButtonDisabled]}
          onPress={handleSubmit}
          disabled={!hasSelection || isSubmitting || hasCardResult}
          activeOpacity={0.7}
        accessibilityRole="button"
        >
          <Text
            style={[
              styles.guessButtonText,
              (!hasSelection || isSubmitting || hasCardResult) && styles.guessButtonTextDisabled,
            ]}
          >
            {t('games.spotlight.guess_button')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </GameShell>
  );
}
