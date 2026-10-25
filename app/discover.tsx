/**
 * Discover ekrani — Sonlu deste (8 film) swipe modeli.
 *
 * Stack screen olarak calisir: Home'dan mood search sonrasi acilir.
 *
 * Mimari:
 *   1. useFeedManager: 8 film yukler (quality-gated, archive-free)
 *   2. Kart kart swipe: saga = begendim (watchlist'e ekle), sola = gectim
 *   3. Ust bar: "3 / 8" ilerleme gostergesi
 *   4. Deste bitince: MoodDeckSummary ozet ekrani
 *
 * Sonsuz scroll KALDIRILDI — sonlu, kaliteli deste modeli.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp } from 'react-native-reanimated';
import { hapticSuccess } from '@/utils/haptics';
import { useScalePress } from '@/hooks/useScalePress';

import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeableCard } from '@/components/SwipeCard/SwipeableCard';
import MoodDeckSummary from '@/components/MoodDeckSummary';
import MoodLockCard from '@/components/MoodLockCard';
import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { useFreeVisibleCount } from '@/hooks/useFreeVisibleCount';
import { useMoodOfferEnabled } from '@/hooks/useMoodOfferEnabled';
import { useProModeAccess } from '@/hooks/useProModeAccess';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useFeedManager } from '@/hooks/useFeedManager';
import { checkAndConsumeQuota } from '@/services/quotaEngine';
import { addToWatchlist, getAppUserId } from '@/services/watchlist';
import { Film } from '@/types/film';
import { FilmFilters } from '@/types';
import { readAppUserId } from '@/services/auth-utils';
import { getLastFullPrompt, getSearchAnalyticsContext, setPendingMoodText } from '@/services/moodSearchState';
import { saveTodayDeck } from '@/services/todayDeckStore';
import { posthogAnalytics } from '@/services/posthog';
import { tasteSignals } from '@/services/tasteSignalService';
import { flushUserVectorUpdates } from '@/services/userProfile';
import * as Sentry from '@sentry/react-native';
import { logger } from '@/utils/logger';
import { deckStartedProps, deckViewEventName, moodEventCore, shouldEmitDeckUnlocked } from '@/utils/moodAnalytics';
import { buildDeckItems, deriveLockState, hidesBeyondFree, progressCounter } from '@/utils/moodLock';
import { isFreeSearchDeckSlotExempt } from '@/utils/moodOfferTiming';
import { createTodayDeckSnapshot } from '@/utils/todayDeck';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT;

/**
 * `mood_deck_unlocked` zaten yayinlanan aramalar. Modul seviyesinde: ekran yeniden mount
 * olsa da `search_id` basina en fazla bir kez (analitik defteri, bayrak degeri DEGIL).
 */
const unlockedDeckKeys = new Set<string>();

const DEFAULT_FILTERS: FilmFilters = {
  yearRange: null,
  minRating: null,
  regions: [],
  directors: [],
};

// ── Ana Ekran ────────────────────────────────────────────────────────────────

/**
 * Discover stack ekrani — sonlu deste swipe.
 * MoodContext'ten profil okur; tek tek kart swipe ile filmler gosterilir.
 * Deste bitince MoodDeckSummary ozet ekranina gecer.
 */
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { currentProfile, currentFilters, setMoodResult, clearMood, addLastSessionFilm, currentSessionId, searchMode, lastSearchId, lastMoodText } = useMood();
  const { premiumStatus } = useSubscription();
  /** Grandfathered kohort slot kota duvarina tabi degil — bkz. useProModeAccess */
  const { quotaExempt, allowed: proEntitled, loading: proAccessLoading } = useProModeAccess();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';
  const offerEnabled = useMoodOfferEnabled();
  const slotExemptFreeDeck = isFreeSearchDeckSlotExempt({ offerEnabled, isOnboarding });
  const freeVisible = useFreeVisibleCount();
  /** Ortak analitik cekirdegi — her cagrida guncel degerleri okur (ref: efekt bagimliligi yaratmaz). */
  const analyticsCoreRef = useRef<() => ReturnType<typeof moodEventCore>>(() =>
    moodEventCore({ searchId: null, entryPoint: null, isPro: false, consent: null }),
  );
  /** Gizli posterler yetki okunurken de indirilmez: sinir `entitled` kesinlesene kadar uygulanir. */
  const prefetchCap = hidesBeyondFree({ offerEnabled, isOnboarding, entitled: proEntitled })
    ? freeVisible
    : undefined;

  const navigateAfterOnboarding = useCallback(() => {
    if (isOnboarding) router.replace('/(tabs)' as never);
  }, [isOnboarding, router]);

  const { triggerPaywall, paywallProps: rawPaywallProps } = useContextualPaywall(navigateAfterOnboarding);
  /** Slot quota tükendi — deck donduruldu, swipe bloklanır */
  const [deckFrozen, setDeckFrozen] = useState(false);
  const paywallProps = useMemo(() => ({
    ...rawPaywallProps,
    onDismiss: () => {
      rawPaywallProps.onDismiss();
      // Slot quota tükendiyse veya onboarding'deyse: discover'dan çık
      if (deckFrozen || isOnboarding) {
        clearMood();
        router.replace('/(tabs)' as never);
      }
    },
    // Satın alma tamamlandı: deste çözülür, geri yaylanan üst kart yeniden
    // kaydırılabilir (aksi halde kalıcı donmuş kalırdı).
    onConvert: (plan: Parameters<typeof rawPaywallProps.onConvert>[0]) => {
      rawPaywallProps.onConvert(plan);
      setDeckFrozen(false);
    },
  }), [rawPaywallProps, isOnboarding, deckFrozen, clearMood, router]);

  const effectiveFilters = currentFilters ?? DEFAULT_FILTERS;

  const {
    films: managerFilms,
    isLoading,
    deckReranked,
    hasError,
    errorType,
    retryLoad,
    resetFeed,
    onSwipeFilm,
  } = useFeedManager(currentProfile, effectiveFilters, prefetchCap);

  /** Kullanıcı puan ve/veya dönem filtresi seçti mi (boş durum + bilgi satırı) */
  const filtersActive = effectiveFilters.yearRange !== null || effectiveFilters.minRating !== null;

  // ── Deck state ─────────────────────────────────────────────────────────────

  /** Full deck — managerFilms'in ilk yuklemesinden snapshot alinir */
  const [deck, setDeck] = useState<Film[]>([]);
  /** Index: su an goruntulenen kart */
  const [currentIndex, setCurrentIndex] = useState(0);
  /** Begenilen filmler (saga swipe) */
  const [likedFilms, setLikedFilms] = useState<Film[]>([]);
  /** Begenilmeyen filmler (sola swipe) */
  const [dislikedFilms, setDislikedFilms] = useState<Film[]>([]);
  /** Deste bitti mi */
  const [deckComplete, setDeckComplete] = useState(false);
  /** insufficient_results flag (backend'den) */
  const [insufficientResults, setInsufficientResults] = useState(false);
  /** Watchlist toast */
  const [showSaveToast, setShowSaveToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Deck snapshot alinip alinmadigi */
  const deckSnapshotTaken = useRef(false);

  // Deck snapshot: ilk batch gelince deste'yi al, sonra degistirme
  useEffect(() => {
    if (managerFilms.length > 0 && !deckSnapshotTaken.current) {
      deckSnapshotTaken.current = true;
      setDeck(managerFilms);
      const { submittedAt } = getSearchAnalyticsContext();
      posthogAnalytics.track(deckViewEventName(getSearchAnalyticsContext().resumed), {
        // Siralı film id'leri (ilk 8) + deste boyutu; kullanici metni YOK.
        ...deckStartedProps(managerFilms),
        search_mode: searchMode,
        ...(submittedAt != null ? { ms_since_submit: Date.now() - submittedAt } : {}),
        ...analyticsCoreRef.current(),
      });
    }
  }, [managerFilms, searchMode]);

  // ── MONEY-1C P0: bugunku deste kurtarma — YALNIZ cihaza yazilir (bayrak arkasinda) ──
  // Deste snapshot'i sabit (bir kez alinir): burada da bir kez kaydedilir. Mood metni
  // yalniz yerel depoda kalir; sunucuya ve analitige gitmez.
  useEffect(() => {
    if (!offerEnabled || isOnboarding || searchMode !== 'ai') return;
    if (!lastSearchId || !lastMoodText || !currentProfile || deck.length === 0) return;
    let active = true;
    void (async () => {
      const ownerId = await readAppUserId();
      if (!ownerId || !active) return;
      await saveTodayDeck(
        createTodayDeckSnapshot({
          now: new Date(),
          ownerId,
          searchId: lastSearchId,
          moodText: lastMoodText,
          profile: currentProfile,
          filters: effectiveFilters,
          films: deck,
        }),
      );
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, offerEnabled]);

  // ── Kullanıcı vektörü: kuyruğa alınan sağ kaydırmalar tek seferde yazılır (PERF-1) ──
  // Çıkış yolları: deste bitti · ekran odağı kaybı/unmount (geri, sekme, yeni mood,
  // watchlist, onboarding replace) · uygulama arka plana gitti.
  useEffect(() => {
    if (deckComplete) void flushUserVectorUpdates();
  }, [deckComplete]);

  useFocusEffect(
    useCallback(() => {
      const sub = AppState.addEventListener('change', (next) => {
        if (next !== 'active') void flushUserVectorUpdates();
      });
      return () => {
        sub.remove();
        void flushUserVectorUpdates();
      };
    }, []),
  );

  // ── Current film ────────────────────────────────────────────────────────────

  const deckSize = deck.length;
  // MONEY-1C kilit: TURETILMIS deger (dinleyici yok) — premiumStatus/yetki degisince
  // kendiliginden acilir. `total` kalite suzgecinden sonraki GERCEK deste uzunlugu.
  const lock = deriveLockState({
    offerEnabled,
    isOnboarding,
    accessLoading: premiumStatus === 'loading' || proAccessLoading,
    entitled: proEntitled,
    total: deckSize,
    freeVisible,
  });
  const deckItems = buildDeckItems(deck, lock);
  analyticsCoreRef.current = () => {
    const ctx = getSearchAnalyticsContext();
    return moodEventCore({
      searchId: lastSearchId,
      entryPoint: ctx.entryPoint,
      isPro: proEntitled,
      consent: ctx.consent,
    });
  };
  const progress = progressCounter({ currentIndex, total: deckSize, lock });
  /** Yigin: [ust, alttaki]. Son kartta alttaki yoktur. */
  const currentItem = deckItems[currentIndex] ?? null;
  const nextItem = deckItems[currentIndex + 1] ?? null;
  const stackItems = currentItem ? (nextItem ? [currentItem, nextItem] : [currentItem]) : [];

  // ── Advance to next card ────────────────────────────────────────────────────

  const advanceToNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    // Kilitli destede son ucretsiz kartin ardindan kilit karti gelir: deste BITMEZ.
    if (nextIndex >= deckItems.length) {
      setDeckComplete(true);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, deckItems.length]);

  // ── Swipe handlers ──────────────────────────────────────────────────────────

  const handleSwipeRight = useCallback(
    async (film: Film) => {
      // ── Slot quota kontrolü (free users) — gate BEFORE advancing ──────
      // `quotaExempt`: grandfathered kohort (legacy_mood_access) duvara tabi
      // degil. Slot kotasi YALNIZ istemcide zorlaniyor, bu yuzden burada
      // atlamak gercekten sinirsiz slot demektir (CTO karari 24 Eyl 2026).
      // `loading` premium SAYILMAZ: slot kotasi yalniz istemcide zorlaniyor,
      // abonelik cozulmeden atlamak bedava slot demek (fail-closed, V-1 Tur 1).
      // MONEY-1C (C8): ucretsiz arama destesinde slot kotasi MUAF — kaydetme kesilmez
      // (bayrak kapaliyken `slotExemptFreeDeck` false → eski davranis).
      if (premiumStatus !== 'premium' && !quotaExempt && !slotExemptFreeDeck) {
        try {
          const uid = await getAppUserId();
          if (uid) {
            const quota = await checkAndConsumeQuota(uid, 'slot');
            if (!quota.allowed) {
              // Kota tükendi — deck'i dondur, paywall göster
              tasteSignals.recordSwipeRight(film.id).catch(() => {});
              setDeckFrozen(true);
              triggerPaywall({ type: 'quota_exhausted', quota: 'slot' });
              return; // Kart ilerlemez, watchlist'e yazılmaz
            }
          }
        } catch (err) {
          // Fail-open: quota kontrolü başarısız olursa devam et
          Sentry.captureException(err, {
            tags: { action: 'swipe_right_quota_check' },
            extra: { filmId: film.id },
          });
        }
      }

      // ── Quota geçti — kart ilerler, watchlist arka planda yazılır ──────
      advanceToNext();
      setLikedFilms((prev) => [...prev, film]);
      addLastSessionFilm(film);
      onSwipeFilm(film, 'right');

      // Toast
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setShowSaveToast(true);
      toastTimer.current = setTimeout(() => setShowSaveToast(false), 1200);

      // Watchlist yazma — arka planda, kullanıcıyı bloklamaz.
      // Servis katmanı hatayı WATCHLIST_ADD_FAILED ile Sentry'ye yazıyor;
      // burada tekrar raporlamak aynı hata için ikinci event üretirdi.
      addToWatchlist(film, currentSessionId, { deferVectorUpdate: true }).catch((err) => {
        logger.warn('[discover] watchlist yazma basarisiz:', err);
      });
    },
    [premiumStatus, quotaExempt, slotExemptFreeDeck, onSwipeFilm, addLastSessionFilm, triggerPaywall, advanceToNext, currentSessionId],
  );

  const handleSwipeLeft = useCallback(
    (film: Film) => {
      // ── Optimistic UI: kart hemen ilerler ──────────────────────────────
      advanceToNext();
      setDislikedFilms((prev) => [...prev, film]);
      onSwipeFilm(film, 'left');
      tasteSignals.recordSwipeLeft(film.id).catch(() => {});
    },
    [onSwipeFilm, advanceToNext],
  );

  // ── Kilit karti CTA'si ─────────────────────────────────────────────────────
  // Paywall kapaninca kilit kartinda KALINIR (paywallProps.onDismiss cikis yapmaz) —
  // deste kaybolmaz. Satin alma premiumStatus'u degistirince kilit kendiliginden acilir.
  const handleLockCta = useCallback(() => {
    posthogAnalytics.track('mood_lock_tapped', {
      ...moodEventCore({ searchId: lastSearchId, entryPoint: 'lock_card', isPro: proEntitled, consent: getSearchAnalyticsContext().consent }),
      visible_count: freeVisible,
      total: deckSize,
    });
    void triggerPaywall({ type: 'mood_offer', entry: 'lock_card', searchId: lastSearchId });
  }, [triggerPaywall, lastSearchId, proEntitled, freeVisible, deckSize]);

  // ── Kilit analitigi ────────────────────────────────────────────────────────
  const instanceId = useRef(String(Date.now())).current;
  const unlockKey = lastSearchId ?? `deck-${instanceId}`;

  /** Kilit karti ekranin ustune geldiginde bir kez. */
  const lockShown = currentItem?.kind === 'lock';
  useEffect(() => {
    if (!lockShown) return;
    posthogAnalytics.track('mood_lock_viewed', {
      ...analyticsCoreRef.current(),
      entry_point: 'lock_card',
      visible_count: freeVisible,
      total: deckSize,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockShown]);

  /**
   * Kilitli deste premiumStatus gecisiyle (restore dahil) acildiginda, search_id basina bir kez.
   * Turetilmis kilit degerinin `locked` → `open` gecisi; baska nedenle (bayrak, onboarding) acilmaz.
   */
  const prevLockKind = useRef<typeof lock.kind | null>(null);
  useEffect(() => {
    if (
      shouldEmitDeckUnlocked({
        prevKind: prevLockKind.current,
        kind: lock.kind,
        entitled: proEntitled,
        key: unlockKey,
        emitted: unlockedDeckKeys,
      })
    ) {
      unlockedDeckKeys.add(unlockKey);
      posthogAnalytics.track('mood_deck_unlocked', {
        ...analyticsCoreRef.current(),
        entry_point: 'lock_card',
        visible_count: freeVisible,
        total: deckSize,
      });
    }
    prevLockKind.current = lock.kind;
  }, [lock.kind, proEntitled, unlockKey, freeVisible, deckSize]);

  // ── Navigation helpers ──────────────────────────────────────────────────────

  const { animatedStyle: newMoodAnimStyle, onPressIn: newMoodPressIn, onPressOut: newMoodPressOut } =
    useScalePress(0.95);

  const handleNewMood = useCallback(() => {
    clearMood();
    router.navigate('/(tabs)');
  }, [clearMood, router]);

  /**
   * Yığın [(tabs), discover]: dismissTo mevcut (tabs) kaydına geri çeker, ikinci
   * bir (tabs) örneği açmaz. Mood temizlenmez (handleNewMood'dan farkı bu).
   */
  const handleClose = useCallback(() => {
    router.dismissTo('/(tabs)');
  }, [router]);

  /**
   * "Filtreleri kaldır": KOTA HARCAMAZ — parse-mood çağrılmaz. Mevcut profil filtresiz
   * `getRecommendations` ile yeniden aranır; rerank için son mood metni geri konur.
   */
  const handleRemoveFilters = useCallback(() => {
    if (!currentProfile) return;
    posthogAnalytics.track('mood_filters_removed', {
      filter_min_rating: effectiveFilters.minRating ?? null,
      filter_era: effectiveFilters.yearRange ?? null,
    });
    // Rerank tam prompt'la calisir; etiket (lastMoodText) yalniz ekranda gorunen metindir.
    const rerankText = getLastFullPrompt() ?? lastMoodText;
    if (rerankText) setPendingMoodText(rerankText);
    setMoodResult(currentProfile, DEFAULT_FILTERS);
    deckSnapshotTaken.current = false;
    setDeck([]);
    setCurrentIndex(0);
    setLikedFilms([]);
    setDislikedFilms([]);
    setDeckComplete(false);
    resetFeed(currentProfile, DEFAULT_FILTERS);
  }, [currentProfile, effectiveFilters, lastMoodText, setMoodResult, resetFeed]);

  const handleGoWatchlist = useCallback(() => {
    router.navigate('/(tabs)/profile' as never);
  }, [router]);

  // ── Deck summary ────────────────────────────────────────────────────────────

  if (deckComplete) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <MoodDeckSummary
          likedFilms={likedFilms}
          dislikedFilms={dislikedFilms}
          deckSize={deckSize}
          analyticsCore={analyticsCoreRef.current()}
          insufficientResults={insufficientResults || deckSize < 8}
          reranked={deckReranked}
          onNewMood={handleNewMood}
          onGoWatchlist={handleGoWatchlist}
          onClose={handleClose}
        />
        <ContextualPaywall {...paywallProps} />
      </View>
    );
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (isLoading && deck.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <View style={styles.skeletonCard}>
          <SkeletonLoader width="100%" height={CARD_HEIGHT * 0.65} borderRadius={0} />
          <View style={styles.skeletonInfo}>
            <SkeletonLoader width="70%" height={24} borderRadius={6} />
            <SkeletonLoader width="50%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
          </View>
        </View>
      </View>
    );
  }

  // ── Filtreyle 0 sonuç: boş durum + filtresiz yeniden arama ──────────────────

  if (hasError && errorType === 'empty' && deck.length === 0 && filtersActive) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <EmptyState
          lumiMood="searching"
          title={t('discover.noFilterMatchTitle')}
          actionLabel={t('discover.removeFilters')}
          onAction={handleRemoveFilters}
        />
      </>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (hasError && deck.length === 0) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <ErrorState errorType={errorType} onRetry={retryLoad} />
      </>
    );
  }

  // ── Empty state (0 films) ──────────────────────────────────────────────────

  if (!isLoading && deck.length === 0) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <EmptyState
          lumiMood="searching"
          title={t('discover.emptyTitle')}
          subtitle={t('discover.tryNewMoodSubtitle')}
          actionLabel={t('discover.newMoodButton')}
          onAction={handleNewMood}
        />
      </>
    );
  }

  // ── Active deck ────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      {/* 2 kartlik yigin: ust kart etkilesimli, alttaki (index+1) yalniz cizilir.
          Katman key'i DESTE SIRASINA bagli (currentIndex + i): ilerleyince alttaki
          kartin katmani ayni key ile uste gecer — React ayni ornegi tasir, remount
          yok (poster yuklu, shared value'lar yerinde). deckFrozen olunca gesture
          bloklanir. */}
      {currentItem && (
        <View
          style={{ height: CARD_HEIGHT }}
          pointerEvents={deckFrozen ? 'none' : 'auto'}
        >
          {stackItems.map((item, i) => (
            <View
              key={`deck-${currentIndex + i}`}
              style={[styles.deckLayer, i === 0 ? styles.deckLayerFront : styles.deckLayerBack]}
            >
              {item.kind === 'film' ? (
                <SwipeableCard
                  film={item.film}
                  height={CARD_HEIGHT}
                  bottomOffset={insets.bottom + 80}
                  onSwipeRight={handleSwipeRight}
                  onSwipeLeft={handleSwipeLeft}
                  interactive={i === 0}
                  frozen={deckFrozen}
                />
              ) : (
                <MoodLockCard
                  variant={item.kind === 'lock' ? 'lock' : 'skeleton'}
                  visible={item.kind === 'lock' ? item.visible : freeVisible}
                  total={item.kind === 'lock' ? item.total : deckSize}
                  height={CARD_HEIGHT}
                  bottomOffset={insets.bottom + 80}
                  interactive={i === 0}
                  onPressCta={handleLockCta}
                />
              )}
            </View>
          ))}
        </View>
      )}

      {/* Deck progress indicator — top bar */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.progressBar, { top: insets.top + 12 }]}
        pointerEvents="none"
      >
        <Text style={styles.progressText}>
          {t('deckSummary.deckProgress', {
            current: progress.current,
            total: progress.total,
          })}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(progress.current / progress.total) * 100}%` },
            ]}
          />
        </View>
        {filtersActive && deckSize > 0 && deckSize < 8 && (
          <Text style={[styles.progressText, styles.filterInfoText]}>
            {t('discover.filterMatchCount', { count: deckSize })}
          </Text>
        )}
      </Animated.View>

      {/* New mood button — top right */}
      <Animated.View
        style={[styles.newMoodBtn, { top: insets.top + 12 }, newMoodAnimStyle]}
      >
        <TouchableOpacity
          onPressIn={newMoodPressIn}
          onPressOut={newMoodPressOut}
          onPress={handleNewMood}
          activeOpacity={1}
        >
          <Ionicons name="close" size={20} color={Colors.textWhite} />
        </TouchableOpacity>
      </Animated.View>

      {/* Watchlist toast */}
      {showSaveToast && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.toast}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
          <Text style={styles.toastText}>{t('discover.savedToWatchlist')}</Text>
        </Animated.View>
      )}

      <ContextualPaywall {...paywallProps} />
    </View>
  );
}

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Kart yigini ────────────────────────────────────────────────────────────
  deckLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  deckLayerFront: {
    zIndex: 2,
  },
  deckLayerBack: {
    zIndex: 1,
  },

  // ── Skeleton ───────────────────────────────────────────────────────────────
  skeletonCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
  },
  skeletonInfo: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // ── Progress bar ────────────────────────────────────────────────────────────
  progressBar: {
    position: 'absolute',
    left: 16,
    right: 60,
    zIndex: 10,
  },
  progressText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  // progressText ile birlikte kullanılır (renk + gölge oradan gelir)
  filterInfoText: {
    fontSize: 13,
    fontWeight: '400',
    marginTop: 8,
    marginBottom: 0,
  },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 3,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },

  // ── New mood (close) button ─────────────────────────────────────────────────
  newMoodBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(10,10,10,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },

  // ── Watchlist toast ─────────────────────────────────────────────────────────
  toast: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.overlay,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.goldDim,
    gap: 8,
    zIndex: 20,
  },
  toastText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '500',
  },
});
