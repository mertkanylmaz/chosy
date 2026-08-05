/**
 * CineMetrics — Wordle-tarzı film tahmin oyunu.
 *
 * 6 öznitelik (Yıl, Tür, Yönetmen, Puan, Süre, Ülke) × max 6 tahmin.
 * Feedback sunucudan gelir (green/yellow/gray + yön okları).
 * Çözüm istemciye İNMEZ — submit-guess Edge Function doğrulama yapar.
 *
 * ── YERLEŞİM (1 Ağu 2026 — Apple 2026 standardı) ──────────────────────────
 * Eskiden 6 sabit ~46px sütunlu bir tablo idi: 9px metin, kolon başlıkları,
 * düz doygun renk dolguları. "Çok kolon = çok bilgi" tuzağı.
 *
 * Şimdi her tahmin bir KART: üstte film adı (serif), altında 3'erli sarılan
 * öznitelik çipleri. Etiket kolon başlığında değil çipin içinde, yani 9px
 * tipografiye gerek kalmıyor.
 *
 * Çipler yatay KAYDIRILMAZ, SARILIR (wrap). Yatay kaydırma her kartın kaydırma
 * pozisyonunu bağımsız yapıp sütun karşılaştırmasını bozardı — oyunun çekirdek
 * mekaniği tam olarak "aynı özniteliği tahminler arasında karşılaştırmak".
 * Sabit 3'lü ızgara hizalamayı korur.
 *
 * ── TEK SAYFA (Festival Layer Kural 7) ────────────────────────────────────
 * Oynanışta `ScrollView` yok. Ama altı açık kart sığmıyor:
 *   6 kart × 148px ≈ 890px   ·   kullanılabilir alan ≈ 480px
 *
 * Çözüm: **son tahmin** tam kart olarak durur (dikkat orada), önceki tahminler
 * tek satırlık geçmiş şeridine iner — film adı + 6 renk noktası. Karşılaştırma
 * renk deseninden okunur; bu Wordle'ın kendi çözümü ve 9px tipografiye geri
 * dönmeden sığar.
 *
 * Aksiyon barı da yüzmeyi bıraktı: ekran kaymadığı için altından geçecek içerik
 * yok, cam orada Kural 5'in derinlik testini geçmezdi.
 *
 * Ayrıntı: .claude/apple-design-standard-2026.md §6 · DESIGN_SYSTEM.md Kural 7
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
  withSpring,
  withDelay,
  withSequence,
  runOnJS,
  FadeInUp,
} from 'react-native-reanimated';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { REVEAL_SPRING } from '@/constants/animations';

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
import { GameShell, useGameThemeFor } from '@/components/games/GameShell';
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

import { createStyles } from './styles';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScreenState = 'loading' | 'playing' | 'completed';

/** Bu ekranin oyun kimligi — tema ve GameShell ayni sabiti okur,
 *  ikisi birbirinden kayamaz. */
const GAME_TYPE = 'cinemetrics' as const;

/** Feedback öznitelik anahtarları (çip sırası — kartlar arası sabit) */
const COLUMN_KEYS: (keyof FeedbackRow)[] = [
  'year',
  'genres',
  'director',
  'rating',
  'runtime',
  'country',
];

/** Çipler arası açılma gecikmesi */
const CHIP_STAGGER_MS = 70;
/** Flip'in yarısı — çip "sırtını döndüğü" ve değerin göründüğü an */
const FLIP_HALF_MS = 110;
/**
 * Bir satırın açılışının toplam süresi. Submit handler bu süre kadar bekler,
 * yani sabit sayı iki yerde yaşamaz — tek kaynak burası.
 * Son çipin gecikmesi + flip yarısı + spring'in oturma payı.
 */
export const ROW_REVEAL_MS = (COLUMN_KEYS.length - 1) * CHIP_STAGGER_MS + FLIP_HALF_MS + 280;

// ─── Flip Chip Component ─────────────────────────────────────────────────────

interface FlipChipProps {
  feedback: FeedbackCell;
  label: string;
  value: string;
  index: number;
  columnKey: keyof FeedbackRow;
  animate: boolean;
  /**
   * Tema stilleri ebeveynden gecirilir; her cip kendi `createStyles()`'ini
   * calistirsaydi her renderda 6 StyleSheet uretilirdi.
   */
  styles: ReturnType<typeof createStyles>;
}

/**
 * Tek bir öznitelik çipi — flip ile feedback açılır.
 *
 * Açılış anı animasyonun kendi callback'inden geliyor; eskiden paralel bir
 * `setTimeout` aynı süreyi ikinci kez tanımlıyordu ve ikisi kayabiliyordu.
 * Artık tek kaynak var: flip'in ilk yarısı bitince `runOnJS` tetikler.
 */
function FlipChip({
  feedback,
  label,
  value,
  index,
  columnKey,
  animate,
  styles,
}: FlipChipProps) {
  const rotateY = useSharedValue(animate ? 90 : 0);
  const [showResult, setShowResult] = useState(!animate);

  /** Değer göründüğü an — haptik de buradan, çünkü aynı kare */
  const handleReveal = useCallback(() => {
    setShowResult(true);
    if (index === COLUMN_KEYS.length - 1) {
      hapticMedium();
    } else {
      hapticLight();
    }
  }, [index]);

  useEffect(() => {
    if (!animate) return;

    rotateY.value = withDelay(
      index * CHIP_STAGGER_MS,
      withSequence(
        withTiming(90, { duration: FLIP_HALF_MS }, (finished) => {
          if (finished) runOnJS(handleReveal)();
        }),
        // Geri dönüş spring — Apple 2026 motion standardı (sabit easing değil)
        withSpring(0, REVEAL_SPRING),
      ),
    );
  }, [animate, index, rotateY, handleReveal]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ perspective: 600 }, { rotateY: `${rotateY.value}deg` }],
  }));

  const hasDirection =
    feedback.direction &&
    (columnKey === 'year' || columnKey === 'rating' || columnKey === 'runtime');

  const surfaceStyle = showResult
    ? feedback.result === 'green'
      ? styles.chipGreen
      : feedback.result === 'yellow'
        ? styles.chipYellow
        : styles.chipGray
    : styles.chipPending;

  const valueStyle = showResult
    ? feedback.result === 'green'
      ? styles.chipValueGreen
      : feedback.result === 'yellow'
        ? styles.chipValueYellow
        : styles.chipValueGray
    : styles.chipValueGray;

  const arrowColor = feedback.result === 'yellow' ? Colors.gold : Colors.textSecondary;

  return (
    <Animated.View style={[styles.chip, surfaceStyle, animatedStyle]}>
      <Text style={styles.chipLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.chipValueRow}>
        <Text style={[styles.chipValue, valueStyle]} numberOfLines={1}>
          {showResult ? value : ''}
        </Text>
        {showResult &&
          hasDirection &&
          feedback.result !== 'green' &&
          (feedback.direction === 'up' ? (
            <ArrowUp size={12} color={arrowColor} weight="duotone" />
          ) : (
            <ArrowDown size={12} color={arrowColor} weight="duotone" />
          ))}
      </View>
    </Animated.View>
  );
}

/**
 * Geçmiş şeridindeki tek noktanın rengi.
 *
 * Çiplerle AYNI stilleri kullanır (`chipGreen`/`chipYellow`/`chipGray`) —
 * geçmiş ile açık kart aynı dili konuşmalı, yoksa oyuncu iki ayrı renk kodu
 * öğrenmek zorunda kalır. Geri bildirim renkleri temadan bağımsızdır.
 */
function dotStyleFor(cell: FeedbackCell, styles: ReturnType<typeof createStyles>) {
  if (cell.result === 'green') return styles.chipGreen;
  if (cell.result === 'yellow') return styles.chipYellow;
  return styles.chipGray;
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

  const theme = useGameThemeFor(GAME_TYPE);
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Ölçülen aksiyon barı yüksekliği ve scroll takibi KALDIRILDI (Kural 7):
  // ekran artık kaymıyor, aksiyon barı normal akışta duruyor.

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
      const result: GuessResult = await submitGuess(challenge.puzzle.id, filmUuid);

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

        // Satır açılışının bitimini bekle — süre FlipChip ile aynı kaynaktan
        await new Promise((r) => setTimeout(r, ROW_REVEAL_MS));
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
    if (d <= 2)
      return {
        color: Colors.greenBright,
        label: t('games.cinemetrics.difficulty.easy'),
      };
    if (d <= 3)
      return {
        color: Colors.gold,
        label: t('games.cinemetrics.difficulty.medium'),
      };
    return {
      color: Colors.error,
      label: t('games.cinemetrics.difficulty.hard'),
    };
  }, [challenge?.puzzle.difficulty, t]);

  /** Hücre değerini formatla — gerçek metadata değerleri gösterir */
  const formatCellValue = useCallback((key: keyof FeedbackRow, guess: GuessEntry): string => {
    // guess.values varsa gerçek metadata değerlerini göster (yakınsama hissi)
    if (guess.values) {
      switch (key) {
        case 'year':
          return String(guess.values.year);
        case 'rating':
          return guess.values.rating.toFixed(1);
        case 'runtime':
          return `${guess.values.runtime}m`;
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
        default:
          return '?';
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
      <GameShell gameType={GAME_TYPE} title={t('games.cinemetrics.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  // ─── Render: Loading ─────────────────────────────────────────────────────

  if (screenState === 'loading') {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.cinemetrics.title')} currentAttempt={0} maxAttempts={maxAttempts}>
        <GameStateView state="loading" />
      </GameShell>
    );
  }

  // ─── Render: Completed ───────────────────────────────────────────────────

  if (screenState === 'completed') {
    return (
      <GameShell
        gameType={GAME_TYPE}
        title={t('games.cinemetrics.title')}
        currentAttempt={guesses.length}
        maxAttempts={maxAttempts}
        hideProgress
        floatingHeader
      >
        {({ topInset }) => (
        <ScrollView
          contentContainerStyle={[styles.completedContainer, { paddingTop: topInset }]}
          showsVerticalScrollIndicator={false}
        >
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
            gameType={GAME_TYPE}
            puzzleNo={puzzleNo}
            xpAwarded={xpAwarded}
            dnaUpdated={dnaUpdated}
            whyThisMovie={whyThisMovie ?? undefined}
            resultMessage={
              won
                ? t('games.cinemetrics.result.won', {
                    count: guesses.length,
                    max: maxAttempts,
                  })
                : t('games.cinemetrics.try_tomorrow')
            }
            countdown={countdown}
            onBackToHub={() => router.back()}
          />
        </ScrollView>
        )}
      </GameShell>
    );
  }

  // ─── Render: Playing ─────────────────────────────────────────────────────

  const emptyRows = Math.max(0, maxAttempts - guesses.length);

  /**
   * Son tahmin tam kart olarak, öncekiler geçmiş şeridinde.
   * Kural 7 gereği altı açık kart tek sayfaya sığmıyor (6 × 148px ≈ 890px,
   * kullanılabilir alan ≈ 480px); açık kart dikkatin olduğu yerde tutuluyor.
   */
  const lastGuess = guesses.length > 0 ? guesses[guesses.length - 1] : null;
  const history = guesses.slice(0, -1);

  return (
    <GameShell
      gameType={GAME_TYPE}
      title={t('games.cinemetrics.title')}
      currentAttempt={guesses.length}
      maxAttempts={maxAttempts}
    >
      <View style={styles.screen}>
        {/* Puzzle No + zorluk */}
        <View style={styles.headerRow}>
          <Text style={styles.puzzleNo}>Chosy #{challenge?.puzzle_no ?? 0}</Text>
          <View style={styles.difficultyBadge}>
            <Circle size={10} color={difficultyInfo.color} weight="fill" />
            <Text style={[styles.difficultyText, { color: difficultyInfo.color }]}>
              {difficultyInfo.label}
            </Text>
          </View>
        </View>

        {/*
          GEÇMİŞ ŞERİDİ — son tahminden önceki her tahmin tek satır.
          Film adı + 6 renk noktası; karşılaştırma renk deseninden okunur.
          Kural 7 (oynanış tek sayfa) 6 açık kartı imkânsız kılıyor:
          6 × 148px ≈ 890px, kullanılabilir alan ≈ 480px. Açık kart yalnız
          dikkatin olduğu yerde — son tahminde — duruyor.
        */}
        {history.length > 0 && (
          <View style={styles.history}>
            {history.map((guess, rowIdx) => (
              <View key={`hist-${rowIdx}`} style={styles.historyRow}>
                <Text style={styles.historyTitle} numberOfLines={1}>
                  {guess.title}
                </Text>
                <View style={styles.historyDots}>
                  {COLUMN_KEYS.map((key) => (
                    <View
                      key={`hist-${rowIdx}-${key}`}
                      style={[styles.historyDot, dotStyleFor(guess.feedback[key], styles)]}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* SON TAHMİN — tam kart, açılan çipler burada */}
        {lastGuess && (
          <Animated.View
            key={`guess-${guesses.length - 1}`}
            entering={FadeInUp.duration(260)}
            style={styles.guessCard}
          >
            <Text style={styles.guessTitle} numberOfLines={1}>
              {lastGuess.title}
            </Text>
            <View style={styles.chipGrid}>
              {COLUMN_KEYS.map((key, colIdx) => (
                <FlipChip
                  key={`${guesses.length - 1}-${key}`}
                  feedback={lastGuess.feedback[key]}
                  label={t(`games.cinemetrics.columns.${key}`)}
                  value={formatCellValue(key, lastGuess)}
                  index={colIdx}
                  columnKey={key}
                  animate={animatingRow === guesses.length - 1}
                  styles={styles}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {/* Esnek boşluk — aksiyon barını dibe iter, içerik yukarıda toplanır */}
        <View style={styles.spacer} />

        {/* Kalan hak + renk dili — tek satırda, legend kısaldı */}
        <View style={styles.metaRow}>
          {emptyRows > 0 && (
            <View style={styles.remainingRow}>
              {Array.from({ length: emptyRows }).map((_, i) => (
                <View
                  key={`empty-${i}`}
                  style={[styles.remainingPip, i === 0 && styles.remainingPipActive]}
                />
              ))}
              <Text style={styles.remainingText}>
                {t('games.cinemetrics.attempts_left', { count: emptyRows })}
              </Text>
            </View>
          )}
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.chipGreen]} />
              <Text style={styles.legendText}>{t('games.cinemetrics.legend_green')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendSwatch, styles.chipYellow]} />
              <Text style={styles.legendText}>{t('games.cinemetrics.legend_yellow')}</Text>
            </View>
            <View style={styles.legendItem}>
              <ArrowUp size={12} color={Colors.textTertiary} weight="duotone" />
              <ArrowDown size={12} color={Colors.textTertiary} weight="duotone" />
              <Text style={styles.legendText}>{t('games.cinemetrics.legend_arrows')}</Text>
            </View>
          </View>
        </View>

        {/*
          Aksiyon barı — artık YÜZMÜYOR, normal akışta. Ekran kaymadığı için
          altından geçecek içerik yok; cam orada dekorasyona düşerdi
          (DESIGN_SYSTEM.md Kural 5, derinlik testi).
        */}
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
            <Text style={styles.submitButtonText}>{t('games.cinemetrics.submit')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </GameShell>
  );
}
