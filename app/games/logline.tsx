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
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ArrowsLeftRight, CheckCircle, Lock, XCircle } from 'phosphor-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getGameStreak } from '@/services/gameService';
import { getDailyChallenge, submitGameGuess } from '@/services/gameApi';
import type {
  DailyChallenge,
  GuessResult,
  LoglineSemanticHints,
  SemanticMatch,
  WhyThisMovieText,
} from '@/types/game';
import type { DnaSignal } from '@/components/games/DnaXpReveal';
import type { GameState, FilmSearchResult } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { GameStateView } from '@/components/games/GameStateView';
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

/**
 * Semantik yakinlik rozeti — Logline'in tur/donem ipuclarinda kullanilir.
 * same: yesil onay · close: altin cift ok · different: soluk capraz
 */
function MatchIcon({ match }: { match: SemanticMatch }): React.JSX.Element {
  if (match === 'same') {
    return <CheckCircle size={14} weight="duotone" color={Colors.success} />;
  }
  if (match === 'close') {
    return <ArrowsLeftRight size={14} weight="duotone" color={Colors.gold} />;
  }
  return <XCircle size={14} weight="duotone" color={Colors.textTertiary} />;
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
  /** Tahmin ucusta — cift gonderimi engeller */
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setPuzzleNo(data.puzzle_no);
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

        // Çözüm sunucudan gelir — puzzle_data film adı taşımaz (migration 064)
        const solution = data.revealed_solution;
        setFilmInfo({
          title: solution?.title ?? t('games.result.unknown_film'),
          year: solution?.year ?? 0,
          posterPath: solution?.poster_url ?? null,
          filmId: 0,
        });

        setWhyThisMovie(data.why_this_movie ?? null);

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
      if (gameState !== 'playing' || isSubmitting) return;

      const filmUuid = film.uuid;
      if (!filmUuid) {
        logger.error('[logline] Film UUID bulunamadı — TMDb fallback kullanılamaz');
        return;
      }

      setIsSubmitting(true);
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
          setWhyThisMovie(result.why_this_movie ?? null);
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
          setWhyThisMovie(result.why_this_movie ?? null);
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
      } finally {
        setIsSubmitting(false);
      }
    },
    [gameState, puzzleId, revealedCount, clues.length, checkGamePaywall, isSubmitting],
  );

  // Error
  if (loadError) {
    return (
      <GameShell title={t('games.logline.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  // Loading
  if (gameState === 'loading') {
    return (
      <GameShell title={t('games.logline.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <GameStateView state="loading" />
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

  // Playing
  return (
    <GameShell
      title={t('games.logline.title')}
      currentAttempt={attempts}
      maxAttempts={maxAttempts}
    >
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/*
          Ilk ipucu logline metninin kendisi — ekranin kahramani.
          Kalan ipuclari (donem, yonetmen, oyuncu) altta birikir.
        */}
        {clues[0] ? (
          <Animated.View entering={FadeInUp.duration(400)} style={styles.loglineHero}>
            <Text style={styles.loglineText}>{clues[0].content}</Text>
          </Animated.View>
        ) : null}

        {/* Ek ipuclari — yanlis tahminle sirayla acilir */}
        {clues.length > 1 ? (
          <View style={styles.cluesContainer}>
            <Text style={styles.cluesLabel}>{t('games.logline.clues_label')}</Text>
            {clues.slice(1).map((clue, index) => {
              // clues[0] hero'ya gittigi icin indeks bir kayiyor
              const isRevealed = index + 1 < revealedCount;
              return (
                <Animated.View
                  key={clue.order}
                  entering={isRevealed ? FadeInUp.delay(index * 100).duration(300) : undefined}
                  style={[styles.clueRow, isRevealed ? styles.clueRevealed : styles.clueLocked]}
                >
                  {isRevealed ? (
                    <Text style={styles.clueText}>{clue.content}</Text>
                  ) : (
                    <View style={styles.lockedRow}>
                      <Lock size={14} color={Colors.textTertiary} weight="duotone" />
                      <Text style={styles.lockedText}>{t('games.logline.clue_locked')}</Text>
                    </View>
                  )}
                </Animated.View>
              );
            })}
          </View>
        ) : null}

        {/* Wrong guess feedback + semantic hints */}
        {wrongGuess && (
          <Animated.View entering={FadeInUp.duration(200)} style={styles.wrongGuessContainer}>
            <View style={styles.wrongGuess}>
              <XCircle size={16} color={Colors.error} weight="duotone" />
              <Text style={styles.wrongText}>{wrongGuess}</Text>
            </View>
            {semanticHints && (
              <View style={styles.semanticHints}>
                <View style={styles.hintChip}>
                  <MatchIcon match={semanticHints.genre_match} />
                  <Text style={[styles.hintChipText, {
                    color: semanticHints.genre_match === 'same' ? Colors.success : semanticHints.genre_match === 'close' ? Colors.gold : Colors.textTertiary,
                  }]}>
                    {t(`games.logline.hint_genre_${semanticHints.genre_match}`)}
                  </Text>
                </View>
                <View style={styles.hintChip}>
                  <MatchIcon match={semanticHints.decade_match} />
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
        <Text style={styles.searchLabel}>{t('games.logline.which_film')}</Text>
        <FilmSearchInput
          onSelect={handleGuess}
          disabled={gameState !== 'playing' || isSubmitting}
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
  /**
   * Logline metni — ekranin kahramani. Afis yok, genis bosluk;
   * hedef kitap okuma hissi (Festival Layer).
   */
  loglineHero: {
    paddingVertical: Theme.spacing.xxl,
    paddingHorizontal: Theme.spacing.sm,
  },
  loglineText: {
    ...Theme.typography.serifQuote,
    textAlign: 'center',
  },

  cluesContainer: {
    gap: Theme.spacing.xs,
    paddingTop: Theme.spacing.md,
  },
  cluesLabel: {
    ...Theme.typography.eyebrow,
    marginBottom: Theme.spacing.xs,
  },
  clueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    minHeight: 44,
  },
  clueRevealed: {
    borderColor: Colors.goldHairline,
    backgroundColor: Colors.goldSeal,
  },
  clueLocked: {
    borderColor: Colors.borderSubtle,
  },
  clueText: {
    flex: 1,
    ...Theme.typography.body,
    fontWeight: '600',
  },
  lockedRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
  },
  lockedText: {
    ...Theme.typography.caption,
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
    borderWidth: 1,
    borderColor: Colors.borderSubtle,
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
    gap: Theme.spacing.sm,
  },
  /** Input ustundeki "WHICH FILM?" etiketi */
  searchLabel: {
    ...Theme.typography.eyebrow,
    textAlign: 'center',
  },
});
