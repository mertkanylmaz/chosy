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
import { Keyboard, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
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
import { isCinemaDnaEnabled } from '@/constants/config';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { isPuzzleUnavailableError } from '@/utils/puzzleAvailability';
import { trackGameOpened, trackGuessSubmitted, trackGameCompleted } from '@/utils/gameAnalytics';
import { getDailyChallenge, submitSpotlightGuess, submitSpotlightLetter } from '@/services/gameApi';
import { GameShell, useGameThemeFor } from '@/components/games/GameShell';
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

import { SPOTLIGHT_MAX_BLUR } from './constants';
import { SpotlightStill, type StillReveal } from './SpotlightStill';
import { fitMaskScale, groupMaskWords } from './maskLayout';
import { nextPuzzleCountdown } from './nextPuzzleClock';
import { createMaskStyles, createStyles, MASK_ROW_W } from './styles';

type ScreenState = 'loading' | 'playing' | 'completed';

/** Bu ekranin oyun kimligi — tema ve GameShell ayni sabiti okur,
 *  ikisi birbirinden kayamaz. */
const GAME_TYPE = 'spotlight' as const;

/** Yanlis harf + yanlis film tahmini icin toplam hak */
const SPOTLIGHT_MAX_ATTEMPTS = 6;

/** Ekran klavyesi duzeni */
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

/** En yuksek bulaniklik — hic harf acilmamisken (tek kaynak: ./constants) */
const MAX_BLUR = SPOTLIGHT_MAX_BLUR;

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
        <Text
          style={[styles.keyText, hit && styles.keyTextHit]}
          // Sabit 42px tus — tavansiz AX boyutunda harf kirpiliyordu
          maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}
        >
          {letter}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

/** Sonraki yerel 18:00'e geri sayım (P-4a) — kural `nextPuzzleClock.ts`'te. */
function useCountdown(): string {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      setTimeLeft(nextPuzzleCountdown(new Date()));
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

  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [loadError, setLoadError] = useState(false);
  /** Bulmaca V3 oncesi formatta — bu ekranla oynanamaz */
  const [staleFormat, setStaleFormat] = useState(false);
  /**
   * P-1c E: bugun bulmaca yok (sunucu NO_PUZZLE). Ag hatasi DEGIL — "baglantini
   * kontrol et" demek yanlis teshis olurdu. Sentry uyarisini gameApi yazdi.
   */
  const [unavailable, setUnavailable] = useState(false);

  const [puzzleId, setPuzzleId] = useState('');
  const [puzzleNo, setPuzzleNo] = useState(0);
  const [puzzleData, setPuzzleData] = useState<SpotlightPuzzleData | null>(null);

  const [triedLetters, setTriedLetters] = useState<string[]>([]);
  const [revealed, setRevealed] = useState<RevealedTitleChar[]>([]);
  const [attempts, setAttempts] = useState(0);
  /**
   * Daha once tahmin edilen filmler (films.id) — arama listesinde soluk ve
   * dokunulamaz. Kaynak sunucu: yuklemede `progress.spotlight_guesses`, sonra
   * sunucunun kabul ettigi her yanlis tahmin eklenir.
   */
  const [guessedFilmIds, setGuessedFilmIds] = useState<string[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  const [won, setWon] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);
  const [dnaUpdated, setDnaUpdated] = useState(false);
  const [revealedFilm, setRevealedFilm] = useState<RevealedFilm | null>(null);
  const [whyThisMovie, setWhyThisMovie] = useState<WhyThisMovieText | null>(null);
  /**
   * Sonuc karesinin netlesmesi (P-2): bu oturumda biten oyun gecisle
   * netlesir, yeniden acilan bitmis oyun animasyonsuz net gelir.
   */
  const [stillReveal, setStillReveal] = useState<Exclude<StillReveal, 'none'>>('static');

  const loadPuzzle = useCallback(async () => {
    try {
      setLoadError(false);
      setStaleFormat(false);
      setUnavailable(false);
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
      setGuessedFilmIds(progress?.spotlight_guesses?.map((g) => g.film_id) ?? []);

      if (progress?.completed) {
        setWon(progress.won);
        setStillReveal('static');
        setScreenState('completed');
        return;
      }

      setScreenState('playing');
      openTimeRef.current = Date.now();
      guessStartRef.current = Date.now();
      trackGameOpened('spotlight', data.puzzle_no, 'hub');
    } catch (err) {
      if (isPuzzleUnavailableError(err)) {
        // Veri durumu; gameApi (oyun, gun) basina bir kez Sentry'ye yazdi.
        setUnavailable(true);
        return;
      }
      logger.error('[spotlight] Puzzle yuklenemedi:', err);
      setLoadError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setTriedLetters([]);
      setRevealed([]);
      setAttempts(0);
      setGuessedFilmIds([]);
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
          setStillReveal('animate');
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
        logger.warn('[spotlight] Film UUID yok — tahmin gonderilemiyor');
        setActionError(true);
        return;
      }

      setIsBusy(true);
      setActionError(false);
      try {
        const res = await submitSpotlightGuess(puzzleId, filmUuid);
        setAttempts(res.attempts_used);
        setGuessedFilmIds((prev) => (prev.includes(filmUuid) ? prev : [...prev, filmUuid]));
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
          setStillReveal('animate');
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

  /** Maske kelimelere bolunur — kelime ici satir kirilmaz (B-1 / Fix 8) */
  const maskWords = useMemo(
    () => groupMaskWords(puzzleData?.title_mask ?? []),
    [puzzleData],
  );
  /** Maskenin 2 satira sigdigi en buyuk olcek, taban 0.8 */
  const maskScale = useMemo(() => fitMaskScale(maskWords, MASK_ROW_W), [maskWords]);
  const maskStyles = useMemo(() => createMaskStyles(theme, maskScale), [theme, maskScale]);

  const attemptsLeft = Math.max(0, SPOTLIGHT_MAX_ATTEMPTS - attempts);
  const blurAmount = blurForProgress(revealedMap.size, puzzleData?.letter_count ?? 0);
  /** Sonuc ekraninda kare cizilebilir mi — yoksa ResultCard posteri kalir */
  const hasStill = Boolean(puzzleData?.backdrop_url);

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

  if (unavailable) {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={1} hideProgress>
        <GameStateView
          state="error"
          onRetry={loadPuzzle}
          title={t('games.spotlight.unavailable_title')}
          subtitle={t('games.spotlight.unavailable_subtitle')}
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
          {/*
            Ayni kare kutusu, sonucta netlesir (P-2). Alt kat bitis anindaki
            bulaniklikta — gecis oyuncunun son gordugu kareden baslar. Kare
            varken ResultCard posteri cizmez: tek kahraman gorsel.
          */}
          {hasStill && (
            <SpotlightStill
              uri={puzzleData?.backdrop_url ?? ''}
              blurRadius={blurAmount}
              reveal={stillReveal}
              styles={styles}
            />
          )}
          <ResultCard
            hidePoster={hasStill}
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
            // Cinema DNA v1'de gizli (`isCinemaDnaEnabled`): "Cinema DNA
            // Updated" cipi gorunmeyen bir ozelligi vaat ederdi. Sunucu yaniti
            // ve oyun mantigi degismez; yalnizca cip cizilmez.
            dnaUpdated={isCinemaDnaEnabled() && dnaUpdated}
            whyThisMovie={whyThisMovie ?? undefined}
            resultMessage={
              won
                ? t('games.spotlight.result_won_letters', {
                    count: triedLetters.length,
                  })
                : t('games.spotlight.result_lost')
            }
            countdown={countdown}
            // Hub yok (IA §2.6) — etiket "Back". Gecmis yoksa (bildirim /
            // soguk acilis) Home'a: archive.tsx ile ayni desen.
            backLabel={t('games.common.back')}
            onBackToHub={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(tabs)');
            }}
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
      {/*
        Oynanis kabi — sahipsiz dokunus klavyeyi kapatir (P-3c B1). RN'de
        "disari dokununca kapat" yalniz ScrollView'da var; bosluk, etiket ve
        hata kutusu input'u blur etmiyordu, liste (A1) kapanmiyordu.
        Bubble fazi: en derin dokunulabilir (liste satiri, Kapat, harf tusu,
        ust bolge ScrollView'i) once sahiplenir, buraya yalniz sahipsiz
        dokunus duser. CAPTURE KULLANILMAZ — satir dokunusunu yutar.
        Header GameShell'de, bu kabin disinda (donmus oyunlar etkilenmesin).
      */}
      <Pressable style={styles.screen} onPress={Keyboard.dismiss} accessible={false}>
        {/*
          Ust bolge — gorsel + baslik maskesi. Kendi icinde kayar (Kural 7'nin
          Spotlight istisnasi, KAPSAM_KILIDI v1.36); aksiyon bari bunun
          DISINDA oldugu icin uzun baslik veya acik klavye onu itemez.
        */}
        <ScrollView
          style={styles.topRegion}
          contentContainerStyle={styles.topContent}
          keyboardShouldPersistTaps="handled"
          // P-3c B2: kareyi suruklemek klavyeyi kapatir → blur → liste kapanir.
          // YALNIZ burada: liste ScrollView'inda sonuclari kaydirmak listeyi
          // kapatirdi (FilmSearchInput A1 kurali).
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
        {/*
          Gorsel — acilan her harf netlestirir. Ekranin kahramani (Kural 4).
          Kutu kaynakla ayni oranda (16:9, P-2): cover kirpmaz. Ust bolgede
          artan alan maske ile aksiyon bari arasinda kalir.
        */}
        <SpotlightStill
          uri={puzzleData?.backdrop_url ?? ''}
          blurRadius={blurAmount}
          reveal="none"
          styles={styles}
        >
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
            </SpotlightStill>

            {/* Baslik maskesi */}
            <View style={styles.maskBlock}>
            <Text style={styles.maskLabel}>{t('games.spotlight.title_label')}</Text>
            {/*
              Kelime gruplari: satir kelimeler ARASINDA kirilir. Slot olcegi
              maske 2 satira sigsin diye 0.8'e kadar kuculur; daha uzun baslik
              3+ satira kirilir ve bu bolgeyle birlikte kayar.
            */}
            <View style={maskStyles.maskRow}>
              {maskWords.map((word) => (
                <View key={word[0].index} style={maskStyles.maskWord}>
                  {word.map(({ token, index }) => {
                    if (token.t === 'sep') {
                      return (
                        <View key={index} style={maskStyles.separator}>
                          {/* Kelime ici ayrac (tire, iki nokta) gorunur */}
                          <Text
                            style={maskStyles.separatorText}
                            maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}
                          >
                            {token.c ?? ''}
                          </Text>
                        </View>
                      );
                    }
                    const ch = revealedMap.get(index);
                    return (
                      <View
                        key={index}
                        style={[maskStyles.slot, ch != null && maskStyles.slotRevealed]}
                      >
                        {ch != null ? (
                          <Animated.Text
                            entering={FadeInUp.duration(250)}
                            style={maskStyles.slotText}
                            maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}
                          >
                            {/* Locale'siz — sunucu ile ayni buyutme, bkz. hitLetters */}
                            {ch.toUpperCase()}
                          </Animated.Text>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
            </View>
        </ScrollView>

        {/*
          Hata — sessiz fallback YASAK. Kayan bolgenin DISINDA: kucuk ekranda
          acik klavyeyle ust bolge kayarken de gorunur kalmali. Yer acmak icin
          kuculen ust bolgedir, aksiyon bari degil.
        */}
        {actionError && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.errorBox}>
            <CloudSlash size={18} weight="duotone" color={Colors.textTertiary} />
            <Text style={styles.errorText}>{t('games.result.error_subtitle')}</Text>
          </Animated.View>
        )}

        {/*
          Aksiyon bari — klavye + film tahmini. Ekranin dibinde SABIT; sistem
          klavyesi acilinca GameShell'in KeyboardAvoidingView'i onu klavyenin
          hemen ustune tasir. Yuzmuyor: ust bolge kaysa da altindan icerik
          gecmiyor, cam Kural 5'in derinlik testini gecmezdi.
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
              <FilmSearchInput
                onSelect={handleGuess}
                disabled={isBusy}
                catalogOnly
                listControls
                triedFilmIds={guessedFilmIds}
              />
          </View>
        </View>
      </Pressable>
    </GameShell>
  );
}
