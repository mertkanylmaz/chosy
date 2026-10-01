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
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { Image as ExpoImage } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SkeletonLoader from '@/components/SkeletonLoader';
import { AuthPromptSheet } from '@/components/auth/AuthPromptSheet';
import { NotificationPromptSheet } from '@/components/notifications/NotificationPromptSheet';
import { ArchiveTrigger } from '@/components/gauntlet/ArchiveTrigger';
import { ChampionReveal } from '@/components/gauntlet/ChampionReveal';
import { ContextBar } from '@/components/gauntlet/ContextBar';
import { LightBleed } from '@/components/gauntlet/LightBleed';
import { PendingWatchFeedbackCard } from '@/components/gauntlet/PendingWatchFeedbackCard';
import {
  PosterTile,
  type PosterTileAnimationState,
  type PosterTitleLines,
} from '@/components/gauntlet/PosterTile';
import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { QuietAction } from '@/components/gauntlet/QuietAction';
import { SpotlightBonusCard } from '@/components/gauntlet/SpotlightBonusCard';
import { TabBarInsetTelemetry } from '@/components/gauntlet/TabBarInsetTelemetry';
import { prefetchWatchProviders } from '@/components/gauntlet/WatchProviders/useWatchProviders';
import { RoundIndicator } from '@/components/gauntlet/RoundIndicator';
import { ROUND_INDICATOR_HEIGHT } from '@/components/gauntlet/RoundIndicator/styles';
import { UnlockCountdown } from '@/components/gauntlet/UnlockCountdown';
import {
  WaitingChampionCard,
  WaitingCurtain,
  useLastChampion,
} from '@/components/gauntlet/WaitingChampion';
import {
  CHAMPION_HAPTIC_DELAY,
  DISSOLVE_DURATION,
  REDUCED_MOTION_DURATION,
} from '@/constants/design/motion';
import { radius, size, space, type } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { TabBarInsetProvider, useTabBarInset } from '@/hooks/useTabBarInset';
import { enqueuePendingChoice, flushPendingChoice } from '@/services/gauntletOfflineQueue';
import {
  GauntletAuthPendingError,
  GauntletFetchError,
  PreviousCycleRejectedError,
  getArchiveStatus,
  getTodayGauntletWithFallback,
  submitChoice,
  submitContextCorrection,
  submitWatchFeedback,
  type ChoiceResult,
} from '@/services/gauntletService';
import { subscribeToReconnect } from '@/services/networkStatus';
import { decidePreviousCycleProbeNow, markPreviousCycle } from '@/services/previousCycle';
import { isE2ETestMode } from '@/utils/e2eTestMode';
import { posthogAnalytics } from '@/services/posthog';
import { resolveChampionPrompt, type ChampionPrompt } from '@/services/championPrompts';
import {
  getPermissionState,
  markNotificationPermissionAsked,
  registerForPushNotifications,
} from '@/services/pushNotifications';
import { supabase } from '@/services/supabase';
import { markUserFlag } from '@/services/userFlags';
import type {
  ChoiceSubmission,
  DailyGauntlet,
  GauntletContext,
  GauntletFilm,
  OklchColor,
  WatchFeedbackResponse,
} from '@/types/gauntlet';
import type { ShareRound } from '@/utils/gauntletShareText';
import { upgradePosterUrl } from '@/utils/posterUrl';
import {
  hapticHeavy,
  hapticLight,
  hapticMedium,
  hapticSelection,
  hapticSuccess,
} from '@/utils/haptics';

import {
  gauntletCycleProps,
  previousLoadOutcome,
  previousOfflineOutcome,
  pulseAction,
  requestOptionsFor,
  type CycleMode,
} from './cycleRules';
import { contentTopFor, headerGapFor, styles } from './styles';
import { UNLOCK_HOUR, formatUnlockTime, nextUnlockAfter } from './unlockClock';

// ─── Ürün sabitleri ──────────────────────────────────────────────────────────
//
// 18:00 kapısı (`UNLOCK_HOUR`) ve saf saat kuralı `./unlockClock.ts`'te —
// Deno testli, istemcide TEK tanım (V-1 D9).

/**
 * Şampiyon reveal'ı ile tek-seferlik istem sheet'i arasındaki bekleme (ms).
 *
 * §7.3 kara boşluk sekansı 120 + 400 + 200 + 200 = 920ms sürüyor; sheet o
 * bitmeden açılırsa imza anın üstüne biner. Bir tasarım token'ı DEĞİL —
 * `constants/design/motion.ts` §7'nin birebir karşılığıdır ve oraya ürün
 * kararı yazılmaz; bu değer bir istem orkestrasyonu sabitidir, o yüzden
 * ürün sabitlerinin arasında durur.
 */
const CHAMPION_PROMPT_DELAY = 1800;

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
  // K-42 Maestro iOS override (DUR NOKTASI onaylı): yalnız `preview-e2e`
  // build'inde (tek doğruluk kaynağı: utils/e2eTestMode.ts) saat kapısı
  // atlanır — release-mode Maestro flow'ları 18:00 öncesi de koşabilsin.
  // Diğer TÜM build'lerde (production dahil) bu dal ölü koddur.
  if (isE2ETestMode()) return true;
  return new Date().getHours() >= UNLOCK_HOUR;
}

/**
 * Bekleyiş ekranı geri sayımının hedefi: bir sonraki kapı anı, yerel saat
 * (V-1 Tur 6). `isUnlockedNow()` ile AYNI bypass — geliştirmede ve
 * preview-e2e'de kapı hep açık, hedef `now`: sayaç anında biter ve nabız
 * yolu yüklemeyi açar.
 */
function getNextUnlockAt(now: Date = new Date()): Date {
  if (__DEV__) return now;
  if (isE2ETestMode()) return now;
  return nextUnlockAfter(now);
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

/**
 * Tur 2 ve 3'ün gelecek rakiplerinin posterlerini ısıtır — mevcut boyutla
 * (sunucunun verdiği w500), `nextChallengerForRound`'un okuyacağı aynı
 * `films[2]`/`films[3]`. Rakip belirdiğinde iskelet yerine poster hazır olur.
 *
 * En iyi çaba: başarısız olursa PosterTile kendi yükleme/yeniden deneme
 * yolunu izler. Sessiz değil — başarısızlık breadcrumb bırakır.
 */
function prefetchUpcomingChallengers(films: GauntletFilm[]): void {
  const urls = [films[2], films[3]]
    .map((f) => f?.posterUrl ?? '')
    .filter((u) => u !== '');
  if (urls.length === 0) return;
  ExpoImage.prefetch(urls)
    .then((ok) => {
      if (ok) return;
      Sentry.addBreadcrumb({
        category: 'gauntlet.poster',
        message: 'gelecek rakip posterleri ön yüklenemedi',
        level: 'warning',
        data: { count: urls.length },
      });
    })
    .catch((err: unknown) => {
      Sentry.addBreadcrumb({
        category: 'gauntlet.poster',
        message: 'gelecek rakip posterleri ön yükleme hatası',
        level: 'warning',
        data: { error: err instanceof Error ? err.message : String(err) },
      });
    });
}

/** Konum bias'ı (PRODUCT_OS §3.2): sol-sağ rastgele. */
function orderPair(a: GauntletFilm, b: GauntletFilm): [GauntletFilm, GauntletFilm] {
  return Math.random() < 0.5 ? [a, b] : [b, a];
}

// ─── Tipler ──────────────────────────────────────────────────────────────────

type ShellState = 'before_18' | 'bootstrapping' | 'ready' | 'in_progress' | 'completed_today';

/**
 * Durum geçişini tetikleyen kaynak — YALNIZ saha teşhisi için
 * (`gauntlet.state` breadcrumb'ı). Hiçbir dal bu değere göre karar vermez.
 *   mount / auth / connectivity / pulse → açılış ve yeniden yükleme kaynakları
 *   retry        → 401 backoff'unun otomatik denemesi
 *   retry_button → kullanıcının "Tekrar dene"si
 *   submit401    → oyun ortasında 401, bootstrap'a dönüş
 *   choice / refresh → oyun eylemi sonucu (tur, şampiyon, tükeniş)
 */
type StateTrigger =
  | 'mount'
  | 'auth'
  | 'connectivity'
  | 'pulse'
  | 'retry'
  | 'retry_button'
  | 'submit401'
  | 'choice'
  | 'refresh';

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

/**
 * V-2 Tur B: alt pay ölçümü kabuğun DIŞINDA kurulur — `useTabBarInset()`
 * yalnız provider altında okunabilir ve ölçüm view'ı tam ekranı kaplamalı.
 */
export function GauntletShell(props: GauntletShellProps): React.JSX.Element {
  return (
    <TabBarInsetProvider>
      <GauntletShellContent {...props} />
    </TabBarInsetProvider>
  );
}

function GauntletShellContent({ onDismiss }: GauntletShellProps): React.JSX.Element {
  const { t, region, language } = useLanguage();
  const isReducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  // V-2 Tur C: tur göstergesi → poster arası boşluk ekran yüksekliğine bağlı.
  const { height: windowHeight } = useWindowDimensions();
  /** V-2 Tur B: tab bar + home indicator — TÜM dalların alt payı buradan. */
  const tabBarInset = useTabBarInset();

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
  /**
   * Işık sızmasını süren film (DESIGN_OS §5, CTO kararı 15.08.2026: defender).
   * SALT GÖRSEL — hiçbir dal bu değere göre karar vermez, oyun mantığına
   * girmez. Film NESNESİ tutulur, id değil: `neither`/`seen` yenilemesinden
   * gelen filmler `gauntlet.films` içinde YOKTUR (backend `film_ids`'i günceller,
   * istemcideki kopya eskir), id'den çözmek başarısız olurdu.
   *
   * Yalnızca `choice` / `seen` / resume güncellenir — `neither` onu DEĞİŞTİRMEZ,
   * renk son geçerli defender'da kalır. Gerekçe: `neither` iki filmi de eler
   * (submit-choice DAL 2), geriye taşınacak bir defender kalmaz.
   */
  const [defenderFilm, setDefenderFilm] = useState<GauntletFilm | null>(null);
  const [animateReveal, setAnimateReveal] = useState(false);
  const [refreshesRemaining, setRefreshesRemaining] = useState(0);
  /**
   * E-19: sunucu bu gauntlet'in editoryal takvimden geldiğini bildirdi ve
   * yenileme uygulanmadı. `refreshesRemaining` ile KARIŞTIRILMAZ — hak hâlâ
   * olabilir, sınır içeriktedir. İlk reddin ardından "İkisi de değil" kapanır
   * ki kullanıcı sonuçsuz kalacak bir eylemi tekrarlamasın.
   */
  const [editorialRefreshBlocked, setEditorialRefreshBlocked] = useState(false);
  const [seenMode, setSeenMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /**
   * "Dün izledin mi?" kartı görünür mü (C.4). ŞellState'e YENİ bir üye
   * DEĞİL — CTO'nun onayladığı "BEŞ durum" sözleşmesi bozulmaz, bu yalnız
   * normal ready/in_progress/completed_today render'ının ÜSTÜNE binen bir
   * interstitial. Yanıtlanınca veya atlanınca kapanır, altındaki ekran
   * (zaten hazır durumda) hemen görünür.
   */
  const [pendingFeedbackVisible, setPendingFeedbackVisible] = useState(false);
  /** Eleme/yenileme geçişi oynarken dokunma kilidi — çifte submit önlenir. */
  const [transitioning, setTransitioning] = useState(false);
  /**
   * Paylaşım metninin braket zinciri (C.5). YALNIZCA bu oturumda gerçekten
   * gerçekleşmiş `choice` turları buraya yazılır — `gauntlet.films`'ten
   * TÜRETİLMEZ: `neither`/`seen` yenilemelerinden sonra istemcideki film
   * kopyası eskir (backend `film_ids`'i günceller), oradan üretilen zincir
   * hiç yarışmamış filmleri gösterirdi. Resume yolunda boş kalır ve paylaşım
   * metni yalnız şampiyon satırını taşır — uydurma yok.
   */
  const [shareRounds, setShareRounds] = useState<ShareRound[]>([]);
  /**
   * Şampiyon sonrası açılan tek-seferlik istem (R-A-2). ShellState'e üye
   * DEĞİL — beş durum sözleşmesi bozulmaz; bu, `completed_today` render'ının
   * üzerine binen bir sheet'tir ve altındaki şampiyon ekranı görünür kalır.
   */
  const [championPrompt, setChampionPrompt] = useState<ChampionPrompt>('none');
  /**
   * K-42 offline durumu. ShellState'e üye DEĞİL — beş durum sözleşmesi
   * bozulmaz; ikisi de mevcut render'ın üzerine binen göstergelerdir.
   *
   * `isStale`      → gösterilen gauntlet bugünün değil (yerel kopya)
   * `choiceFrozen` → bir seçim kuyrukta bekliyor, tur İLERLEMEZ
   */
  const [isStale, setIsStale] = useState(false);
  const [choiceFrozen, setChoiceFrozen] = useState(false);

  /**
   * V-4 Tur B: poster başlıklarının doğal satır sayısı, film kimliğine göre.
   * SALT GÖRSEL — tur, çift ve kuyruk bu değerden türetilmez (K-37/K-42).
   * Kimlikle anahtarlandığı için yeni rakip geldiğinde kalan filmin ölçümü
   * korunur, gelenin ölçümü kendi ilk düzeninde yazılır.
   */
  const [titleLinesById, setTitleLinesById] = useState<Record<string, PosterTitleLines>>({});
  const reportTitleLines = useCallback((filmId: string, lines: PosterTitleLines) => {
    setTitleLinesById((prev) => (prev[filmId] === lines ? prev : { ...prev, [filmId]: lines }));
  }, []);

  const shellStateRef = useRef(shellState);
  shellStateRef.current = shellState;
  const loadingRef = useRef(false);
  const authAttemptsRef = useRef(0);
  const pairShownAtRef = useRef(Date.now());
  const completedDateKeyRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  /** `gauntlet_started` bir gauntlet başına en fazla bir kez ateşlenir —
   *  applyGauntlet 401 retry/resume gibi nedenlerle birden çok kez
   *  çağrılabilir, olay burada yinelenmemeli. */
  const startedTrackedGauntletIdsRef = useRef<Set<string>>(new Set());
  /**
   * B5: breadcrumb'ın "önceki durum"u. `shellStateRef`'ten AYRI tutulur —
   * o ref render'da güncellenir ve tetikleyici guard'ları ona bakar; burada
   * erken güncellemek guard davranışını değiştirirdi.
   */
  const recordedStateRef = useRef<ShellState | null>(null);
  /**
   * E-21: istenen döngü. `previous` yalnız mount'taki önceki döngü sorgusuyla
   * girilir; yalnız nabız (18:00 / gece yarısı) ve ret onu `current`'a
   * döndürür. `load` modu TETİKLEYİCİDEN DEĞİL buradan okur — önceki döngü
   * oyunu sırasındaki reconnect / 401 / retry sabah bugünün satırını üretmesin.
   */
  const cycleModeRef = useRef<CycleMode>('current');
  /**
   * Son `submit` çağrısı seçimi K-42 kuyruğuna mı aldı? YALNIZ dokunma
   * onayının geri alınıp alınmayacağını belirler (CTO kararı 29.09.2026:
   * donukken vurgu kalır — kullanıcı hangi seçimin beklediğini görür).
   * Kuyruk davranışı bu değere bakmaz.
   */
  const choiceQueuedRef = useRef(false);
  /** Analytics `cycle` etiketi için önceki döngü gauntlet'inin kimliği (3i). */
  const previousGauntletIdRef = useRef<string | null>(null);

  /**
   * B5 saha teşhisi: her ShellState geçişi bir `gauntlet.state` breadcrumb'ı
   * bırakır (yalnız breadcrumb — captureMessage yok, kota maliyeti sıfır).
   * Aynı duruma "geçiş" de yazılır: yeniden yüklemenin görünmez tekrarı
   * (ör. ready → ready) çırpınma teşhisinde tam aranan izdir.
   */
  const transitionTo = useCallback((next: ShellState, trigger: StateTrigger) => {
    Sentry.addBreadcrumb({
      category: 'gauntlet.state',
      message: `${recordedStateRef.current ?? 'none'} -> ${next}`,
      level: 'info',
      data: { from: recordedStateRef.current, to: next, trigger },
    });
    recordedStateRef.current = next;
    setShellState(next);
  }, []);

  /**
   * B5: `loadError` ShellState değil, üstüne binen bir gösterge — geçiş
   * breadcrumb'ı onu görmez. "Gauntlet yok dedi" teşhisi için hata metni ve
   * tipiyle ayrıca yazılır. `state` alanı önemli: metin YALNIZ `bootstrapping`
   * dalında render edilir, başka durumda set edilmesi ekranda görünmez.
   */
  const showLoadError = useCallback(
    (trigger: StateTrigger, reason: string, err?: unknown) => {
      const text = t('gauntlet.loadError');
      Sentry.addBreadcrumb({
        category: 'gauntlet.state',
        message: `loadError (${reason})`,
        level: 'warning',
        data: {
          state: recordedStateRef.current,
          trigger,
          reason,
          text,
          error_type: err instanceof Error ? err.name : null,
          error_message: err instanceof Error ? err.message.slice(0, 200) : null,
        },
      });
      setLoadError(text);
    },
    [t],
  );

  // ── PostHog: gauntlet_viewed — ekran her mount olduğunda bir kez ──────────
  useEffect(() => {
    posthogAnalytics.track('gauntlet_viewed');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Gürültü koruması (§3.5): İSTEMCİ YALNIZCA ÖLÇER — eşik/karar SUNUCUDA. */
  useEffect(() => {
    pairShownAtRef.current = Date.now();
  }, [pair]);

  const measuredLatencyMs = (): number =>
    Math.max(0, Math.round(Date.now() - pairShownAtRef.current));

  // ── Yanıt yorumlama ────────────────────────────────────────────────────────

  const toExhausted = useCallback((trigger: StateTrigger) => {
    setChampion(null);
    setPair(null);
    setSeenMode(false);
    completedDateKeyRef.current = localDateKey();
    transitionTo('completed_today', trigger);
  }, [transitionTo]);

  const applyGauntlet = useCallback(
    (g: DailyGauntlet, trigger: StateTrigger) => {
      setGauntlet(g);
      setRefreshesRemaining(g.refreshesRemaining);
      setActionError(null);
      // E-19: yeni gauntlet = yeni gün olabilir. Editoryal kilit gauntlet'e
      // aittir, ekrana değil — taşınırsa algoritmik bir günde "İkisi de değil"
      // sebepsiz kapalı kalırdı.
      setEditorialRefreshBlocked(false);
      // Sunucudan gelen durum tur GEÇMİŞİ taşımaz (kilitli sözleşme) —
      // ölçülmemiş bir zinciri elde tutmak yerine sıfırlanır (C.5).
      setShareRounds([]);
      if (g.pendingWatchFeedback) setPendingFeedbackVisible(true);
      const p = g.progress;

      if (p && p.status === 'champion') {
        if (!p.champion) {
          // Kilitli invariant ihlali — sessiz düzeltme yok, görünür hata.
          Sentry.captureException(
            new Error('GauntletShell: progress.status=champion ama champion boş'),
            { tags: { component: 'GauntletShell' } },
          );
          showLoadError(trigger, 'invariant_champion_missing');
          return;
        }
        setChampion(p.champion);
        setAnimateReveal(false); // resume: kara boşluk yalnız canlı finalde
        completedDateKeyRef.current = localDateKey();
        transitionTo('completed_today', trigger);
        return;
      }

      if (p && p.status === 'exhausted') {
        toExhausted(trigger);
        return;
      }

      if (p && p.status === 'in_progress' && (!p.defender || !p.challenger)) {
        Sentry.captureException(
          new Error('GauntletShell: in_progress ama defender/challenger boş'),
          { tags: { component: 'GauntletShell' } },
        );
        showLoadError(trigger, 'invariant_pair_missing');
        return;
      }

      // Oynanacak tur var (ready ya da resume) — gelecek rakipleri ısıt.
      prefetchUpcomingChallengers(g.films);

      if (p && p.status === 'in_progress' && p.completedRounds > 0) {
        // KESİN koşul: status==='in_progress' && completedRounds>0 → resume
        setRound((p.completedRounds + 1) as 2 | 3);
        setPair({ left: p.defender as GauntletFilm, right: p.challenger as GauntletFilm });
        setDefenderFilm(p.defender as GauntletFilm); // sızma rengi (§5)
        setTileStates({ left: 'idle', right: 'idle' });
        transitionTo('in_progress', trigger);
        return;
      }

      // KESİN koşul: progress undefined VEYA in_progress && completedRounds===0
      setRound(1);
      setPair(
        p && p.defender && p.challenger
          ? { left: p.defender, right: p.challenger }
          : { left: g.films[0], right: g.films[1] },
      );
      // Tur 1'de defender backend'in dIdx=0 konvansiyonudur (§5 sızma rengi).
      setDefenderFilm(p?.defender ?? g.films[0]);
      setTileStates({ left: 'idle', right: 'idle' });
      transitionTo('ready', trigger);

      if (!startedTrackedGauntletIdsRef.current.has(g.gauntletId)) {
        startedTrackedGauntletIdsRef.current.add(g.gauntletId);
        posthogAnalytics.track('gauntlet_started', {
          gauntlet_id: g.gauntletId,
          algorithm_version: g.algorithmVersion,
          context_companion: g.context.companion,
          context_duration: g.context.duration,
          context_energy: g.context.energy,
          ...gauntletCycleProps(g.gauntletId, previousGauntletIdRef.current),
        });
      }
    },
    [toExhausted, transitionTo, showLoadError],
  );

  // ── Yükleme + 401 retry (CTO 🔴2) ──────────────────────────────────────────

  /**
   * E-21: önceki döngü bu kullanıcı için kapandı (sunucu reddetti ya da
   * yeniden açılışta oyun zaten bitmiş) → bekleyiş ekranı. Hata DEĞİL; sunucu
   * hatası (5xx/400) bu yoldan geçmez, `loadError`'a düşer (3g).
   */
  const closePreviousCycle = useCallback((trigger: StateTrigger) => {
    cycleModeRef.current = 'current';
    void markPreviousCycle('closed');
    setLoadError(null);
    setGauntlet(null);
    setChampion(null);
    setPair(null);
    transitionTo('before_18', trigger);
  }, [transitionTo]);

  const load = useCallback(async (trigger: StateTrigger): Promise<void> => {
    if (loadingRef.current) {
      // B5: çift tetikleme teorisinin saha doğrulaması — uçuştaki bir
      // yükleme varken gelen ikinci çağrı burada düşer, iz bırakır.
      Sentry.addBreadcrumb({
        category: 'gauntlet.state',
        message: 'load dropped (in flight)',
        level: 'info',
        data: { state: recordedStateRef.current, trigger },
      });
      return;
    }
    loadingRef.current = true;
    setLoadError(null);
    try {
      // K-42: ağ → bugünün yerel kopyası → en son yerel kopya. Kaynak
      // `source` ile gelir; `progress` HER DURUMDA sunucunun türettiği
      // değerdir — istemci turu hâlâ SAYMAZ, yalnız kopyayı gösterir.
      const mode = cycleModeRef.current;
      const { gauntlet: g, source } = await getTodayGauntletWithFallback(
        undefined,
        requestOptionsFor(mode),
      );
      if (!mountedRef.current) return;
      authAttemptsRef.current = 0;
      if (mode === 'previous') {
        if (previousLoadOutcome(g.progress?.status, shellStateRef.current) === 'close') {
          closePreviousCycle(trigger);
          return;
        }
        previousGauntletIdRef.current = g.gauntletId;
        void markPreviousCycle('previous');
      }
      // `cache_today` gösterge ÜRETMEZ: yerel kopya ama bugünün verisi,
      // kullanıcı için fark yok — görsel gürültü eklemek yanlış olurdu.
      setIsStale(source === 'cache_stale');
      applyGauntlet(g, trigger);
    } catch (err) {
      if (!mountedRef.current) return;
      if (err instanceof PreviousCycleRejectedError) {
        closePreviousCycle(trigger);
        return;
      }
      if (
        err instanceof GauntletFetchError &&
        cycleModeRef.current === 'previous' &&
        previousOfflineOutcome(shellStateRef.current) === 'before_18'
      ) {
        // CTO SARI-4: açılışta ağ yok → bekleyiş ekranı, hata ekranı değil.
        // İz YAZILMAZ (bir sonraki açılış yeniden sorar); GAUNTLET_OFFLINE
        // uyarısı servis katmanında Sentry'ye yazıldı.
        Sentry.addBreadcrumb({
          category: 'gauntlet.cycle',
          message: 'previous probe offline -> before_18',
          level: 'warning',
          data: { trigger },
        });
        cycleModeRef.current = 'current';
        transitionTo('before_18', trigger);
        return;
      }
      if (err instanceof GauntletAuthPendingError) {
        const attempt = authAttemptsRef.current + 1;
        authAttemptsRef.current = attempt;
        if (attempt >= MAX_AUTH_ATTEMPTS) {
          // 5. deneme de 401: artık bootstrap penceresi değil, gerçek kimlik
          // arızası. Kalıcı iskelet YASAK — §15.2 hata görünümüne düş.
          Sentry.captureException(err, {
            tags: { component: 'GauntletShell', error_code: 'GAUNTLET_AUTH_EXHAUSTED' },
          });
          showLoadError(trigger, 'auth_exhausted', err);
        } else {
          retryTimerRef.current = setTimeout(() => {
            void load('retry');
          }, AUTH_RETRY_BACKOFF_MS[attempt - 1]);
        }
      } else {
        // Sentry servis katmanında yazıldı — burada görünür hata (§15.2).
        showLoadError(trigger, 'fetch_failed', err);
      }
    } finally {
      loadingRef.current = false;
    }
  }, [applyGauntlet, showLoadError, closePreviousCycle, transitionTo]);

  /**
   * K-42: bekleyen seçim varsa ÖNCE onu gönder, sonra yükle.
   *
   * Sıra önemli: seçim sunucuya yazılmadan `load()` çağırmak, o seçimi
   * İÇERMEYEN bir `progress` getirir ve kullanıcı turu ikinci kez oynardı.
   * Gönderim başarılıysa gelen `progress` zaten seçimi içerir — istemci
   * hiçbir şey türetmez (K-37 invariant'ı korunur).
   *
   * `still_offline`'da da yükleme denenir: bağlantı yoksa cache geri düşüşü
   * devreye girer ve kullanıcı boş ekran yerine donmuş turu görür.
   */
  const flushThenLoad = useCallback(async (trigger: StateTrigger): Promise<void> => {
    const outcome = await flushPendingChoice();
    if (!mountedRef.current) return;

    switch (outcome.status) {
      case 'sent':
        setChoiceFrozen(false);
        setActionError(null);
        break;
      case 'dropped':
        // Kalıcı ret veya süre aşımı. Sessiz kayıp YOK — kullanıcıya söylenir.
        setChoiceFrozen(false);
        setActionError(t('gauntlet.choiceDropped'));
        break;
      case 'still_offline':
        setChoiceFrozen(true);
        break;
      case 'empty':
        setChoiceFrozen(false);
        break;
    }

    await load(trigger);
  }, [load, t]);

  const retryLoad = useCallback(() => {
    authAttemptsRef.current = 0;
    void flushThenLoad('retry_button');
  }, [flushThenLoad]);

  /**
   * E-21: 18:00 öncesi açılışta önceki döngü sorulmalı mı? Mevcut kullanıcı
   * (cache ya da `closed` iz'i var) için AĞ ÇAĞRISI YOK — akış eskisi.
   * Sorulacaksa mevcut bootstrapping makinesi kullanılır: 401 penceresi,
   * `loadError` + "Tekrar dene" ve K-42 kuyruk flush'ı aynen geçerli.
   */
  const probePreviousCycle = useCallback(async (): Promise<void> => {
    const decision = await decidePreviousCycleProbeNow(isUnlockedNow());
    if (!mountedRef.current || !decision.probe) return;
    // Karar beklenirken nabız kapıyı açmış olabilir — yalnız hâlâ before_18 ise.
    if (shellStateRef.current !== 'before_18') return;
    cycleModeRef.current = 'previous';
    authAttemptsRef.current = 0;
    transitionTo('bootstrapping', 'mount');
    await flushThenLoad('mount');
  }, [flushThenLoad, transitionTo]);

  // Mount: yalnız kapı açıksa çağır — before_18'de AĞ ÇAĞRISI YOK (§3.6).
  useEffect(() => {
    mountedRef.current = true;
    // B5: başlangıç durumu useState'ten gelir, setter'dan geçmez — ilk
    // breadcrumb burada elle yazılır ki zincir "none -> …" ile başlasın.
    Sentry.addBreadcrumb({
      category: 'gauntlet.state',
      message: `none -> ${shellStateRef.current}`,
      level: 'info',
      data: { from: null, to: shellStateRef.current, trigger: 'mount' },
    });
    recordedStateRef.current = shellStateRef.current;
    if (shellStateRef.current === 'bootstrapping') {
      // K-42 tetikleyici (a): açılışta bekleyen seçim varsa önce o gider.
      void flushThenLoad('mount');
    } else if (shellStateRef.current === 'before_18') {
      probePreviousCycle().catch((err: unknown) => {
        Sentry.captureException(err, {
          tags: { component: 'GauntletShell', flow: 'previousCycleProbe' },
        });
      });
    }
    return () => {
      mountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
      if (hapticTimerRef.current) clearTimeout(hapticTimerRef.current);
      if (promptTimerRef.current) clearTimeout(promptTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bootstrap sinyali: app/_layout.tsx'in ensureAppUser akışı auth event'i
  // yayınlar — sayaç sıfırlanır, bekleyen backoff iptal edilip hemen denenir.
  //
  // Kimlik değişimi (kurucu kararı, 1 Eki 2026): kabuk açıkken BAŞKA bir
  // auth kimliği oturum açarsa (hesap silme → anonim kurtarma, ölü JWT
  // kurtarması, başka hesaba giriş) ekran eski kullanıcının durumunda
  // KALMAZ — yeni kullanıcıya açılışta ne gösterilecekse o gösterilir:
  // 18:00 öncesi E-21 önceki döngü sorgusu, sonrası bugünün gauntlet'i.
  // 30 Eyl TestFlight: hesap silindikten sonra açılış kararı ölü kimlikle
  // verilmiş ("mevcut kullanıcı"), yeni anonim kullanıcı 18:00'i beklemişti.
  //
  // `lastAuthIdRef` SIGNED_OUT'ta SIFIRLANMAZ — çıkış + yeni giriş tam da
  // yakalanması gereken değişimdir. İlk kimlik (null → id) değişim sayılmaz:
  // temiz kurulumu mount akışı zaten karşılar. Apple bağlama (linkIdentity)
  // kimliği korur, tetiklemez.
  const lastAuthIdRef = useRef<string | null>(null);

  const restartForNewIdentity = useCallback(() => {
    cycleModeRef.current = 'current';
    completedDateKeyRef.current = null;
    authAttemptsRef.current = 0;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    setGauntlet(null);
    setChampion(null);
    setPair(null);
    setSeenMode(false);
    setAnimateReveal(false);
    setIdentityEpoch((n) => n + 1);

    if (isUnlockedNow()) {
      transitionTo('bootstrapping', 'auth');
      void flushThenLoad('auth');
      return;
    }
    transitionTo('before_18', 'auth');
    // probePreviousCycle `shellStateRef`'e bakar; ref render'da güncellenir,
    // burada aynı değer elle yazılır ki karar bayat durumla verilmesin.
    shellStateRef.current = 'before_18';
    probePreviousCycle().catch((err: unknown) => {
      Sentry.captureException(err, {
        tags: { component: 'GauntletShell', flow: 'previousCycleProbe', trigger: 'identity_change' },
      });
    });
  }, [flushThenLoad, probePreviousCycle, transitionTo]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const authId = session?.user?.id ?? null;
      if (authId) {
        const previous = lastAuthIdRef.current;
        lastAuthIdRef.current = authId;
        if (event === 'SIGNED_IN' && previous !== null && previous !== authId) {
          Sentry.addBreadcrumb({
            category: 'gauntlet.state',
            message: 'identity changed — shell restarted for new user',
            level: 'info',
          });
          restartForNewIdentity();
          return;
        }
      }

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        authAttemptsRef.current = 0;
        if (shellStateRef.current === 'bootstrapping') {
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          void flushThenLoad('auth');
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [flushThenLoad, restartForNewIdentity]);

  // K-42 tetikleyici (b): bağlantı geri geldi. Yalnız offline→online
  // geçişinde ateşlenir (networkStatus), açılıştaki ilk online event'inde
  // DEĞİL — açılış flush'ı yukarıdaki mount effect'inin işi.
  useEffect(() => {
    return subscribeToReconnect(() => {
      // P0-1: 18:00 kapısı. before_18'de AĞ ÇAĞRISI YOK (§3.6) — kapıyı
      // yalnız dakikalık nabız açar. `=== 'bootstrapping'` değil: in_progress
      // sırasında bekleyen seçimin flush'ı (K-42) korunmalı.
      if (shellStateRef.current === 'before_18') return;
      void flushThenLoad('connectivity');
    });
  }, [flushThenLoad]);

  /**
   * Nabız gövdesi. Dakikalık zamanlayıcı VE bekleyiş sayacının sıfırı
   * (V-1 Tur 6) aynı yolu çağırır — ayrı bir kapı mekanizması yok. Sayaç
   * sıfırda bunu hemen çağırır, kullanıcı bir sonraki dakika tikini beklemez.
   */
  const runClockPulse = useCallback(() => {
    // Karar saf kuralda (cycleRules.pulseAction): 18:00 kapısı, yerel gece
    // yarısı (§3.6 — dünün şampiyonu gösterilmez) ve E-21 "18:00 geçişi"
    // (önceki döngü şampiyonu → bugünün gauntlet'i).
    const action = pulseAction({
      state: shellStateRef.current,
      mode: cycleModeRef.current,
      unlocked: isUnlockedNow(),
      dateKeyChanged:
        completedDateKeyRef.current !== null &&
        completedDateKeyRef.current !== localDateKey(),
    });
    if (action === 'none') return;
    // Nabzın açtığı her yükleme bugünün döngüsüdür.
    cycleModeRef.current = 'current';
    if (action === 'open_gate') {
      transitionTo('bootstrapping', 'pulse');
      authAttemptsRef.current = 0;
      void load('pulse');
      return;
    }
    completedDateKeyRef.current = null;
    setGauntlet(null);
    setChampion(null);
    setPair(null);
    setAnimateReveal(false);
    if (action === 'reset_and_load') {
      transitionTo('bootstrapping', 'pulse');
      authAttemptsRef.current = 0;
      void load('pulse');
    } else {
      transitionTo('before_18', 'pulse');
    }
  }, [load, transitionTo]);

  // Dakikalık nabız: 18:00 kapısı + gün dönümü (CTO 🟠3 — ayrı mekanizma yok).
  useEffect(() => {
    const id = setInterval(runClockPulse, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, [runClockPulse]);

  /**
   * Bekleyiş sayacının hedefi — yalnız `before_18`'e HER girişte yeniden
   * hesaplanır (gece yarısı sıfırlaması, E-21 kapanışı dahil). Referans
   * sabit kalır: sayaç her render'da yeniden kurulmaz.
   */
  const unlockAt = useMemo(
    () => (shellState === 'before_18' ? getNextUnlockAt() : null),
    [shellState],
  );

  /** V1-D7 revizyonu (30 Eyl 2026): bekleyişte son şampiyon — perde + kart. */
  /** Kabuk açıkken kimlik değişimi sayacı — `restartForNewIdentity` artırır. */
  const [identityEpoch, setIdentityEpoch] = useState(0);
  const waitingChampion = useLastChampion(shellState === 'before_18', identityEpoch);

  // PostHog: waiting_viewed — bekleyiş ekranına her giriş bir kez.
  useEffect(() => {
    if (!unlockAt) return;
    posthogAnalytics.track('waiting_viewed', {
      minutes_to_unlock: Math.max(0, Math.round((unlockAt.getTime() - Date.now()) / 60_000)),
    });
  }, [unlockAt]);

  /**
   * V-2 Tur E1 — bekleyiş ekranı bildirim CTA'sı (K-15 yerel 18:00).
   * Koşul: OS izni `undetermined` VE kullanıcının ≥1 şampiyonu var.
   * "≥1 şampiyon" kaynağı `get-archive-status` `completedCount` (CTO onayı:
   * son 7 UTC gün — daha uzun ara vermiş kullanıcı CTA'yı görmez).
   * Okuma hatasında CTA gizli kalır; `getArchiveStatus` hatayı kendisi
   * Sentry'ye yazar, 401 penceresi burada breadcrumb bırakır.
   */
  const [waitingNotifyEligible, setWaitingNotifyEligible] = useState(false);
  const [waitingNotifyBusy, setWaitingNotifyBusy] = useState(false);

  useEffect(() => {
    if (!unlockAt) {
      setWaitingNotifyEligible(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const permission = await getPermissionState();
      if (permission !== 'undetermined') {
        if (!cancelled) setWaitingNotifyEligible(false);
        return;
      }
      try {
        const status = await getArchiveStatus();
        if (!cancelled) setWaitingNotifyEligible(status.completedCount >= 1);
      } catch (err) {
        Sentry.addBreadcrumb({
          category: 'gauntlet',
          level: 'warning',
          message: 'waiting notify CTA: archive status okunamadı — CTA gizli',
          data: { error: err instanceof Error ? err.message : String(err) },
        });
        if (!cancelled) setWaitingNotifyEligible(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlockAt]);

  const handleWaitingNotify = useCallback(async () => {
    if (waitingNotifyBusy) return;
    void hapticLight();
    setWaitingNotifyBusy(true);
    posthogAnalytics.track('waiting_notify_tapped', {
      minutes_to_unlock: unlockAt
        ? Math.max(0, Math.round((unlockAt.getTime() - Date.now()) / 60_000))
        : null,
    });

    // OS diyaloğunu açar; kabulde yerel 18:00 hatırlatıcısını planlar
    // (ensureDailyReminderScheduled) ve token'ı sunucuya yazar.
    const granted = await registerForPushNotifications();
    // Kabul de ret de "sorduk" sayılır — şampiyon sheet'i tekrar sormaz.
    await markNotificationPermissionAsked();
    posthogAnalytics.track('notification_prompt_answered', {
      surface: 'waiting_cta',
      granted,
    });

    if (!mountedRef.current) return;
    setWaitingNotifyBusy(false);
    setWaitingNotifyEligible(false);
  }, [waitingNotifyBusy, unlockAt]);

  // E-21: önceki döngü canlı oynanıp bitti (şampiyon ya da tükeniş) — reveal
  // bu oturumda görünür, yeniden açılışta bekleyiş ekranı gelir.
  useEffect(() => {
    if (shellState === 'completed_today' && cycleModeRef.current === 'previous') {
      void markPreviousCycle('closed');
    }
  }, [shellState]);

  // ── Oyun eylemleri ─────────────────────────────────────────────────────────

  const submit = useCallback(
    async (submission: ChoiceSubmission): Promise<ChoiceResult | null> => {
      setSubmitting(true);
      setActionError(null);
      choiceQueuedRef.current = false;
      try {
        return await submitChoice(submission);
      } catch (err) {
        if (!mountedRef.current) return null;
        if (err instanceof GauntletAuthPendingError) {
          // Oyun ortasında 401: oturum düştü — bootstrap penceresine dön.
          authAttemptsRef.current = 0;
          transitionTo('bootstrapping', 'submit401');
          void load('submit401');
        } else if (err instanceof GauntletFetchError) {
          // K-42: sunucuya ulaşılamadı. Seçim ARTIK KAYBOLMUYOR — kuyruğa
          // alınır ve ekran donar. Tur İLERLEMEZ: çağıran `null` görüp erken
          // döner, `progress` hâlâ yalnız sunucudan gelir (K-37 invariant'ı).
          void enqueuePendingChoice(submission);
          choiceQueuedRef.current = true;
          setChoiceFrozen(true);
          setActionError(null);
        } else {
          // Sunucu yanıtladı ama hata döndü — Sentry servis katmanında
          // yazıldı, kullanıcıya görünür hata (§15.2).
          setActionError(t('gauntlet.submitError'));
        }
        return null;
      } finally {
        if (mountedRef.current) setSubmitting(false);
      }
    },
    [load, t, transitionTo],
  );

  /** `neither`/`seen` yanıtı: replacement varsa çift güncellenir —
   *  getTodayGauntlet TEKRAR ÇAĞRILMAZ (ölçülmüş sözleşme). */
  const applyRefreshResult = useCallback(
    (result: ChoiceResult, oldPair: Pair) => {
      setRefreshesRemaining(result.refreshesRemaining);
      if (result.next === 'exhausted') {
        toExhausted('refresh');
        return;
      }
      const replacement = result.replacement;
      if (!replacement) {
        // refreshAllowed=false: çift değişmez. İKİ sebebi olabilir ve ayrımı
        // sunucu `refreshBlockedReason` ile bildirir (E-19):
        //   - alan yok        → yenileme hakkı bitti. Mevcut davranış:
        //                       "İkisi de değil" devre dışı, "Boşver, yarın" görünür.
        //   - 'editorial_day' → o günün dörtlüsü editoryal takvimden geliyor,
        //                       yedek çekilmiyor. Sessiz kalmak kullanıcıya
        //                       "dokundum, bir şey olmadı" hissi verirdi.
        if (result.refreshBlockedReason === 'editorial_day') {
          setEditorialRefreshBlocked(true);
          setActionError(t('gauntlet.editorialNoRefresh'));
        }
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
    [isReducedMotion, toExhausted, t],
  );

  const handleChoice = useCallback(
    async (side: 'left' | 'right') => {
      if (!pair || !gauntlet || submitting || transitioning || choiceFrozen) return;
      const winner = side === 'left' ? pair.left : pair.right;
      void hapticLight();
      const latencyMs = measuredLatencyMs();
      // Dokunma onayı (§7.1 Kesme, CTO kararı 29.09.2026): sunucu yanıtı
      // yüzlerce ms ile birkaç saniye arası sürebilir (TestFlight 906: ~3 s);
      // bu arada seçilen poster vurgulanır, diğeri kısılır. SALT
      // GÖRSEL — `round`, `pair` ve ilerleme sunucu yanıtına kadar DEĞİŞMEZ (K-37).
      setTileStates(
        side === 'left'
          ? { left: 'pending', right: 'dimmed' }
          : { left: 'dimmed', right: 'pending' },
      );
      /** Seçim ilerlemediyse dokunma onayı geri alınır — bekleyen seçim yok. */
      const revertTapConfirmation = () => setTileStates({ left: 'idle', right: 'idle' });
      const result = await submit({
        gauntletId: gauntlet.gauntletId,
        round,
        filmA: pair.left.id,
        filmB: pair.right.id,
        winner: winner.id,
        outcome: 'choice',
        positionOfWinner: side,
        latencyMs,
      });
      if (!mountedRef.current) return;
      if (!result) {
        // K-42: seçim kuyrukta bekliyorsa vurgu KALIR (hangi seçimin beklediği
        // görünsün); sonraki load() → applyGauntlet onu sıfırlar. Sunucu reddi,
        // 401 ya da diğer hatalarda geri alınır.
        if (!choiceQueuedRef.current) revertTapConfirmation();
        return;
      }
      setRefreshesRemaining(result.refreshesRemaining);

      posthogAnalytics.track('choice_submitted', {
        gauntlet_id: result.gauntletId,
        algorithm_version: result.algorithmVersion,
        round,
        film_a: pair.left.id,
        film_b: pair.right.id,
        winner: winner.id,
        position_of_winner: side,
        latency_ms: latencyMs,
        context_companion: gauntlet.context.companion,
        context_duration: gauntlet.context.duration,
        context_energy: gauntlet.context.energy,
        ...gauntletCycleProps(result.gauntletId, previousGauntletIdRef.current),
      });

      // Braket zinciri (C.5): tur GERÇEKLEŞTİ — kazanan ve elenen belli.
      const eliminated = side === 'left' ? pair.right : pair.left;
      setShareRounds((prev) => [
        ...prev,
        { round, winnerTitle: winner.title, loserTitle: eliminated.title },
      ]);

      if (result.next === 'round2' || result.next === 'round3') {
        const newRound = result.next === 'round2' ? 2 : 3;
        let incoming: GauntletFilm;
        try {
          incoming = nextChallengerForRound(newRound, gauntlet.films);
        } catch (err) {
          Sentry.captureException(err, { tags: { component: 'GauntletShell' } });
          setActionError(t('gauntlet.submitError'));
          revertTapConfirmation();
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
          // C2e + C5: SON TUR basliyor. Sampiyon bu ikisinden biri olacak;
          // saglayici verisi simdi cekilirse Champion ekraninda birincil
          // eylem `loading`'de takilmaz. En iyi caba - basarisiz olursa
          // Champion kendi yolundan tekrar dener.
          if (newRound === 3) {
            void prefetchWatchProviders(winner.id, region);
            void prefetchWatchProviders(incoming.id, region);
            // C5: sampiyon SECIMDEN SONRA belli oluyor; o an prefetch gec
            // kalir. Son tur baslarken IKI finalistin de w780'i isitilir,
            // hangisi kazanirsa kazansin kara bosluk icinde hazir olur.
            void ExpoImage.prefetch(
              [winner, incoming]
                .map((f) => upgradePosterUrl(f.posterUrl).url)
                .filter((u) => u !== ''),
            );
          }
          setRound(newRound);
          setPair({ left, right });
          setDefenderFilm(winner); // kazanan yeni defender — sızma rengi (§5)
          setTileStates({
            left: left.id === incoming.id ? 'entering' : 'idle',
            right: right.id === incoming.id ? 'entering' : 'idle',
          });
          setSeenMode(false);
          transitionTo('in_progress', 'choice');
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
          revertTapConfirmation();
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
        transitionTo('completed_today', 'choice');
        posthogAnalytics.track('gauntlet_completed', {
          gauntlet_id: result.gauntletId,
          algorithm_version: result.algorithmVersion,
          champion_film_id: result.champion.id,
          ...gauntletCycleProps(result.gauntletId, previousGauntletIdRef.current),
        });
        posthogAnalytics.track('champion_revealed', {
          gauntlet_id: result.gauntletId,
          champion_film_id: result.champion.id,
          ...gauntletCycleProps(result.gauntletId, previousGauntletIdRef.current),
        });

        void hapticSuccess();
        hapticTimerRef.current = setTimeout(() => {
          void hapticHeavy();
        }, CHAMPION_HAPTIC_DELAY);

        // ── K-13 / K-15 İSTEM TETİKLEYİCİSİ (R-A-2) ────────────────────────
        // Kararı `resolveChampionPrompt()` verir: anonim + bayrak yoksa auth
        // prompt, aksi hâlde (ve yalnızca bir SONRAKİ akşam) bildirim izni.
        // İkisi asla aynı oturumda art arda gösterilmez.
        //
        // Yalnızca CANLI reveal'da çalışır — resume yolundan (applyGauntlet,
        // progress.status === 'champion') tetiklenmez: kullanıcı o şampiyonu
        // zaten görmüştür, uygulama açılışına sheet düşürmek istem değil,
        // kesintidir.
        promptTimerRef.current = setTimeout(() => {
          void resolveChampionPrompt().then((kind) => {
            if (!mountedRef.current || kind === 'none') return;
            setChampionPrompt(kind);
          });
        }, CHAMPION_PROMPT_DELAY);
        return;
      }

      if (result.next === 'exhausted') {
        toExhausted('choice');
        return;
      }

      // 'refresh' outcome='choice' için beklenmez — sessiz geçilmez.
      Sentry.captureException(
        new Error(`GauntletShell: outcome=choice için beklenmeyen next=${result.next}`),
        { tags: { component: 'GauntletShell' } },
      );
      setActionError(t('gauntlet.submitError'));
      revertTapConfirmation();
    },
    [pair, gauntlet, submitting, transitioning, choiceFrozen, round, submit, isReducedMotion, t, toExhausted, region, transitionTo],
  );

  /** Seviye 1 ret — TEK buton, her rette AYNI davranış (§3.3, C.3'e kadar). */
  const handleNeither = useCallback(async () => {
    if (!pair || !gauntlet || submitting || transitioning || choiceFrozen) return;
    void hapticSelection(); // ret haptik deseni (§8)
    const latencyMs = measuredLatencyMs();
    const result = await submit({
      gauntletId: gauntlet.gauntletId,
      round,
      filmA: pair.left.id,
      filmB: pair.right.id,
      winner: null,
      outcome: 'neither',
      positionOfWinner: null,
      latencyMs,
    });
    if (!result || !mountedRef.current) return;
    posthogAnalytics.track('choice_rejected', {
      gauntlet_id: result.gauntletId,
      algorithm_version: result.algorithmVersion,
      round,
      film_a: pair.left.id,
      film_b: pair.right.id,
      latency_ms: latencyMs,
      context_companion: gauntlet.context.companion,
      context_duration: gauntlet.context.duration,
      context_energy: gauntlet.context.energy,
      ...gauntletCycleProps(result.gauntletId, previousGauntletIdRef.current),
    });
    applyRefreshResult(result, pair);
  }, [pair, gauntlet, submitting, transitioning, choiceFrozen, round, submit, applyRefreshResult]);

  /**
   * "Dün izledin mi?" cevabı (C.4). Kart ANINDA kapanır — network sonucu
   * BEKLENMEZ (CTO şartı: "sonucu beklemeden normal akışa devam et, asla
   * bloklamaz"). Optimistic: başarısız olursa `watch_feedback` satırı hiç
   * yazılmaz, bir sonraki generate-gauntlet çağrısında soru KENDİLİĞİNDEN
   * yeniden görünür — veri kaybı yok, sessiz fallback değil, kendi kendini
   * onaran bir yol. Hata yalnızca Sentry'ye gider (kullanıcıya gösterilmez);
   * `silent_retry` etiketi bu sınıfı "kullanıcı etkilenmedi, otomatik
   * telafi var" olarak işaretler — Sentry'deki hata oranı taramasında
   * gürültüden ayıklanabilsin diye.
   */
  const handlePendingFeedback = useCallback(
    (response: WatchFeedbackResponse) => {
      const pending = gauntlet?.pendingWatchFeedback;
      setPendingFeedbackVisible(false);
      if (!pending) return; // savunma: kart yanlışlıkla pending olmadan gösterildiyse
      submitWatchFeedback(pending.gauntletId, pending.film.id, response).catch((err) => {
        Sentry.captureException(err, {
          tags: {
            component: 'GauntletShell',
            flow: 'pendingWatchFeedback',
            silent_retry: 'next_gauntlet_fetch',
          },
        });
      });
    },
    [gauntlet],
  );

  /**
   * ContextBar düzeltmesi (C.3, CTO kararı 16.08.2026). Fire-and-forget —
   * `handlePendingFeedback` ile aynı desen: bugünün ekranı zaten bundan
   * etkilenmez (idempotency korunur, `daily_gauntlets`'e dokunulmaz),
   * network sonucu beklemenin kullanıcıya bir faydası yok. Hata yalnızca
   * Sentry'ye gider — kullanıcı ContextBar'ı kapattığında "kaydedildi"
   * zaten optimistic gösterildi (§4.3 dürüstlük, kaybolan tekil bir
   * düzeltme yarının tahminini bozacak kritiklikte değil).
   */
  const handleContextCorrect = useCallback(
    (corrected: GauntletContext) => {
      if (!gauntlet) return;
      posthogAnalytics.track('context_changed', {
        gauntlet_id: gauntlet.gauntletId,
        context_companion: corrected.companion,
        context_duration: corrected.duration,
        context_energy: corrected.energy,
      });
      submitContextCorrection(gauntlet.gauntletId, corrected).catch((err) => {
        Sentry.captureException(err, {
          tags: {
            component: 'GauntletShell',
            flow: 'contextCorrection',
            silent_retry: 'none',
          },
        });
      });
    },
    [gauntlet],
  );

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
      if (!pair || !gauntlet || submitting || transitioning || choiceFrozen) return;
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
      // İzlenen film defender'sa sızma rengi elde kalan filme geçer
      // (submit-choice DAL 2: 'seen'de KAYBEDEN kalır). Değilse dokunulmaz.
      const retained = side === 'left' ? pair.right : pair.left;
      setDefenderFilm((prev) => (prev && prev.id === seenFilm.id ? retained : prev));
      applyRefreshResult(result, pair);
    },
    [pair, gauntlet, submitting, transitioning, choiceFrozen, round, submit, applyRefreshResult],
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

  // ── Şampiyon sonrası istemler (R-A-2) ──────────────────────────────────────

  /**
   * Auth prompt kapandı. "Not now" da giriş de AYNI bayrağı yazar
   * (CTO kararı, 22 Ağu 2026): sheet ömür boyu en fazla bir kez görünür.
   * Yazma başarısız olursa `markUserFlag` Sentry'ye yazar; sheet yine kapanır
   * — kullanıcının kapatma eylemi bir ağ hatasına rehin edilmez.
   */
  const handleAuthPromptClose = useCallback((completed: boolean) => {
    setChampionPrompt('none');
    void markUserFlag('auth_prompt_seen');
    posthogAnalytics.track('auth_prompt_closed', { completed });
  }, []);

  /**
   * Bildirim istemi kapandı. "Sorduk" işareti sheet'in kendi içinde
   * (cihaz-yerel AsyncStorage) yazılır — OS izni cihaz başınadır.
   */
  const handleNotificationPromptClose = useCallback(() => {
    setChampionPrompt('none');
  }, []);

  // ── Işık sızması ───────────────────────────────────────────────────────────

  /**
   * Sızmayı süren renk — DURUMA göre tek karar noktası.
   *   ready / in_progress → defender (çiftin rengi, §5 CTO kararı 15.08.2026)
   *   diğer tüm dallar    → renksiz (§5.2 fallback: 'ink')
   *
   * V-4 Tur A (V4-D3, kurucu onayı 29.09.2026): şampiyonda sızma KAPALI.
   * TestFlight 906'da şampiyon zemini film rengiyle belirgin lacivertleşiyor,
   * hero'nun `ink`'e biten geçişi bu tintli zeminde sert kenar bırakıyordu.
   * Şampiyon zemini artık saf `ink` — hero geçişiyle birebir. G11'in
   * zamanlama durumu (kara boşluk sonrası açılış) bununla birlikte kalktı;
   * renksiz dala geçişte `LightBleed` opaklığı animasyonsuz sıfırlar.
   */
  let bleedColor: OklchColor | undefined;
  if (shellState === 'ready' || shellState === 'in_progress') {
    bleedColor = defenderFilm?.dominantColor;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  /**
   * C.9b-UI G4b + G11 — TEK MERKEZİ KATMAN.
   *
   * Eskiden sekiz dalın her biri kendi `<View style={styles.root}>` + kendi
   * `<LightBleed/>`'ini kuruyordu. Beşi renksizdi, yani `ink` üstüne `ink`
   * boyayan NO-OP çağrılardı; altıncısı (champion) hiç yoktu ve Champion
   * ekranı §10.2'nin "sızma burada en güçlü" şartına rağmen düz siyahtı.
   *
   * Artık kabuk TEK yerde kuruluyor: dış root tam ekran (`ink` + sızma,
   * dolgusuz — ışık ekranın kenarına ULAŞIR), iç katman güvenli alan
   * dolgusunu taşır. `renderBody` yalnız İÇERİĞİ döndürür.
   *
   * Sekiz dala ayrı ayrı inset vermek sekiz ayrı hata yüzeyi olurdu; sızmayı
   * dolgulu bir katmanın içinde bırakmak da çentik ve home indicator
   * şeritlerini boyasız bırakır, tintli alanın bittiği yerde görünür bir
   * kenar üretirdi. İkisi aynı yapısal düzeltmeyle çözülüyor.
   */
  const renderBody = (): React.JSX.Element => {
  // C.4: normal akışın ÜSTÜNE biner, ShellState'e dahil DEĞİL (bkz. state
  // tanımı yorumu). Yanıtlanana/atlanana kadar altındaki ready/in_progress/
  // completed_today ekranı render edilmez — ama state olarak zaten hazırdır.
  if (pendingFeedbackVisible && gauntlet?.pendingWatchFeedback) {
    return (
      <PendingWatchFeedbackCard
        film={gauntlet.pendingWatchFeedback.film}
        onRespond={handlePendingFeedback}
      />
    );
  }

  if (shellState === 'before_18') {
    // V-1 Tur 6: metin + geri sayım. Arşiv, Pro Mode ve keşif rotası YOK
    // (K-46). V-2 Tur E1: koşullu bildirim CTA'sı. V1-D7 revizyonu
    // (30 Eyl 2026): sayacın altında son şampiyon — dokunulamaz, rota yok;
    // perdesi kökte (aşağıda), güvenli alanın dışına taşsın diye.
    return (
      <View style={styles.centerContent}>
        <Text style={styles.stateText}>
          {t('gauntlet.before18', { time: formatUnlockTime(language) })}
        </Text>
        {unlockAt && <UnlockCountdown target={unlockAt} onElapsed={runClockPulse} />}
        {waitingNotifyEligible && (
          <QuietAction
            label={t('gauntlet.waitingNotifyCta', { time: formatUnlockTime(language) })}
            onPress={() => void handleWaitingNotify()}
            disabled={waitingNotifyBusy}
          />
        )}
        {waitingChampion && <WaitingChampionCard champion={waitingChampion} />}
      </View>
    );
  }

  if (shellState === 'bootstrapping') {
    if (loadError) {
      // §15.2: hata özür dilemez, gerçek mesaj + tekrar dene. Sessiz boş
      // ekran ve kalıcı iskelet YASAK.
      return (
        <View style={styles.centerContent}>
          <Text style={styles.stateText}>{loadError}</Text>
          <QuietAction label={t('gauntlet.retry')} onPress={retryLoad} />
        </View>
      );
    }
    // Graphite iskelet (§10.1: spinner yok) — 401 penceresinde hata metni
    // GÖSTERİLMEZ, kullanıcıya normal yükleniyor hissi verilir.
    // V-3 Tur G1: iskelet ana dalın düzenini birebir izler — aynı `content`/
    // `header`/`middle` kapları, aynı yükseklikler (pill, tur göstergesi,
    // poster metin bloğu, soru, buton satırı). Veri gelince düzen kaymaz.
    return (
        <View style={[styles.content, { paddingTop: contentTopFor(windowHeight) }]}>
          <View style={styles.header}>
            <SkeletonLoader width="100%" height={size.touchTarget} borderRadius={radius.pill} />
            <SkeletonLoader width={space.xxl} height={ROUND_INDICATOR_HEIGHT} />
          </View>
          <View style={[styles.middle, { marginTop: headerGapFor(windowHeight) }]}>
            <View style={styles.posterRow}>
              {(['left', 'right'] as const).map((side) => (
                <View key={side} style={styles.posterSlot}>
                  <View style={styles.skeletonPosterFrame}>
                    <SkeletonLoader
                      width="100%"
                      height={1}
                      borderRadius={radius.poster}
                      style={styles.skeletonPoster}
                    />
                  </View>
                  <View style={styles.skeletonMetaBlock}>
                    <SkeletonLoader width="70%" height={type.filmTitle.lineHeight} />
                  </View>
                </View>
              ))}
            </View>
            <View style={styles.skeletonQuestion}>
              <SkeletonLoader width="60%" height={type.callout.lineHeight} />
            </View>
            <View style={styles.actions}>
              <View style={styles.skeletonAction}>
                <SkeletonLoader width="100%" height={size.touchTarget} borderRadius={radius.pill} />
              </View>
              <View style={styles.skeletonAction}>
                <SkeletonLoader width="100%" height={size.touchTarget} borderRadius={radius.pill} />
              </View>
            </View>
          </View>
        </View>
    );
  }

  if (shellState === 'completed_today') {
    if (champion) {
      return (
        <>
          {/* K-42 (C.9b-UI): bayat gosterge Champion dalinda da gorunur.
              Onceden YALNIZ ana dalda vardi; cevrimdisiyken onbellekten
              DUNUN champion'i geldiginde kullanici "bu bugunun listesi degil"
              uyarisini hic gormuyordu ve dunun filmini bugunun filmi
              saniyordu. Mevcut gosterge yeniden kullanildi, yeni string yok. */}
          {/* V-2 Tur B: şampiyon bloğu KAYDIRILABİLİR.
              V-3 Tur G2 (C8): alt dolgu = `tabBarInset` + boşluk — içerik
              tab bar'ın arkasından geçer, en alttaki öğe (Spotlight) bar'ın
              ÜSTÜNDE durur. `insetLayer` bu dalda dolgusuz. */}
          <ScrollView
            style={styles.championScroll}
            contentContainerStyle={[
              styles.championScrollContent,
              { paddingBottom: tabBarInset + space.lg },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <ChampionReveal
              champion={champion}
              animateReveal={animateReveal}
              onDismiss={onDismiss}
              date={gauntlet?.date}
              rounds={shareRounds}
              gauntletId={gauntlet?.gauntletId}
              cycle={cycleModeRef.current}
            />

            {/* K-46: ritüel bittikten SONRA arşiv teklifi. Oyun mantığına
                dokunmaz — kendi durumunu kendi sorar, hiçbir prop almaz. */}
            <ArchiveTrigger />

            {/* C.9b-UI C4 (IA §2.6): "Bugünün bonusu" — Spotlight'ın TEK giriş
                noktası. Ayrı hub yok. §7.1: bonus ritüelin ÇIKIŞINDA durur.
                V-3 Tur G2 (C7, V3-D6): yüzen/mutlak konum kaldırıldı —
                kaydırılabilir içeriğin SONUNDA satır içi. Görünme koşulu
                aynı: şampiyon varsa. */}
            <View style={styles.bonusCardInline}>
              <SpotlightBonusCard />
            </View>
          </ScrollView>

          {/* K-42 (C.9b-UI): bayat gösterge — V-3 Tur G2'den beri hero'nun
              ÜSTÜNDE sabit, güvenli alanın hemen altında (hero durum
              çubuğunun altına uzandığı için kaydırma içinde kaybolurdu). */}
          {isStale && (
            <View style={[styles.championStaleOverlay, { top: insets.top }]} pointerEvents="none">
              <Text style={styles.championStaleNotice}>{t('gauntlet.offlineStale')}</Text>
            </View>
          )}

          {/* R-A-2: şampiyonun ÜSTÜNE binen tek-seferlik istem. Akşam başına
              en fazla biri açılır — kararı resolveChampionPrompt() verir. */}
          <AuthPromptSheet
            visible={championPrompt === 'auth'}
            onClose={handleAuthPromptClose}
          />
          <NotificationPromptSheet
            visible={championPrompt === 'notification'}
            onClose={handleNotificationPromptClose}
          />

          {/* G4b: native tab bar payının saha ölçümü — görsel çıktısı yok,
              düzeni değiştirmez. Karar verisi gelince kaldırılır. */}
          <TabBarInsetTelemetry />
        </>
      );
    }
    return (
        <View style={styles.centerContent}>
          <Text style={styles.stateText}>{t('gauntlet.exhausted')}</Text>
          {onDismiss && (
            <QuietAction label={t('gauntlet.dismissTomorrow')} onPress={onDismiss} />
          )}
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
        <View style={styles.centerContent}>
          <Text style={styles.stateText}>{t('gauntlet.loadError')}</Text>
          <QuietAction label={t('gauntlet.retry')} onPress={retryLoad} />
        </View>
    );
  }

  const outOfRefreshes = refreshesRemaining === 0; // -1 = sınırsız (Pro)
  /** V-4 Tur B: iki başlık da ölçüldüyse büyüğü; yoksa doğal yükseklik. */
  const leftTitleLines = titleLinesById[pair.left.id];
  const rightTitleLines = titleLinesById[pair.right.id];
  const rowTitleLines: PosterTitleLines | undefined =
    leftTitleLines !== undefined && rightTitleLines !== undefined
      ? leftTitleLines === 2 || rightTitleLines === 2
        ? 2
        : 1
      : undefined;
  /** K-42: kuyrukta bekleyen seçim varken tüm oyun etkileşimleri kilitli. */
  const interactionsLocked = submitting || transitioning || choiceFrozen;

  return (
      <View style={[styles.content, { paddingTop: contentTopFor(windowHeight) }]}>
        <View style={styles.header}>
          <ContextBar context={gauntlet.context} onCorrect={handleContextCorrect} />
          {/* C.9b-UI G1 (D-06 · L-7): güven yüzdesi Gauntlet'ten KALDIRILDI.
              "%0 tanıyorum" ilk günlerde doğrulanabilir biçimde yanlış bir
              iddiaydı ve ürünün tüm zekâ savını tek hamlede çürütüyordu.
              `ConfidenceMeter` bileşeni ve `gauntlet.confidence` stringi
              SİLİNMEDİ — D-06 eşiği (≥7 tamamlanmış gauntlet) uygulandıktan
              sonra DNA/Profile yüzeyinde kullanılacak. */}
          <RoundIndicator current={round} />
        </View>

        {/* K-42: gösterilen liste bugünün değil (yerel kopya). Özür yok,
            durum bildirilir — §15.2. */}
        {isStale && <Text style={styles.offlineNotice}>{t('gauntlet.offlineStale')}</Text>}

        {/* C.9b-UI G4: film bloğu + soru + eylemler tek grup halinde.
            V-2 Tur C: grup header'ın hemen altına yaslanır (boşluk
            headerGapFor); artan alan eylemlerin altında kalır. */}
        <View style={[styles.middle, { marginTop: headerGapFor(windowHeight) }]}>
        <View style={styles.posterRow}>
          <View style={styles.posterSlot}>
            <PosterTile
              key={pair.left.id}
              film={pair.left}
              disabled={interactionsLocked}
              animationState={tileStates.left}
              onPress={() => handlePosterPress('left')}
              titleLines={rowTitleLines}
              onTitleLines={(lines) => reportTitleLines(pair.left.id, lines)}
            />
          </View>
          <View style={styles.posterSlot}>
            <PosterTile
              key={pair.right.id}
              film={pair.right}
              disabled={interactionsLocked}
              animationState={tileStates.right}
              onPress={() => handlePosterPress('right')}
              titleLines={rowTitleLines}
              onTitleLines={(lines) => reportTitleLines(pair.right.id, lines)}
            />
          </View>
        </View>

        <Text style={styles.question}>
          {seenMode ? t('gauntlet.seenPrompt') : t('gauntlet.question')}
        </Text>

        {/* K-42 dondurma: seçim kuyrukta. Hata DEĞİL — bekleyen bir durum,
            o yüzden actionError'dan ayrı stil ve ayrı metin. */}
        {choiceFrozen && (
          <Text style={styles.pendingNotice}>{t('gauntlet.choicePending')}</Text>
        )}

        {actionError !== null && <Text style={styles.actionError}>{actionError}</Text>}

        {/* V-3 Tur G1 (G6): metin bağlantıları → iki eşit genişlikte
            kenarlıklı buton. Koşullar, disabled kuralları ve işleyiciler
            AYNEN korunur; yalnız görünüm değişti. İpucu satırı (V-2 Tur A,
            `actionError`) yukarıda, butonların üstünde kalır. */}
        <View style={styles.actions}>
          {seenMode ? (
            <OutlineAction label={t('gauntlet.cancel')} onPress={handleSeenToggle} />
          ) : (
            <>
              <OutlineAction
                label={t('gauntlet.rejectNeither')}
                onPress={() => void handleNeither()}
                disabled={interactionsLocked || outOfRefreshes || editorialRefreshBlocked}
              />
              <OutlineAction
                label={t('gauntlet.markWatched')}
                onPress={handleSeenToggle}
                disabled={interactionsLocked}
              />
            </>
          )}
        </View>
        {/* Hak bitince "Boşver, yarın" — eskiden satırın üçüncü bağlantısıydı;
            iki eşit buton düzeninde altta metin bağlantısı olarak kalır. */}
        {!seenMode && outOfRefreshes && onDismiss && (
          <View style={styles.dismissRow}>
            <QuietAction label={t('gauntlet.dismissTomorrow')} onPress={onDismiss} />
          </View>
        )}
        </View>
      </View>
  );
  };

  /**
   * V-3 Tur G2: şampiyon görünümü dolgusuz — hero durum çubuğunun altına
   * kadar uzanır (C1, kurucu kararı) ve kaydırma içeriği tab bar'ın
   * arkasından geçer; alt pay kaydırma içeriğinin kendi dolgusunda (C8).
   * SALT DÜZEN — hangi dalın çizildiği yine `renderBody`'nin kararı.
   */
  const isChampionView = shellState === 'completed_today' && champion !== null;

  return (
    <View style={styles.root}>
      {/* Sızma dolgusuz katmanda — ışık ekranın kenarına ulaşır (§5.1). */}
      <LightBleed dominantColor={bleedColor} />
      {/* V1-D7 revizyonu: bekleyiş perdesi dolgusuz katmanda — ekran kenarına ulaşır. */}
      {shellState === 'before_18' && waitingChampion?.posterUrl && (
        <WaitingCurtain posterUrl={waitingChampion.posterUrl} />
      )}
      <View
        style={[
          styles.insetLayer,
          // V-2 Tur B: alt pay tab bar DAHİL (`useTabBarInset`) — şampiyon
          // dışındaki dallar bu tek dolguyu miras alır. Üst pay pencere güvenli alanı.
          isChampionView
            ? null
            : { paddingTop: insets.top, paddingBottom: tabBarInset },
        ]}
      >
        {renderBody()}
      </View>
    </View>
  );
}
