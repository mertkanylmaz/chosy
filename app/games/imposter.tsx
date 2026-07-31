/**
 * Imposter — 60 saniye prototipi.
 *
 * 3 round, her roundda 4 secenek; zorluk sahte sayisiyla artar:
 *   Round 1: 3 gercek + 1 sahte (kolay)
 *   Round 2: 2 gercek + 2 sahte (orta)
 *   Round 3: 2 gercek + 2 sahte (zor)
 *
 * Yanlis round'da oyun BITMEZ — 3 round daima oynanir.
 * Her round sonrasi dogru cevap gosterilir (ogrenme ani).
 * Skor: 0-3 (dogru round sayisi).
 *
 * Edge Function tabanli — cozum istemciye inmez.
 *
 * ── Prototip notu (30 Tem 2026) ───────────────────────────────────────────
 * Oyun "acip 1 dakikada cikilabilir" hedefine gore sadelestirildi. Kaldirilan
 * ve degisen katmanlar:
 *
 * 1. Guven bahsi (ConfidenceSelector) ekrandan kaldirildi. Her round'dan once
 *    carpan okuyup risk secmek akisi kesiyordu — GAME_INNER_DYNAMICS.md'nin
 *    kendisi de "Confidence wager EKLEME, over-engineering" diyordu ama katman
 *    yine de eklenmisti. Sunucuya notr bahis (%50) gonderilmeye devam ediyor,
 *    yani sunucu sozlesmesi ve XP hesabi degismedi.
 * 2. "Lock In" butonu ve "1/2 secildi" sayaci kaldirildi. Gereken sayida yuz
 *    secilince round kendiliginden gonderiliyor — round 1 tek tap.
 * 3. Ogrenme ani 2500ms -> 900ms. Bilgi ayni, bekleme yok.
 * 4. Oynanis ekrani TEK SAYFA, ScrollView yok (31 Tem 2026): secenek sayisi
 *    her roundda 4'e sabitlendi, izgara 2x2, kart olculeri olculen yukseklige
 *    gore hesaplaniyor. Poster kirpilmiyor (contain), oyuncu adinin altinda
 *    rol adi var. Ayrinti: components/games/ImposterPilot/index.tsx dosya basi.
 * 5. Sonuc ekrani ResultCard yerine QuickResult — kisa icerikte tek ekran.
 *    (Tur 2: kesif karti acilinca kirpilmasin diye ScrollView'a alindi.)
 *
 * Bilerek DOKUNULMAYAN: seceneklerin ayirt edici bilgi tasimamasi sorunu.
 * Oyuncu bir aktoru taniyorsa biliyor, tanimiyorsa sans — bunu duzeltmek
 * generate-puzzles tarafinda celdirici kalitesi isi, istemci degisikligi degil.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticWarning, hapticSuccess, hapticMedium } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getGameStreak } from '@/services/gameService';
import { getDailyChallenge, submitImposterGuess } from '@/services/gameApi';
import type {
  DailyChallenge,
  ImposterGuessResult,
  ImposterRound,
  WhyThisMovieText,
} from '@/types/game';
import type { GameState } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { GameStateView } from '@/components/games/GameStateView';
import { ImposterPilot, ImposterBackdrop } from '@/components/games/ImposterPilot';
import { PilotTokens } from '@/components/games/ImposterPilot/pilotTokens';
import { QuickResult } from '@/components/games/QuickResult';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useGamePaywall } from '@/hooks/useGamePaywall';
import {
  trackGameOpened,
  trackGuessSubmitted,
  trackGameCompleted,
} from '@/utils/gameAnalytics';

/**
 * Ogrenme ani suresi — dogru cevabi okumaya yeter, akisi kesmez.
 * (Izgara olculeri artik components/games/ImposterPilot icinde.)
 */
const REVEAL_MS = 900;

/** Ikinci secimden sonra kilitlenmeden once birakilan nefes */
const AUTO_SUBMIT_MS = 250;

/**
 * Notr bahis. Guven secici kaldirildi ama sunucu bu alani bekliyor;
 * %50 gonderildiginde carpan 1 kalir ve XP eski davranisla birebir ayni olur.
 */
const NEUTRAL_CONFIDENCE = 50;

/** Round sonuc state'i */
interface RoundOutcome {
  round: number;
  correct: boolean;
  revealedImposters: string[];
}

export default function ImposterScreen() {
  const { t } = useLanguage();
  const router = useRouter();
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

  // Final result state
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
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
  }, [t]);

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
      loadPuzzle();
    }, [loadPuzzle]),
  );

  // ── Round gonderimi ─────────────────────────────────────────────────────────

  /** Round gonder — gereken secim tamamlaninca otomatik cagrilir */
  const handleSubmitRound = useCallback(async () => {
    if (selectedIds.size !== requiredSelections || isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(false);

    try {
      const result: ImposterGuessResult = await submitImposterGuess(
        puzzleId,
        currentRound,
        [...selectedIds],
        NEUTRAL_CONFIDENCE,
      );
      trackGuessSubmitted('imposter', currentRound, Date.now() - guessStartTime.current);
      guessStartTime.current = Date.now();

      const outcome: RoundOutcome = {
        round: currentRound,
        correct: result.round_correct,
        revealedImposters: result.revealed_imposters,
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

      // Ogrenme ani goster — kisa, akisi kesmeyecek kadar
      setLastRoundOutcome(outcome);
      setShowRoundReveal(true);
      setRoundOutcomes((prev) => [...prev, outcome]);

      await new Promise((r) => setTimeout(r, REVEAL_MS));

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
        setDnaUpdated(result.dna_updated);

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
        // Sonraki round
        setShowRoundReveal(false);
        setLastRoundOutcome(null);
        setSelectedIds(new Set());
        setCurrentRound((prev) => prev + 1);
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
      // Secim geri alinir — oyuncu yeniden secip tekrar deneyebilsin
      setSelectedIds(new Set());
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
    flashOpacity,
    checkGamePaywall,
  ]);

  /**
   * Otomatik kilitleme: gereken sayida yuz secilince round kendiliginden
   * gonderilir. "Lock In" butonu bu yuzden kaldirildi — round 1 tek tap,
   * round 2-3 iki tap. Kisa gecikme son secimin altin tikinin gorulmesi icin.
   */
  useEffect(() => {
    if (gameState !== 'playing') return;
    if (selectedIds.size !== requiredSelections) return;
    if (isSubmitting || showRoundReveal) return;

    const timer = setTimeout(handleSubmitRound, AUTO_SUBMIT_MS);
    return () => clearTimeout(timer);
  }, [
    gameState,
    selectedIds,
    requiredSelections,
    isSubmitting,
    showRoundReveal,
    handleSubmitRound,
  ]);

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

  // ── Render ──────────────────────────────────────────────────────────────────

  /** Error state */
  if (loadError) {
    return (
      <GameShell
        title={t('games.imposter.title')}
        currentAttempt={0}
        maxAttempts={3}
        background={<ImposterBackdrop />}
        progressGradient={PilotTokens.progressGradient}
      >
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  /** Loading state */
  if (gameState === 'loading') {
    return (
      <GameShell
        title={t('games.imposter.title')}
        currentAttempt={0}
        maxAttempts={3}
        background={<ImposterBackdrop />}
        progressGradient={PilotTokens.progressGradient}
      >
        <GameStateView state="loading" />
      </GameShell>
    );
  }

  /** Complete state — tek ekran */
  if (gameState === 'complete') {
    const correctCount = roundOutcomes.filter((r) => r.correct).length;

    return (
      <GameShell
        title={t('games.imposter.title')}
        currentAttempt={3}
        maxAttempts={3}
        hideProgress
        background={<ImposterBackdrop />}
      >
        <QuickResult
          solved={correctCount === 3}
          score={correctCount}
          total={3}
          filmTitle={filmInfo?.title ?? ''}
          filmYear={filmInfo?.year}
          filmPosterPath={filmInfo?.posterPath ?? null}
          filmId={filmInfo?.filmId ?? 0}
          streak={streak}
          gameTitle={t('games.imposter.title')}
          gameType="imposter"
          puzzleNo={puzzleNo}
          xpAwarded={xpAwarded}
          dnaUpdated={dnaUpdated}
          whyThisMovie={whyThisMovie ?? undefined}
          onBackToHub={() => router.back()}
        />
      </GameShell>
    );
  }

  // ── Playing state ───────────────────────────────────────────────────────────

  if (!activeRound) {
    // Round verisi yoksa sessizce bos ekran cizme — Hard Rule 5
    return (
      <GameShell
        title={t('games.imposter.title')}
        currentAttempt={0}
        maxAttempts={3}
        background={<ImposterBackdrop />}
        progressGradient={PilotTokens.progressGradient}
      >
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  const roundLabel = currentRound === 1
    ? t('games.imposter.round_easy')
    : currentRound === 2
      ? t('games.imposter.round_medium')
      : t('games.imposter.round_hard');

  return (
    <GameShell
      title={t('games.imposter.title')}
      subtitle={`${t('games.imposter.round_label', { n: currentRound })} · ${roundLabel}`}
      currentAttempt={currentRound - 1}
      maxAttempts={3}
      // PILOT: hero tam kanamali olsun diye padding sorumlulugu ekrana geciyor
      contentPadding={false}
      background={<ImposterBackdrop />}
      progressGradient={PilotTokens.progressGradient}
    >
      {/* Flash overlay — yanlis roundda kisa kirmizi parlama */}
      <Animated.View style={[styles.flashOverlay, flashStyle]} pointerEvents="none" />

      <ImposterPilot
        round={activeRound}
        currentRound={currentRound}
        requiredSelections={requiredSelections}
        selectedIds={selectedIds}
        onToggle={handleToggle}
        disabled={isSubmitting || showRoundReveal}
        showReveal={showRoundReveal}
        outcome={lastRoundOutcome}
        submitError={submitError}
      />

      <ContextualPaywall {...paywallProps} />
    </GameShell>
  );
}

/**
 * Bu ekranda kalan tek stil. Oynanis gorselleri artik
 * components/games/ImposterPilot/styles.ts icinde.
 */
const styles = StyleSheet.create({
  /** Yanlis roundda kisa kirmizi parlama — tum ekrani kaplar */
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.error,
    zIndex: 100,
  },
});
