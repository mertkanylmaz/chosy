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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwipeableCard } from '@/components/SwipeCard/SwipeableCard';
import MoodDeckSummary from '@/components/MoodDeckSummary';
import { Colors } from '@/constants/Colors';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useFeedManager } from '@/hooks/useFeedManager';
import { checkAndConsumeQuota } from '@/services/quotaEngine';
import { addToWatchlist, getAppUserId } from '@/services/watchlist';
import { Film } from '@/types/film';
import { FilmFilters } from '@/types';
import { posthogAnalytics } from '@/services/posthog';
import { tasteSignals } from '@/services/tasteSignalService';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_HEIGHT = SCREEN_HEIGHT;

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
  const { currentProfile, currentFilters, clearMood, addLastSessionFilm } = useMood();
  const { isPremium } = useSubscription();
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const isOnboarding = onboarding === '1';

  const navigateAfterOnboarding = useCallback(() => {
    if (isOnboarding) router.replace('/(tabs)' as never);
  }, [isOnboarding, router]);

  const { triggerPaywall, paywallProps: rawPaywallProps } = useContextualPaywall(navigateAfterOnboarding);
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
  } = useFeedManager(currentProfile, effectiveFilters);

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
      posthogAnalytics.track('mood_deck_started', {
        deck_size: managerFilms.length,
      });
    }
  }, [managerFilms]);

  // ── Current film ────────────────────────────────────────────────────────────

  const currentFilm = deck[currentIndex] ?? null;
  const deckSize = deck.length;

  // ── Advance to next card ────────────────────────────────────────────────────

  const advanceToNext = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= deckSize) {
      setDeckComplete(true);
    } else {
      setCurrentIndex(nextIndex);
    }
  }, [currentIndex, deckSize]);

  // ── Swipe handlers ──────────────────────────────────────────────────────────

  const handleSwipeRight = useCallback(
    async (film: Film) => {
      // Quota check (free users)
      if (!isPremium) {
        const uid = await getAppUserId();
        if (uid) {
          const quota = await checkAndConsumeQuota(uid, 'slot');
          if (!quota.allowed) {
            tasteSignals.recordSwipeRight(film.id).catch(() => {});
            triggerPaywall({ type: 'quota_exhausted', quota: 'slot' });
            advanceToNext();
            return;
          }
        }
      }

      // Watchlist'e ekle
      await addToWatchlist(film);
      onSwipeFilm(film, 'right');
      addLastSessionFilm(film);
      setLikedFilms((prev) => [...prev, film]);

      // Toast
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setShowSaveToast(true);
      toastTimer.current = setTimeout(() => setShowSaveToast(false), 1200);

      advanceToNext();
    },
    [isPremium, onSwipeFilm, addLastSessionFilm, triggerPaywall, advanceToNext],
  );

  const handleSwipeLeft = useCallback(
    (film: Film) => {
      onSwipeFilm(film, 'left');
      tasteSignals.recordSwipeLeft(film.id).catch(() => {});
      setDislikedFilms((prev) => [...prev, film]);
      advanceToNext();
    },
    [onSwipeFilm, advanceToNext],
  );

  // ── Navigation helpers ──────────────────────────────────────────────────────

  const { animatedStyle: newMoodAnimStyle, onPressIn: newMoodPressIn, onPressOut: newMoodPressOut } =
    useScalePress(0.95);

  const handleNewMood = useCallback(() => {
    clearMood();
    router.navigate('/(tabs)');
  }, [clearMood, router]);

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
          insufficientResults={insufficientResults || deckSize < 8}
          onNewMood={handleNewMood}
          onGoWatchlist={handleGoWatchlist}
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

      {/* Current swipe card */}
      {currentFilm && (
        <View style={{ height: CARD_HEIGHT }}>
          <SwipeableCard
            film={currentFilm}
            height={CARD_HEIGHT}
            bottomOffset={insets.bottom + 80}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
          />
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
            current: currentIndex + 1,
            total: deckSize,
          })}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / deckSize) * 100}%` },
            ]}
          />
        </View>
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
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  progressTrack: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accentPrimary,
    borderRadius: 2,
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
