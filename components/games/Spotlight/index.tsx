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
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Sentry from '@sentry/react-native';
import { CloudSlash } from 'phosphor-react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import {
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
  SPOTLIGHT_FOCUS_STEP,
} from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/utils/logger';
import { isPuzzleUnavailableError } from '@/utils/puzzleAvailability';
import {
  trackGameOpened,
  trackGuessSubmitted,
  trackGameCompleted,
  trackSpotlightAnswerSheetOpened,
  trackSpotlightResultViewed,
} from '@/utils/gameAnalytics';
import { getDailyChallenge, submitSpotlightGuess, submitSpotlightLetter } from '@/services/gameApi';
import { GameShell, useGameThemeFor } from '@/components/games/GameShell';
import { GameStateView } from '@/components/games/GameStateView';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import type { FilmSearchResult } from '@/services/gameTypes';
import type {
  DailyChallenge,
  RevealedFilm,
  RevealedTitleChar,
  SpotlightPuzzleData,
  WhyThisMovieText,
} from '@/types/game';

import { SPOTLIGHT_KEY_PRESS, SPOTLIGHT_MAX_BLUR } from './constants';
import { blurForProgress } from './focus';
import { keyPressState } from './hapticMap';
import { hasHitBar, isStruck, KEY_A11Y_KEY, keyStateFor, type KeyState } from './keyState';
import { composeMaskLabel } from './maskA11y';
import { playSpotlightHaptic } from './playHaptic';
import { useScreenReaderEnabled } from './useScreenReaderEnabled';
import { AnswerSheet } from './AnswerSheet';
import { ChancesRow } from './ChancesRow';
import { SpotlightStill, type StillReveal } from './SpotlightStill';
import { fitMaskScale, groupMaskWords } from './maskLayout';
import { resultState } from './resultState';
import { shouldFireResultViewed } from './resultViewed';
import { validateSpotlightLoad } from './resumeValidation';
import { buildShareMask } from '@/components/ShareCards/spotlightShareMask';
import { SpotlightResult } from './SpotlightResult';
import { createMaskStyles, createStyles, MASK_ROW_W } from './styles';

type ScreenState = 'loading' | 'playing' | 'completed';

/** Bu ekranin oyun kimligi — tema ve GameShell ayni sabiti okur,
 *  ikisi birbirinden kayamaz. */
const GAME_TYPE = 'spotlight' as const;

/** Ekran klavyesi duzeni */
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const;

// ─── Klavye tusu ─────────────────────────────────────────────────────────────

interface KeyButtonProps {
  letter: string;
  /** Uc durum: uygun / kullanildi+basliktta var / kullanildi+basliktta yok */
  state: KeyState;
  /** VoiceOver: "Harf A. Kullanilabilir." vb. (i18n) */
  a11yLabel: string;
  disabled: boolean;
  onPress: () => void;
  /**
   * Tema stilleri ebeveynden gecirilir, burada `useGameTheme()` cagrilmaz:
   * ekranda 26 tus var, her biri kendi `createStyles()`'ini calistirsaydi
   * her renderda 26 StyleSheet uretilirdi.
   */
  styles: ReturnType<typeof createStyles>;
  /** Reduce Motion: ebeveynden — ekranda 26 tus, her biri hook acmaz */
  reduceMotion: boolean;
}

/**
 * Tek klavye tusu — basista ince opaklik/olcek geri bildirimi.
 *
 * Spring/bounce YOK (Spotlight hareket dili): sure token, easing ease-out.
 * Reduce Motion'da olcek uygulanmaz, yalniz opaklik. Kullanilmis/kilitli tus
 * (`disabled`) hicbir gorsel tepki vermez — Pressable basisi zaten almaz.
 */
function KeyButton({
  letter,
  state,
  a11yLabel,
  disabled,
  onPress,
  styles,
  reduceMotion,
}: KeyButtonProps) {
  const hit = state === 'used_hit';
  const tried = state !== 'available';
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * (1 - SPOTLIGHT_KEY_PRESS.opacity),
    transform: reduceMotion
      ? []
      : [{ scale: 1 - pressed.value * (1 - SPOTLIGHT_KEY_PRESS.scale) }],
  }));

  const animatePress = (to: 0 | 1) => {
    pressed.value = withTiming(to, {
      duration: REDUCED_MOTION_DURATION.crossFade,
      easing: EASE_OUT_QUART,
    });
  };

  return (
    // Hucre bosluksuz dokunma alanidir (50pt yukseklik, DESIGN_OS §14 istisnasi);
    // gorunen yuzey animasyonlu ic View'dir.
    <Pressable
      style={styles.keyCell}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ disabled: tried || disabled }}
    >
      <Animated.View style={[styles.key, animatedStyle, tried && (hit ? styles.keyHit : styles.keyMiss)]}>
        <Text
          style={[styles.keyText, hit && styles.keyTextHit]}
          // Sabit 42px tus — tavansiz AX boyutunda harf kirpiliyordu
          maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}
        >
          {letter}
        </Text>
        {/* Renksiz ayrim: yalniz "basliktta yok" ustu cizili, "basliktta var" alt cubuklu */}
        {isStruck(state) && <View style={styles.keyStrike} pointerEvents="none" />}
        {hasHitBar(state) && <View style={styles.keyHitBar} pointerEvents="none" />}
      </Animated.View>
    </Pressable>
  );
}

/**
 * Spotlight V3 oyun ekrani.
 */
export function SpotlightGame() {
  const { t } = useLanguage();
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
  /**
   * Toplam hak — sunucudaki `puzzle.max_attempts`. Sabit YOK: eksikse oyun
   * acilmaz, gorunur hata + retry cikar (sessiz fallback yasak).
   */
  const [maxAttempts, setMaxAttempts] = useState(0);
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
  /**
   * Senkron tahmin kilidi: `isBusy` state'i ayni karede iki hizli dokunusa
   * karsi bayat kalir; ref aninda yazilir. Yalniz film tahminini korur.
   */
  const guessLockRef = useRef(false);
  /**
   * Harf icin ayni senkron kilit — hizli iki tus ayni karede `isBusy` bayatken
   * ikinci istegi (ve ikinci haptigi) gecirmesin. Basis haptigi kilitten SONRA.
   */
  const letterLockRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const screenReaderOn = useScreenReaderEnabled();
  /** CTA dugumu — cevap sayfasi kapaninca VoiceOver odagi buraya doner */
  const ctaRef = useRef<React.ElementRef<typeof TouchableOpacity>>(null);
  /**
   * VoiceOver anonu — YALNIZ kullanici eyleminin sonucunda ve ekran okuyucu
   * aciksken; mount/resume'da cagrilmaz (cagri yerleri handleLetter/handleGuess).
   */
  const announce = useCallback(
    (message: string) => {
      if (screenReaderOn) AccessibilityInfo.announceForAccessibility(message);
    },
    [screenReaderOn],
  );
  const focusCta = useCallback(() => {
    const node = screenReaderOn && ctaRef.current ? findNodeHandle(ctaRef.current) : null;
    if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
  }, [screenReaderOn]);
  const [actionError, setActionError] = useState(false);
  /** Cevap sayfasi (Sprint 1) — oyun durumundan bagimsiz, yalniz sunum */
  const [answerOpen, setAnswerOpen] = useState(false);
  /** Async catch'in sayfa acik mi sorusu icin — kapanista bayat closure okunmasin */
  const answerOpenRef = useRef(false);
  answerOpenRef.current = answerOpen;
  /**
   * Tahmin istegi gitmedi (ag/sunucu hatasi) — SAYFANIN ICINDE gosterilir; ekran
   * Modal'in arkasinda kalir. Hak sayaci etkilenmez: hak yalniz sunucu yanitindan gelir.
   */
  const [guessError, setGuessError] = useState(false);
  /** Sayfa acikken son tahmin yanlisti — sakin satir gosterilir */
  const [lastGuessWrong, setLastGuessWrong] = useState(false);

  const [won, setWon] = useState(false);
  // Sonuc ekrani artik odul/DNA/aciklama metni okumaz (K-33); sunucu yaniti ve
  // asagidaki yazimlar degismedi — yalniz okuyucular kalkti.
  const [, setXpAwarded] = useState(0);
  const [, setDnaUpdated] = useState(false);
  const [revealedFilm, setRevealedFilm] = useState<RevealedFilm | null>(null);
  const [, setWhyThisMovie] = useState<WhyThisMovieText | null>(null);
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

      const serverMax = data.puzzle.max_attempts;
      if (typeof serverMax !== 'number' || !Number.isFinite(serverMax) || serverMax < 1) {
        logger.error(
          '[spotlight] puzzle.max_attempts eksik veya gecersiz',
          new Error('SPOTLIGHT_MAX_ATTEMPTS_MISSING'),
          { code: 'SPOTLIGHT_MAX_ATTEMPTS_MISSING' },
        );
        setLoadError(true);
        return;
      }

      // Yükleme/resume doğrulaması (saf: resumeValidation.ts). Eksik ya da tutarsız
      // veri sessiz "taze oyun" ya da tam netlik olmaz: hata durumu + retry + log.
      const validation = validateSpotlightLoad(pd, serverMax, data.progress ?? null);
      if (!validation.ok) {
        logger.error(
          `[spotlight] Yukleme/resume dogrulamasi basarisiz: ${validation.detail}`,
          new Error(validation.code),
          { code: validation.code, extra: { detail: validation.detail, puzzle_id: data.puzzle.id } },
        );
        setLoadError(true);
        return;
      }

      setPuzzleId(data.puzzle.id);
      setPuzzleNo(data.puzzle_no);
      setMaxAttempts(serverMax);
      setPuzzleData(pd);
      setWhyThisMovie(data.why_this_movie ?? null);
      if (data.revealed_solution) setRevealedFilm(data.revealed_solution);

      // Resume (P-3d): denenmis harfler, acilmis pozisyonlar ve hak sayaci
      // sunucudan. `progress` null = oyuncu bu bulmacada henuz hamle yapmadi.
      // Spotlight'ta `guesses` hep bos; hak `attempts`'tan okunur.
      const progress = data.progress;
      // Doğrulama geçti: progress varsa bu alanlar mevcut ve tutarlı (taze oyun = null)
      setTriedLetters(progress?.spotlight_letters ?? []);
      setRevealed(progress?.spotlight_revealed ?? []);
      setAttempts(progress?.attempts ?? 0);
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
      if (letterLockRef.current || guessLockRef.current) return;
      if (isBusy || screenState !== 'playing') return;
      if (triedLetters.includes(letter)) return;

      letterLockRef.current = true;
      // Basis haptigi: yalniz kabul edilen (uygun) tus, anlik
      playSpotlightHaptic({
        type: 'key_press',
        state: keyPressState(false, false),
      });
      setIsBusy(true);
      setActionError(false);
      try {
        const res = await submitSpotlightLetter(puzzleId, letter);
        setTriedLetters(res.tried_letters);
        setRevealed(res.revealed);
        setAttempts(res.attempts_used);
        announce(
          res.hit
            ? t('games.spotlight.announce_letter_hit', { letter })
            : t('games.spotlight.announce_letter_miss', {
                letter,
                count: Math.max(0, maxAttempts - res.attempts_used),
              }),
        );

        // Haklar bittiyse oyun burada kapanir — aksi halde oyuncu "0 hak"
        // ile ekranda kilitli kalir ve sonraki harf 409 alir.
        if (res.completed) {
          setWon(false);
          setXpAwarded(res.xp_awarded);
          setDnaUpdated(res.dna_updated);
          if (res.revealed_solution) setRevealedFilm(res.revealed_solution);
          if (res.why_this_movie) setWhyThisMovie(res.why_this_movie);
          playSpotlightHaptic({ type: 'letter_result', hit: res.hit, completed: true });
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

        // Dogru harf sessiz; yanlis harf tek uyari (hapticMap.ts)
        playSpotlightHaptic({ type: 'letter_result', hit: res.hit, completed: false });
      } catch (err) {
        logger.error('[spotlight] Harf gonderilemedi:', err);
        setActionError(true);
      } finally {
        letterLockRef.current = false;
        setIsBusy(false);
      }
    },
    [isBusy, screenState, triedLetters, puzzleId, announce, maxAttempts, t],
  );

  /**
   * Tahmin gonderilemedi: sayfa aciksa hata sayfanin icinde, degilse ekranda gorunur
   * (sessiz yol yok). Tek haptik + tek VoiceOver duyurusu; hak sayaci dokunulmaz.
   */
  const reportGuessFailure = useCallback(() => {
    if (answerOpenRef.current) setGuessError(true);
    else setActionError(true);
    playSpotlightHaptic({ type: 'action_error' });
    announce(t('games.spotlight.answer_error'));
  }, [announce, t]);

  /** Filmi tahmin et — kazanma yolu */
  const handleGuess = useCallback(
    async (film: FilmSearchResult) => {
      if (isBusy || guessLockRef.current || letterLockRef.current || screenState !== 'playing') return;

      const filmUuid = film.uuid;
      if (!filmUuid) {
        logger.error('[spotlight] Film UUID yok — tahmin gonderilemiyor', new Error('SPOTLIGHT_GUESS_NO_UUID'), {
          code: 'SPOTLIGHT_GUESS_NO_UUID',
        });
        reportGuessFailure();
        return;
      }

      guessLockRef.current = true;
      setIsBusy(true);
      setActionError(false);
      setGuessError(false);
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
          playSpotlightHaptic({ type: 'guess_result', won: res.won, completed: true });
          setStillReveal('animate');
          setAnswerOpen(false);
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
          setLastGuessWrong(true);
          playSpotlightHaptic({ type: 'guess_result', won: false, completed: false });
          // Sayfadaki satirla AYNI metin, bir kez (iOS'ta canli bolge yok)
          announce(
            t('games.spotlight.answer_wrong', {
              count: Math.max(0, maxAttempts - res.attempts_used),
            }),
          );
        }
      } catch (err) {
        logger.error('[spotlight] Tahmin gonderilemedi:', err);
        reportGuessFailure();
      } finally {
        guessLockRef.current = false;
        setIsBusy(false);
      }
    },
    [isBusy, screenState, puzzleId, announce, maxAttempts, t, reportGuessFailure],
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
  /** Paylasim karti maskesi — yalniz yapi (kelime basina slot sayisi), harf yok */
  const shareMaskWords = useMemo(
    () => buildShareMask(puzzleData?.title_mask ?? []),
    [puzzleData],
  );
  /** Maskenin 2 satira sigdigi en buyuk olcek, taban 0.8 */
  const maskScale = useMemo(() => fitMaskScale(maskWords, MASK_ROW_W), [maskWords]);
  const maskStyles = useMemo(() => createMaskStyles(theme, maskScale), [theme, maskScale]);
  /** VoiceOver ozeti — ekranda gorunenden fazlasini icermez */
  const maskLabel = useMemo(
    () => composeMaskLabel(maskWords, revealedMap, t),
    [maskWords, revealedMap, t],
  );

  const attemptsLeft = Math.max(0, maxAttempts - attempts);

  /** Acilan harf: yalniz opaklik, ease-out (kayma/spring yok); Reduce Motion'da 100ms */
  const revealEntering = useMemo(
    () =>
      FadeIn.duration(
        reduceMotion ? REDUCED_MOTION_DURATION.crossFade : SPOTLIGHT_FOCUS_STEP.duration,
      ).easing(EASE_OUT_QUART),
    [reduceMotion],
  );

  /** Hata kutusu: yalniz opaklik; Reduce Motion'da 100ms (en yakin mevcut token) */
  const noticeEntering = useMemo(
    () =>
      FadeIn.duration(
        reduceMotion ? REDUCED_MOTION_DURATION.crossFade : SPOTLIGHT_FOCUS_STEP.duration,
      ),
    [reduceMotion],
  );

  const openAnswerSheet = useCallback(() => {
    if (isBusy) return;
    playSpotlightHaptic({ type: 'cta_press' });
    setLastGuessWrong(false);
    setActionError(false);
    setGuessError(false);
    setAnswerOpen(true);
    trackSpotlightAnswerSheetOpened(puzzleId, Math.max(0, maxAttempts - attempts));
  }, [isBusy, puzzleId, maxAttempts, attempts]);
  const closeAnswerSheet = useCallback(() => setAnswerOpen(false), []);
  // letter_count yuklemede dogrulandi (tam sayi > 0, maske ile tutarli). Bulmaca
  // yokken kare cizilmez; yine de eksik veri tam netlik degil azami bulaniklik verir.
  const blurAmount = puzzleData
    ? blurForProgress(revealedMap.size, puzzleData.letter_count, SPOTLIGHT_MAX_BLUR)
    : SPOTLIGHT_MAX_BLUR;
  /** Sonuc ekraninda kare cizilebilir mi — yoksa kare cizilmez (Sentry'ye yazilir) */
  const hasStill = Boolean(puzzleData?.backdrop_url);

  // ─── Sonuc: durum + analitik ──────────────────────────────────────────────
  // Hak etiketi YALNIZ {won, attempts, maxAttempts}'ten turer (resultState.ts);
  // harf verisi girmez. Anomali sessizce kenetlenmez: Sentry + hak satiri yok.
  const resultInfo = useMemo(
    () => resultState({ won, attempts, maxAttempts }),
    [won, attempts, maxAttempts],
  );
  const resultFilmId = revealedFilm?.film_id ?? null;
  /**
   * Tek-atis kumeleri bu ekranda (SpotlightResult yeniden mount olabilir).
   * `viewed`: bulmaca basina bir `spotlight_result_viewed`. `reported`: ayni
   * veri hatasi icin bulmaca basina bir Sentry kaydi. Useffect'in yeniden
   * kosmasi (focus ile yeniden yukleme, Where to Watch'tan donus) ikisini de
   * tekrarlayamaz.
   */
  const viewedRef = useRef<Set<string>>(new Set());
  const reportedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (screenState !== 'completed' || puzzleId === '') return;

    if (!resultInfo.ok && shouldFireResultViewed(reportedRef.current, `anomaly:${puzzleId}`)) {
      Sentry.captureMessage(`Spotlight sonuc durumu gecersiz: ${resultInfo.reason}`, {
        level: 'error',
        tags: { component: 'SpotlightResult', reason: resultInfo.reason },
        extra: { puzzle_id: puzzleId, won, attempts, max_attempts: maxAttempts },
      });
    }
    if (!hasStill && shouldFireResultViewed(reportedRef.current, `still:${puzzleId}`)) {
      logger.error(
        '[spotlight] Sonuc karesi yok — backdrop_url bos',
        new Error('SPOTLIGHT_RESULT_NO_STILL'),
        { code: 'SPOTLIGHT_RESULT_NO_STILL', extra: { puzzle_id: puzzleId } },
      );
    }
    if (resultFilmId === null && shouldFireResultViewed(reportedRef.current, `film:${puzzleId}`)) {
      logger.error(
        '[spotlight] Sonuc filmi kimliksiz — eylemler sunulmuyor',
        new Error('SPOTLIGHT_RESULT_NO_FILM_ID'),
        { code: 'SPOTLIGHT_RESULT_NO_FILM_ID', extra: { puzzle_id: puzzleId } },
      );
    }

    if (resultInfo.ok && shouldFireResultViewed(viewedRef.current, puzzleId)) {
      trackSpotlightResultViewed({
        won,
        chancesLeft: resultInfo.chancesLeft,
        // `static` yalniz tamamlanmis bulmacayla acilista (loadPuzzle) ayarlanir;
        // bu oturumda biten oyun `animate` ile gelir. Ilk gorunumde gecerli.
        resumed: stillReveal === 'static',
      });
    }
  }, [
    screenState,
    puzzleId,
    resultInfo,
    won,
    attempts,
    maxAttempts,
    hasStill,
    resultFilmId,
    stillReveal,
  ]);

  // ─── Render: durum ekranlari ──────────────────────────────────────────────

  if (staleFormat) {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={1} hideProgress flatBackdrop compactHeader>
        <GameStateView
          state="error"
          onRetry={loadPuzzle}
          enlargeRetryTarget
          title={t('games.spotlight.preparing_title')}
          subtitle={t('games.spotlight.preparing_subtitle')}
        />
      </GameShell>
    );
  }

  if (unavailable) {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={1} hideProgress flatBackdrop compactHeader>
        <GameStateView
          state="error"
          onRetry={loadPuzzle}
          enlargeRetryTarget
          title={t('games.spotlight.unavailable_title')}
          subtitle={t('games.spotlight.unavailable_subtitle')}
        />
      </GameShell>
    );
  }

  if (loadError) {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={1} hideProgress flatBackdrop compactHeader>
        <GameStateView state="error" onRetry={loadPuzzle} enlargeRetryTarget />
      </GameShell>
    );
  }

  if (screenState === 'loading') {
    return (
      <GameShell gameType={GAME_TYPE} title={t('games.spotlight.title')} currentAttempt={0} maxAttempts={1} hideProgress flatBackdrop compactHeader>
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
        maxAttempts={maxAttempts}
        hideProgress
        flatBackdrop
        compactHeader
        floatingHeader
      >
        {({ topInset }) => (
        <ScrollView
          contentContainerStyle={[styles.completedContainer, { paddingTop: topInset }]}
          showsVerticalScrollIndicator={false}
        >
          {/*
            Ayni kare kutusu, sonucta netlesir (P-2): SpotlightResult kareyi
            kendi cizer. Alt kat bitis anindaki bulaniklikta — gecis oyuncunun
            son gordugu kareden baslar. Header (geri) GameShell'de.
          */}
          <SpotlightResult
            puzzleId={puzzleId}
            won={won}
            result={resultInfo}
            film={revealedFilm}
            stillUri={hasStill ? (puzzleData?.backdrop_url ?? null) : null}
            blurRadius={blurAmount}
            stillReveal={stillReveal}
            stillStyles={styles}
            puzzleNo={puzzleNo}
            shareMaskWords={shareMaskWords}
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
      // "FILM 026" — sunucunun `puzzle_no`'su, 3 haneye sifirla doldurulur
      subtitle={t('games.spotlight.case_label', { number: String(puzzleNo).padStart(3, '0') })}
      currentAttempt={attempts}
      maxAttempts={maxAttempts}
      hideProgress
      flatBackdrop
      compactHeader
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
          Gorsel — acilan her harf netlestirir. Ekranin kahramani: rozet veya
          chrome yok. Kutu kaynakla ayni oranda (16:9, P-2): cover kirpmaz.
        */}
        <SpotlightStill
          uri={puzzleData?.backdrop_url ?? ''}
          blurRadius={blurAmount}
          reveal="none"
          styles={styles}
        />

        {/* Hak — gorsel netligi ILERLEME, nokta RISK. Deger sunucunun max_attempts'i */}
        <ChancesRow max={maxAttempts} left={attemptsLeft} />

            {/* Baslik maskesi */}
            <View style={styles.maskBlock}>
            {/*
              Kelime gruplari: satir kelimeler ARASINDA kirilir. Slot olcegi
              maske 2 satira sigsin diye 0.8'e kadar kuculur; daha uzun baslik
              3+ satira kirilir ve bu bolgeyle birlikte kayar.
            */}
            {/*
              Tek erisilebilir oge: kelime sayisi, uzunluklar, acik pozisyonlar
              (maskA11y.ts). Slotlar VoiceOver'dan gizli — slot basina gurultu yok.
            */}
            <View accessible accessibilityRole="text" accessibilityLabel={maskLabel}>
            <View
              style={maskStyles.maskRow}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
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
                            entering={revealEntering}
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
            <Text style={styles.helper}>{t('games.spotlight.helper')}</Text>
            </View>
        </ScrollView>

        {/*
          Hata — sessiz fallback YASAK. Kayan bolgenin DISINDA: kucuk ekranda
          acik klavyeyle ust bolge kayarken de gorunur kalmali. Yer acmak icin
          kuculen ust bolgedir, aksiyon bari degil.
        */}
        {actionError && (
          <Animated.View entering={noticeEntering} style={styles.errorBox}>
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
                  {[...row].map((letter) => {
                    const used = triedLetters.includes(letter);
                    const state = keyStateFor(used, hitLetters.has(letter));
                    return (
                      <KeyButton
                        key={letter}
                        letter={letter}
                        state={state}
                        a11yLabel={t(`games.spotlight.${KEY_A11Y_KEY[state]}`, { letter })}
                        disabled={used || isBusy}
                        styles={styles}
                        reduceMotion={reduceMotion}
                        // Basis haptigi handleLetter'da, kilitten sonra (tek atis)
                        onPress={() => handleLetter(letter)}
                      />
                    );
                  })}
                </View>
              ))}
            </View>

            {/* Film tahmini — kazanma yolu: cevap sayfasini acar */}
            <View style={styles.guessArea}>
              <PrimaryAction
                label={t('games.spotlight.answer_cta')}
                onPress={openAnswerSheet}
                buttonRef={ctaRef}
                disabled={isBusy}
                busy={isBusy}
                variant="gold"
              />
          </View>
        </View>
      </Pressable>
      <AnswerSheet
        visible={answerOpen}
        onClose={closeAnswerSheet}
        onDismissed={focusCta}
        onSelect={handleGuess}
        busy={isBusy}
        triedFilmIds={guessedFilmIds}
        inlineNote={
          lastGuessWrong ? t('games.spotlight.answer_wrong', { count: attemptsLeft }) : null
        }
        inlineError={guessError ? t('games.spotlight.answer_error') : null}
      />
    </GameShell>
  );
}
