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
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useFeedManager } from '@/hooks/useFeedManager';
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
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Milestone toast ──────────────────────────────────────────────────────
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
      // Milestone: her 10 swipe
      swipeCountRef.current += 1;
      saveCountRef.current += 1;
      if (swipeCountRef.current % 10 === 0) {
        showMilestone(`${swipeCountRef.current} movies explored! 🎬`);
      } else if (saveCountRef.current % 5 === 0) {
        showMilestone('Nice taste! 5 films saved ✨');
      }
    },
    [onSwipeFilm, showMilestone],
  );

  /**
   * Sola swipe: skip logla + film listeden çıkar.
   */
  const handleSwipeLeft = useCallback(
    (film: Film) => {
      onSwipeFilm(film, 'left');
      setDisplayFilms((prev) => prev.filter((f) => f.id !== film.id));
      // Milestone: her 10 swipe
      swipeCountRef.current += 1;
      if (swipeCountRef.current % 10 === 0) {
        showMilestone(`${swipeCountRef.current} movies explored! 🎬`);
      }
    },
    [onSwipeFilm, showMilestone],
  );

  const { animatedStyle: newMoodAnimStyle, onPressIn: newMoodPressIn, onPressOut: newMoodPressOut } = useScalePress(0.95);

  /** "New Mood" → profili temizle + mood sekmesine git */
  const handleNewMood = useCallback(() => {
    clearMood();
    router.push('/(tabs)/mood');
  }, [clearMood, router]);

  // ── Sürpriz kart görünürlük tespiti ───────────────────────────────────────

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (!viewableItems[0]) return;
      const film = viewableItems[0].item as Film;
      const effectiveType = film.pick_type ?? film.surpriseType ?? null;
      if (effectiveType != null && !firstSurpriseSeenRef.current) {
        firstSurpriseSeenRef.current = true;
        showMilestone('A hidden gem found! 💎');
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
      <View style={[styles.centered, { justifyContent: 'flex-start', paddingTop: 60, gap: 16 }]}>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <SkeletonLoader width="85%" height={CARD_HEIGHT * 0.7} borderRadius={16} />
        <SkeletonLoader width="70%" height={20} borderRadius={6} />
        <SkeletonLoader width="50%" height={16} borderRadius={6} />
      </View>
    );
  }

  if (hasError && displayFilms.length === 0) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <ErrorState onRetry={retryLoad} />
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
          title="Ready to discover?"
          subtitle="Describe your mood and find matching films"
          actionLabel="Set Your Mood"
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

      {/* Arka plan yükleme göstergesi */}
      {isLoading && displayFilms.length > 0 && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color={Colors.gold} />
        </View>
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

  // ─── Floating "New mood" butonu ────────────────────────────────────────────
  newMoodBtn: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'rgba(10,14,39,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.5)',
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

  // ─── Arka plan yükleme ─────────────────────────────────────────────────────
  loadingOverlay: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 16,
    alignSelf: 'center',
  },

  // ─── Hata bar ─────────────────────────────────────────────────────────────
  errorBar: {
    position: 'absolute',
    bottom: TAB_BAR_HEIGHT + 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,68,68,0.15)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.4)',
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
    backgroundColor: 'rgba(26,31,53,0.95)',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.4)',
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
    backgroundColor: 'rgba(26,31,53,0.9)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.3)',
    gap: 8,
  },
  toastText: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '600',
  },
});
