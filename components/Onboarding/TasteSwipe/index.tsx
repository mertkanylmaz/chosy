/**
 * TasteSwipe — Cold-start onboarding swipe component.
 *
 * Kullaniciya 6 curated film gosterir. Her kart icin saga (like) veya
 * sola (skip) kaydirmak zorunlu. Tamamlaninca taste signal'leri kayda
 * alinmis olur → hybrid recommendation ilk aramadan itibaren aktif.
 *
 * Basitlestirilmis swipe mekanigi — discover.tsx'teki full stack'a ihtiyac yok.
 * Reanimated + GestureHandler ile 60fps animasyon.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Colors } from '@/constants/Colors';
import { hapticLight, hapticMedium, hapticSuccess } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { tasteSignals } from '@/services/tasteSignalService';
import { getAppUserId } from '@/services/watchlist';
import { useLanguage } from '@/contexts/LanguageContext';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const VELOCITY_THRESHOLD = 600;
const EXIT_DISTANCE = SCREEN_WIDTH * 1.5;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

/**
 * 6 curated film — genre dengeli, universally recognized.
 * DB'deki film_id'ler ile eslesmeli. posterPath TMDB w500 format.
 */
export interface ColdStartFilm {
  id: string;
  title: string;
  year: number;
  posterPath: string;
  genre: string;
}

/** Curated cold-start films — well-known, genre-diverse */
const COLD_START_FILMS: ColdStartFilm[] = [
  { id: '278', title: 'The Shawshank Redemption', year: 1994, posterPath: '/9cjIGRiQoOdyAMSMaHiMznO7SUk.jpg', genre: 'Drama' },
  { id: '27205', title: 'Inception', year: 2010, posterPath: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', genre: 'Sci-Fi' },
  { id: '129', title: 'Spirited Away', year: 2001, posterPath: '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', genre: 'Animation' },
  { id: '120467', title: 'The Grand Budapest Hotel', year: 2014, posterPath: '/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg', genre: 'Comedy' },
  { id: '419704', title: 'Get Out', year: 2017, posterPath: '/tFXcEccSQMf3zy7uWgQMBMRL5Z4.jpg', genre: 'Thriller' },
  { id: '313369', title: 'La La Land', year: 2016, posterPath: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', genre: 'Romance' },
];

const TOTAL_CARDS = COLD_START_FILMS.length;

// ── Props ─────────────────────────────────────────────────────────────────────

interface TasteSwipeProps {
  /** Tum kartlar tamamlandiginda cagirilir */
  onComplete: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Cold-start onboarding swipe — 6 film, zorunlu swipe.
 * Her swipe bir taste signal kaydeder.
 */
export function TasteSwipe({ onComplete }: TasteSwipeProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);
  const translateX = useSharedValue(0);

  /** Swipe tamamlandi — signal kaydet, sonraki karta gec */
  const handleSwipeComplete = useCallback(
    (direction: 'right' | 'left', filmIndex: number) => {
      const film = COLD_START_FILMS[filmIndex];
      if (!film) return;

      // Taste signal kaydi — fire-and-forget
      if (direction === 'right') {
        hapticMedium();
        tasteSignals.recordSwipeRight(film.id).catch((err) => {
          logger.error('[TasteSwipe] swipe_right signal failed:', err);
        });
      } else {
        hapticLight();
        tasteSignals.recordSwipeLeft(film.id).catch((err) => {
          logger.error('[TasteSwipe] swipe_left signal failed:', err);
        });
      }

      const nextIndex = filmIndex + 1;
      if (nextIndex >= TOTAL_CARDS) {
        // Tum kartlar bitti — dirty flag tetikle ve complete callback
        hapticSuccess();
        // preferences_vector_dirty migration 039 ile otomatik tetiklenir
        // (taste signal insert → trigger)
        onComplete();
      } else {
        setCurrentIndex(nextIndex);
      }
    },
    [onComplete],
  );

  /** Worklet: swipe sonrasi JS callback'e gec */
  const onSwipeDone = useCallback(
    (direction: 'right' | 'left') => {
      handleSwipeComplete(direction, currentIndex);
      translateX.value = 0;
    },
    [currentIndex, handleSwipeComplete, translateX],
  );

  // ── Gesture ─────────────────────────────────────────────────────────────────

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          const shouldSwipeRight =
            e.translationX > SWIPE_THRESHOLD || e.velocityX > VELOCITY_THRESHOLD;
          const shouldSwipeLeft =
            e.translationX < -SWIPE_THRESHOLD || e.velocityX < -VELOCITY_THRESHOLD;

          if (shouldSwipeRight) {
            translateX.value = withTiming(EXIT_DISTANCE, { duration: 250 }, () => {
              runOnJS(onSwipeDone)('right');
            });
          } else if (shouldSwipeLeft) {
            translateX.value = withTiming(-EXIT_DISTANCE, { duration: 250 }, () => {
              runOnJS(onSwipeDone)('left');
            });
          } else {
            translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
          }
        }),
    [translateX, onSwipeDone],
  );

  // ── Animated Styles ─────────────────────────────────────────────────────────

  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-15, 0, 15],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  /** Save overlay (sag) opacity */
  const saveOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  /** Skip overlay (sol) opacity */
  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  /** Back card scale — swipe ilerledikce buyur */
  const backCardStyle = useAnimatedStyle(() => {
    const scale = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD],
      [0.92, 1],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  const currentFilm = COLD_START_FILMS[currentIndex];
  const nextFilm = currentIndex + 1 < TOTAL_CARDS ? COLD_START_FILMS[currentIndex + 1] : null;
  const progress = currentIndex / TOTAL_CARDS;

  if (!currentFilm) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('onboarding.tasteSwipeTitle')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.tasteSwipeSubtitle')}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.counter}>
        {currentIndex + 1} / {TOTAL_CARDS}
      </Text>

      {/* Card stack */}
      <View style={styles.cardArea}>
        {/* Back card (next) */}
        {nextFilm && (
          <Animated.View style={[styles.card, styles.backCard, backCardStyle]}>
            <Image
              source={{ uri: `${TMDB_IMAGE_BASE}${nextFilm.posterPath}` }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['transparent', 'rgba(10,10,10,0.85)']}
              style={styles.gradient}
            />
            <View style={styles.cardInfo}>
              <Text style={styles.filmTitle} numberOfLines={2}>{nextFilm.title}</Text>
              <Text style={styles.filmMeta}>{nextFilm.year} · {nextFilm.genre}</Text>
            </View>
          </Animated.View>
        )}

        {/* Active card — zIndex:2 ensures it sits above backCard for touch */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, styles.activeCard, cardAnimatedStyle]}>
            <Image
              source={{ uri: `${TMDB_IMAGE_BASE}${currentFilm.posterPath}` }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <LinearGradient
              colors={['transparent', 'rgba(10,10,10,0.85)']}
              style={styles.gradient}
            />

            {/* Save overlay */}
            <Animated.View style={[styles.overlay, styles.saveOverlay, saveOverlayStyle]}>
              <Ionicons name="heart" size={48} color={Colors.success} />
              <Text style={styles.overlayText}>{t('onboarding.tasteSwipeLike')}</Text>
            </Animated.View>

            {/* Skip overlay */}
            <Animated.View style={[styles.overlay, styles.skipOverlay, skipOverlayStyle]}>
              <Ionicons name="close" size={48} color={Colors.error} />
              <Text style={styles.overlayText}>{t('onboarding.tasteSwipeSkip')}</Text>
            </Animated.View>

            {/* Film info */}
            <View style={styles.cardInfo}>
              <Text style={styles.filmTitle} numberOfLines={2}>{currentFilm.title}</Text>
              <Text style={styles.filmMeta}>{currentFilm.year} · {currentFilm.genre}</Text>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Action buttons — fallback for swipe + visual hint */}
      <View style={styles.hintRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={() => {
            translateX.value = withTiming(-EXIT_DISTANCE, { duration: 250 }, () => {
              runOnJS(onSwipeDone)('left');
            });
          }}
        >
          <Ionicons name="close-circle" size={32} color={Colors.error} />
          <Text style={[styles.hintText, { color: Colors.error }]}>{t('onboarding.tasteSwipeSkip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={() => {
            translateX.value = withTiming(EXIT_DISTANCE, { duration: 250 }, () => {
              runOnJS(onSwipeDone)('right');
            });
          }}
        >
          <Ionicons name="heart-circle" size={32} color={Colors.success} />
          <Text style={[styles.hintText, { color: Colors.success }]}>{t('onboarding.tasteSwipeLike')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_HEIGHT = CARD_WIDTH * 1.5;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
  },

  // Header
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  title: {
    color: Colors.textWhite,
    fontSize: 22,
    fontFamily: 'PlayfairDisplay_700Bold',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textGrey,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Progress
  progressTrack: {
    width: CARD_WIDTH,
    height: 4,
    backgroundColor: Colors.white10,
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    backgroundColor: Colors.accentPrimary,
    borderRadius: 2,
  },
  counter: {
    color: Colors.textGrey,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },

  // Card area
  cardArea: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  activeCard: {
    zIndex: 2,
  },
  backCard: {
    zIndex: 0,
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    top: '50%',
  },

  // Overlays
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  saveOverlay: {
    backgroundColor: 'rgba(34,197,94,0.2)',
    borderWidth: 3,
    borderColor: Colors.success,
  },
  skipOverlay: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 3,
    borderColor: Colors.error,
  },
  overlayText: {
    color: Colors.textWhite,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },

  // Film info
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
  },
  filmTitle: {
    color: Colors.textWhite,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 4,
  },
  filmMeta: {
    color: Colors.textGrey,
    fontSize: 14,
    fontWeight: '500',
  },

  // Hint
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: CARD_WIDTH,
    marginTop: 20,
    gap: 48,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hintText: {
    color: Colors.textLightGrey,
    fontSize: 13,
    fontWeight: '500',
  },
});
