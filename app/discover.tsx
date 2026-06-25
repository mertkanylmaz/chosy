/**
 * Discover ekranı — TikTok+Tinder hibrit film keşfi.
 *
 * Stack screen olarak çalışır: Home'dan veya Mood → "Browse Movies"
 * üzerinden açılır. Geri tuşu / gesture ile önceki ekrana döner.
 *
 * Mimari:
 * - FlatList: dikey snap scroll (TikTok tarzı sayfa geçişi)
 * - SwipeableCard: her kart kendi yatay swipe mekanizmasını yönetir (Tinder)
 * - Gesture çakışması yok: failOffsetY + activeOffsetX ile ayrılmış
 *
 * Film Yönetimi:
 * - useFeedManager: API yüklemesi, exclude_ids, faz geçişleri
 * - displayFilms (local state): swipe edilen filmler filter() ile çıkarılır
 * - Yükleme tetikleyici: displayFilms.length <= 3 → onLoadMore()
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewToken,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp } from 'react-native-reanimated';
import { hapticSuccess } from '@/utils/haptics';
import { useScalePress } from '@/hooks/useScalePress';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeableCard } from '@/components/SwipeCard/SwipeableCard';
import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import MilestoneCelebration from '@/components/Gamification/MilestoneCelebration';
import type { MilestoneCelebrationProps } from '@/components/Gamification/MilestoneCelebration';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useFeedManager } from '@/hooks/useFeedManager';
import {
  getUnseenMilestones,
  getStreakInfo,
  markMilestoneSeen,
} from '@/services/gamification';
import { isWatchlistFull, isStreakMilestone } from '@/services/conversion';
import { checkAndConsumeQuota } from '@/services/quotaEngine';
import { addToWatchlist, getAppUserId } from '@/services/watchlist';
import type { UserMilestone } from '@/services/gamification';
import { Film } from '@/types/film';
import { FilmFilters } from '@/types';
import { posthogAnalytics } from '@/services/posthog';
import { tasteSignals } from '@/services/tasteSignalService';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Tab bar olmadığı için ekranın tamamını kullan */
const CARD_HEIGHT = SCREEN_HEIGHT;

/** Filtreler seçilmemişse varsayılan */
const DEFAULT_FILTERS: FilmFilters = {
  yearRange: null,
  minRating: null,
  regions: [],
  directors: [],
};

/** Kalan film sayisi bu eşigin altina düşünce yeni batch yükle */
const LOAD_MORE_THRESHOLD = 3;

/** Sag swipe (watchlist'e ekleme) limiti — 5 film sonrasi session biter */
const WATCHLIST_SESSION_LIMIT = 5;

/** Her kac swipe'da bir achievement toast gosterilir */
const MILESTONE_INTERVAL = 5;

/** Onboarding modunda kaç film goruldukten sonra akis tetiklenir */
const ONBOARDING_FILM_LIMIT = 5;

// ── Ana Ekran ────────────────────────────────────────────────────────────────

/**
 * Discover stack ekranı.
 * MoodContext'ten profil okur; FlatList + SwipeableCard ile filmler gösterilir.
 * Tab bar olmadığı için CARD_HEIGHT tam ekran yüksekliğini kullanır.
 */
export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { currentProfile, currentFilters, clearMood, addLastSessionFilm } = useMood();
  const { isPremium } = useSubscription();
  /** Onboarding akisi: mood.tsx'ten gelen param — 5 film limiti + Store Review + paywall */
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';

  /** Onboarding tamamlaninca tabs'a yonlendir */
  const navigateAfterOnboarding = useCallback(() => {
    if (isOnboarding) router.replace('/(tabs)' as never);
  }, [isOnboarding, router]);

  const { triggerPaywall, paywallProps: rawPaywallProps } = useContextualPaywall(navigateAfterOnboarding);

  // Onboarding dismiss'inde de tabs'a yonlendir
  const paywallProps = useMemo(() => ({
    ...rawPaywallProps,
    onDismiss: () => {
      rawPaywallProps.onDismiss();
      if (isOnboarding) router.replace('/(tabs)' as never);
    },
  }), [rawPaywallProps, isOnboarding, router]);

  const effectiveFilters = currentFilters ?? DEFAULT_FILTERS;

  const {
    films: managerFilms,
    isLoading,
    hasError,
    errorType,
    retryLoad,
    onSwipeFilm,
    onLoadMore,
    resetFeed,
  } = useFeedManager(currentProfile, effectiveFilters);

  // ── Yerel film listesi ─────────────────────────────────────────────────────

  const [displayFilms, setDisplayFilms] = useState<Film[]>([]);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Onboarding: cift-tetiklemeyi onler
  const onboardingCompleteRef = useRef(false);
  /** Onboarding modunda kac benzersiz film goruldu */
  const onboardingViewedCountRef = useRef(0);
  /** Gorulmus film ID'leri — ayni filmi tekrar saymamak icin */
  const onboardingViewedIdsRef = useRef<Set<string>>(new Set());

  // Streak state kaldirildi — discover'da streak gosterilmiyor

  /** Session-end curator celebration mi yoksa normal milestone mi */
  const isSessionEndCelebrationRef = useRef(false);

  // ── Milestone celebration overlay state ────────────────────────────────────
  const [celebrationMilestone, setCelebrationMilestone] = useState<
    MilestoneCelebrationProps['milestone'] | null
  >(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const milestoneQueueRef = useRef<UserMilestone[]>([]);

  // ── Milestone toast ────────────────────────────────────────────────────────
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeCountRef = useRef(0);
  const saveCountRef = useRef(0);
  const firstSurpriseSeenRef = useRef(false);
  const lastMilestoneCheckRef = useRef(0);

  /** Milestone mesajini 2 sn goster */
  const showMilestone = useCallback((msg: string) => {
    if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
    setMilestoneMsg(msg);
    milestoneTimer.current = setTimeout(() => setMilestoneMsg(null), 2000);
  }, []);

  /**
   * Onboarding tamamlama akisi:
   *   1. "5 film kesfettin!" milestone toast'u (2.2 sn)
   *   2. App Store review (en iyi dopamin ani — kullanici degeri deneyimledi)
   *   3. Paywall'a yonlendir (onboarding=1 param)
   *
   * Cift-tetikleme: onboardingCompleteRef ile korunur.
   */
  const triggerOnboardingComplete = useCallback(async () => {
    if (onboardingCompleteRef.current) return;
    onboardingCompleteRef.current = true;

    showMilestone(t('onboarding.discoverMilestoneTitle'));
    await new Promise<void>((r) => setTimeout(r, 2200));

    // App Store review — lazy import (native build yoksa crash onlemek icin)
    try {
      const StoreReview = await import('expo-store-review');
      const isAvailable = await StoreReview.hasAction();
      if (isAvailable) await StoreReview.requestReview();
    } catch {
      // Sessizce devam et
    }

    triggerPaywall({ type: 'onboarding_complete' });
  }, [showMilestone, t, triggerPaywall]);

  // Streak yukleme kaldirildi — discover'da streak gosterilmiyor

  // ── Milestone celebration ──────────────────────────────────────────────────

  const showNextCelebration = useCallback(() => {
    const next = milestoneQueueRef.current.shift();
    if (!next) return;
    setCelebrationMilestone({
      userMilestoneId: next.id,
      slug: next.milestone.slug,
      title: next.milestone.title,
      description: next.milestone.description,
      icon: next.milestone.icon,
      category: next.milestone.category,
      threshold: next.milestone.threshold,
    });
    setCelebrationVisible(true);
  }, []);

  const handleCelebrationDismiss = useCallback(() => {
    setCelebrationVisible(false);
    if (celebrationMilestone) {
      markMilestoneSeen(celebrationMilestone.userMilestoneId).catch(() => {});
    }
    // Curator session-end: ilk seferinde App Store Review + watchlist navigate
    if (isSessionEndCelebrationRef.current) {
      isSessionEndCelebrationRef.current = false;
      void (async () => {
        try {
          const reviewShown = await AsyncStorage.getItem('chosy_curator_review_shown');
          if (!reviewShown) {
            await AsyncStorage.setItem('chosy_curator_review_shown', '1');
            // expo-store-review — lazy import (native build yoksa crash onlemek icin)
            const StoreReview = await import('expo-store-review');
            const isAvailable = await StoreReview.hasAction();
            if (isAvailable) await StoreReview.requestReview();
          }
        } catch {
          // Sessizce devam — review bloklayici olmamali
        }
        router.navigate('/(tabs)/profile' as never);
      })();
      return;
    }
    if (milestoneQueueRef.current.length > 0) {
      setTimeout(showNextCelebration, 500);
    }
  }, [celebrationMilestone, showNextCelebration, router]);

  const lastSyncedLengthRef = useRef(0);

  // Yeni filmler gelince displayFilms'e ekle
  useEffect(() => {
    if (managerFilms.length === 0) {
      setDisplayFilms([]);
      lastSyncedLengthRef.current = 0;
      return;
    }
    if (managerFilms.length > lastSyncedLengthRef.current) {
      const isFirstBatch = lastSyncedLengthRef.current === 0;
      const newFilms = managerFilms.slice(lastSyncedLengthRef.current);
      lastSyncedLengthRef.current = managerFilms.length;
      setDisplayFilms((prev) => [...prev, ...newFilms]);

      // PostHog: film_recommended — ilk batch geldiginde fire
      if (isFirstBatch) {
        posthogAnalytics.track('film_recommended', { film_count: managerFilms.length });
      }
    }
  }, [managerFilms]);

  // Profil değişince feed sıfırla
  const prevProfileRef = useRef(currentProfile);
  useEffect(() => {
    if (currentProfile && currentProfile !== prevProfileRef.current) {
      prevProfileRef.current = currentProfile;
      lastSyncedLengthRef.current = 0;
      setDisplayFilms([]);
      resetFeed(currentProfile, effectiveFilters);
    } else if (!currentProfile) {
      prevProfileRef.current = null;
    }
  }, [currentProfile, effectiveFilters, resetFeed]);

  // Kalan film az olunca yükle
  useEffect(() => {
    if (displayFilms.length > 0 && displayFilms.length <= LOAD_MORE_THRESHOLD) {
      onLoadMore();
    }
  }, [displayFilms.length, onLoadMore]);

  // ── Swipe handler'lar ──────────────────────────────────────────────────────

  const checkNewMilestones = useCallback(async () => {
    try {
      await new Promise((r) => setTimeout(r, 600));
      const unseen = await getUnseenMilestones();
      if (unseen.length > 0) {
        milestoneQueueRef.current = [...unseen];
        showNextCelebration();
      }

      // Streak milestone paywall check — free user icin
      if (!isPremium) {
        const streakInfo = await getStreakInfo();
        if (streakInfo && isStreakMilestone(streakInfo.currentStreak)) {
          triggerPaywall({ type: 'streak_milestone', days: streakInfo.currentStreak });
        }
      }
    } catch {
      // Sessizce devam
    }
  }, [showNextCelebration, isPremium, triggerPaywall]);

  const handleSwipeRight = useCallback(
    async (film: Film) => {
      // Karti her durumda listeden cikar — swipe animasyonu zaten oynadi
      setDisplayFilms((prev) => prev.filter((f) => f.id !== film.id));

      // ── Slot quota check — free user kota kontrolu ──────────────────────
      // Premium kullanicilar icin atlaniyor (sinirsiz slot).
      // Kota bitmisse: filmi watchlist'e EKLEME, paywall goster.
      if (!isPremium) {
        const uid = await getAppUserId();
        if (uid) {
          const quota = await checkAndConsumeQuota(uid, 'slot');
          if (!quota.allowed) {
            // Watchlist'e eklenemedi — swipe_right sinyali yaz (watchlist_add yazılmayacak)
            tasteSignals.recordSwipeRight(film.id).catch(() => {});
            triggerPaywall({ type: 'quota_exhausted', quota: 'slot' });
            return;
          }
        }
      }

      // ── Watchlist insert — Sprint 2 Bug B fix ─────────────────────────
      // Quota gate'i geçildi. Filmi gerçekten watchlist tablosuna yaz.
      // addToWatchlist içinde fire-and-forget swipe_right signal + user
      // vector update tetiklenir. await: insert tamamlanmadan UI "Saved"
      // toast göstermesin diye. Hata olursa addToWatchlist içinde
      // [watchlist] addToWatchlist hata: log'u atılır, sessizce yutulmaz.
      await addToWatchlist(film);

      onSwipeFilm(film, 'right');
      addLastSessionFilm(film);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setShowSaveToast(true);
      toastTimer.current = setTimeout(() => setShowSaveToast(false), 1400);
      swipeCountRef.current += 1;
      saveCountRef.current += 1;

      // Watchlist full check — free user 30 film limitine ulasmissa paywall goster
      if (!isPremium) {
        getAppUserId().then((uid) => {
          if (uid) {
            isWatchlistFull(uid).then((isFull) => {
              if (isFull) triggerPaywall({ type: 'watchlist_full' });
            });
          }
        });
      }

      // 5 film watchlist'e eklendiyse session biter — Curator milestone goster
      if (saveCountRef.current >= WATCHLIST_SESSION_LIMIT) {
        hapticSuccess();
        isSessionEndCelebrationRef.current = true;
        setCelebrationMilestone({
          userMilestoneId: 'session_curator_local',
          slug: 'curator_5',
          title: t('discover.curatorTitle'),
          description: t('discover.curatorDescription'),
          icon: '🎬',
          category: 'watchlist',
          threshold: 5,
        });
        setCelebrationVisible(true);
        setSessionComplete(true);
        return;
      }
      // Her MILESTONE_INTERVAL filmde achievement toast
      if (swipeCountRef.current % MILESTONE_INTERVAL === 0) {
        showMilestone(t('discover.milestoneExplored', { count: swipeCountRef.current }));
      }
      const now = Date.now();
      if (now - lastMilestoneCheckRef.current > 5000) {
        lastMilestoneCheckRef.current = now;
        checkNewMilestones();
      }
    },
    [onSwipeFilm, addLastSessionFilm, showMilestone, checkNewMilestones, t, isPremium, triggerPaywall],
  );

  const handleSwipeLeft = useCallback(
    (film: Film) => {
      onSwipeFilm(film, 'left');
      tasteSignals.recordSwipeLeft(film.id).catch(() => {});
      setDisplayFilms((prev) => prev.filter((f) => f.id !== film.id));
      swipeCountRef.current += 1;

      // Sol swipe session'i bitirmez — sadece milestone toast
      if (swipeCountRef.current % MILESTONE_INTERVAL === 0) {
        showMilestone(t('discover.milestoneExplored', { count: swipeCountRef.current }));
      }
    },
    [onSwipeFilm, showMilestone, t],
  );

  const { animatedStyle: newMoodAnimStyle, onPressIn: newMoodPressIn, onPressOut: newMoodPressOut } =
    useScalePress(0.95);

  /** Yeni Mood → profili temizle + mood sekmesine git */
  const handleNewMood = useCallback(() => {
    clearMood();
    router.navigate('/(tabs)');
  }, [clearMood, router]);

  /** Pull-to-refresh */
  const handleRefresh = useCallback(async () => {
    if (!currentProfile) return;
    setIsRefreshing(true);
    lastSyncedLengthRef.current = 0;
    setDisplayFilms([]);
    resetFeed(currentProfile, effectiveFilters);
    setTimeout(() => setIsRefreshing(false), 800);
  }, [currentProfile, effectiveFilters, resetFeed]);

  // ── Sürpriz kart görünürlük tespiti ───────────────────────────────────────

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems[0]) return;
      const film = viewableItems[0].item as Film;

      // ── Onboarding: 5. film gorulunce akisi tetikle ──────────────────────
      // "karsilarina gelince" — swipe degil, ekrana gelmesi yeterli
      if (isOnboarding && !onboardingCompleteRef.current) {
        if (!onboardingViewedIdsRef.current.has(film.id)) {
          onboardingViewedIdsRef.current.add(film.id);
          onboardingViewedCountRef.current += 1;
          if (onboardingViewedCountRef.current >= ONBOARDING_FILM_LIMIT) {
            void triggerOnboardingComplete();
          }
        }
      }

      // ── Hidden gem milestone ─────────────────────────────────────────────
      const effectiveType = film.pick_type ?? film.surpriseType ?? null;
      if (effectiveType != null && !firstSurpriseSeenRef.current) {
        firstSurpriseSeenRef.current = true;
        showMilestone(t('discover.milestoneHiddenGem'));
        hapticSuccess();
      }
    },
    [showMilestone, t, isOnboarding, triggerOnboardingComplete],
  );

  // ── FlatList yardımcıları ──────────────────────────────────────────────────

  const getItemLayout = useCallback(
    (_: ArrayLike<Film> | null | undefined, index: number) => ({
      length: CARD_HEIGHT,
      offset: CARD_HEIGHT * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback((item: Film) => item.id, []);

  /** Nav bar + güvenli bölge boşluğu — action butonlarının üstünde kalması için */
  const cardBottomOffset = insets.bottom + 80;

  const renderItem = useCallback(
    ({ item }: { item: Film }) => (
      <View style={{ height: CARD_HEIGHT }}>
        <SwipeableCard
          film={item}
          height={CARD_HEIGHT}
          bottomOffset={cardBottomOffset}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
        />
      </View>
    ),
    [handleSwipeRight, handleSwipeLeft, cardBottomOffset],
  );

  // ── Oturum tamamlandı (5 sag swipe) — Curator overlay ────────────────────

  if (sessionComplete) {
    return (
      <View style={styles.sessionCompleteContainer}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        {/* Curator milestone overlay — dismiss → watchlist navigate */}
        {celebrationMilestone && (
          <MilestoneCelebration
            milestone={celebrationMilestone}
            visible={celebrationVisible}
            onDismiss={handleCelebrationDismiss}
          />
        )}
      </View>
    );
  }

  // ── Yükleme durumu ────────────────────────────────────────────────────────

  if (isLoading && displayFilms.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <View style={styles.skeletonCard}>
          <SkeletonLoader width="100%" height={CARD_HEIGHT * 0.65} borderRadius={0} />
          <View style={styles.skeletonInfo}>
            <SkeletonLoader width="70%" height={24} borderRadius={6} />
            <SkeletonLoader width="50%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
            <SkeletonLoader width="85%" height={12} borderRadius={6} style={{ marginTop: 12 }} />
          </View>
          <View style={styles.skeletonActions}>
            <SkeletonLoader width={48} height={48} borderRadius={24} />
            <SkeletonLoader width={56} height={56} borderRadius={28} />
            <SkeletonLoader width={48} height={48} borderRadius={24} />
          </View>
        </View>
      </View>
    );
  }

  if (hasError && displayFilms.length === 0) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <ErrorState errorType={errorType} onRetry={retryLoad} />
      </>
    );
  }

  if (!isLoading && displayFilms.length === 0) {
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

  // ── Feed ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />

      <FlatList
        data={displayFilms}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsVerticalScrollIndicator={false}
        snapToInterval={CARD_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accentPrimary}
            colors={[Colors.accentPrimary]}
            progressBackgroundColor={Colors.bgCard}
          />
        }
        maxToRenderPerBatch={2}
        windowSize={3}
        initialNumToRender={1}
        updateCellsBatchingPeriod={100}
        removeClippedSubviews={true}
      />

      {/* "New mood" floating butonu */}
      <Animated.View
        style={[styles.newMoodBtn, { top: insets.top + 12 }, newMoodAnimStyle]}
      >
        <TouchableOpacity
          onPressIn={newMoodPressIn}
          onPressOut={newMoodPressOut}
          onPress={handleNewMood}
          activeOpacity={1}
        >
          <Text style={styles.newMoodBtnText}>✦ {t('discover.newMoodBtn')}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Nav butonları — alt bar (icon-only, 3 buton) */}
      <View style={[styles.navBar, { bottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.navigate('/(tabs)' as never)}
          activeOpacity={0.75}
          accessibilityLabel={t('tabs.home')}
          accessibilityRole="button"
        >
          <Ionicons name="home" size={22} color={Colors.textWhite} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.navigate('/(tabs)/profile' as never)}
          activeOpacity={0.75}
          accessibilityLabel={t('tabs.watchlist')}
          accessibilityRole="button"
        >
          <Ionicons name="bookmark" size={22} color={Colors.textWhite} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.navigate('/(tabs)/profile')}
          activeOpacity={0.75}
          accessibilityLabel={t('tabs.profile')}
          accessibilityRole="button"
        >
          <Ionicons name="person" size={22} color={Colors.textWhite} />
        </TouchableOpacity>
      </View>

      {/* Arka plan yükleme göstergesi */}
      {isLoading && displayFilms.length > 0 && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          style={styles.loadingPill}
          pointerEvents="none"
        >
          <ActivityIndicator size="small" color={Colors.accentPrimary} />
          <Text style={styles.loadingPillText}>{t('loading.moreFilms')}</Text>
        </Animated.View>
      )}

      {/* Arka plan hata durumu */}
      {hasError && displayFilms.length > 0 && (
        <Animated.View
          entering={FadeInDown.springify().damping(16)}
          style={styles.errorBar}
          pointerEvents="box-none"
        >
          <Text style={styles.errorBarText}>{t('errors.noMoviesFound')}</Text>
          <TouchableOpacity onPress={retryLoad} activeOpacity={0.8} style={styles.errorBarBtn}>
            <Text style={styles.errorBarBtnText}>{t('errors.retry')}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Milestone toast */}
      {milestoneMsg != null && (
        <Animated.View
          entering={FadeInDown.springify().damping(16)}
          exiting={FadeOutUp.duration(300)}
          style={[styles.milestoneToast, { top: insets.top + 12 }]}
          pointerEvents="none"
        >
          <Text style={styles.milestoneToastText}>{milestoneMsg}</Text>
        </Animated.View>
      )}

      {/* Watchlist toast */}
      {showSaveToast && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.toast}
          pointerEvents="none"
        >
          <Ionicons name="checkmark-circle" size={18} color={Colors.swipeRight} />
          <Text style={styles.toastText}>{t('discover.savedToWatchlist')}</Text>
        </Animated.View>
      )}

      {/* Milestone celebration overlay */}
      {celebrationMilestone && (
        <MilestoneCelebration
          milestone={celebrationMilestone}
          visible={celebrationVisible}
          onDismiss={handleCelebrationDismiss}
        />
      )}

      {/* Contextual Paywall (watchlist_full, streak_milestone) */}
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

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  skeletonCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
  },
  skeletonInfo: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  skeletonActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    marginTop: 24,
  },

  // ── Nav bar (alt) ──────────────────────────────────────────────────────────
  navBar: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(10,10,10,0.85)',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 10,
  },
  navBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  newMoodBtn: {
    position: 'absolute',
    right: 16,
    backgroundColor: Colors.overlay,
    borderWidth: 1,
    borderColor: Colors.goldGlow,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  newMoodBtnText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // ── Arka plan yükleme ─────────────────────────────────────────────────────
  loadingPill: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.overlay,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.accentDim,
  },
  loadingPillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },

  // ── Hata bar ─────────────────────────────────────────────────────────────
  errorBar: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  errorBarText: {
    color: Colors.textWhite,
    fontSize: 13,
    flex: 1,
  },
  errorBarBtn: {
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  errorBarBtnText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '700',
  },

  // ── Milestone toast ───────────────────────────────────────────────────────
  milestoneToast: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: Colors.overlay,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.goldGlow,
  },
  milestoneToastText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },

  // ── Watchlist toast ───────────────────────────────────────────────────────
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
  },
  toastText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Oturum tamamlandı (5 sag swipe) — sadece container, overlay uzerinde ─
  sessionCompleteContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
