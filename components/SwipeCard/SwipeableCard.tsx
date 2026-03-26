/**
 * SwipeableCard — Tek film kartı, kendi yatay swipe mekanizmasıyla.
 *
 * Mekanik:
 * - Yatay pan: Tinder tarzı sağ/sol swipe → kart ekrandan uçar → callback
 * - Dikey kaydırma: FlatList üzerinden, bu component müdahale etmez
 * - Gesture çakışması: activeOffsetX([-15,15]) + failOffsetY([-10,10])
 *
 * Animasyon:
 * - Swipe eşiği geçilince: withTiming(±SCREEN_WIDTH*1.5, 300ms) → runOnJS callback
 * - Eşik geçilmezse: withSpring(0) ile geri döner
 * - Overlay: sürüklerken fade in, bırakınca ya kalır (uçuşa eşlik eder) ya sıfırlanır
 */

import React, { useCallback, useEffect, useRef } from 'react';
import {
  Dimensions,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { hapticLight, hapticMedium, hapticSuccess } from '@/utils/haptics';

import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Film } from '@/types/film';
import { Colors } from '@/constants/Colors';
import Lumi from '@/components/Lumi';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Film için Lumi AI açıklama metni üretir.
 * film.whyThisFilm varsa kullanılır; yoksa genres'ten template üretilir.
 */
function getAIExplanation(film: Film): string {
  if (film.whyThisFilm) return film.whyThisFilm;
  const genres = film.moodTags.slice(0, 2).join(' and ').toLowerCase();
  if (!genres) return 'A unique film picked just for your current mood';
  const templates = [
    `A ${genres} film that perfectly matches your mood`,
    `Rich ${genres} storytelling for your current state`,
    `This ${genres} gem delivers exactly what you need`,
    `Your mood pairs beautifully with this ${genres} film`,
  ];
  const charCode = film.id ? film.id.charCodeAt(0) : 0;
  return templates[charCode % templates.length];
}

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Swipe tamamlanma eşiği */
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;
/** Hız bazlı swipe için minimum velocity */
const VELOCITY_THRESHOLD = 500;
/** Kart ekrandan çıkış mesafesi */
const EXIT_X = SCREEN_WIDTH * 1.5;

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface SwipeableCardProps {
  film: Film;
  /** Kartın yüksekliği — FlatList item height ile eşleşmeli */
  height: number;
  onSwipeRight: (film: Film) => void;
  onSwipeLeft: (film: Film) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Tek bir film kartı.
 * Kendi translateX / cardRotation / overlay shared value'larını yönetir.
 * FlatList item olarak render edilir; dikey scroll FlatList'e devredilir.
 */
export const SwipeableCard: React.FC<SwipeableCardProps> = React.memo(({
  film,
  height,
  onSwipeRight,
  onSwipeLeft,
}) => {
  const router = useRouter();

  // ── Shared values ─────────────────────────────────────────────────────────
  const translateX = useSharedValue(0);
  const cardRotation = useSharedValue(0);
  const savedOpacity = useSharedValue(0);
  const skipOpacity = useSharedValue(0);
  /** Threshold geçişinde bir kez tetiklenmesi için guard */
  const thresholdHapticFired = useSharedValue(false);

  // ── Türetilmiş değerler ───────────────────────────────────────────────────
  const fullPosterUrl: string | null = film.posterUrl
    ? film.posterUrl.startsWith('http')
      ? film.posterUrl
      : `${TMDB_IMAGE_BASE}${film.posterUrl}`
    : null;

  const matchPercent = film.matchScore ?? 0;
  const rating = film.voteAverage ?? 0;
  const metaParts: string[] = [];
  if (film.director) metaParts.push(film.director);
  if (film.year) metaParts.push(String(film.year));
  const metaString = metaParts.join(' · ');

  /** pick_type önceliklidir; yoksa surpriseType kullanılır */
  const effectiveType = film.pick_type ?? film.surpriseType ?? null;

  const surpriseLabel: string | null =
    effectiveType === 'hidden_gem'
      ? '💎 Hidden Gem'
      : effectiveType === 'ai_pick'
        ? '⭐ AI Pick'
        : effectiveType === 'unexpected'
          ? '🎲 Unexpected'
          : null;

  // Sürpriz kart ilk görününce notification haptic (bir kez)
  const hapticFiredRef = useRef(false);
  useEffect(() => {
    if (effectiveType != null && !hapticFiredRef.current) {
      hapticFiredRef.current = true;
      hapticSuccess();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── JS thread callback'ler ────────────────────────────────────────────────

  /**
   * Sağa swipe tamamlandı — haptic + parent callback.
   * runOnJS ile UI thread'den çağrılır.
   */
  const doSwipeRight = useCallback(() => {
    hapticMedium();
    onSwipeRight(film);
  }, [film, onSwipeRight]);

  /**
   * Sola swipe tamamlandı — haptic + parent callback.
   * runOnJS ile UI thread'den çağrılır.
   */
  const doSwipeLeft = useCallback(() => {
    hapticLight();
    onSwipeLeft(film);
  }, [film, onSwipeLeft]);

  /** Swipe threshold geçilince bir kez tetiklenen light haptic */
  const doThresholdHaptic = useCallback(() => {
    hapticLight();
  }, []);

  /** "Save" butonu veya alt watchlist butonu basıldı */
  const handleSave = useCallback(() => {
    hapticMedium();
    onSwipeRight(film);
  }, [film, onSwipeRight]);

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

  // ── Gesture ───────────────────────────────────────────────────────────────

  /**
   * Pan gesture — sadece yatay hareketi yakalar.
   *
   * activeOffsetX([-15, 15]): 15px yatay hareketten sonra aktifleşir
   * failOffsetY([-10, 10]):   10px dikey harekette gesture iptal edilir
   *                           → FlatList dikey scroll devralır
   */
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;

      // Threshold geçilince bir kez light haptic
      const crossed = Math.abs(event.translationX) > SWIPE_THRESHOLD ||
        Math.abs(event.velocityX) > VELOCITY_THRESHOLD;
      if (crossed && !thresholdHapticFired.value) {
        thresholdHapticFired.value = true;
        runOnJS(doThresholdHaptic)();
      }

      cardRotation.value = interpolate(
        event.translationX,
        [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
        [-15, 0, 15],
        Extrapolation.CLAMP,
      );

      // Saved overlay (sağa)
      savedOpacity.value =
        event.translationX > 0
          ? interpolate(
              event.translationX,
              [0, SCREEN_WIDTH * 0.15],
              [0, 1],
              Extrapolation.CLAMP,
            )
          : 0;

      // Skip overlay (sola)
      skipOpacity.value =
        event.translationX < 0
          ? interpolate(
              event.translationX,
              [0, -SCREEN_WIDTH * 0.15],
              [0, 1],
              Extrapolation.CLAMP,
            )
          : 0;
    })
    .onEnd((event) => {
      'worklet';
      const passed =
        Math.abs(translateX.value) > SWIPE_THRESHOLD ||
        Math.abs(event.velocityX) > VELOCITY_THRESHOLD;

      if (passed && translateX.value > 0) {
        // Sağa uç → callback
        savedOpacity.value = withTiming(1, { duration: 100 });
        cardRotation.value = withTiming(15, { duration: 300 });
        translateX.value = withTiming(EXIT_X, { duration: 300 }, () => {
          runOnJS(doSwipeRight)();
        });
      } else if (passed && translateX.value < 0) {
        // Sola uç → callback
        skipOpacity.value = withTiming(1, { duration: 100 });
        cardRotation.value = withTiming(-15, { duration: 300 });
        translateX.value = withTiming(-EXIT_X, { duration: 300 }, () => {
          runOnJS(doSwipeLeft)();
        });
      } else {
        // Eşik geçilmedi — geri dönsün
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        cardRotation.value = withSpring(0, { damping: 20, stiffness: 200 });
        savedOpacity.value = withSpring(0, { damping: 20, stiffness: 200 });
        skipOpacity.value = withSpring(0, { damping: 20, stiffness: 200 });
      }
      thresholdHapticFired.value = false;
    });

  // ── Animated styles ───────────────────────────────────────────────────────

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotate: `${cardRotation.value}deg` },
    ],
  }));

  const savedOverlayStyle = useAnimatedStyle(() => ({
    opacity: savedOpacity.value,
  }));

  const skipOverlayStyle = useAnimatedStyle(() => ({
    opacity: skipOpacity.value,
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.itemContainer, { height }]}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, cardStyle]}>

          {/* Sürpriz kart type bazlı border */}
          {effectiveType != null && (
            <View
              style={[
                styles.surpriseBorderBase,
                effectiveType === 'ai_pick'
                  ? styles.surpriseBorderWhite
                  : effectiveType === 'unexpected'
                    ? styles.surpriseBorderPurple
                    : styles.surpriseBorderGold,
              ]}
              pointerEvents="none"
            />
          )}

          {/* Poster arka plan */}
          {fullPosterUrl != null ? (
            <Image
              source={{ uri: fullPosterUrl }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <LinearGradient
              colors={[Colors.cardSolid, Colors.background]}
              style={StyleSheet.absoluteFillObject}
            />
          )}

          {/* Film detay — tüm kart tıklanabilir */}
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={handlePress}
            activeOpacity={0.97}
          />

          {/* Alt gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(10,14,39,0.55)', 'rgba(10,14,39,0.92)']}
            locations={[0.3, 0.58, 1.0]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* Saved overlay (sağa swipe) */}
          <Animated.View
            style={[styles.overlay, styles.goldOverlay, savedOverlayStyle]}
            pointerEvents="none"
          >
            <Text style={styles.overlayText}>Saved ✓</Text>
          </Animated.View>

          {/* Skip overlay (sola swipe) */}
          <Animated.View
            style={[styles.overlay, styles.greyOverlay, skipOverlayStyle]}
            pointerEvents="none"
          >
            <Text style={styles.overlayText}>Skip</Text>
          </Animated.View>

          {/* Sürpriz badge — tip bazlı renk + FadeInDown animasyon */}
          {surpriseLabel != null && (
            <Animated.View
              entering={FadeInDown.springify().damping(14).stiffness(160)}
              style={[
                styles.surpriseBadge,
                effectiveType === 'ai_pick'
                  ? styles.surpriseBadgeWhite
                  : effectiveType === 'unexpected'
                    ? styles.surpriseBadgePurple
                    : styles.surpriseBadgeGold,
              ]}
            >
              <Text
                style={[
                  styles.surpriseBadgeText,
                  effectiveType === 'unexpected' && styles.surpriseBadgeTextLight,
                ]}
              >
                {surpriseLabel}
              </Text>
            </Animated.View>
          )}

          {/* Sol üst — New mood butonu */}
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/mood')}
            style={styles.newMoodBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.newMoodBtnText}>New mood</Text>
          </TouchableOpacity>

          {/* Sağ kenar — Share + Save butonları (label'lı) */}
          <View style={styles.sideButtons}>
            <View style={styles.sideIconWrap}>
              <TouchableOpacity onPress={handleShare} style={styles.sideIconCircle} activeOpacity={0.75}>
                <Ionicons name="share-outline" size={22} color={Colors.textWhite} />
              </TouchableOpacity>
              <Text style={styles.sideIconLabel}>Share</Text>
            </View>
            <View style={styles.sideIconWrap}>
              <TouchableOpacity onPress={handleSave} style={styles.sideIconCircle} activeOpacity={0.75}>
                <Ionicons name="heart-outline" size={22} color={Colors.textWhite} />
              </TouchableOpacity>
              <Text style={styles.sideIconLabel}>Save</Text>
            </View>
          </View>

          {/* Alt içerik */}
          <View style={styles.bottomContent} pointerEvents="none">
            {/* Film adı + match dairesi yan yana */}
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.title} numberOfLines={2}>
                  {film.title}
                </Text>
                {matchPercent > 0 && (
                  <Text style={styles.matchLabel}>Mood Match Score</Text>
                )}
              </View>

              {/* Match yüzdesi dairesi */}
              {matchPercent > 0 && (
                <View style={styles.matchCircle}>
                  <Text style={styles.matchPercent}>{matchPercent}%</Text>
                </View>
              )}
            </View>

            {/* AI açıklama metni */}
            <Text style={styles.aiText} numberOfLines={2}>
              {getAIExplanation(film)}
            </Text>

            {/* Meta bilgi */}
            <Text style={styles.metaText}>
              {[
                film.year,
                rating > 0 ? `★ ${rating.toFixed(1)}` : null,
                ...film.moodTags.slice(0, 2),
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

        </Animated.View>
      </GestureDetector>
    </View>
  );
});

SwipeableCard.displayName = 'SwipeableCard';

// ── Stiller ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ─── FlatList item container ────────────────────────────────────────────────
  itemContainer: {
    width: '100%',
  },

  // ─── Kart ──────────────────────────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: Colors.cardSolid,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 22,
    elevation: 16,
  },

  // ─── Sürpriz border (base + type varyantları) ──────────────────────────────
  surpriseBorderBase: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    zIndex: 30,
    shadowOpacity: 0.85,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  surpriseBorderGold: {
    borderColor: Colors.gold,
    shadowColor: Colors.gold,
  },
  surpriseBorderWhite: {
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
  },
  surpriseBorderPurple: {
    borderColor: '#A78BFA',
    shadowColor: '#A78BFA',
  },

  // ─── Overlay'ler ───────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  goldOverlay: {
    backgroundColor: 'rgba(212,168,67,0.25)',
    borderWidth: 3,
    borderColor: Colors.gold,
  },
  greyOverlay: {
    backgroundColor: 'rgba(138,130,144,0.25)',
    borderWidth: 3,
    borderColor: '#8A8290',
  },
  overlayText: {
    color: Colors.textWhite,
    fontSize: 40,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },

  // ─── Sürpriz badge (base + type varyantları) ───────────────────────────────
  surpriseBadge: {
    position: 'absolute',
    top: 54,
    right: 16,
    zIndex: 20,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  surpriseBadgeGold: {
    backgroundColor: 'rgba(212,168,67,0.92)',
  },
  surpriseBadgeWhite: {
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  surpriseBadgePurple: {
    backgroundColor: 'rgba(167,139,250,0.92)',
  },
  surpriseBadgeText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '700',
  },
  surpriseBadgeTextLight: {
    color: '#FFFFFF',
  },

  // ─── Sol üst: New mood butonu ──────────────────────────────────────────────
  newMoodBtn: {
    position: 'absolute',
    top: 54,
    left: 20,
    zIndex: 20,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  newMoodBtnText: {
    color: Colors.gold,
    fontSize: 12,
    fontWeight: '600',
  },

  // ─── Sağ taraf butonlar ────────────────────────────────────────────────────
  sideButtons: {
    position: 'absolute',
    right: 16,
    top: '50%',
    zIndex: 20,
    alignItems: 'center',
    gap: 20,
  },
  sideIconWrap: {
    alignItems: 'center',
    gap: 4,
  },
  sideIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sideIconLabel: {
    fontSize: 11,
    color: Colors.textWhite,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // ─── Alt içerik ────────────────────────────────────────────────────────────
  bottomContent: {
    position: 'absolute',
    bottom: 80,
    left: 20,
    right: 20,
    zIndex: 20,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 8,
    gap: 12,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 28,
    color: Colors.textWhite,
    lineHeight: 34,
    marginBottom: 2,
  },
  matchLabel: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  matchCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(10,14,39,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
    flexShrink: 0,
  },
  matchPercent: {
    color: Colors.textWhite,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  aiText: {
    color: Colors.textLightGrey,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textGrey,
    letterSpacing: 0.1,
  },
});

export default React.memo(SwipeableCard);
