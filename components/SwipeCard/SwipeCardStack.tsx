/**
 * SwipeCardStack — Hibrit swipe motorlu kart yığını.
 *
 * Mekanik:
 * - 3 kart position absolute üst üste (currentIndex, +1, +2)
 * - Sadece en üstteki kart swipe edilebilir (GestureDetector)
 * - Yatay: Tinder-style fırlat → sağ=watchlist+sil, sol=skip+sil
 * - Dikey: TikTok-style snap → aşağı=ileri (feed'de kalır), yukarı=geri
 * - Yön kilidi: açı bazlı, 10px sonra kilitlenir
 * - 2. kart: scale 0.92→1.0 swipe ilerledikçe büyür (backCardStyle)
 *
 * Gesture.Pan bileşende oluşturulur, useHybridSwipe handler'larını kullanır.
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Dimensions,
  Image,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { hapticLight, hapticMedium, hapticSuccess } from '@/utils/haptics';
import { useHybridSwipe, SwipeDirection } from '@/hooks/useHybridSwipe';
import { useLanguage } from '@/contexts/LanguageContext';
import { Film } from '@/types/film';
import { Colors } from '@/constants/Colors';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
const HEADER_HEIGHT = 56;

/**
 * rawOverlay bu değerden büyüyünce overlay görünmeye başlar.
 * rawOverlay = translationX / SWIPE_X_THRESHOLD (≈ translationX / (0.35 * W))
 * OVERLAY_THRESHOLD = 0.15 * W → normalized ≈ 0.15 / 0.35 ≈ 0.43
 */
const OVERLAY_START = (SCREEN_WIDTH * 0.15) / (SCREEN_WIDTH * 0.35);

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface SwipeCardStackProps {
  films: Film[];
  currentIndex: number;
  onSwipeComplete: (direction: SwipeDirection) => void;
  onNewMood?: () => void;
}

interface CardVisualProps {
  film: Film;
  /**
   * rawOverlay shared value (-1→skip, 0→none, 1→save).
   * Sadece aktif karta verilir. undefined = overlay render edilmez.
   */
  rawOverlay?: SharedValue<number>;
  onSave: () => void;
  /** i18n translation function */
  t: (key: string, opts?: Record<string, string | number>) => string;
}

// ── Kart Görseli ──────────────────────────────────────────────────────────────

/**
 * Film kartının görsel içeriği.
 * Gesture mantığı yoktur — SwipeCardStack tarafından sarılır.
 */
const CardVisual: React.FC<CardVisualProps> = React.memo(({ film, rawOverlay, onSave, t }) => {
  const router = useRouter();

  const fullPosterUrl: string | null = film.posterUrl
    ? film.posterUrl.startsWith('http')
      ? film.posterUrl
      : `${TMDB_IMAGE_BASE}${film.posterUrl}`
    : null;

  const matchPercent = film.matchScore ?? 0;
  const rating = film.voteAverage ?? 0;

  const surpriseLabel: string | null =
    film.surpriseType === 'hidden_gem'
      ? '💎 Hidden Gem'
      : film.surpriseType === 'ai_pick'
        ? '⭐ AI Pick'
        : film.surpriseType === 'unexpected'
          ? '🎲 Unexpected'
          : null;

  const handlePress = useCallback(() => {
    if (!film?.id) return;
    router.push(`/film/${film.id}`);
  }, [router, film.id]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: t('swipeCard.shareMessage', { title: film.title, match: matchPercent }),
      });
    } catch {
      // kullanıcı iptal etti
    }
  }, [film.title, matchPercent, t]);

  const metaParts: string[] = [];
  if (film.director) metaParts.push(film.director);
  if (film.year) metaParts.push(String(film.year));
  const metaString = metaParts.join(' · ');

  /**
   * Sağ swipe → "Saved ✓" overlay.
   * OVERLAY_START değerinden itibaren görünmeye başlar.
   */
  const saveOverlayStyle = useAnimatedStyle(() => ({
    opacity: rawOverlay
      ? interpolate(rawOverlay.value, [OVERLAY_START, 1], [0, 1], Extrapolation.CLAMP)
      : 0,
  }));

  /**
   * Sol swipe → "Skip" overlay.
   * -OVERLAY_START değerinden itibaren görünmeye başlar.
   */
  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: rawOverlay
      ? interpolate(rawOverlay.value, [-1, -OVERLAY_START], [1, 0], Extrapolation.CLAMP)
      : 0,
  }));

  return (
    <View style={styles.card}>

      {/* Sürpriz kart altın border */}
      {film.surpriseType != null && (
        <View style={styles.surpriseBorder} pointerEvents="none" />
      )}

      {/* Poster — tıklanınca film detay */}
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

      {/* SAVED overlay (sağa swipe) */}
      <Animated.View
        style={[styles.swipeOverlay, styles.goldOverlay, saveOverlayStyle]}
        pointerEvents="none"
      >
        <Text style={styles.overlayText}>+</Text>
      </Animated.View>

      {/* SKIP overlay (sola swipe) */}
      <Animated.View
        style={[styles.swipeOverlay, styles.greyOverlay, skipOverlayStyle]}
        pointerEvents="none"
      >
        <Text style={styles.overlayText}>✕</Text>
      </Animated.View>

      {/* Sürpriz badge */}
      {surpriseLabel != null && (
        <View style={styles.surpriseBadge}>
          <Text style={styles.surpriseBadgeText}>{surpriseLabel}</Text>
        </View>
      )}

      {/* Sağ taraf dikey aksiyon butonları */}
      <View style={styles.sideButtons}>
        <TouchableOpacity style={styles.sideBtn} onPress={handleShare} activeOpacity={0.75}>
          <View style={styles.sideIconCircle}>
            <Ionicons name="share-social-outline" size={22} color={Colors.textWhite} />
          </View>
          <Text style={styles.sideBtnLabel}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sideBtn} onPress={onSave} activeOpacity={0.75}>
          <View style={styles.sideIconCircle}>
            <Ionicons name="bookmark-outline" size={22} color={Colors.textWhite} />
          </View>
          <Text style={styles.sideBtnLabel}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Alt gradient — başlık, meta, watchlist butonu */}
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

        {film.whyThisFilm != null && film.whyThisFilm.length > 0 && (
          <Text style={styles.aiExplanation} numberOfLines={2}>
            {film.whyThisFilm}
          </Text>
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
            <Text style={styles.watchlistBtnText}>{t('filmDetail.addToWatchlist')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

    </View>
  );
});

CardVisual.displayName = 'CardVisual';

// ── Ana Stack Component ───────────────────────────────────────────────────────

/**
 * 3 kartlık Tinder+TikTok hibrit swipe yığını.
 *
 * Gesture.Pan bileşende oluşturulur; useHybridSwipe hook'u
 * handler fonksiyonlarını ve animated stilleri sağlar.
 */
export const SwipeCardStack: React.FC<SwipeCardStackProps> = ({
  films,
  currentIndex,
  onSwipeComplete,
  onNewMood,
}) => {
  const { t } = useLanguage();

  // ── Sürpriz kart haptic ──────────────────────────────────────────────────
  useEffect(() => {
    const film = films[currentIndex];
    if (film?.surpriseType) hapticSuccess();
  }, [currentIndex, films]);

  // ── Swipe hook ────────────────────────────────────────────────────────────

  const {
    rawOverlay,
    swipeProgress,
    onGestureStart,
    onGestureUpdate,
    onGestureEnd,
    activeCardStyle,
    backCardStyle,
    resetValues,
  } = useHybridSwipe(
    useCallback(
      (dir: SwipeDirection) => {
        // Haptic — yöne göre
        if (dir === 'right') hapticMedium();
        else if (dir === 'left') hapticLight();
        else hapticLight(); // dikey geçiş

        resetValues(); // animasyon değerlerini sıfırla, sonra parent render
        onSwipeComplete(dir);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [onSwipeComplete],
    ),
  );

  // ── Gesture.Pan ───────────────────────────────────────────────────────────

  /**
   * Pan gesture bileşende oluşturulur.
   * minDistance: 5 → hassas yakalama
   * activeOffsetX/Y kullanılmaz — kendi yön kilidimiz var
   * useMemo: gesture nesnesi stabil kalır; worklet'ler stable shared values'i kullanır
   */
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .minPointers(1)
        .maxPointers(1)
        .minDistance(5)
        .onBegin(() => {
          'worklet';
          onGestureStart();
        })
        .onUpdate((e) => {
          'worklet';
          onGestureUpdate(e.translationX, e.translationY);
        })
        .onEnd((e) => {
          'worklet';
          onGestureEnd(e.translationX, e.translationY, e.velocityX, e.velocityY);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [], // worklet'ler stable shared values üzerinden çalışır
  );

  // ── "Add to Watchlist" butonu → sağa swipe simüle et ─────────────────────

  const handleSaveButton = useCallback(() => {
    hapticMedium();
    resetValues();
    onSwipeComplete('right');
  }, [resetValues, onSwipeComplete]);

  // ── 3. kart stili ─────────────────────────────────────────────────────────

  /**
   * 3. kart: 2. kartın yarısı kadar öne gelir.
   * swipeProgress'e bağlı; doğrudan hook'tan alınmaz — bileşende hesaplanır.
   */
  const thirdCardStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: interpolate(
          swipeProgress.value,
          [0, 1],
          [0.85, 0.92],
          Extrapolation.CLAMP,
        ),
      },
      {
        translateY: interpolate(
          swipeProgress.value,
          [0, 1],
          [28, 14],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // ── Boş durumlar ──────────────────────────────────────────────────────────

  if (films.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🎬</Text>
        <Text style={styles.emptyTitle}>{t('swipeCard.noMovies')}</Text>
        <Text style={styles.emptySubtitle}>{t('swipeCard.describeToDiscover')}</Text>
        {onNewMood != null && (
          <TouchableOpacity style={styles.emptyBtn} onPress={onNewMood} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyBtnGradient}
            >
              <Text style={styles.emptyBtnText}>{t('swipeCard.goToMood')}</Text>
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
        <Text style={styles.emptyTitle}>{t('swipeCard.thatsAll')}</Text>
        <Text style={styles.emptySubtitle}>{t('swipeCard.tryNewMood')}</Text>
        {onNewMood != null && (
          <TouchableOpacity style={styles.emptyBtn} onPress={onNewMood} activeOpacity={0.85}>
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyBtnGradient}
            >
              <Text style={styles.emptyBtnText}>{t('swipeCard.newMood')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ── Stack render ──────────────────────────────────────────────────────────

  const film0 = films[currentIndex];
  const film1 = films[currentIndex + 1] ?? null;
  const film2 = films[currentIndex + 2] ?? null;

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('swipeCard.filmDiscovery')}</Text>
        {onNewMood != null && (
          <TouchableOpacity style={styles.newMoodPill} onPress={onNewMood} activeOpacity={0.8}>
            <Text style={styles.newMoodPillText}>✦ {t('swipeCard.newMoodPill')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Kart yığını */}
      <View style={styles.stackArea}>

        {/* 3. kart — en arkada */}
        {film2 != null && (
          <Animated.View style={[styles.cardWrapper, { zIndex: 1 }, thirdCardStyle]}>
            <CardVisual film={film2} onSave={() => {}} t={t} />
          </Animated.View>
        )}

        {/* 2. kart — ortada, ön kart sürüklendikçe büyür */}
        {film1 != null && (
          <Animated.View style={[styles.cardWrapper, { zIndex: 2 }, backCardStyle]}>
            <CardVisual film={film1} onSave={() => {}} t={t} />
          </Animated.View>
        )}

        {/* 1. kart — en üstte, gesture aktif */}
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.cardWrapper, { zIndex: 3 }, activeCardStyle]}>
            <CardVisual
              film={film0}
              rawOverlay={rawOverlay}
              onSave={handleSaveButton}
              t={t}
            />
          </Animated.View>
        </GestureDetector>

      </View>
    </View>
  );
};

SwipeCardStack.displayName = 'SwipeCardStack';

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ─── Ana container ─────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ─── Header ────────────────────────────────────────────────────────────────
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  headerTitle: {
    color: Colors.textWhite,
    fontSize: 20,
    fontFamily: 'PlayfairDisplay_700Bold',
  },
  newMoodPill: {
    backgroundColor: Colors.goldDim,
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

  // ─── Stack alanı ───────────────────────────────────────────────────────────
  stackArea: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 10,
  },
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

  // ─── Sürpriz border ────────────────────────────────────────────────────────
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
    backgroundColor: Colors.bgCard,
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

  // ─── Swipe overlay'ler ─────────────────────────────────────────────────────
  swipeOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  goldOverlay: {
    backgroundColor: 'rgba(34,197,94,0.2)',
  },
  greyOverlay: {
    backgroundColor: 'rgba(239,68,68,0.2)',
  },
  overlayText: {
    color: Colors.textWhite,
    fontSize: 40,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  // ─── Sürpriz badge ─────────────────────────────────────────────────────────
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

  // ─── Sağ taraf butonlar ────────────────────────────────────────────────────
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
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '600',
  },

  // ─── Alt gradient ──────────────────────────────────────────────────────────
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

  // ─── Watchlist butonu ──────────────────────────────────────────────────────
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

  // ─── Boş durum ─────────────────────────────────────────────────────────────
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
});

export default SwipeCardStack;
