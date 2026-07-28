/**
 * Imposter V2 — 3 Round Kadro Bilgisi Oyunu.
 *
 * 3 round, artan zorluk:
 *   Round 1: 4 secenek, 1 sahte bul (kolay)
 *   Round 2: 5 secenek, 2 sahte bul (orta)
 *   Round 3: 6 secenek, 2 sahte bul (zor)
 *
 * Yanlis round'da oyun BITMEZ — 3 round daima oynanir.
 * Her round sonrasi dogru cevap gosterilir (ogrenme ani).
 * Skor: 0-3 (dogru round sayisi).
 *
 * Edge Function tabanli — cozum istemciye inmez.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check, CheckCircle, CloudSlash, X, XCircle } from 'phosphor-react-native';
import * as Sentry from '@sentry/react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticWarning, hapticSuccess, hapticMedium } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getPosterUrl } from '@/services/tmdb';
import { getGameStreak } from '@/services/gameService';
import { getDailyChallenge, submitImposterGuess } from '@/services/gameApi';
import type {
  DailyChallenge,
  ImposterConfidenceConfig,
  ImposterGuessResult,
  ImposterRound,
  WhyThisMovieText,
} from '@/types/game';
import type { DnaSignal } from '@/components/games/DnaXpReveal';
import type { GameState } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { ConfidenceSelector, formatFactor } from '@/components/games/ConfidenceSelector';
import { ResultCard } from '@/components/games/ResultCard';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useGamePaywall } from '@/hooks/useGamePaywall';
import {
  trackGameOpened,
  trackGuessSubmitted,
  trackGameCompleted,
  trackConfidenceSet,
} from '@/utils/gameAnalytics';

const { width: SCREEN_W } = Dimensions.get('window');
const POSTER_W = SCREEN_W * 0.5;
const POSTER_H = POSTER_W * 1.5;

/** Aktör seçeneği */
interface ActorOption {
  id: number;
  name: string;
}

/** Nötr bahis — seçim yapılmazsa XP bugünküyle birebir aynı kalır */
const DEFAULT_CONFIDENCE = 50;

/** Round sonuç state'i */
interface RoundOutcome {
  round: number;
  correct: boolean;
  revealedImposters: string[];
  /** Bu round'un XP çarpanı — reveal kartında rozet olarak gösterilir */
  xpFactor: number;
}

export default function ImposterScreen() {
  const { t } = useLanguage();
  const { checkGamePaywall, paywallProps } = useGamePaywall();

  // Analytics timing refs
  const openTimeRef = useRef(Date.now());
  const guessStartTime = useRef(Date.now());

  // State
  const [gameState, setGameState] = useState<GameState>('loading');
  const [rounds, setRounds] = useState<ImposterRound[]>([]);
  const [currentRound, setCurrentRound] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [roundOutcomes, setRoundOutcomes] = useState<RoundOutcome[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Round gonderimi basarisiz — sessiz fallback YASAK */
  const [submitError, setSubmitError] = useState(false);
  const [puzzleId, setPuzzleId] = useState('');
  const [streak, setStreak] = useState(0);
  const [loadError, setLoadError] = useState(false);

  // Round reveal state (ogrenme ani)
  const [showRoundReveal, setShowRoundReveal] = useState(false);
  const [lastRoundOutcome, setLastRoundOutcome] = useState<RoundOutcome | null>(null);

  // Guven bahsi
  const [confidenceConfig, setConfidenceConfig] = useState<ImposterConfidenceConfig | null>(null);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [confidenceFactor, setConfidenceFactor] = useState<number | null>(null);

  // Final result state
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [dnaSignals, setDnaSignals] = useState<DnaSignal[]>([]);
  /** Film kesfi koprusu metni — sunucudan gelir, tamamlanmada dolar */
  const [whyThisMovie, setWhyThisMovie] = useState<WhyThisMovieText | null>(null);
  /** Gunun bulmaca numarasi — paylasim kartinda film adi yerine gosterilir */
  const [puzzleNo, setPuzzleNo] = useState(0);
  const [filmInfo, setFilmInfo] = useState<{
    title: string;
    year: number;
    posterPath: string | null;
    filmId: number;
  } | null>(null);

  // Flash animation
  const flashOpacity = useSharedValue(0);
  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  /** Mevcut round verisi */
  const activeRound = useMemo(
    () => rounds.find((r) => r.round === currentRound),
    [rounds, currentRound],
  );

  /** Bu round'da kac sahte secilmeli */
  const requiredSelections = useMemo(() => {
    if (currentRound === 1) return 1;
    return 2; // Round 2 ve 3: 2 sahte
  }, [currentRound]);

  // ── Load puzzle ─────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      setGameState('loading');
      setRounds([]);
      setCurrentRound(1);
      setSelectedIds(new Set());
      setRoundOutcomes([]);
      setIsSubmitting(false);
      setShowRoundReveal(false);
      setLastRoundOutcome(null);
      setLoadError(false);
      setSubmitError(false);
      setFilmInfo(null);
      setConfidence(DEFAULT_CONFIDENCE);
      setConfidenceFactor(null);
      loadPuzzle();
    }, []),
  );

  /** Puzzle yukle */
  const loadPuzzle = useCallback(async () => {
    try {
      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const data: DailyChallenge = await getDailyChallenge('imposter', puzzleDate);
      const puzzle = data.puzzle;
      const progress = data.progress;

      setPuzzleId(puzzle.id);
      setPuzzleNo(data.puzzle_no);

      // puzzle_data.rounds: [{ round, film_title, poster_url, options }]
      const roundsData = puzzle.puzzle_data.rounds as ImposterRound[] | undefined;
      if (!roundsData || roundsData.length < 3) {
        setLoadError(true);
        return;
      }
      setRounds(roundsData);

      // Guven bahsi config'i — seviyeler ve carpanlar sunucudan
      if (data.confidence_config) {
        setConfidenceConfig(data.confidence_config);
        setConfidence(data.confidence_config.levels[0] ?? DEFAULT_CONFIDENCE);
      }

      // Bugun zaten oynanmis mi?
      if (progress?.completed) {
        const streakInfo = await getGameStreak('imposter');
        setStreak(streakInfo.currentStreak);

        setFilmInfo({
          title: roundsData[0].film_title ?? t('games.result.unknown_film'),
          year: 0,
          posterPath: roundsData[0].poster_url ?? null,
          filmId: 0,
        });

        setRoundOutcomes(
          progress.imposter_rounds?.map((r) => ({
            round: r.round,
            correct: r.correct,
            revealedImposters: [],
            xpFactor: 1,
          })) ?? [],
        );

        setWhyThisMovie(data.why_this_movie ?? null);

        setGameState('complete');
        return;
      }

      // Devam eden oyun — hangi round'dayiz?
      const impRounds = progress?.imposter_rounds;
      if (impRounds && impRounds.length > 0) {
        setCurrentRound(impRounds.length + 1);
        setRoundOutcomes(
          impRounds.map((r) => ({
            round: r.round,
            correct: r.correct,
            revealedImposters: [],
            xpFactor: 1,
          })),
        );
      }

      setGameState('playing');
      openTimeRef.current = Date.now();
      guessStartTime.current = Date.now();
      trackGameOpened('imposter', 0, 'hub');
    } catch (err) {
      logger.error('[imposter] Load hatasi:', err);
      setLoadError(true);
    }
  }, []);

  // ── Selection handler ───────────────────────────────────────────────────────

  /** Aktor toggle */
  const handleToggle = useCallback(
    (actorId: number) => {
      if (gameState !== 'playing' || isSubmitting || showRoundReveal) return;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(actorId)) {
          next.delete(actorId);
        } else {
          // Max secim kontrolu
          if (next.size >= requiredSelections) {
            hapticWarning();
            return prev;
          }
          next.add(actorId);
        }
        hapticMedium();
        return next;
      });
    },
    [gameState, isSubmitting, showRoundReveal, requiredSelections],
  );

  /** Round gonder */
  const handleSubmitRound = useCallback(async () => {
    if (selectedIds.size !== requiredSelections || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(false);

    try {
      const result: ImposterGuessResult = await submitImposterGuess(
        puzzleId,
        currentRound,
        [...selectedIds],
        confidence,
      );
      trackGuessSubmitted('imposter', currentRound, Date.now() - guessStartTime.current);
      guessStartTime.current = Date.now();

      const outcome: RoundOutcome = {
        round: currentRound,
        correct: result.round_correct,
        revealedImposters: result.revealed_imposters,
        // Bahis alani donmeyen bir sunucu surumunde notre dus — rozet gizlenir
        xpFactor: result.round_xp_factor ?? 1,
      };

      if (result.round_correct) {
        hapticSuccess();
      } else {
        hapticWarning();
        flashOpacity.value = withSequence(
          withTiming(0.3, { duration: 150 }),
          withTiming(0, { duration: 300 }),
        );
      }

      // Ogrenme ani goster
      setLastRoundOutcome(outcome);
      setShowRoundReveal(true);
      setRoundOutcomes((prev) => [...prev, outcome]);

      // 2.5 saniye ogrenme ani
      await new Promise((r) => setTimeout(r, 2500));

      if (result.completed) {
        // Oyun bitti — final sonuc
        trackGameCompleted({
          gameId: 'imposter',
          won: result.won,
          guessesUsed: 3,
          timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
          xp: result.xp_awarded,
        });
        setXpAwarded(result.xp_awarded);
        setWhyThisMovie(result.why_this_movie ?? null);
        setConfidenceFactor(result.confidence_factor ?? null);
        setDnaUpdated(result.dna_updated);
        if (result.dna_updated) {
          setDnaSignals([
            { dimension: 'knowledge', delta: result.correct_count * 0.2 },
          ]);
        }

        if (result.revealed_solution) {
          setFilmInfo({
            title: result.revealed_solution.title,
            year: result.revealed_solution.year,
            posterPath: result.revealed_solution.poster_url ?? null,
            filmId: 0,
          });
        }

        const streakInfo = await getGameStreak('imposter');
        setStreak(streakInfo.currentStreak);
        setGameState('complete');
        checkGamePaywall(streakInfo.currentStreak, result.won);
      } else {
        // Sonraki round — bahis notre doner, her round bagimsiz karar
        setShowRoundReveal(false);
        setLastRoundOutcome(null);
        setSelectedIds(new Set());
        setCurrentRound((prev) => prev + 1);
        setConfidence(confidenceConfig?.levels[0] ?? DEFAULT_CONFIDENCE);
      }
    } catch (err) {
      // Sessiz fallback YASAK — kullaniciya gorunur hata + tekrar deneme
      logger.error('[imposter] Submit hatasi:', err);
      Sentry.captureException(err, {
        tags: { game: 'imposter', action: 'submit_round', round: String(currentRound) },
      });
      hapticHeavy();
      setShowRoundReveal(false);
      setLastRoundOutcome(null);
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedIds,
    requiredSelections,
    isSubmitting,
    puzzleId,
    currentRound,
    confidence,
    confidenceConfig,
    flashOpacity,
    checkGamePaywall,
  ]);

  // ── Render ──────────────────────────────────────────────────────────────────

  /** Error state */
  if (loadError) {
    return (
      <GameShell title={t('games.imposter.title')} currentAttempt={0} maxAttempts={3}>
        <View style={styles.center}>
          <Text style={styles.errorEmoji}>🎬</Text>
          <Text style={styles.errorText}>{t('games.result.error_title')}</Text>
          <Text style={styles.errorSubtext}>{t('games.result.error_subtitle')}</Text>
        </View>
      </GameShell>
    );
  }

  /** Loading state */
  if (gameState === 'loading') {
    return (
      <GameShell title={t('games.imposter.title')} currentAttempt={0} maxAttempts={3}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t('games.result.loading')}</Text>
        </View>
      </GameShell>
    );
  }

  /** Complete state */
  if (gameState === 'complete') {
    const correctCount = roundOutcomes.filter((r) => r.correct).length;
    const solved = correctCount === 3;

    return (
      <GameShell
        title={t('games.imposter.title')}
        currentAttempt={3}
        maxAttempts={3}
        hideProgress
      >
        <ScrollView contentContainerStyle={styles.completeScroll} showsVerticalScrollIndicator={false}>
          {/* Round sonuclari ozeti */}
          <View style={styles.roundsSummary}>
            {[1, 2, 3].map((r) => {
              const outcome = roundOutcomes.find((o) => o.round === r);
              return (
                <View key={r} style={styles.roundDot}>
                  {outcome?.correct ? (
                    <CheckCircle size={28} weight="duotone" color={Colors.success} />
                  ) : (
                    <XCircle size={28} weight="duotone" color={Colors.error} />
                  )}
                  <Text style={styles.roundDotLabel}>R{r}</Text>
                </View>
              );
            })}
          </View>

          <ResultCard
            solved={solved}
            attempts={correctCount}
            maxAttempts={3}
            filmTitle={filmInfo?.title ?? ''}
            filmYear={filmInfo?.year ?? 0}
            filmPosterPath={filmInfo?.posterPath ?? null}
            filmId={filmInfo?.filmId ?? 0}
            streak={streak}
            gameTitle={t('games.imposter.title')}
            gameType="imposter"
            puzzleNo={puzzleNo}
            whyThisMovie={whyThisMovie ?? undefined}
            xpAwarded={xpAwarded > 0 ? xpAwarded : undefined}
            confidenceFactor={confidenceFactor}
            dnaUpdated={dnaUpdated}
            dnaSignals={dnaSignals.length > 0 ? dnaSignals : undefined}
          />
        </ScrollView>
      </GameShell>
    );
  }

  // ── Playing state ───────────────────────────────────────────────────────────

  const roundLabel = currentRound === 1
    ? t('games.imposter.round_easy')
    : currentRound === 2
      ? t('games.imposter.round_medium')
      : t('games.imposter.round_hard');

  const posterUrl = activeRound?.poster_url
    ? getPosterUrl(activeRound.poster_url, 'w500')
    : null;

  return (
    <GameShell
      title={t('games.imposter.title')}
      currentAttempt={currentRound - 1}
      maxAttempts={3}
    >
      {/* Flash overlay */}
      <Animated.View style={[styles.flashOverlay, flashStyle]} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Round indicator */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.roundHeader}>
          <View style={styles.roundBadge}>
            <Text style={styles.roundBadgeText}>
              {t('games.imposter.round_label', { n: currentRound })}
            </Text>
          </View>
          <Text style={styles.roundDifficulty}>{roundLabel}</Text>
        </Animated.View>

        {/* Round sonuclari (onceki roundlar) */}
        {roundOutcomes.length > 0 && (
          <View style={styles.prevRoundsRow}>
            {roundOutcomes.map((o) => (
              <View key={o.round} style={[
                styles.prevRoundChip,
                o.correct ? styles.prevRoundCorrect : styles.prevRoundWrong,
              ]}>
                {o.correct ? (
                  <Check size={14} weight="bold" color={Colors.success} />
                ) : (
                  <X size={14} weight="bold" color={Colors.error} />
                )}
                <Text style={[
                  styles.prevRoundText,
                  { color: o.correct ? Colors.success : Colors.error },
                ]}>
                  R{o.round}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Poster */}
        <View style={styles.posterContainer}>
          {posterUrl && (
            <Image
              source={{ uri: posterUrl }}
              style={styles.poster}
              contentFit="cover"
              transition={300}
            />
          )}
          <Text style={styles.filmTitle} numberOfLines={2}>
            {activeRound?.film_title ?? ''}
          </Text>
        </View>

        {/* Soru */}
        <Text style={styles.question}>
          {requiredSelections === 1
            ? t('games.imposter.question')
            : t('games.imposter.question_multi', { count: requiredSelections })}
        </Text>

        {/* Round reveal (ogrenme ani) */}
        {showRoundReveal && lastRoundOutcome && (
          <Animated.View entering={FadeInDown.duration(400)} style={[
            styles.revealCard,
            lastRoundOutcome.correct ? styles.revealCorrect : styles.revealWrong,
          ]}>
            {lastRoundOutcome.correct ? (
              <CheckCircle size={24} weight="duotone" color={Colors.success} />
            ) : (
              <XCircle size={24} weight="duotone" color={Colors.error} />
            )}
            <View style={styles.revealContent}>
              <Text style={[
                styles.revealTitle,
                { color: lastRoundOutcome.correct ? Colors.success : Colors.error },
              ]}>
                {lastRoundOutcome.correct
                  ? t('games.imposter.round_correct')
                  : t('games.imposter.round_wrong')}
              </Text>
              <Text style={styles.revealSubtext}>
                {t('games.imposter.imposters_were', {
                  names: lastRoundOutcome.revealedImposters.join(', '),
                })}
              </Text>
            </View>

            {/* Bahsin karsiligi — notr (x1) ise gosterilmez */}
            {lastRoundOutcome.xpFactor !== 1 && (
              <View style={[
                styles.factorBadge,
                lastRoundOutcome.correct ? styles.factorBadgeWin : styles.factorBadgeLose,
              ]}>
                <Text style={[
                  styles.factorBadgeText,
                  { color: lastRoundOutcome.correct ? Colors.gold : Colors.error },
                ]}>
                  ×{formatFactor(lastRoundOutcome.xpFactor)}
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* Aktor secenekleri */}
        {!showRoundReveal && activeRound && (
          <Animated.View entering={FadeInUp.delay(200).duration(300)} style={styles.optionsGrid}>
            {activeRound.options.map((option) => {
              const isSelected = selectedIds.has(option.id);
              return (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionButton,
                    isSelected ? styles.optionSelected : styles.optionDefault,
                  ]}
                  onPress={() => handleToggle(option.id)}
                  disabled={isSubmitting || showRoundReveal}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.optionText,
                      isSelected && styles.optionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {option.name}
                  </Text>
                  {isSelected && (
                    <CheckCircle size={18} color={Colors.accentPrimary} weight="duotone" />
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        )}

        {/* Guven bahsi — round kilitlenmeden ONCE yatirilir */}
        {!showRoundReveal && confidenceConfig && (
          <Animated.View entering={FadeInUp.delay(260).duration(300)} style={styles.confidenceArea}>
            <ConfidenceSelector
              config={confidenceConfig}
              value={confidence}
              onChange={(next) => {
                setConfidence(next);
                trackConfidenceSet('imposter', currentRound, next);
              }}
              disabled={isSubmitting}
            />
          </Animated.View>
        )}

        {/* Gonderim hatasi — sessiz fallback YASAK */}
        {submitError && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.submitErrorBox}>
            <CloudSlash size={18} color={Colors.error} weight="duotone" />
            <Text style={styles.submitErrorText}>{t('games.result.error_subtitle')}</Text>
          </Animated.View>
        )}

        {/* Secim sayaci + gonder butonu */}
        {!showRoundReveal && (
          <View style={styles.submitArea}>
            <Text style={styles.selectionCount}>
              {t('games.imposter.selected', {
                count: selectedIds.size,
                total: requiredSelections,
              })}
            </Text>
            <TouchableOpacity
              style={[
                styles.submitButton,
                selectedIds.size !== requiredSelections && styles.submitDisabled,
              ]}
              onPress={handleSubmitRound}
              disabled={selectedIds.size !== requiredSelections || isSubmitting}
              activeOpacity={0.7}
            >
              <Text style={styles.submitText}>
                {t('games.imposter.submit_round')}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.error,
    zIndex: 100,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: Theme.spacing.xl,
  },
  completeScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },

  // ── Round header ──────────────────────────────────────────────────────
  roundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  roundBadge: {
    backgroundColor: Colors.accentDim,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
  },
  roundBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.accentPrimary,
  },
  roundDifficulty: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textTertiary,
  },

  // ── Prev rounds chips ─────────────────────────────────────────────────
  prevRoundsRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.sm,
  },
  prevRoundChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
  },
  prevRoundCorrect: {
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  prevRoundWrong: {
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  prevRoundText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // ── Poster ────────────────────────────────────────────────────────────
  posterContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.md,
  },
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: Theme.borderRadius.lg,
  },
  filmTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textWhite,
    textAlign: 'center',
    marginTop: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },

  // ── Question ──────────────────────────────────────────────────────────
  question: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
  },

  // ── Round reveal (ogrenme ani) ─────────────────────────────────────────
  revealCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    padding: Theme.spacing.md,
    marginHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    width: SCREEN_W - Theme.spacing.md * 2,
  },
  revealCorrect: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: Colors.success,
  },
  revealWrong: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderColor: Colors.error,
  },
  revealContent: {
    flex: 1,
    gap: 4,
  },
  revealTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  revealSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // ── Options grid ──────────────────────────────────────────────────────
  optionsGrid: {
    width: SCREEN_W - Theme.spacing.md * 2,
    gap: Theme.spacing.sm,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    minHeight: 48,
  },
  optionDefault: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  optionSelected: {
    backgroundColor: Colors.accentDim,
    borderWidth: 1,
    borderColor: Colors.accentPrimary,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textWhite,
    flex: 1,
  },
  optionTextSelected: {
    color: Colors.accentPrimary,
  },

  // ── Submit area ───────────────────────────────────────────────────────
  /** Guven bahsi carpan rozeti — reveal kartinin sagi */
  factorBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Theme.borderRadius.full,
  },
  factorBadgeWin: {
    backgroundColor: Colors.goldDim,
  },
  factorBadgeLose: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  factorBadgeText: {
    fontSize: 14,
    fontWeight: '800',
  },

  confidenceArea: {
    width: SCREEN_W - Theme.spacing.md * 2,
    marginTop: Theme.spacing.lg,
  },
  submitErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    width: SCREEN_W - Theme.spacing.md * 2,
    marginTop: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  submitErrorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.error,
  },
  submitArea: {
    width: SCREEN_W - Theme.spacing.md * 2,
    marginTop: Theme.spacing.lg,
    gap: Theme.spacing.sm,
    alignItems: 'center',
  },
  selectionCount: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  submitButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },

  // ── Complete state ────────────────────────────────────────────────────
  roundsSummary: {
    flexDirection: 'row',
    gap: Theme.spacing.lg,
    marginBottom: Theme.spacing.lg,
  },
  roundDot: {
    alignItems: 'center',
    gap: 4,
  },
  roundDotLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
});
