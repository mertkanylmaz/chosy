/**
 * Feed sekmesi — FlatList tabanlı TikTok+Tinder hibrit film discovery.
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
 *
 * Siyah ekran neden yok:
 * - Kart yatay uçuş animasyonu 300ms içinde biter
 * - withTiming callback'te runOnJS → onSwipeRight/Left → film array'den çıkar
 * - FlatList'teki sonraki kart zaten render edilmiş ve hazır
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { SwipeableCard } from '@/components/SwipeCard/SwipeableCard';
import { Colors } from '@/constants/Colors';
import Lumi from '@/components/Lumi';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import StreakBadge from '@/components/Gamification/StreakBadge';
import MilestoneCelebration from '@/components/Gamification/MilestoneCelebration';
import type { MilestoneCelebrationProps } from '@/components/Gamification/MilestoneCelebration';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useFeedManager } from '@/hooks/useFeedManager';
import {
  getStreakInfo,
  getUnseenMilestones,
  markMilestoneSeen,
} from '@/services/gamification';
import type { StreakInfo, UserMilestone } from '@/services/gamification';
import { Film } from '@/types/film';
import { FilmFilters } from '@/types';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/** Tab bar yüksekliği (tab bar position:absolute) */
const TAB_BAR_HEIGHT = 80;

/**
 * Her kart item'ının yüksekliği.
 * snapToInterval bu değerle eşleşmeli.
 */
const CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT;

/** Filtreler seçilmemişse varsayılan */
const DEFAULT_FILTERS: FilmFilters = {
  yearRange: null,
  minRating: null,
  regions: [],
  directors: [],
};

/** Kalan film sayısı bu eşiğin altına düşünce yeni batch yükle */
const LOAD_MORE_THRESHOLD = 3;

// ── Ana Ekran ────────────────────────────────────────────────────────────────

/**
 * Feed sekmesi.
 * MoodContext'ten profil okur; FlatList + SwipeableCard ile filmler gösterilir.
 */
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useLanguage();
  const { currentProfile, currentFilters, clearMood } = useMood();

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

  /**
   * Manager'dan gelen filmler buraya kopyalanır.
   * Swipe edilince filter() ile çıkarılır — FlatList bu array'i kullanır.
   */
  const [displayFilms, setDisplayFilms] = useState<Film[]>([]);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Streak badge state ─────────────────────────────────────────────────
  const [streakCount, setStreakCount] = useState(0);
  const [streakLoading, setStreakLoading] = useState(true);

  // ── Milestone celebration overlay state ─────────────────────────────────
  const [celebrationMilestone, setCelebrationMilestone] = useState<
    MilestoneCelebrationProps['milestone'] | null
  >(null);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  /** Milestone kuyruğu — birden fazla unseen varsa sırayla göster */
  const milestoneQueueRef = useRef<UserMilestone[]>([]);

  // ── Milestone toast (basit metin, küçük milestone'lar için) ─────────────
  const [milestoneMsg, setMilestoneMsg] = useState<string | null>(null);
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swipeCountRef = useRef(0);
  const saveCountRef = useRef(0);
  const firstSurpriseSeenRef = useRef(false);

  /** Milestone mesajını 2 sn göster */
  const showMilestone = useCallback((msg: string) => {
    if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
    setMilestoneMsg(msg);
    milestoneTimer.current = setTimeout(() => setMilestoneMsg(null), 2000);
  }, []);

  // ── Streak bilgisini yükle ───────────────────────────────────────────────

  const loadStreak = useCallback(async () => {
    try {
      const info = await getStreakInfo();
      if (info) {
        setStreakCount(info.currentStreak);
      }
    } catch {
      // Streak yükleme hatası sessizce geç
    } finally {
      setStreakLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  // ── Milestone celebration — sıradakini göster ─────────────────────────

  /** Kuyruktan sonraki milestone'u al ve celebration overlay'ı aç */
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

  /** Celebration overlay kapatıldığında: seen işaretle, sıradakine geç */
  const handleCelebrationDismiss = useCallback(() => {
    setCelebrationVisible(false);

    // Mevcut milestone'u seen olarak işaretle
    if (celebrationMilestone) {
      markMilestoneSeen(celebrationMilestone.userMilestoneId).catch(() => {});
    }

    // Kuyrukta başka milestone varsa 500ms sonra göster
    if (milestoneQueueRef.current.length > 0) {
      setTimeout(showNextCelebration, 500);
    }
  }, [celebrationMilestone, showNextCelebration]);

  /**
   * Manager'ın kaç filmini senkronize ettiğimizi izler.
   * Sadece yeni eklenen filmler displayFilms'e eklenir.
   */
  const lastSyncedLengthRef = useRef(0);

  // Yeni filmler gelince displayFilms'e ekle; manager sıfırlanınca temizle
  useEffect(() => {
    if (managerFilms.length === 0) {
      setDisplayFilms([]);
      lastSyncedLengthRef.current = 0;
      return;
    }
    if (managerFilms.length > lastSyncedLengthRef.current) {
      const newFilms = managerFilms.slice(lastSyncedLengthRef.current);
      lastSyncedLengthRef.current = managerFilms.length;
      setDisplayFilms((prev) => [...prev, ...newFilms]);
    }
  }, [managerFilms]);

  // ── Profil değişince feed sıfırla ─────────────────────────────────────────

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

  // ── Otomatik yükleme (swipe bazlı) ────────────────────────────────────────

  /**
   * Kalan film sayısı LOAD_MORE_THRESHOLD'un altına düşünce
   * (FlatList scroll'ından bağımsız) yeni batch yükle.
   */
  useEffect(() => {
    if (displayFilms.length > 0 && displayFilms.length <= LOAD_MORE_THRESHOLD) {
      onLoadMore();
    }
  }, [displayFilms.length, onLoadMore]);

  // ── Swipe handler'lar ──────────────────────────────────────────────────────

  /**
   * Swipe sonrası backend'den gelen yeni milestone'ları kontrol et.
   * recordActivity() useFeedManager'da fire-and-forget çalışır;
   * burada ayrıca unseen milestone sorgusu yaparız.
   *
   * Yeni milestone varsa:
   * - Full celebration overlay (MilestoneCelebration) gösterilir
   * - Birden fazla varsa sırayla gösterilir (kuyruk)
   * - Streak badge da güncellenir
   */
  const checkNewMilestones = useCallback(async () => {
    try {
      // Kısa gecikme — recordActivity'nin DB'ye yazmasını bekle
      await new Promise((r) => setTimeout(r, 600));
      const unseen = await getUnseenMilestones();

      if (unseen.length > 0) {
        // Celebration overlay kuyruğuna ekle
        milestoneQueueRef.current = [...unseen];
        showNextCelebration();
      }

      // Streak badge'i de güncelle
      const info = await getStreakInfo();
      if (info) {
        setStreakCount(info.currentStreak);
      }
    } catch {
      // Milestone kontrolü başarısız olursa sessizce devam et
    }
  }, [showNextCelebration]);

  /**
   * Sağa swipe: watchlist'e ekle + film listeden çıkar.
   * SwipeableCard'ın withTiming callback'inden (JS thread) çağrılır.
   */
  const handleSwipeRight = useCallback(
    (film: Film) => {
      onSwipeFilm(film, 'right');
      setDisplayFilms((prev) => prev.filter((f) => f.id !== film.id));
      // Watchlist toast
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setShowSaveToast(true);
      toastTimer.current = setTimeout(() => setShowSaveToast(false), 1400);
      // Local milestone — anlık geri bildirim
      swipeCountRef.current += 1;
      saveCountRef.current += 1;
      if (swipeCountRef.current % 10 === 0) {
        showMilestone(t('discover.milestoneExplored', { count: swipeCountRef.current }));
      } else if (saveCountRef.current % 5 === 0) {
        showMilestone(t('discover.milestoneSaved', { count: saveCountRef.current }));
      }
      // Backend milestone kontrolü (arka planda)
      checkNewMilestones();
    },
    [onSwipeFilm, showMilestone, checkNewMilestones, t],
  );

  /**
   * Sola swipe: skip logla + film listeden çıkar.
   */
  const handleSwipeLeft = useCallback(
    (film: Film) => {
      onSwipeFilm(film, 'left');
      setDisplayFilms((prev) => prev.filter((f) => f.id !== film.id));
      // Local milestone — anlık geri bildirim
      swipeCountRef.current += 1;
      if (swipeCountRef.current % 10 === 0) {
        showMilestone(t('discover.milestoneExplored', { count: swipeCountRef.current }));
      }
      // Backend milestone kontrolü (arka planda)
      checkNewMilestones();
    },
    [onSwipeFilm, showMilestone, checkNewMilestones, t],
  );

  const { animatedStyle: newMoodAnimStyle, onPressIn: newMoodPressIn, onPressOut: newMoodPressOut } = useScalePress(0.95);

  /** "New Mood" → profili temizle + mood sekmesine git */
  const handleNewMood = useCallback(() => {
    clearMood();
    router.push('/(tabs)/mood');
  }, [clearMood, router]);

  /** Pull-to-refresh — mevcut profil ile feed'i sıfırlar */
  const handleRefresh = useCallback(async () => {
    if (!currentProfile) return;
    setIsRefreshing(true);
    lastSyncedLengthRef.current = 0;
    setDisplayFilms([]);
    resetFeed(currentProfile, effectiveFilters);
    // Yeni batch yüklenince isLoading false olur — kısa gecikme ile refreshing'i kapat
    setTimeout(() => setIsRefreshing(false), 800);
  }, [currentProfile, effectiveFilters, resetFeed]);

  // ── Sürpriz kart görünürlük tespiti ───────────────────────────────────────

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems[0]) return;
      const film = viewableItems[0].item as Film;
      const effectiveType = film.pick_type ?? film.surpriseType ?? null;
      if (effectiveType != null && !firstSurpriseSeenRef.current) {
        firstSurpriseSeenRef.current = true;
        showMilestone(t('discover.milestoneHiddenGem'));
        hapticSuccess();
      }
    },
    [showMilestone],
  );

  // ── FlatList yardımcıları ──────────────────────────────────────────────────

  /**
   * getItemLayout: tüm kartlar aynı yükseklikte → FlatList'in hesaplama
   * maliyetini ortadan kaldırır.
   */
  const getItemLayout = useCallback(
    (_: ArrayLike<Film> | null | undefined, index: number) => ({
      length: CARD_HEIGHT,
      offset: CARD_HEIGHT * index,
      index,
    }),
    [],
  );

  const keyExtractor = useCallback((item: Film) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Film }) => (
      <Animated.View style={{ height: CARD_HEIGHT }} entering={FadeIn.duration(300)}>
        <SwipeableCard
          film={item}
          height={CARD_HEIGHT}
          onSwipeRight={handleSwipeRight}
          onSwipeLeft={handleSwipeLeft}
        />
      </Animated.View>
    ),
    [handleSwipeRight, handleSwipeLeft],
  );

  // ── Boş / yükleme durumları ────────────────────────────────────────────────

  if (isLoading && displayFilms.length === 0) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <View style={styles.skeletonCard}>
          {/* Poster alanı — tam kart yüksekliği */}
          <SkeletonLoader width="100%" height={CARD_HEIGHT * 0.65} borderRadius={0} />

          {/* Gradient geçiş — poster'dan bilgi alanına */}
          <LinearGradient
            colors={['transparent', Colors.background]}
            style={styles.skeletonGradient}
          />

          {/* Match score dairesi placeholder */}
          <View style={styles.skeletonMatchCircle}>
            <SkeletonLoader width={56} height={56} borderRadius={28} />
          </View>

          {/* Alt bilgi alanı — başlık + meta + tagline */}
          <View style={styles.skeletonInfo}>
            <SkeletonLoader width="70%" height={24} borderRadius={6} />
            <SkeletonLoader width="50%" height={14} borderRadius={6} style={{ marginTop: 10 }} />
            <SkeletonLoader width="85%" height={12} borderRadius={6} style={{ marginTop: 12 }} />
            <SkeletonLoader width="60%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
          </View>

          {/* Aksiyon butonları placeholder */}
          <View style={styles.skeletonActions}>
            <SkeletonLoader width={48} height={48} borderRadius={24} />
            <SkeletonLoader width={56} height={56} borderRadius={28} />
            <SkeletonLoader width={48} height={48} borderRadius={24} />
          </View>

          {/* Watchlist butonu placeholder */}
          <View style={styles.skeletonWatchlistBtn}>
            <SkeletonLoader width="100%" height={48} borderRadius={14} />
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

  if (!isLoading && displayFilms.length === 0 && !currentProfile) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <EmptyState
          lumiMood="idle"
          lumiSize="large"
          title={t('discover.readyTitle')}
          subtitle={t('discover.readySubtitle')}
          actionLabel={t('discover.setYourMood')}
          onAction={() => router.push('/(tabs)/mood')}
        />
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
        // Dikey snap scroll
        showsVerticalScrollIndicator={false}
        snapToInterval={CARD_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        // Yükleme
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        // Sürpriz kart görünürlük tespiti
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig.current}
        // Pull-to-refresh
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.accentPrimary}
            colors={[Colors.accentPrimary]}
            progressBackgroundColor={Colors.bgCard}
          />
        }
        // Performans
        maxToRenderPerBatch={3}
        windowSize={5}
        initialNumToRender={2}
        removeClippedSubviews={true}
      />

      {/* "New mood" floating butonu */}
      <Animated.View style={[styles.newMoodBtn, { top: insets.top + 12 }, newMoodAnimStyle]}>
        <TouchableOpacity
          onPressIn={newMoodPressIn}
          onPressOut={newMoodPressOut}
          onPress={handleNewMood}
          activeOpacity={1}
        >
          <Text style={styles.newMoodBtnText}>✦ {t('discover.newMoodBtn')}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Streak badge — sağ üst köşe */}
      <View style={[styles.streakBadgeContainer, { top: insets.top + 12 }]}>
        <StreakBadge
          currentStreak={streakCount}
          loading={streakLoading}
          onPress={() => router.push('/(tabs)/profile')}
        />
      </View>

      {/* Arka plan yükleme göstergesi — shimmer pill */}
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

      {/* Arka plan hata durumu — retry butonu */}
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

      {/* Milestone toast — üstten kayarak girer */}
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
          <Lumi size="small" mood="happy" />
          <Text style={styles.toastText}>{t('discover.savedToWatchlist')}</Text>
        </Animated.View>
      )}

      {/* Milestone celebration overlay — tam ekran */}
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

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },

  // ─── Boş durum ─────────────────────────────────────────────────────────────
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.textWhite,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: Colors.textGrey,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  emptyBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  emptyBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  emptyBtnText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: 'bold',
  },

  // ─── Feed skeleton ───────────────────────────────────────────────────────
  skeletonCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
  },
  skeletonGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: CARD_HEIGHT * 0.55,
    height: CARD_HEIGHT * 0.15,
  },
  skeletonMatchCircle: {
    position: 'absolute',
    right: 20,
    top: CARD_HEIGHT * 0.60,
    zIndex: 2,
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
  skeletonWatchlistBtn: {
    marginHorizontal: 20,
    marginTop: 16,
  },

  // ─── Streak badge (sağ üst) ────────────────────────────────────────────────
  streakBadgeContainer: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },

  // ─── Floating "New mood" butonu ────────────────────────────────────────────
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

  // ─── Arka plan yükleme pill ─────────────────────────────────────────────────
  loadingPill: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 16,
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

  // ─── Hata bar ─────────────────────────────────────────────────────────────
  errorBar: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 16,
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

  // ─── Milestone toast ───────────────────────────────────────────────────────
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

  // ─── Watchlist toast ───────────────────────────────────────────────────────
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
    fontWeight: '600',
  },
});
