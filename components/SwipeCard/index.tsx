/**
 * Chosy.ai — SwipeCard Component (v3)
 * Tinder-style stack kart mekanizması. FlatList YOK.
 *
 * Mekanik:
 * - 3 kart üst üste (position absolute, aynı konumda)
 * - Sadece en üstteki kart swipe edilebilir
 * - Sağa kaydır (RIGHT) → watchlist'e ekle
 * - Sola kaydır (LEFT) → atla
 * - Dikey scroll YOK — tüm geçiş sağ/sol swipe ile
 *
 * Stack Derinliği:
 * - currentIndex   → zIndex:3, scale:1.0  (aktif)
 * - currentIndex+1 → zIndex:2, scale:0.95, translateY:10
 * - currentIndex+2 → zIndex:1, scale:0.90, translateY:20
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Share,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { hapticHeavy, hapticLight, hapticMedium } from '@/utils/haptics';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Film } from '@/types/film';
import { Colors } from '@/constants/Colors';
import Lumi from '@/components/Lumi';

// ── Sabitler ──────────────────────────────────────────────────────────────────
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_X_THRESHOLD = SCREEN_WIDTH * 0.2;
const VELOCITY_X_THRESHOLD = 500;
const EXIT_X_DISTANCE = SCREEN_WIDTH * 1.5;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
const TAB_BAR_HEIGHT = 83;
const HEADER_HEIGHT = 56;
const STATUS_BAR_H = Platform.OS === 'ios' ? 44 : (RNStatusBar.currentHeight ?? 24);
/** Kart yüksekliği — ekrandan header + tab bar + küçük margin çıkar */
const CARD_HEIGHT = SCREEN_HEIGHT - TAB_BAR_HEIGHT - STATUS_BAR_H - HEADER_HEIGHT - 20;

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface SwipeCardFeedProps {
  films: Film[];
  onSwipeRight: (film: Film) => void;
  onSwipeLeft: (film: Film) => void;
  onLoadMore?: () => void;
  onNewMood?: () => void;
  tabBarHeight?: number;
}

interface CardVisualProps {
  film: Film;
  /**
   * Sağ/sol swipe overlay kontrolü.
   * pozitif [0,1] = Saved overlay opacity
   * negatif [-1,0] = Skip overlay opacity
   * undefined = overlay render edilmez (arkadaki kartlar)
   */
  rawOverlay?: SharedValue<number>;
  onSave: () => void;
}

// ── Kart Görseli (gesture yok, sadece render) ─────────────────────────────────

/**
 * Film kartının görsel içeriği.
 * Gesture mantığı SwipeCardFeed'de; bu component sadece UI render eder.
 */
const CardVisual: React.FC<CardVisualProps> = React.memo(({
  film,
  rawOverlay,
  onSave,
}) => {
  const router = useRouter();

  const fullPosterUrl: string | null = film.posterUrl
    ? film.posterUrl.startsWith('http')
      ? film.posterUrl
      : `${TMDB_IMAGE_BASE}${film.posterUrl}`
    : null;

  const matchPercent = film.matchScore ?? 0;
  const rating = film.voteAverage ?? 0;

  const surpriseLabel: string | null =
    film.surpriseType === 'hidden_gem' ? '💎 Hidden Gem'
    : film.surpriseType === 'ai_pick' ? '⭐ AI Pick'
    : film.surpriseType === 'unexpected' ? '🎲 Unexpected'
    : null;

  const handlePress = useCallback(() => {
    if (!film?.id) return;
    router.push(`/film/${film.id}`);
  }, [router, film.id]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Check out "${film.title}" on Chosy.ai! ${matchPercent}% mood match.`,
      });
    } catch {
      // kullanıcı iptal etti
    }
  }, [film.title, matchPercent]);

  const metaParts: string[] = [];
  if (film.director) metaParts.push(film.director);
  if (film.year) metaParts.push(String(film.year));
  const metaString = metaParts.join(' · ');

  // Overlay animated style — rawOverlay undefined ise opacity 0
  const saveOverlayStyle = useAnimatedStyle(() => {
    if (!rawOverlay || rawOverlay.value <= 0) return { opacity: 0 };
    return {
      opacity: interpolate(
        rawOverlay.value,
        [0, SCREEN_WIDTH * 0.1, SCREEN_WIDTH * 0.25],
        [0, 0.5, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const skipOverlayStyle = useAnimatedStyle(() => {
    if (!rawOverlay || rawOverlay.value >= 0) return { opacity: 0 };
    return {
      opacity: interpolate(
        rawOverlay.value,
        [0, -SCREEN_WIDTH * 0.1, -SCREEN_WIDTH * 0.25],
        [0, 0.5, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  return (
    <View style={styles.card}>

      {/* Sürpriz kart altın border */}
      {film.surpriseType != null && (
        <View style={styles.surpriseBorder} pointerEvents="none" />
      )}

      {/* Poster — tıklanabilir (film detay) */}
      <TouchableOpacity
        style={StyleSheet.absoluteFillObject}
        onPress={handlePress}
        activeOpacity={0.97}
      >
        {fullPosterUrl != null ? (
          <Image
            source={{ uri: fullPosterUrl, cache: 'force-cache' }}
            style={styles.poster}
            resizeMode="cover"
            fadeDuration={200}
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Text style={styles.posterPlaceholderIcon}>🎬</Text>
            <Text style={styles.posterPlaceholderTitle}>{film.title}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* SAVED Overlay */}
      <Animated.View
        style={[styles.swipeOverlay, styles.goldOverlay, saveOverlayStyle]}
        pointerEvents="none"
      >
        <Text style={styles.overlayText}>Saved ✓</Text>
      </Animated.View>

      {/* SKIP Overlay */}
      <Animated.View
        style={[styles.swipeOverlay, styles.greyOverlay, skipOverlayStyle]}
        pointerEvents="none"
      >
        <Text style={styles.overlayText}>Skip</Text>
      </Animated.View>

      {/* Sürpriz Badge */}
      {surpriseLabel != null && (
        <View style={styles.surpriseBadge}>
          <Text style={styles.surpriseBadgeText}>{surpriseLabel}</Text>
        </View>
      )}

      {/* Mini Lumi — pick_type olan sürpriz kartlarda sağ üst köşe */}
      {film.pick_type != null && (
        <View style={styles.miniLumiContainer} pointerEvents="none">
          <Lumi size="small" mood="excited" showGlow={false} />
          <View style={styles.miniLumiBadge}>
            <Text style={styles.miniLumiBadgeText}>
              {film.pick_type === 'hidden_gem'
                ? 'Hidden Gem 💎'
                : film.pick_type === 'ai_pick'
                  ? 'AI Pick ⭐'
                  : 'Surprise 🎲'}
            </Text>
          </View>
        </View>
      )}

      {/* Sağ Taraf Dikey Butonlar */}
      <View style={styles.sideButtons}>
        <TouchableOpacity style={styles.sideBtn} onPress={handleShare} activeOpacity={0.75}>
          <View style={styles.sideIconCircle}>
            <Text style={styles.sideIcon}>⬆</Text>
          </View>
          <Text style={styles.sideBtnLabel}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sideBtn} onPress={onSave} activeOpacity={0.75}>
          <View style={styles.sideIconCircle}>
            <Text style={styles.sideIcon}>♡</Text>
          </View>
          <Text style={styles.sideBtnLabel}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Alt Gradient Overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(4,6,18,0.72)', 'rgba(4,6,18,0.97)']}
        style={styles.bottomGradient}
        pointerEvents="box-none"
      >
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{film.title}</Text>
          {matchPercent > 0 && (
            <View style={styles.matchCircle}>
              <Text style={styles.matchPercent}>{matchPercent}%</Text>
            </View>
          )}
        </View>

        <Text style={styles.moodMatchLabel}>Mood Match Score</Text>

        {film.whyThisFilm != null && (
          <Text style={styles.aiExplanation} numberOfLines={2}>{film.whyThisFilm}</Text>
        )}

        <View style={styles.metaRow}>
          {metaString.length > 0 && (
            <Text style={styles.metaText}>{metaString}</Text>
          )}
          {rating > 0 && (
            <Text style={styles.imdbText}>
              {metaString.length > 0 ? ' · ' : ''}⭐ {rating.toFixed(1)}
            </Text>
          )}
        </View>

        <TouchableOpacity style={styles.watchlistBtn} onPress={onSave} activeOpacity={0.85}>
          <LinearGradient
            colors={[Colors.gold, Colors.goldDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.watchlistGradient}
          >
            <Text style={styles.watchlistBtnText}>Add to Watchlist</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

    </View>
  );
});

CardVisual.displayName = 'CardVisual';

// ── Ana Feed Component ────────────────────────────────────────────────────────

/**
 * Tinder-style stack card feed.
 * 3 kart üst üste; sadece en üstteki swipe edilebilir.
 * Swipe sonrası kart ekrandan uçar, alttaki kart öne gelir.
 */
const SwipeCardFeed: React.FC<SwipeCardFeedProps> = React.memo(({
  films,
  onSwipeRight,
  onSwipeLeft,
  onLoadMore,
  onNewMood,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  /** Üstteki kartın yatay pozisyonu */
  const translateX = useSharedValue(0);
  /**
   * Swipe yönü sinyali: pozitif=sağ, negatif=sol.
   * Overlay opacity ve backing card animasyonu için kullanılır.
   */
  const rawOverlay = useSharedValue(0);
  /** 0→1: swipe ne kadar ilerledi (backing card scale için) */
  const swipeProgress = useSharedValue(0);

  // 10 film kala sonraki batch yükle
  useEffect(() => {
    if (films.length > 0 && films.length - currentIndex <= 10) {
      onLoadMore?.();
    }
  }, [currentIndex, films.length, onLoadMore]);

  // Sürpriz film görününce güçlü haptic
  useEffect(() => {
    const film = films[currentIndex];
    if (film?.surpriseType) hapticHeavy();
  }, [currentIndex, films]);

  /** Animasyon değerlerini sıfırla (swipe sonrası) */
  const resetCard = useCallback(() => {
    translateX.value = 0;
    rawOverlay.value = 0;
    swipeProgress.value = 0;
  }, [translateX, rawOverlay, swipeProgress]);

  /** Swipe animasyonu tamamlanınca: aksiyon + index ilerle + reset */
  const handleSwipeComplete = useCallback((direction: 'right' | 'left') => {
    const film = films[currentIndex];
    if (!film) return;
    if (direction === 'right') {
      hapticMedium();
      onSwipeRight(film);
    } else {
      hapticLight();
      onSwipeLeft(film);
    }
    setCurrentIndex(prev => prev + 1);
    resetCard();
  }, [currentIndex, films, onSwipeRight, onSwipeLeft, resetCard]);

  /** Watchlist/Save butonuna basınca sağa fling animasyonu */
  const handleSave = useCallback(() => {
    rawOverlay.value = withTiming(EXIT_X_DISTANCE, { duration: 200 });
    swipeProgress.value = withTiming(1, { duration: 300 });
    translateX.value = withSpring(EXIT_X_DISTANCE, { damping: 15, stiffness: 100, mass: 0.8 }, (finished) => {
      'worklet';
      if (finished) runOnJS(handleSwipeComplete)('right');
    });
  }, [rawOverlay, swipeProgress, translateX, handleSwipeComplete]);

  // ── Gesture ──────────────────────────────────────────────────────────────

  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      rawOverlay.value = event.translationX;
      swipeProgress.value = Math.min(
        Math.abs(event.translationX) / (SCREEN_WIDTH * 0.2),
        1,
      );
    })
    .onEnd((event) => {
      'worklet';
      const isRight = event.translationX > SWIPE_X_THRESHOLD || event.velocityX > VELOCITY_X_THRESHOLD;
      const isLeft = event.translationX < -SWIPE_X_THRESHOLD || event.velocityX < -VELOCITY_X_THRESHOLD;
      if (isRight) {
        // Sağa fırlat
        rawOverlay.value = withTiming(EXIT_X_DISTANCE, { duration: 200 });
        swipeProgress.value = withTiming(1, { duration: 300 });
        translateX.value = withSpring(EXIT_X_DISTANCE, { damping: 15, stiffness: 100, mass: 0.8 }, (finished) => {
          'worklet';
          if (finished) runOnJS(handleSwipeComplete)('right');
        });
      } else if (isLeft) {
        // Sola fırlat
        rawOverlay.value = withTiming(-EXIT_X_DISTANCE, { duration: 200 });
        swipeProgress.value = withTiming(1, { duration: 300 });
        translateX.value = withSpring(-EXIT_X_DISTANCE, { damping: 15, stiffness: 100, mass: 0.8 }, (finished) => {
          'worklet';
          if (finished) runOnJS(handleSwipeComplete)('left');
        });
      } else {
        // Threshold geçilmedi — geri dönsün
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        rawOverlay.value = withSpring(0, { damping: 20, stiffness: 200 });
        swipeProgress.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
    });

  // ── Animated Styles ──────────────────────────────────────────────────────

  /** Üstteki kartın hareketi */
  const topCardAnimStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-15, 0, 15],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: translateX.value },
        { rotate: `${rotation}deg` },
      ],
    };
  });

  /** 2. kart: swipe ilerledikçe scale:0.95→1.0, translateY:10→0 */
  const secondCardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(swipeProgress.value, [0, 1], [0.95, 1.0], Extrapolation.CLAMP) },
      { translateY: interpolate(swipeProgress.value, [0, 1], [10, 0], Extrapolation.CLAMP) },
    ],
  }));

  /** 3. kart: swipe ilerledikçe scale:0.90→0.95, translateY:20→10 */
  const thirdCardAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(swipeProgress.value, [0, 1], [0.90, 0.95], Extrapolation.CLAMP) },
      { translateY: interpolate(swipeProgress.value, [0, 1], [20, 10], Extrapolation.CLAMP) },
    ],
  }));

  // ── Boş Durumlar ─────────────────────────────────────────────────────────

  if (films.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🎬</Text>
        <Text style={styles.emptyTitle}>No movies yet</Text>
        <Text style={styles.emptySubtitle}>Describe your mood to discover movies</Text>
        {onNewMood != null && (
          <TouchableOpacity style={styles.emptyMoodBtn} onPress={onNewMood} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyMoodBtnGradient}
            >
              <Text style={styles.emptyMoodBtnText}>Go to Mood</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (currentIndex >= films.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>✨</Text>
        <Text style={styles.emptyTitle}>That's all!</Text>
        <Text style={styles.emptySubtitle}>Try a new mood to discover more films</Text>
        {onNewMood != null && (
          <TouchableOpacity style={styles.emptyMoodBtn} onPress={onNewMood} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyMoodBtnGradient}
            >
              <Text style={styles.emptyMoodBtnText}>New Mood</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Stack Render ──────────────────────────────────────────────────────────

  const film0 = films[currentIndex];
  const film1 = films[currentIndex + 1] ?? null;
  const film2 = films[currentIndex + 2] ?? null;

  return (
    <View style={styles.feedContainer}>

      {/* Header: başlık + "New mood" pill */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Film Discovery</Text>
        {onNewMood != null && (
          <TouchableOpacity style={styles.newMoodPill} onPress={onNewMood} activeOpacity={0.8}>
            <Text style={styles.newMoodPillText}>✦ New mood</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Kart Stack */}
      <View style={styles.stackContainer}>

        {/* Kart 3 — en arkada */}
        {film2 != null && (
          <Animated.View style={[styles.cardWrapper, { zIndex: 1 }, thirdCardAnimStyle]}>
            <CardVisual film={film2} onSave={() => {}} />
          </Animated.View>
        )}

        {/* Kart 2 — ortada */}
        {film1 != null && (
          <Animated.View style={[styles.cardWrapper, { zIndex: 2 }, secondCardAnimStyle]}>
            <CardVisual film={film1} onSave={() => {}} />
          </Animated.View>
        )}

        {/* Kart 1 — en üstte, swipe edilebilir */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.cardWrapper, { zIndex: 3 }, topCardAnimStyle]}>
            <CardVisual
              film={film0}
              rawOverlay={rawOverlay}
              onSave={handleSave}
            />
          </Animated.View>
        </GestureDetector>

      </View>
    </View>
  );
});

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ─── Feed ──────────────────────────────────────────────────────────────────
  feedContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  feedHeader: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  feedTitle: {
    color: Colors.textWhite,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  newMoodPill: {
    backgroundColor: 'rgba(212,168,67,0.12)',
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  newMoodPillText: {
    color: Colors.gold,
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Stack ─────────────────────────────────────────────────────────────────
  stackContainer: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 10,
  },
  /** Her kart position absolute ile aynı alanda yığılır */
  cardWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ─── Kart ──────────────────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 16,
  },

  // ─── Sürpriz Border ────────────────────────────────────────────────────────
  surpriseBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.gold,
    zIndex: 30,
    shadowColor: Colors.gold,
    shadowOpacity: 0.85,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },

  // ─── Poster ────────────────────────────────────────────────────────────────
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  posterPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0D1130',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterPlaceholderIcon: {
    fontSize: 56,
    marginBottom: 12,
  },
  posterPlaceholderTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ─── Swipe Overlay'ler ─────────────────────────────────────────────────────
  swipeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  goldOverlay: {
    backgroundColor: 'rgba(212,168,67,0.15)',
    borderWidth: 3,
    borderColor: '#D4A843',
    borderRadius: 20,
  },
  greyOverlay: {
    backgroundColor: 'rgba(138,130,144,0.15)',
    borderWidth: 3,
    borderColor: '#8A8290',
    borderRadius: 20,
  },
  overlayText: {
    color: Colors.textWhite,
    fontSize: 40,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // ─── Sürpriz Badge ─────────────────────────────────────────────────────────
  surpriseBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 20,
    backgroundColor: 'rgba(212,168,67,0.92)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  surpriseBadgeText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '700',
  },

  // ─── Mini Lumi (pick_type) ────────────────────────────────────────────────
  miniLumiContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 20,
    alignItems: 'center',
  },
  miniLumiBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(212,168,67,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212,168,67,0.4)',
  },
  miniLumiBadgeText: {
    color: Colors.gold,
    fontSize: 10,
    fontWeight: '600',
  },

  // ─── Sağ Taraf Dikey Butonlar ──────────────────────────────────────────────
  sideButtons: {
    position: 'absolute',
    right: 14,
    bottom: 230,
    zIndex: 20,
    alignItems: 'center',
    gap: 16,
  },
  sideBtn: {
    alignItems: 'center',
    gap: 4,
  },
  sideIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideIcon: {
    color: Colors.textWhite,
    fontSize: 20,
  },
  sideBtnLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },

  // ─── Alt Gradient Overlay ──────────────────────────────────────────────────
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 80,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 4,
    gap: 12,
  },
  title: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: 26,
    fontFamily: 'PlayfairDisplay_700Bold',
    lineHeight: 32,
  },
  matchCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginBottom: 2,
  },
  matchPercent: {
    color: Colors.gold,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  moodMatchLabel: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  aiExplanation: {
    color: Colors.textLightGrey,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
    marginRight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  metaText: {
    color: Colors.textGrey,
    fontSize: 12,
  },
  imdbText: {
    color: Colors.imdbYellow,
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Watchlist Butonu ──────────────────────────────────────────────────────
  watchlistBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  watchlistGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  watchlistBtnText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ─── Boş Durum ─────────────────────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.textWhite,
    fontSize: 24,
    fontFamily: 'PlayfairDisplay_700Bold',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: Colors.textGrey,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  emptyMoodBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
  },
  emptyMoodBtnGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  emptyMoodBtnText: {
    color: Colors.background,
    fontSize: 17,
    fontWeight: 'bold',
  },
});

export default SwipeCardFeed;
