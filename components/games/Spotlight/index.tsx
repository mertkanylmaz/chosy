/**
 * Spotlight V3 — tek gorsel + harf harf acilan baslik.
 *
 * Eski V2 (6 film eleme) Detective'in kucuk kopyasiydi: ayni fiil, ayni his.
 * V3 farkli bir soru soruyor — "bu kareyi taniyor musun?"
 *
 * Mekanik:
 *   - Filmden bir kare bulanik baslar; acilan her harf gorseli netlestirir
 *   - Baslik maskeli; oyuncu klavyeden harf dener
 *   - Dogru harf bedava ve tum pozisyonlarini acar, yanlis harf 1 hak goturur
 *   - Oyuncu istedigi an arama kutusundan filmi tahmin edebilir
 *
 * Cozum istemciye INMEZ — baslik metni hicbir response'ta yoktur; yalnizca
 * oyuncunun kendi actigi harfler ve pozisyonlari doner (Hard Rule 1 + 2).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { CloudSlash, Eye } from 'phosphor-react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { PRESS_SPRING } from '@/constants/animations';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { trackGameOpened, trackGuessSubmitted, trackGameCompleted } from '@/utils/gameAnalytics';
import { getDailyChallenge, submitSpotlightGuess, submitSpotlightLetter } from '@/services/gameApi';
import { GameShell, useGameThemeFor } from '@/components/games/GameShell';
import { clamp, useGameFit } from '@/hooks/useGameLayout';
import { GameStateView } from '@/components/games/GameStateView';
import { ResultCard } from '@/components/games/ResultCard';
import { FilmSearchInput } from '@/components/games/FilmSearchInput';
import { GlassSurface } from '@/components/games/GlassSurface';
import type { FilmSearchResult } from '@/services/gameTypes';
import type {
  DailyChallenge,
  RevealedFilm,
  RevealedTitleChar,
  SpotlightPuzzleData,
  WhyThisMovieText,
} from '@/types/game';

import { createStyles } from './styles';

type ScreenState = 'loading' | 'playing' | 'completed';

/** Bu ekranin oyun kimligi — tema ve GameShell ayni sabiti okur,
 *  ikisi birbirinden kayamaz. */
const GAME_TYPE = 'spotlight' as const;

/** Yanlis harf + yanlis film tahmini icin toplam hak */
const SPOTLIGHT_MAX_ATTEMPTS = 6;

/** Ekran klavyesi duzeni */
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

/** En yuksek bulaniklik — hic harf acilmamisken */
const MAX_BLUR = 40;

/**
 * Gorsel disinda kalan sabit dikey yuk: maske etiketi + harf satiri +
 * klavye (3x42 + aralik) + tahmin alani + bosluklar.
 */
const BOARD_RESERVED_H = 340;

/** Gorselin okunurluk tabani — altinda film karesi tanınmaz oluyor */
const STILL_MIN = 150;
/** Ust sinir — buyuk ekranda gorsel ekrani yutmasin */
const STILL_MAX = 380;

/**
 * Bulaniklik acilan harf oranina gore azalir: hicbiri acikken MAX_BLUR,
 * hepsi acikken 0. Netlesme oyuncunun tek gorsel odulu.
 */
function blurForProgress(revealedCount: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round(MAX_BLUR * (1 - Math.min(1, revealedCount / total)));
}

// ─── Klavye tusu ─────────────────────────────────────────────────────────────

interface KeyButtonProps {
  letter: string;
  tried: boolean;
  hit: boolean;
  disabled: boolean;
  onPress: () => void;
  /**
   * Tema stilleri ebeveynden gecirilir, burada `useGameTheme()` cagrilmaz:
   * ekranda 26 tus var, her biri kendi `createStyles()`'ini calistirsaydi
   * her renderda 26 StyleSheet uretilirdi.
   */
  styles: ReturnType<typeof createStyles>;
}

/**
 * Tek klavye tusu — basista spring ile kuculur.
 *
 * `TouchableOpacity`'nin opaklik solmasi yerine `PRESS_SPRING`: Apple 2026
 * motion standardi sabit easing degil spring istiyor (bkz. DESIGN_SYSTEM.md
 * › Motion). Kural 6 ihlal edilmiyor — bu bir "anlamli animasyon" degil,
 * dokunma geri bildirimi.
 */
function KeyButton({ letter, tried, hit, disabled, onPress, styles }: KeyButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        style={[styles.key, tried && (hit ? styles.keyHit : styles.keyMiss)]}
        onPressIn={() => {
          scale.value = withSpring(0.9, PRESS_SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={letter}
        accessibilityState={{ disabled }}
      >
        <Text style={[styles.keyText, hit && styles.keyTextHit]}>{letter}</Text>
      </Pressable>
    </Animated.View>
  );
}

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

/**
 * Spotlight V3 oyun ekrani.
 */
export function SpotlightGame() {
  const { t } = useLanguage();
  const router = useRouter();
  const countdown = useCountdown();
  const openTimeRef = useRef(Date.now());
  const guessStartRef = useRef(Date.now());

  const theme = useGameThemeFor(GAME_TYPE);
  const styles = useMemo(() => createStyles(theme), [theme]);

  /** Tek sayfa olcumu — Kural 7 */
  const fit = useGameFit();

  /**
   * Gorselin yuksekligi olculen alandan pay biciliyor.
   *
   * Sabit oran kullanilamaz: Kural 4 gorselin ekran yuksekliginin >=%45'i
   * olmasini istiyor ama maske satiri + klavye + tahmin alani ~340px sabit yer
   * kapliyor. iPhone SE'de (667pt) %45 klavyeyi ekran disina iterdi.
   *
   * STILL_MIN okunurluk tabani: bu degerin altinda film karesi tanınmaz hale
   * geliyor ve oyunun tek gorsel ipucu kayboluyor.
   */
  const stillHeight = fit.measured
    ? clamp(fit.height - BOARD_RESERVED_H, STILL_MIN, STILL_MAX)
    : STILL_MIN;

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [loadError, setLoadError] = useState(false);
  /** Bulmaca V3 oncesi formatta — bu ekranla oynanamaz */
  const [staleFormat, setStaleFormat] = useState(false);

  const [puzzleId, setPuzzleId] = useState('');
  const [puzzleNo, setPuzzleNo] = useState(0);
  const [puzzleData, setPuzzleData] = useState<SpotlightPuzzleData | null>(null);

  const [triedLetters, setTriedLetters] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<RevealedTitleChar[]>([]);
  const [attempts, setAttempts] = useState(0);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  const [won, setWon] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [revealedFilm, setRevealedFilm] = useState<RevealedFilm | null>(null);
  const [whyThisMovie, setWhyThisMovie] = useState<WhyThisMovieText | null>(null);

  const loadPuzzle = useCallback(async () => {
    try {
      setLoadError(false);
      setStaleFormat(false);
      setScreenState('loading');

      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const data: DailyChallenge = await getDailyChallenge('spotlight', puzzleDate);
      const pd = data.puzzle.puzzle_data as unknown as SpotlightPuzzleData;

      // V3 oncesi bulmacalar bu ekranla oynanamaz. Bos ekran yerine
      // gorunur durum + retry sunulur (Hard Rule 5).
      if (!pd?.title_mask || (pd.v ?? 0) < 3) {
        logger.warn('[spotlight] V3 oncesi puzzle formati — oyun gosterilemiyor');
        setStaleFormat(true);
        return;
      }

      setPuzzleId(data.puzzle.id);
      setPuzzleNo(data.puzzle_no);
      setPuzzleData(pd);
      setWhyThisMovie(data.why_this_movie ?? null);
      if (data.revealed_solution) setRevealedFilm(data.revealed_solution);

      const progress = data.progress;
      setTriedLetters(progress?.spotlight_letters ?? []);
      setRevealed(progress?.spotlight_revealed ?? []);
      setAttempts(progress?.guesses?.length ?? 0);

      if (progress?.completed) {
        setWon(progress.won);
        setScreenState('completed');
        return;
      }

      setScreenState('playing');
      openTimeRef.current = Date.now();
      guessStartRef.current = Date.now();
      trackGameOpened('spotlight', data.puzzle_no, 'hub');
    } catch (err) {
      logger.error('[spotlight] Puzzle yuklenemedi:', err);
      setLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setTriedLetters([]);
      setRevealed([]);
      setAttempts(0);
      setWon(false);
      setActionError(false);
      loadPuzzle();
    }, [loadPuzzle]),
  );

  /** Harf dene — dogrulama sunucuda */
  const handleLetter = useCallback(
    async (letter: string) => {
      if (isBusy || screenState !== 'playing') return;
      if (triedLetters.includes(letter)) return;

      setIsBusy(true);
      setActionError(false);
      try {
        const res = await submitSpotlightLetter(puzzleId, letter);
        setTriedLetters(res.tried_letters);
        setRevealed(res.revealed);
        setAttempts(res.attempts_used);

        // Haklar bittiyse oyun burada kapanir — aksi halde oyuncu "0 hak"
        // ile ekranda kilitli kalir ve sonraki harf 409 alir.
        if (res.completed) {
          setWon(false);
          setXpAwarded(res.xp_awarded);
          setDnaUpdated(res.dna_updated);
          if (res.revealed_solution) setRevealedFilm(res.revealed_solution);
          if (res.why_this_movie) setWhyThisMovie(res.why_this_movie);
          hapticMedium();
          setScreenState('completed');
          trackGameCompleted({
            gameId: 'spotlight',
            won: false,
            guessesUsed: res.attempts_used,
            timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
            xp: res.xp_awarded,
            extra: {
              letters_tried: res.tried_letters.length,
              ended_by: 'letters',
            },
          });
          return;
        }

        if (res.hit) hapticSuccess();
        else hapticWarning();
      } catch (err) {
        logger.error('[spotlight] Harf gonderilemedi:', err);
        setActionError(true);
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, screenState, triedLetters, puzzleId],
  );

  /** Filmi tahmin et — kazanma yolu */
  const handleGuess = useCallback(
    async (film: FilmSearchResult) => {
      if (isBusy || screenState !== 'playing') return;

      const filmUuid = film.uuid;
      if (!filmUuid) {
        logger.error('[spotlight] Film UUID yok — tahmin gonderilemiyor');
        setActionError(true);
        return;
      }

      setIsBusy(true);
      setActionError(false);
      try {
        const res = await submitSpotlightGuess(puzzleId, filmUuid);
        setAttempts(res.attempts_used);
        setTriedLetters(res.tried_letters);
        setRevealed(res.revealed);
        trackGuessSubmitted('spotlight', res.attempts_used, Date.now() - guessStartRef.current);
        guessStartRef.current = Date.now();

        if (res.completed) {
          setWon(res.won);
          setXpAwarded(res.xp_awarded);
          setDnaUpdated(res.dna_updated);
          if (res.revealed_solution) setRevealedFilm(res.revealed_solution);
          if (res.why_this_movie) setWhyThisMovie(res.why_this_movie);
          if (res.won) hapticSuccess();
          else hapticMedium();
          setScreenState('completed');
          trackGameCompleted({
            gameId: 'spotlight',
            won: res.won,
            guessesUsed: res.attempts_used,
            timeToSolveS: Math.round((Date.now() - openTimeRef.current) / 1000),
            xp: res.xp_awarded,
            extra: { letters_tried: res.tried_letters.length },
          });
        } else {
          hapticWarning();
        }
      } catch (err) {
        logger.error('[spotlight] Tahmin gonderilemedi:', err);
        setActionError(true);
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, screenState, puzzleId],
  );

  /** Pozisyon → harf haritasi; maskeyi cizmek icin */
  const revealedMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of revealed) map.set(r.pos, r.ch);
    return map;
  }, [revealed]);

  /**
   * Baslikta cikan harfler — klavyede altin isaretlenir.
   *
   * Locale'siz `toUpperCase()`: sunucu da ayni sekilde buyutuyor
   * (submit-guess:256/492). `tr-TR` ile 'i' → 'İ' oluyor ve klavyedeki 'I'
   * tusu acilmis harfle eslesmiyordu, tus altin isaretlenmiyordu.
   */
  const hitLetters = useMemo(
    () => new Set(revealed.map((r) => r.ch.toUpperCase())),
    [revealed],
  );

  const attemptsLeft = Math.max(0, SPOTLIGHT_MAX_ATTEMPTS - attempts);
  const blurAmount = blurForProgress(revealedMap.size, puzzleData?.letter_count ?? 0);

  // ─── Render: durum ekranlari ──────────────────────────────────────────────

  if (staleFormat) {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={1} hideProgress>
        <GameStateView
          state="error"
          onRetry={loadPuzzle}
          title={t('games.spotlight.preparing_title')}
          subtitle={t('games.spotlight.preparing_subtitle')}
        />
      </GameShell>
    );
  }

  if (loadError) {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={1} hideProgress>
        <GameStateView state="error" onRetry={loadPuzzle} />
      </GameShell>
    );
  }

  if (screenState === 'loading') {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={1} hideProgress>
        <GameStateView state="loading" />
      </GameShell>
    );
  }

  if (screenState === 'completed') {
    return (
      <GameShell
        gameType={GAME_TYPE}
        title={t('games.spotlight.title')}
        currentAttempt={attempts}
        maxAttempts={SPOTLIGHT_MAX_ATTEMPTS}
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
            attempts={attempts}
            maxAttempts={SPOTLIGHT_MAX_ATTEMPTS}
            filmTitle={revealedFilm?.title ?? ''}
            filmYear={revealedFilm?.year ?? 0}
            filmPosterUrl={revealedFilm?.poster_url ?? null}
            filmUuid={revealedFilm?.film_id}
            streak={0}
            gameTitle={t('games.spotlight.title')}
            gameType={GAME_TYPE}
            puzzleNo={puzzleNo}
            xpAwarded={xpAwarded}
            dnaUpdated={dnaUpdated}
            whyThisMovie={whyThisMovie ?? undefined}
            resultMessage={
              won
                ? t('games.spotlight.result_won_letters', {
                    count: triedLetters.length,
                  })
                : t('games.spotlight.result_lost')
            }
            countdown={countdown}
            onBackToHub={() => router.back()}
          />
        </ScrollView>
        )}
      </GameShell>
    );
  }

  // ─── Render: oynanis ──────────────────────────────────────────────────────

  return (
    <GameShell
      gameType={GAME_TYPE}
      title={t('games.spotlight.title')}
      subtitle={t('games.spotlight.case_label', { number: puzzleNo })}
      currentAttempt={attempts}
      maxAttempts={SPOTLIGHT_MAX_ATTEMPTS}
    >
      <View style={styles.screen} onLayout={fit.onLayout}>
        {/*
          Gorsel — acilan her harf netlestirir. Ekranin kahramani (Kural 4).
          Yukseklik OLCULEN alandan pay biciliyor (Kural 7: tek sayfa):
          sabit bir oran kucuk cihazda klavyeyi ekran disina itiyordu.
        */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.stillWrap, { height: stillHeight }]}
        >
              <Image
                source={{ uri: puzzleData?.backdrop_url ?? '' }}
                style={styles.still}
                contentFit="cover"
                blurRadius={blurAmount}
                transition={300}
              />
              {/*
            Kalan hak rozeti — yuzen kontrol, yani chrome. Duz scrim yerine cam:
            altinda gercekten gorsel akiyor, saglama sorusu geciliyor.
          */}
              <GlassSurface
                radius={Theme.borderRadius.full}
                intensity={18}
                noShadow
                style={styles.attemptsBadge}
                contentStyle={styles.attemptsBadgeContent}
              >
                <Eye size={12} weight="duotone" color={Colors.textPrimary} />
                <Text style={styles.attemptsText}>
                  {t('games.spotlight.attempts_left', { count: attemptsLeft })}
                </Text>
              </GlassSurface>
            </Animated.View>

            {/* Baslik maskesi */}
            <Text style={styles.maskLabel}>{t('games.spotlight.title_label')}</Text>
            <View style={styles.maskRow}>
              {puzzleData?.title_mask.map((token, index) => {
                if (token.t === 'sep') {
                  return (
                    <View key={index} style={styles.separator}>
                      {/* Bosluk gorunmez kalir; tire/iki nokta gosterilir */}
                      <Text style={styles.separatorText}>
                        {token.c === ' ' ? '' : (token.c ?? '')}
                      </Text>
                    </View>
                  );
                }
                const ch = revealedMap.get(index);
                return (
                  <View key={index} style={[styles.slot, ch != null && styles.slotRevealed]}>
                    {ch != null ? (
                      <Animated.Text entering={FadeInUp.duration(250)} style={styles.slotText}>
                        {/* Locale'siz — sunucu ile ayni buyutme, bkz. hitLetters */}
                        {ch.toUpperCase()}
                      </Animated.Text>
                    ) : null}
                  </View>
                );
              })}
            </View>

            {/* Hata — sessiz fallback YASAK */}
            {actionError && (
              <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
                <CloudSlash size={18} weight="duotone" color={Colors.textTertiary} />
                <Text style={styles.errorText}>{t('games.result.error_subtitle')}</Text>
              </Animated.View>
            )}
        {/* Esnek bosluk — aksiyon barini dibe iter */}
        <View style={styles.spacer} />

        {/*
          Aksiyon bari — klavye + film tahmini. Artik YUZMUYOR: ekran kaymadigi
          icin altindan gececek icerik yok, cam orada Kural 5'in derinlik
          testini gecmezdi.
        */}
        <View style={styles.actionBar}>
            {/* Klavye — denenmis harfler isaretli */}
            <View style={styles.keyboard}>
              {KEY_ROWS.map((row) => (
                <View key={row} style={styles.keyboardRow}>
                  {[...row].map((letter) => (
                    <KeyButton
                      key={letter}
                      letter={letter}
                      tried={triedLetters.includes(letter)}
                      hit={hitLetters.has(letter)}
                      disabled={triedLetters.includes(letter) || isBusy}
                      styles={styles}
                      onPress={() => {
                        hapticLight();
                        handleLetter(letter);
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>

            {/* Film tahmini — kazanma yolu */}
            <View style={styles.guessArea}>
              <Text style={styles.guessLabel}>{t('games.spotlight.which_film')}</Text>
              <FilmSearchInput onSelect={handleGuess} disabled={isBusy} />
          </View>
        </View>
      </View>
    </GameShell>
  );
}
