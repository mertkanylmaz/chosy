/**
 * Quoted — Gercek film repliginden filmi tahmin et.
 *
 * Ikonik bir film repligi gosterilir, kullanici filmi tahmin eder.
 * Yanlis tahminlerde ipuclari acilir: karakter adi > basrol > yonetmen+yil.
 * Max 4 deneme hakki (1 replik + 3 ipucu).
 *
 * Edge Function tabanlı — tahmin doğrulaması sunucuda.
 */
import React, { useCallback, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ChatCircleDots, FilmSlate, Info, Lightbulb, XCircle } from 'phosphor-react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticHeavy, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { getGameStreak } from '@/services/gameService';
import { getDailyChallenge, submitGameGuess } from '@/services/gameApi';
import type { DailyChallenge, GuessResult, WhyThisMovieText } from '@/types/game';
import type { DnaSignal } from '@/components/games/DnaXpReveal';
import type { GameState, FilmSearchResult } from '@/services/gameTypes';
import { GameShell } from '@/components/games/GameShell';
import { GameStateView } from '@/components/games/GameStateView';
import { ResultCard } from '@/components/games/ResultCard';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useGamePaywall } from '@/hooks/useGamePaywall';
import { trackGameOpened, trackGuessSubmitted, trackGameCompleted } from '@/utils/gameAnalytics';

/** Quoted ipucu */
interface QuotedHint {
  order: number;
  content: string;
}

export default function QuotedScreen() {
  const { t } = useLanguage();
  const { checkGamePaywall, paywallProps } = useGamePaywall();

  // Analytics timing refs
  const openTimeRef = useRef(Date.now());
  const guessStartTime = useRef(Date.now());

  const [gameState, setGameState] = useState<GameState>('loading');
  const [quoteText, setQuoteText] = useState('');
  const [contextHint, setContextHint] = useState('');
  const [quoteGenre, setQuoteGenre] = useState('');
  const [hints, setHints] = useState<QuotedHint[]>([]);
  const [revealedHints, setRevealedHints] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [maxAttempts, setMaxAttempts] = useState(4);
  const [puzzleId, setPuzzleId] = useState('');
  const [streak, setStreak] = useState(0);
  const [wrongGuess, setWrongGuess] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);

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
      setQuoteText('');
      setContextHint('');
      setQuoteGenre('');
      setHints([]);
      setRevealedHints(0);
      setAttempts(0);
      setSolved(false);
      setFilmInfo(null);
      setWrongGuess(null);
      setLoadError(false);
      loadPuzzle();
    }, []),
  );

  /** Puzzle yükle — Edge Function */
  const loadPuzzle = useCallback(async () => {
    try {
      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const data: DailyChallenge = await getDailyChallenge('quoted', puzzleDate);
      const puzzle = data.puzzle;
      const progress = data.progress;

      setPuzzleId(puzzle.id);
      setPuzzleNo(data.puzzle_no);
      setMaxAttempts(puzzle.max_attempts);

      // puzzle_data: { quote, context_hint?, genre?, hints, poster_url?, tmdb_id?, film_title? }
      const pd = puzzle.puzzle_data;
      setQuoteText((pd.quote as string) ?? '');
      setContextHint((pd.context_hint as string) ?? '');
      setQuoteGenre((pd.genre as string) ?? '');

      const hintList = (pd.hints as QuotedHint[]) ?? [];
      setHints(hintList.sort((a, b) => a.order - b.order));

      // Bugün zaten oynanmış mı?
      if (progress?.completed) {
        const streakInfo = await getGameStreak('quoted');
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
        setAttempts(progress.guesses.length);
        setRevealedHints(Math.min(progress.guesses.length, hintList.length));
      }

      setGameState('playing');
      openTimeRef.current = Date.now();
      guessStartTime.current = Date.now();
      trackGameOpened('quoted', 0, 'hub');
    } catch (err) {
      logger.error('[quoted] Load hatası:', err);
      setLoadError(true);
    }
  }, []);

  /** Tahmin yap — Edge Function doğrular */
  const handleGuess = useCallback(
    async (film: FilmSearchResult) => {
      if (gameState !== 'playing') return;

      const filmUuid = film.uuid;
      if (!filmUuid) {
        logger.error('[quoted] Film UUID bulunamadı — TMDb fallback kullanılamaz');
        return;
      }

      try {
        const result: GuessResult = await submitGameGuess(puzzleId, filmUuid);
        const newAttempts = result.guesses_used;
        setAttempts(newAttempts);
        trackGuessSubmitted('quoted', newAttempts, Date.now() - guessStartTime.current);
        guessStartTime.current = Date.now();

        if (result.correct) {
          hapticSuccess();
          setSolved(true);
          setXpAwarded(result.xp_awarded);
          setWhyThisMovie(result.why_this_movie ?? null);
          setDnaUpdated(result.dna_updated);
          if (result.dna_updated) {
            setDnaSignals([
              { dimension: 'knowledge', delta: 0.5 },
              { dimension: 'deduction', delta: 0.3 },
            ]);
          }

          setGameState('reveal');
          trackGameCompleted({
            gameId: 'quoted',
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

          const streakInfo = await getGameStreak('quoted');
          setStreak(streakInfo.currentStreak);
          setGameState('complete');
          checkGamePaywall(streakInfo.currentStreak, true);
        } else {
          hapticWarning();
          setWrongGuess(film.title);
          setTimeout(() => setWrongGuess(null), 1500);

          // Sonraki ipucunu aç
          if (revealedHints < hints.length) {
            setRevealedHints((prev) => prev + 1);
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
              gameId: 'quoted',
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

            const streakInfo = await getGameStreak('quoted');
            setStreak(streakInfo.currentStreak);
            setGameState('complete');
          }
        }
      } catch (err) {
        logger.error('[quoted] Submit hatası:', err);
      }
    },
    [gameState, puzzleId, revealedHints, hints.length, checkGamePaywall],
  );

  // ─── Error ───
  if (loadError) {
    return (
      <GameShell title={t('games.quoted.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  // ─── Loading ───
  if (gameState === 'loading') {
    return (
      <GameShell title={t('games.quoted.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <GameStateView state="loading" />
      </GameShell>
    );
  }

  // ─── Complete ───
  if (gameState === 'complete' && filmInfo) {
    return (
      <GameShell
        title={t('games.quoted.title')}
        currentAttempt={attempts}
        maxAttempts={maxAttempts}
        hideProgress
      >
        <ScrollView contentContainerStyle={styles.resultContainer} showsVerticalScrollIndicator={false}>
          {/* Repliği tekrar göster */}
          <View style={styles.quoteCardSmall}>
            <ChatCircleDots size={18} color={Colors.gold} weight="duotone" />
            <Text style={styles.quoteTextSmall} numberOfLines={3}>
              {`"${quoteText}"`}
            </Text>
          </View>
          <ResultCard
            solved={solved}
            attempts={attempts}
            maxAttempts={maxAttempts}
            filmTitle={filmInfo.title}
            filmYear={filmInfo.year}
            filmPosterPath={filmInfo.posterPath}
            filmId={filmInfo.filmId}
            streak={streak}
            gameTitle={t('games.quoted.title')}
            gameType="quoted"
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

  // ─── Playing ───
  return (
    <GameShell
      title={t('games.quoted.title')}
      currentAttempt={attempts}
      maxAttempts={maxAttempts}
    >
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Bağlam ipucu — replikten ÖNCE gösterilir (dedüksiyon katmanı) */}
        {contextHint ? (
          <Animated.View entering={FadeInDown.duration(300)} style={styles.contextCard}>
            <Info size={18} color={Colors.gold} weight="duotone" />
            <View style={styles.contextContent}>
              {quoteGenre ? (
                <Text style={styles.contextGenre}>{quoteGenre}</Text>
              ) : null}
              <Text style={styles.contextText}>{contextHint}</Text>
            </View>
          </Animated.View>
        ) : (
          <View style={styles.quoteBadge}>
            <FilmSlate size={20} color={Colors.gold} weight="duotone" />
            <Text style={styles.quoteBadgeLabel}>{t('games.quoted.quoteLabel')}</Text>
          </View>
        )}

        {/* Replik kartı */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.quoteCard}>
          <ChatCircleDots size={28} color={Colors.gold} style={styles.quoteIcon} weight="duotone" />
          <Text style={styles.quoteMainText}>{`"${quoteText}"`}</Text>
        </Animated.View>

        {/* Açılan ipuçları */}
        {hints.slice(0, revealedHints).map((hint, index) => (
          <Animated.View
            key={hint.order}
            entering={FadeInUp.delay(index * 100).duration(300)}
            style={styles.hintRow}
          >
            <Lightbulb size={16} color={Colors.gold} weight="duotone" />
            <Text style={styles.hintText}>{hint.content}</Text>
          </Animated.View>
        ))}

        {/* Yanlış tahmin */}
        {wrongGuess && (
          <Animated.View entering={FadeInUp.duration(200)} style={styles.wrongGuess}>
            <XCircle size={16} color={Colors.error} weight="duotone" />
            <Text style={styles.wrongText}>{wrongGuess}</Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Film arama */}
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
    gap: Theme.spacing.md,
    paddingBottom: Theme.spacing.lg,
  },
  quoteCardSmall: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quoteTextSmall: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 20,
  },
  scrollContent: {
    flex: 1,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.md,
    padding: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(218,165,32,0.15)',
  },
  contextContent: {
    flex: 1,
    gap: 4,
  },
  contextGenre: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.gold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  contextText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  quoteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
  },
  quoteBadgeLabel: {
    fontSize: 13,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  quoteCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Theme.borderRadius.lg,
    padding: Theme.spacing.lg,
    marginVertical: Theme.spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  quoteIcon: {
    marginBottom: Theme.spacing.sm,
  },
  quoteMainText: {
    fontSize: 20,
    color: Colors.textWhite,
    lineHeight: 30,
    fontStyle: 'italic',
    fontWeight: '500',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    backgroundColor: Colors.goldDim,
    borderRadius: Theme.borderRadius.sm,
    marginTop: Theme.spacing.sm,
  },
  hintText: {
    fontSize: 14,
    color: Colors.gold,
    fontWeight: '500',
  },
  wrongGuess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
    marginTop: Theme.spacing.sm,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: Theme.borderRadius.sm,
  },
  wrongText: {
    fontSize: 14,
    color: Colors.error,
  },
  searchContainer: {
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.sm,
    marginBottom: Platform.OS === 'ios' ? 20 : 10,
  },
});
