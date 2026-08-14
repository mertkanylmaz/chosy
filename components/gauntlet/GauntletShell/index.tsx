/**
 * GauntletShell — günlük gauntlet ritüelinin durum makinesi. C.2-2.
 *
 * BEŞ durum (CTO onayı 14.08.2026 — dört değil):
 *   before_18       → PRODUCT_OS §3.6: gauntlet ÇAĞRILMAZ, bekleyiş metni
 *   bootstrapping   → yükleme + 401 penceresi, graphite iskelet
 *   ready           → Tur 1 (progress yok ya da completedRounds === 0)
 *   in_progress     → resume (completedRounds > 0)
 *   completed_today → champion (ChampionReveal) ya da exhausted (§15.3)
 *
 * İstemci progress TÜRETMEZ — C.2-0 deriveProgress tek gerçek kaynak; bu
 * bileşen yalnızca backend'in dediğini gösterir. Kimlik `ensureAppUser()`
 * bootstrap akışından gelir (app/_layout.tsx auth listener) — `getAppUserId`
 * BURADA KULLANILMAZ, ekran INSERT yapmaz.
 *
 * Ret akışı yalnızca Seviye 1 ("İkisi de değil", tek buton, her rette aynı)
 * + "Boşver, yarın". Seviye 2/3 dalları C.3 / Faz D.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { useReducedMotion } from 'react-native-reanimated';

import SkeletonLoader from '@/components/SkeletonLoader';
import { ChampionReveal } from '@/components/gauntlet/ChampionReveal';
import { ConfidenceMeter } from '@/components/gauntlet/ConfidenceMeter';
import { LightBleed } from '@/components/gauntlet/LightBleed';
import { PosterTile, type PosterTileAnimationState } from '@/components/gauntlet/PosterTile';
import { QuietAction } from '@/components/gauntlet/QuietAction';
import { RoundIndicator } from '@/components/gauntlet/RoundIndicator';
import {
  CHAMPION_HAPTIC_DELAY,
  DISSOLVE_DURATION,
  REDUCED_MOTION_DURATION,
} from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  GauntletAuthPendingError,
  getTodayGauntlet,
  submitChoice,
  type ChoiceResult,
} from '@/services/gauntletService';
import { supabase } from '@/services/supabase';
import type { ChoiceSubmission, DailyGauntlet, GauntletFilm } from '@/types/gauntlet';
import {
  hapticHeavy,
  hapticLight,
  hapticMedium,
  hapticSelection,
  hapticSuccess,
} from '@/utils/haptics';

import { styles } from './styles';

// ─── Ürün sabitleri ──────────────────────────────────────────────────────────

/**
 * 18:00 kapısı — PRODUCT_OS §3.6: "Gauntlet 18:00'den önce açılmaz."
 * app_config anahtarı YOK (migration bu işte yasak) — TEKNIK_BORC:
 * "gauntlet_unlock_hour app_config'e taşınmalı". Tasarım token'ı değil,
 * ürün kuralı — bu yüzden constants/design/ altında DEĞİL, burada.
 */
const UNLOCK_HOUR = 18;

/**
 * 401 retry politikası (CTO 🔴2, 14.08.2026): maks 5 deneme; deneme k
 * başarısız olunca AUTH_RETRY_BACKOFF_MS[k-1] beklenir; 5. deneme de 401
 * dönerse artık bootstrap penceresi değil gerçek kimlik arızasıdır →
 * Sentry + §15.2 hata görünümü. Kalıcı iskelet YASAK.
 */
const MAX_AUTH_ATTEMPTS = 5;
const AUTH_RETRY_BACKOFF_MS = [300, 600, 1200, 2400, 4800] as const;

/** before_18 kapısı ve gün dönümü (CTO 🟠3) aynı dakikalık nabızla izlenir. */
const CLOCK_TICK_MS = 60_000;

function isUnlockedNow(): boolean {
  // CTO kararı 14.08.2026: geliştirmede kapı açık — 14:00'te ekran
  // görülebilmeli. Production build'de bu dal ölü koddur.
  if (__DEV__) return true;
  return new Date().getHours() >= UNLOCK_HOUR;
}

/** Gün dönümü YEREL gece yarısı (PRODUCT_OS §3.6) — UTC değil. */
function localDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * ⚠️ Bu kural generate-gauntlet/deriveProgress'in POZİSYONEL mantığının
 * istemci aynasıdır: tur 2'nin meydan okuyucusu films[2], tur 3'ünki
 * films[3]. submit-choice `film_ids`'i in-place günceller (C.2-0 ölçümü,
 * pozisyonlar korunur), bu yüzden geçerli. Backend seçim mantığı değişirse
 * burası SESSİZCE yanlış film gösterir — güvence, şampiyon anındaki
 * uyuşmazlık tespiti (aşağıda, CTO 🔴1). Inline indeksleme YASAK; bu
 * kuralın tek yaşadığı yer burası. TEKNIK_BORC: submit-choice `choice`
 * outcome'unda da `replacement`/`nextPair` dönmeli (Faz F).
 */
function nextChallengerForRound(round: 2 | 3, films: GauntletFilm[]): GauntletFilm {
  const film = films[round];
  if (!film) {
    throw new Error(`nextChallengerForRound: films[${round}] yok (films.length=${films.length})`);
  }
  return film;
}

/** Konum bias'ı (PRODUCT_OS §3.2): sol-sağ rastgele. */
function orderPair(a: GauntletFilm, b: GauntletFilm): [GauntletFilm, GauntletFilm] {
  return Math.random() < 0.5 ? [a, b] : [b, a];
}

// ─── Tipler ──────────────────────────────────────────────────────────────────

type ShellState = 'before_18' | 'bootstrapping' | 'ready' | 'in_progress' | 'completed_today';

interface Pair {
  left: GauntletFilm;
  right: GauntletFilm;
}

interface TileStates {
  left: PosterTileAnimationState;
  right: PosterTileAnimationState;
}

interface GauntletShellProps {
  /** "Boşver, yarın" — ekranı kapatır (hata durumu DEĞİL, sağlıklı çıkış §3.3). */
  onDismiss?: () => void;
}

// ─── Bileşen ─────────────────────────────────────────────────────────────────

export function GauntletShell({ onDismiss }: GauntletShellProps): React.JSX.Element {
  const { t } = useLanguage();
  const isReducedMotion = useReducedMotion();

  const [shellState, setShellState] = useState<ShellState>(
    isUnlockedNow() ? 'bootstrapping' : 'before_18',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [gauntlet, setGauntlet] = useState<DailyGauntlet | null>(null);
  const [round, setRound] = useState<1 | 2 | 3>(1);
  const [pair, setPair] = useState<Pair | null>(null);
  const [tileStates, setTileStates] = useState<TileStates>({ left: 'idle', right: 'idle' });
  const [champion, setChampion] = useState<GauntletFilm | null>(null);
  const [animateReveal, setAnimateReveal] = useState(false);
  const [refreshesRemaining, setRefreshesRemaining] = useState(0);
  const [seenMode, setSeenMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Eleme/yenileme geçişi oynarken dokunma kilidi — çifte submit önlenir. */
  const [transitioning, setTransitioning] = useState(false);

  const shellStateRef = useRef(shellState);
  shellStateRef.current = shellState;
  const loadingRef = useRef(false);
  const authAttemptsRef = useRef(0);
  const pairShownAtRef = useRef(Date.now());
  const completedDateKeyRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  /** Gürültü koruması (§3.5): İSTEMCİ YALNIZCA ÖLÇER — eşik/karar SUNUCUDA. */
  useEffect(() => {
    pairShownAtRef.current = Date.now();
  }, [pair]);

  const measuredLatencyMs = (): number =>
    Math.max(0, Math.round(Date.now() - pairShownAtRef.current));

  // ── Yanıt yorumlama ────────────────────────────────────────────────────────

  const toExhausted = useCallback(() => {
    setChampion(null);
    setPair(null);
    setSeenMode(false);
    completedDateKeyRef.current = localDateKey();
    setShellState('completed_today');
  }, []);

  const applyGauntlet = useCallback(
    (g: DailyGauntlet) => {
      setGauntlet(g);
      setRefreshesRemaining(g.refreshesRemaining);
      setActionError(null);
      const p = g.progress;

      if (p && p.status === 'champion') {
        if (!p.champion) {
          // Kilitli invariant ihlali — sessiz düzeltme yok, görünür hata.
          Sentry.captureException(
            new Error('GauntletShell: progress.status=champion ama champion boş'),
            { tags: { component: 'GauntletShell' } },
          );
          setLoadError(t('gauntlet.loadError'));
          return;
        }
        setChampion(p.champion);
        setAnimateReveal(false); // resume: kara boşluk yalnız canlı finalde
        completedDateKeyRef.current = localDateKey();
        setShellState('completed_today');
        return;
      }

      if (p && p.status === 'exhausted') {
        toExhausted();
        return;
      }

      if (p && p.status === 'in_progress' && (!p.defender || !p.challenger)) {
        Sentry.captureException(
          new Error('GauntletShell: in_progress ama defender/challenger boş'),
          { tags: { component: 'GauntletShell' } },
        );
        setLoadError(t('gauntlet.loadError'));
        return;
      }

      if (p && p.status === 'in_progress' && p.completedRounds > 0) {
        // KESİN koşul: status==='in_progress' && completedRounds>0 → resume
        setRound((p.completedRounds + 1) as 2 | 3);
        setPair({ left: p.defender as GauntletFilm, right: p.challenger as GauntletFilm });
        setTileStates({ left: 'idle', right: 'idle' });
        setShellState('in_progress');
        return;
      }

      // KESİN koşul: progress undefined VEYA in_progress && completedRounds===0
      setRound(1);
      setPair(
        p && p.defender && p.challenger
          ? { left: p.defender, right: p.challenger }
          : { left: g.films[0], right: g.films[1] },
      );
      setTileStates({ left: 'idle', right: 'idle' });
      setShellState('ready');
    },
    [t, toExhausted],
  );

  // ── Yükleme + 401 retry (CTO 🔴2) ──────────────────────────────────────────

  const load = useCallback(async (): Promise<void> => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoadError(null);
    try {
      const g = await getTodayGauntlet();
      if (!mountedRef.current) return;
      authAttemptsRef.current = 0;
      applyGauntlet(g);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof GauntletAuthPendingError) {
        const attempt = authAttemptsRef.current + 1;
        authAttemptsRef.current = attempt;
        if (attempt >= MAX_AUTH_ATTEMPTS) {
          // 5. deneme de 401: artık bootstrap penceresi değil, gerçek kimlik
          // arızası. Kalıcı iskelet YASAK — §15.2 hata görünümüne düş.
          Sentry.captureException(err, {
            tags: { component: 'GauntletShell', error_code: 'GAUNTLET_AUTH_EXHAUSTED' },
          });
          setLoadError(t('gauntlet.loadError'));
        } else {
          retryTimerRef.current = setTimeout(() => {
            void load();
          }, AUTH_RETRY_BACKOFF_MS[attempt - 1]);
        }
      } else {
        // Sentry servis katmanında yazıldı — burada görünür hata (§15.2).
        setLoadError(t('gauntlet.loadError'));
      }
    } finally {
      loadingRef.current = false;
    }
  }, [applyGauntlet, t]);

  const retryLoad = useCallback(() => {
    authAttemptsRef.current = 0;
    void load();
  }, [load]);

  // Mount: yalnız kapı açıksa çağır — before_18'de AĞ ÇAĞRISI YOK (§3.6).
  useEffect(() => {
    mountedRef.current = true;
    if (shellStateRef.current === 'bootstrapping') {
      void load();
    }
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bootstrap sinyali: app/_layout.tsx'in ensureAppUser akışı auth event'i
  // yayınlar — sayaç sıfırlanır, bekleyen backoff iptal edilip hemen denenir.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        authAttemptsRef.current = 0;
        if (shellStateRef.current === 'bootstrapping') {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          void load();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [load]);

  // Dakikalık nabız: 18:00 kapısı + gün dönümü (CTO 🟠3 — ayrı mekanizma yok).
  useEffect(() => {
    const id = setInterval(() => {
      if (shellStateRef.current === 'before_18' && isUnlockedNow()) {
        setShellState('bootstrapping');
        authAttemptsRef.current = 0;
        void load();
        return;
      }
      if (
        shellStateRef.current === 'completed_today' &&
        completedDateKeyRef.current !== null &&
        completedDateKeyRef.current !== localDateKey()
      ) {
        // Yerel gece yarısı geçti (§3.6) — dünün şampiyonu gösterilmez.
        completedDateKeyRef.current = null;
        setGauntlet(null);
        setChampion(null);
        setPair(null);
        setAnimateReveal(false);
        if (isUnlockedNow()) {
          setShellState('bootstrapping');
          authAttemptsRef.current = 0;
          void load();
        } else {
          setShellState('before_18');
        }
      }
    }, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [load]);

  // ── Oyun eylemleri ─────────────────────────────────────────────────────────

  const submit = useCallback(
    async (submission: ChoiceSubmission): Promise<ChoiceResult | null> => {
      setSubmitting(true);
      setActionError(null);
      try {
        return await submitChoice(submission);
      } catch (err) {
        if (!mountedRef.current) return null;
        if (err instanceof GauntletAuthPendingError) {
          // Oyun ortasında 401: oturum düştü — bootstrap penceresine dön.
          authAttemptsRef.current = 0;
          setShellState('bootstrapping');
          void load();
        } else {
          // Sentry servis katmanında yazıldı — kullanıcıya görünür hata.
          setActionError(t('gauntlet.submitError'));
        }
        return null;
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [load, t],
  );

  /** `neither`/`seen` yanıtı: replacement varsa çift güncellenir —
   *  getTodayGauntlet TEKRAR ÇAĞRILMAZ (ölçülmüş sözleşme). */
  const applyRefreshResult = useCallback(
    (result: ChoiceResult, oldPair: Pair) => {
      setRefreshesRemaining(result.refreshesRemaining);
      if (result.next === 'exhausted') {
        toExhausted();
        return;
      }
      const replacement = result.replacement;
      if (!replacement) {
        // refreshAllowed=false: hak bitti, çift değişmez. Sessiz değil —
        // "İkisi de değil" devre dışı kalır, "Boşver, yarın" görünür.
        return;
      }
      const newIds = new Set([replacement.filmA.id, replacement.filmB.id]);
      setTileStates({
        left: newIds.has(oldPair.left.id) ? 'idle' : 'eliminated',
        right: newIds.has(oldPair.right.id) ? 'idle' : 'eliminated',
      });
      const oldIds = new Set([oldPair.left.id, oldPair.right.id]);
      const delay = isReducedMotion
        ? REDUCED_MOTION_DURATION.crossFade
        : DISSOLVE_DURATION.eliminatedPoster;
      setTransitioning(true);
      transitionTimerRef.current = setTimeout(() => {
        if (!mountedRef.current) return;
        setPair({ left: replacement.filmA, right: replacement.filmB });
        setTileStates({
          left: oldIds.has(replacement.filmA.id) ? 'idle' : 'entering',
          right: oldIds.has(replacement.filmB.id) ? 'idle' : 'entering',
        });
        setTransitioning(false);
      }, delay);
    },
    [isReducedMotion, toExhausted],
  );

  const handleChoice = useCallback(
    async (side: 'left' | 'right') => {
      if (!pair || !gauntlet || submitting || transitioning) return;
      const winner = side === 'left' ? pair.left : pair.right;
      void hapticLight();
      const result = await submit({
        gauntletId: gauntlet.gauntletId,
        round,
        filmA: pair.left.id,
        filmB: pair.right.id,
        winner: winner.id,
        outcome: 'choice',
        positionOfWinner: side,
        latencyMs: measuredLatencyMs(),
      });
      if (!result || !mountedRef.current) return;
      setRefreshesRemaining(result.refreshesRemaining);

      if (result.next === 'round2' || result.next === 'round3') {
        const newRound = result.next === 'round2' ? 2 : 3;
        let incoming: GauntletFilm;
        try {
          incoming = nextChallengerForRound(newRound, gauntlet.films);
        } catch (err) {
          Sentry.captureException(err, { tags: { component: 'GauntletShell' } });
          setActionError(t('gauntlet.submitError'));
          return;
        }
        setTileStates(
          side === 'left'
            ? { left: 'remaining', right: 'eliminated' }
            : { left: 'eliminated', right: 'remaining' },
        );
        const delay = isReducedMotion
          ? REDUCED_MOTION_DURATION.crossFade
          : DISSOLVE_DURATION.eliminatedPoster;
        setTransitioning(true);
        transitionTimerRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          const [left, right] = orderPair(winner, incoming);
          setRound(newRound);
          setPair({ left, right });
          setTileStates({
            left: left.id === incoming.id ? 'entering' : 'idle',
            right: right.id === incoming.id ? 'entering' : 'idle',
          });
          setSeenMode(false);
          setShellState('in_progress');
          setTransitioning(false);
          void hapticMedium(); // tur geçişi (§8) — geçişin kendisi Kesme (§7.1)
        }, delay);
        return;
      }

      if (result.next === 'champion') {
        if (!result.champion) {
          Sentry.captureException(
            new Error('GauntletShell: next=champion ama champion alanı boş'),
            { tags: { component: 'GauntletShell' } },
          );
          setActionError(t('gauntlet.submitError'));
          return;
        }
        if (result.champion.id !== winner.id) {
          // CTO 🔴1 uyuşmazlık tespiti: pozisyonel ayna saptı. Backend'in
          // dediği kazanır; sapma ilk gün Sentry'de görünür.
          Sentry.captureException(
            new Error(
              `GauntletShell: şampiyon uyuşmazlığı — istemci ${winner.id}, backend ${result.champion.id}`,
            ),
            {
              level: 'warning',
              tags: { component: 'GauntletShell', error_code: 'GAUNTLET_MIRROR_DIVERGENCE' },
            },
          );
        }
        setChampion(result.champion);
        setAnimateReveal(true); // canlı final: 720ms kara boşluk (§7.3)
        completedDateKeyRef.current = localDateKey();
        setShellState('completed_today');
        void hapticSuccess();
        hapticTimerRef.current = setTimeout(() => {
          void hapticHeavy();
        }, CHAMPION_HAPTIC_DELAY);
        return;
      }

      if (result.next === 'exhausted') {
        toExhausted();
        return;
      }

      // 'refresh' outcome='choice' için beklenmez — sessiz geçilmez.
      Sentry.captureException(
        new Error(`GauntletShell: outcome=choice için beklenmeyen next=${result.next}`),
        { tags: { component: 'GauntletShell' } },
      );
      setActionError(t('gauntlet.submitError'));
    },
    [pair, gauntlet, submitting, transitioning, round, submit, isReducedMotion, t, toExhausted],
  );

  /** Seviye 1 ret — TEK buton, her rette AYNI davranış (§3.3, C.3'e kadar). */
  const handleNeither = useCallback(async () => {
    if (!pair || !gauntlet || submitting || transitioning) return;
    void hapticSelection(); // ret haptik deseni (§8)
    const result = await submit({
      gauntletId: gauntlet.gauntletId,
      round,
      filmA: pair.left.id,
      filmB: pair.right.id,
      winner: null,
      outcome: 'neither',
      positionOfWinner: null,
      latencyMs: measuredLatencyMs(),
    });
    if (!result || !mountedRef.current) return;
    applyRefreshResult(result, pair);
  }, [pair, gauntlet, submitting, transitioning, round, submit, applyRefreshResult]);

  /** "Bunu izledim" moduna gir/çık (CTO kararı 4: soru satırı + "Vazgeç"). */
  const handleSeenToggle = useCallback(() => {
    if (submitting) return;
    void hapticSelection(); // mod girişi/çıkışı haptik (CTO şartı, §8)
    setSeenMode((prev) => !prev);
  }, [submitting]);

  /** Seen modunda poster dokunuşu: tur HARCAMAZ, film değişir (§3.4).
   *  watchlist yazımı SUNUCUDA (submit-choice markWatched) — istemci
   *  watchlist'e AYRICA YAZMAZ. */
  const handleSeenPick = useCallback(
    async (side: 'left' | 'right') => {
      if (!pair || !gauntlet || submitting || transitioning) return;
      const seenFilm = side === 'left' ? pair.left : pair.right;
      void hapticSelection(); // "İzledim" haptik deseni (§8)
      const result = await submit({
        gauntletId: gauntlet.gauntletId,
        round,
        filmA: pair.left.id,
        filmB: pair.right.id,
        winner: seenFilm.id, // ölçülmüş semantik: winner = İZLENEN film
        outcome: 'seen',
        positionOfWinner: side,
        latencyMs: measuredLatencyMs(),
      });
      if (!mountedRef.current) return;
      setSeenMode(false);
      if (!result) return;
      applyRefreshResult(result, pair);
    },
    [pair, gauntlet, submitting, transitioning, round, submit, applyRefreshResult],
  );

  const handlePosterPress = useCallback(
    (side: 'left' | 'right') => {
      if (seenMode) {
        void handleSeenPick(side);
      } else {
        void handleChoice(side);
      }
    },
    [seenMode, handleSeenPick, handleChoice],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  if (shellState === 'before_18') {
    return (
      <View style={styles.root}>
        <LightBleed />
        <View style={styles.centerContent}>
          <Text style={styles.stateText}>{t('gauntlet.before18')}</Text>
        </View>
      </View>
    );
  }

  if (shellState === 'bootstrapping') {
    if (loadError) {
      // §15.2: hata özür dilemez, gerçek mesaj + tekrar dene. Sessiz boş
      // ekran ve kalıcı iskelet YASAK.
      return (
        <View style={styles.root}>
          <LightBleed />
          <View style={styles.centerContent}>
            <Text style={styles.stateText}>{loadError}</Text>
            <QuietAction label={t('gauntlet.retry')} onPress={retryLoad} />
          </View>
        </View>
      );
    }
    // Graphite iskelet (§10.1: spinner yok) — 401 penceresinde hata metni
    // GÖSTERİLMEZ, kullanıcıya normal yükleniyor hissi verilir.
    return (
      <View style={styles.root}>
        <LightBleed />
        <View style={styles.skeletonContent}>
          <SkeletonLoader width="40%" height={16} />
          <View style={styles.posterRow}>
            <View style={styles.skeletonPosterSlot}>
              <SkeletonLoader width="100%" height={1} style={styles.skeletonPoster} />
            </View>
            <View style={styles.skeletonPosterSlot}>
              <SkeletonLoader width="100%" height={1} style={styles.skeletonPoster} />
            </View>
          </View>
          <SkeletonLoader width="55%" height={14} />
        </View>
      </View>
    );
  }

  if (shellState === 'completed_today') {
    if (champion) {
      return (
        <View style={styles.root}>
          <ChampionReveal champion={champion} animateReveal={animateReveal} onDismiss={onDismiss} />
        </View>
      );
    }
    return (
      <View style={styles.root}>
        <LightBleed />
        <View style={styles.centerContent}>
          <Text style={styles.stateText}>{t('gauntlet.exhausted')}</Text>
          {onDismiss && (
            <QuietAction label={t('gauntlet.dismissTomorrow')} onPress={onDismiss} />
          )}
        </View>
      </View>
    );
  }

  // ready | in_progress — aynı oyun görünümü, fark yalnız başlangıç turu.
  if (!pair || !gauntlet) {
    // Bu dala KESİN koşullar gereği düşülmez; düşülürse sözleşme bozuldu.
    Sentry.captureException(
      new Error(`GauntletShell: ${shellState} durumunda pair/gauntlet boş`),
      { tags: { component: 'GauntletShell' } },
    );
    return (
      <View style={styles.root}>
        <LightBleed />
        <View style={styles.centerContent}>
          <Text style={styles.stateText}>{t('gauntlet.loadError')}</Text>
          <QuietAction label={t('gauntlet.retry')} onPress={retryLoad} />
        </View>
      </View>
    );
  }

  const outOfRefreshes = refreshesRemaining === 0; // -1 = sınırsız (Pro)

  return (
    <View style={styles.root}>
      <LightBleed />
      <View style={styles.content}>
        <View style={styles.header}>
          <ConfidenceMeter userConfidence={gauntlet.userConfidence} />
          <RoundIndicator current={round} />
        </View>

        <View style={styles.posterRow}>
          <View style={styles.posterSlot}>
            <PosterTile
              film={pair.left}
              disabled={submitting || transitioning}
              animationState={tileStates.left}
              onPress={() => handlePosterPress('left')}
            />
          </View>
          <View style={styles.posterSlot}>
            <PosterTile
              film={pair.right}
              disabled={submitting || transitioning}
              animationState={tileStates.right}
              onPress={() => handlePosterPress('right')}
            />
          </View>
        </View>

        <Text style={styles.question}>
          {seenMode ? t('gauntlet.seenPrompt') : t('gauntlet.question')}
        </Text>

        {actionError !== null && <Text style={styles.actionError}>{actionError}</Text>}

        <View style={styles.actions}>
          {seenMode ? (
            <QuietAction label={t('gauntlet.cancel')} onPress={handleSeenToggle} />
          ) : (
            <>
              <QuietAction
                label={t('gauntlet.rejectNeither')}
                onPress={() => void handleNeither()}
                disabled={submitting || transitioning || outOfRefreshes}
              />
              <Text style={styles.actionSeparator}>·</Text>
              <QuietAction
                label={t('gauntlet.markWatched')}
                onPress={handleSeenToggle}
                disabled={submitting || transitioning}
              />
              {outOfRefreshes && onDismiss && (
                <>
                  <Text style={styles.actionSeparator}>·</Text>
                  <QuietAction label={t('gauntlet.dismissTomorrow')} onPress={onDismiss} />
                </>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}
