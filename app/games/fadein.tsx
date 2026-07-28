/**
 * Fade In (Pikselli Afis) — Wordle-tarzi gunluk poster tahmin oyunu.
 *
 * Edge Function tabanlı — tahmin doğrulaması sunucuda.
 *
 * Mekanik:
 *   - Poster blur'lu baslar, her yanlis tahminde blur azalir
 *   - 6 deneme hakki — her yanlis tahmin 1 ipucu kredisi kazandirir
 *   - Krediyi oyuncu ISTEDIGI ipucu kategorisine harcar (sirali acilma YOK)
 *   - Dogruyu bilirsen poster tamamen net acilir (reveal)
 *   - 6/6 yanlis → loss state + filmi kesfet CTA
 *
 * Blur seviyeleri: [45, 30, 20, 12, 6, 2] — ilk adımda görsel fark net olacak
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
import { CloudSlash, EyeSlash, XCircle } from 'phosphor-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getPosterUrl } from '@/services/tmdb';
import { getGameStreak } from '@/services/gameService';
import { getDailyChallenge, revealHint, submitGameGuess } from '@/services/gameApi';
import type { DailyChallenge, FadeInHintStub, GuessResult, WhyThisMovieText } from '@/types/game';
import type { DnaSignal } from '@/components/games/DnaXpReveal';
import type { GameState, FilmSearchResult } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { GameStateView } from '@/components/games/GameStateView';
import { HintBoard } from '@/components/games/HintBoard';
import { ResultCard } from '@/components/games/ResultCard';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useGamePaywall } from '@/hooks/useGamePaywall';
import {
  trackGameOpened,
  trackGuessSubmitted,
  trackGameCompleted,
  trackHintUsed,
} from '@/utils/gameAnalytics';

// ─── Sabitler ───────────────────────────────────────────────────────────────

const { width: SCREEN_W } = Dimensions.get('window');
const POSTER_W = Math.floor(SCREEN_W * 0.7);
const POSTER_H = Math.floor(POSTER_W * 1.5);

/** Blur seviyeleri — index = kullanilan deneme sayisi.
 * Eski: [50,40,28,18,10,4] — ilk adımda fark görülmüyordu.
 * Yeni: Daha agresif azalma, her adımda bariz görsel fark. */
const BLUR_LEVELS = [45, 30, 20, 12, 6, 2];
const MAX_ATTEMPTS = 6;

// ─── FadeInScreen ───────────────────────────────────────────────────────────

export default function FadeInScreen() {
  const { t } = useLanguage();
  const { checkGamePaywall, paywallProps } = useGamePaywall();

  // Analytics timing refs
  const openTimeRef = useRef(Date.now());
  const guessStartTime = useRef(Date.now());

  // State
  const [gameState, setGameState] = useState<GameState>('loading');
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [hints, setHints] = useState<FadeInHintStub[]>([]);
  /** Acilmis ipuclarinin icerigi (order -> metin) — yalnizca sunucudan gelir */
  const [hintContents, setHintContents] = useState<Record<number, string>>({});
  /** Acilmis ipuclarinin order degerleri — secim sirasiyla */
  const [revealedOrders, setRevealedOrders] = useState<number[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [puzzleId, setPuzzleId] = useState('');
  const [streak, setStreak] = useState(0);
  const [wrongGuess, setWrongGuess] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  /** Tahmin/ipucu istegi hatasi — sessiz fallback YASAK */
  const [actionError, setActionError] = useState(false);

  // Result state (Edge Function response)
  const [solved, setSolved] = useState(false);
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

  /** Mevcut blur seviyesi */
  const currentBlur = BLUR_LEVELS[Math.min(attempts, BLUR_LEVELS.length - 1)];

  /** Harcanabilir ipucu hakki — her yanlis tahmin 1 kredi verir */
  const hintCredits = Math.max(0, attempts - revealedOrders.length);

  // ── Load puzzle ─────────────────────────────────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      setGameState('loading');
      setPosterUrl(null);
      setHints([]);
      setHintContents({});
      setRevealedOrders([]);
      setAttempts(0);
      setSolved(false);
      setFilmInfo(null);
      setWrongGuess(null);
      setLoadError(false);
      setActionError(false);
      loadPuzzle();
    }, []),
  );

  /** Puzzle yükle — Edge Function */
  const loadPuzzle = useCallback(async () => {
    try {
      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const data: DailyChallenge = await getDailyChallenge('fadein', puzzleDate);
      const puzzle = data.puzzle;
      const progress = data.progress;

      setPuzzleId(puzzle.id);
      setPuzzleNo(data.puzzle_no);

      // puzzle_data: { poster_url, hints: [{ order, type }] } — icerik/film adi YOK
      const pd = puzzle.puzzle_data;
      const posterPath = pd.poster_url as string | undefined;
      if (posterPath) {
        setPosterUrl(getPosterUrl(posterPath, 'w500'));
      }

      // puzzle_data yalnızca ipucu iskeletini taşır (order + type);
      // içerik sunucudan gelir (migration 064, Hard Rule 1).
      const hintList = (pd.hints as FadeInHintStub[]) ?? [];
      setHints(hintList.sort((a, b) => a.order - b.order));

      // Açılmış ipuçlarının içerikleri — resume
      if (data.revealed_hint_contents?.length) {
        setHintContents(
          Object.fromEntries(data.revealed_hint_contents.map((h) => [h.order, h.content])),
        );
      }

      // Bugün zaten oynanmış mı?
      if (progress?.completed) {
        const streakInfo = await getGameStreak('fadein');
        setStreak(streakInfo.currentStreak);
        setSolved(progress.won);
        setAttempts(progress.guesses?.length ?? 0);

        // Çözüm sunucudan gelir — puzzle_data film adı taşımaz
        const solution = data.revealed_solution;
        setFilmInfo({
          title: solution?.title ?? t('games.result.unknown_film'),
          year: solution?.year ?? 0,
          posterPath: solution?.poster_url ?? posterPath ?? null,
          filmId: 0,
        });

        setWhyThisMovie(data.why_this_movie ?? null);

        setGameState('complete');
        return;
      }

      // Devam eden oyun — tahmin sayisi ve acilmis ipuclari sunucudan
      if (progress?.guesses) {
        setAttempts(progress.guesses.length);
      }
      if (progress?.revealed_hints) {
        setRevealedOrders(progress.revealed_hints);
      }

      setGameState('playing');
      openTimeRef.current = Date.now();
      guessStartTime.current = Date.now();
      trackGameOpened('fadein', 0, 'hub');
    } catch (err) {
      logger.error('[fadein] Load hatası:', err);
      setLoadError(true);
    }
  }, []);

  // ── Guess handler ─────────────────────────────────────────────────────────

  /** Tahmin yap — Edge Function doğrular */
  const handleGuess = useCallback(
    async (film: FilmSearchResult) => {
      if (gameState !== 'playing') return;

      const filmUuid = film.uuid;
      if (!filmUuid) {
        logger.error('[fadein] Film UUID bulunamadı — TMDb fallback kullanılamaz');
        return;
      }

      try {
        const result: GuessResult = await submitGameGuess(puzzleId, filmUuid);
        const newAttempts = result.guesses_used;
        setAttempts(newAttempts);
        trackGuessSubmitted('fadein', newAttempts, Date.now() - guessStartTime.current);
        guessStartTime.current = Date.now();

        if (result.correct) {
          hapticSuccess();
          setSolved(true);
          setXpAwarded(result.xp_awarded);
          setWhyThisMovie(result.why_this_movie ?? null);
          setDnaUpdated(result.dna_updated);
          if (result.dna_updated) {
            setDnaSignals([
              { dimension: 'visual_sense', delta: 0.5 },
              { dimension: 'knowledge', delta: 0.3 },
            ]);
          }

          setGameState('reveal');
          trackGameCompleted({
            gameId: 'fadein',
            won: true,
            guessesUsed: newAttempts,
            timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
            xp: result.xp_awarded,
          });
          await new Promise((r) => setTimeout(r, 800));

          if (result.revealed_solution) {
            setFilmInfo({
              title: result.revealed_solution.title,
              year: result.revealed_solution.year,
              posterPath: result.revealed_solution.poster_url ?? null,
              filmId: 0,
            });
          }

          const streakInfo = await getGameStreak('fadein');
          setStreak(streakInfo.currentStreak);
          setGameState('complete');
          checkGamePaywall(streakInfo.currentStreak, true);
        } else {
          hapticWarning();
          setWrongGuess(film.title);
          setTimeout(() => setWrongGuess(null), 1500);

          // İpucu otomatik açılmaz — bu yanlış tahmin 1 kredi kazandırır,
          // oyuncu krediyi HintBoard'dan istediği kategoriye harcar.

          // Son deneme — oyun biter
          if (result.completed) {
            hapticHeavy();
            setSolved(false);
            setXpAwarded(result.xp_awarded);
          setWhyThisMovie(result.why_this_movie ?? null);
            setDnaUpdated(result.dna_updated);

            setGameState('reveal');
            trackGameCompleted({
              gameId: 'fadein',
              won: false,
              guessesUsed: newAttempts,
              timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
              xp: result.xp_awarded,
            });
            await new Promise((r) => setTimeout(r, 800));

            if (result.revealed_solution) {
              setFilmInfo({
                title: result.revealed_solution.title,
                year: result.revealed_solution.year,
                posterPath: result.revealed_solution.poster_url ?? null,
                filmId: 0,
              });
            }

            const streakInfo = await getGameStreak('fadein');
            setStreak(streakInfo.currentStreak);
            setGameState('complete');
          }
        }
      } catch (err) {
        // Sessiz fallback YASAK — kullanıcıya görünür hata + retry
        logger.error('[fadein] Submit hatası:', err);
        Sentry.captureException(err, { tags: { game: 'fadein', action: 'submit_guess' } });
        hapticHeavy();
        setActionError(true);
      }
    },
    [gameState, puzzleId, checkGamePaywall],
  );

  // ── Hint handler ──────────────────────────────────────────────────────────

  /** Seçilen ipucunu açar — sunucu kredi kontrolünü yapar */
  const handleRevealHint = useCallback(
    async (hint: FadeInHintStub) => {
      if (gameState !== 'playing') return;
      // Optimistic: kart hemen açılır, sunucu reddederse geri alınır
      if (revealedOrders.includes(hint.order)) return;

      const previous = revealedOrders;
      setRevealedOrders([...previous, hint.order]);
      setActionError(false);
      hapticMedium();

      try {
        const result = await revealHint(puzzleId, hint.order);
        setRevealedOrders(result.revealed_hints);
        setHintContents((prev) => ({ ...prev, [result.hint.order]: result.hint.content }));
        trackHintUsed('fadein', hint.type, result.hints_used);
      } catch (err) {
        logger.error('[fadein] İpucu açma hatası:', err);
        Sentry.captureException(err, {
          tags: { game: 'fadein', action: 'reveal_hint', hint_type: hint.type },
        });
        setRevealedOrders(previous);
        hapticWarning();
        setActionError(true);
      }
    },
    [gameState, puzzleId, revealedOrders],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  /** Error state */
  if (loadError) {
    return (
      <GameShell title={t('games.fadein.title')} currentAttempt={0} maxAttempts={MAX_ATTEMPTS}>
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  /** Loading state */
  if (gameState === 'loading') {
    return (
      <GameShell title={t('games.fadein.title')} currentAttempt={0} maxAttempts={MAX_ATTEMPTS}>
        <GameStateView state="loading" />
      </GameShell>
    );
  }

  /** Complete state */
  if (gameState === 'complete' && filmInfo) {
    return (
      <GameShell
        title={t('games.fadein.title')}
        currentAttempt={attempts}
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
            solved={solved}
            attempts={attempts}
            maxAttempts={MAX_ATTEMPTS}
            filmTitle={filmInfo.title}
            filmYear={filmInfo.year}
            filmPosterPath={filmInfo.posterPath}
            filmId={filmInfo.filmId}
            streak={streak}
            gameTitle={t('games.fadein.title')}
            gameType="fadein"
            puzzleNo={puzzleNo}
            whyThisMovie={whyThisMovie ?? undefined}
            xpAwarded={xpAwarded > 0 ? xpAwarded : undefined}
            dnaUpdated={dnaUpdated}
            dnaSignals={dnaSignals.length > 0 ? dnaSignals : undefined}
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
                  <EyeSlash size={14} color={Colors.textWhite} weight="duotone" />
                  <Text style={styles.blurBadgeText}>
                    {t('games.fadein.blur_level', { level: attempts + 1, max: MAX_ATTEMPTS })}
                  </Text>
                </View>
              )}
            </Animated.View>
          )}
        </View>

        {/* İpucu tahtası — oyuncu hangisini açacağını seçer */}
        {gameState === 'playing' && (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.hintsContainer}>
            <HintBoard
              hints={hints}
              revealedOrders={revealedOrders}
              contents={hintContents}
              credits={hintCredits}
              onReveal={handleRevealHint}
            />
          </Animated.View>
        )}

        {/* İstek hatası — sessiz fallback YASAK */}
        {actionError && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.actionErrorBox}>
            <CloudSlash size={18} color={Colors.error} weight="duotone" />
            <Text style={styles.actionErrorText}>{t('games.result.error_subtitle')}</Text>
          </Animated.View>
        )}

        {/* Yanlış tahmin toast */}
        {wrongGuess && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.wrongToast}>
            <XCircle size={18} color={Colors.error} weight="duotone" />
            <Text style={styles.wrongText} numberOfLines={1}>
              {wrongGuess} — {t('games.fadein.wrong')}
            </Text>
          </Animated.View>
        )}

        {/* Deneme göstergesi */}
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
  },
  actionErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  actionErrorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: Colors.error,
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
