/**
 * SwipeableCard — Tek film kartı, Premium Bumble tasarım.
 *
 * Mekanik:
 * - Yatay pan: Tinder tarzı sağ/sol swipe → kart ekrandan uçar → callback
 * - Dikey kaydırma: FlatList üzerinden, bu component müdahale etmez
 * - Gesture çakışması: activeOffsetX([-15,15]) + failOffsetY([-10,10])
 *
 * Görsel:
 * - Full-bleed poster, bottom %40 gradient overlay
 * - Swipe overlay: yeşil "+" (sağa), kırmızı "✕" (sola)
 * - 2 dairesel action button: Skip (✕), Save (♡)
 * - Sürpriz badge + match circle
 */

import React, { useCallback, useEffect, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { hapticLight, hapticMedium, hapticSuccess } from '@/utils/haptics';

import Animated, {
  cancelAnimation,
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
import { useLanguage } from '@/contexts/LanguageContext';
import { localizeGenre } from '@/utils/filmFilters';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Film için AI açıklama metni üretir.
 * film.whyThisFilm varsa kullanılır; yoksa genres'ten template üretilir.
 */
function getAIExplanation(film: Film): string {
  if (film.whyThisFilm) return film.whyThisFilm;
  // Şablon metni İngilizce — genre'ları her zaman EN normalize et
  const genres = film.moodTags.slice(0, 2).map((g) => localizeGenre(g, 'en')).join(' and ').toLocaleLowerCase('en-US');
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

/** Action button boyutları */
const ACTION_BTN_SM = 48;

// ── Tipler ────────────────────────────────────────────────────────────────────

export interface SwipeableCardProps {
  film: Film;
  /** Kartın yüksekliği — FlatList item height ile eşleşmeli */
  height: number;
  /** Alt navigasyon barının yüksekliği + konumu — bottomContent'i yukarı iter */
  bottomOffset?: number;
  onSwipeRight: (film: Film) => void;
  onSwipeLeft: (film: Film) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Tek bir film kartı — Premium Bumble tasarım.
 * Kendi translateX / cardRotation / overlay shared value'larını yönetir.
 * FlatList item olarak render edilir; dikey scroll FlatList'e devredilir.
 */
export const SwipeableCard: React.FC<SwipeableCardProps> = React.memo(({
  film,
  height,
  bottomOffset = 0,
  onSwipeRight,
  onSwipeLeft,
}) => {
  const router = useRouter();
  const { language } = useLanguage();

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

  /**
   * isMounted guard — runOnJS callback'leri component unmount olduktan sonra
   * calismasin. Production Hermes'te withTiming callback use-after-free'e yol
   * acar (SIGBUS / KERN_PROTECTION_FAILURE).
   */
  const isMounted = useRef(true);
  useEffect(() => {
    return () => {
      isMounted.current = false;
      // Devam eden tum animasyonlari iptal et — callback'lerin unmount sonrasi
      // ateşlenmesini ve gecersiz closure'lara erismesini onler.
      cancelAnimation(translateX);
      cancelAnimation(cardRotation);
      cancelAnimation(savedOpacity);
      cancelAnimation(skipOpacity);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
   * isMounted kontrolü: withTiming callback'i component unmount olduktan
   * sonra tetiklenirse (hizli swipe + GC) gecersiz closure → SIGBUS.
   */
  const doSwipeRight = useCallback(() => {
    if (!isMounted.current) return;
    hapticMedium();
    onSwipeRight(film);
  }, [film, onSwipeRight]);

  /**
   * Sola swipe tamamlandı — haptic + parent callback.
   * isMounted kontrolü: ayni sebeple unmount sonrası guard.
   */
  const doSwipeLeft = useCallback(() => {
    if (!isMounted.current) return;
    hapticLight();
    onSwipeLeft(film);
  }, [film, onSwipeLeft]);

  /** Swipe threshold geçilince bir kez tetiklenen light haptic */
  const doThresholdHaptic = useCallback(() => {
    hapticLight();
  }, []);

  /** Save action button — sağa swipe simüle eder */
  const handleSave = useCallback(() => {
    hapticMedium();
    onSwipeRight(film);
  }, [film, onSwipeRight]);

  /** Skip action button — sola swipe simüle eder */
  const handleSkip = useCallback(() => {
    hapticLight();
    onSwipeLeft(film);
  }, [film, onSwipeLeft]);

  /** Karta tıklayınca film detay */
  const handlePress = useCallback(() => {
    if (!film?.id) return;
    router.push(`/film/${film.id}`);
  }, [router, film.id]);

  // Star/share button kaldirildi — sadece Skip + Save kaldi (Madde 1)

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
        [-12, 0, 12],
        Extrapolation.CLAMP,
      );

      // Saved overlay (sağa) — max 0.3 opacity (Premium Bumble spec)
      savedOpacity.value =
        event.translationX > 0
          ? interpolate(
              event.translationX,
              [0, SCREEN_WIDTH * 0.15],
              [0, 0.3],
              Extrapolation.CLAMP,
            )
          : 0;

      // Skip overlay (sola) — max 0.3 opacity
      skipOpacity.value =
        event.translationX < 0
          ? interpolate(
              event.translationX,
              [0, -SCREEN_WIDTH * 0.15],
              [0, 0.3],
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
        savedOpacity.value = withTiming(0.5, { duration: 100 });
        cardRotation.value = withTiming(12, { duration: 300 });
        translateX.value = withTiming(EXIT_X, { duration: 300 }, () => {
          runOnJS(doSwipeRight)();
        });
      } else if (passed && translateX.value < 0) {
        skipOpacity.value = withTiming(0.5, { duration: 100 });
        cardRotation.value = withTiming(-12, { duration: 300 });
        translateX.value = withTiming(-EXIT_X, { duration: 300 }, () => {
          runOnJS(doSwipeLeft)();
        });
      } else {
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

  // ── Meta string ───────────────────────────────────────────────────────────
  const metaLine = [
    film.year,
    rating > 0 ? `★ ${rating.toFixed(1)}` : null,
    ...film.moodTags.slice(0, 2).map((g) => localizeGenre(g, language)),
  ].filter(Boolean).join(' · ');

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

          {/* Bottom %40 gradient overlay — daha güçlü */}
          <LinearGradient
            colors={['transparent', 'rgba(10,10,10,0.6)', Colors.cardGradientBottom]}
            locations={[0.45, 0.68, 1.0]}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />

          {/* SAVE overlay (sağa swipe) — yeşil "+" */}
          <Animated.View
            style={[styles.overlay, styles.saveOverlay, savedOverlayStyle]}
            pointerEvents="none"
          >
            <View style={styles.overlayIconCircle}>
              <Ionicons name="add" size={56} color={Colors.swipeRight} />
            </View>
          </Animated.View>

          {/* SKIP overlay (sola swipe) — kırmızı "✕" */}
          <Animated.View
            style={[styles.overlay, styles.skipOverlay, skipOverlayStyle]}
            pointerEvents="none"
          >
            <View style={styles.overlayIconCircle}>
              <Ionicons name="close" size={56} color={Colors.swipeLeft} />
            </View>
          </Animated.View>

          {/* Sürpriz badge — tip bazlı renk + FadeInDown animasyon.
              Outer View: entering animasyonu (transform yok)
              Inner View: renk + konum stili
              Bu ayrım Reanimated "transform overwrite by layout animation" uyarısını önler. */}
          {surpriseLabel != null && (
            <Animated.View
              entering={FadeInDown.springify().damping(14).stiffness(160)}
              style={styles.surpriseBadgeAnchor}
            >
              <View
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
              </View>
            </Animated.View>
          )}

          {/* ── Alt içerik ─────────────────────────────────────────────────── */}
          <View style={[styles.bottomContent, { bottom: 20 + bottomOffset }]} pointerEvents="box-none">

            {/* Film adı + match dairesi */}
            <View style={styles.titleRow}>
              <View style={styles.titleBlock}>
                <Text style={styles.title} numberOfLines={2}>
                  {film.title}
                </Text>
              </View>

              {matchPercent > 0 && (
                <View style={styles.matchCircle}>
                  <Text style={styles.matchPercent}>{matchPercent}%</Text>
                  <Text style={styles.matchLabel}>match</Text>
                </View>
              )}
            </View>

            {/* AI açıklama */}
            <Text style={styles.aiText} numberOfLines={2}>
              {getAIExplanation(film)}
            </Text>

            {/* Meta: yıl · rating · genre */}
            {metaLine.length > 0 && (
              <Text style={styles.metaText}>{metaLine}</Text>
            )}

            {/* ── 2 Action Buttons — Skip / Save ─────────────────────────── */}
            <View style={styles.actionRow}>
              {/* Skip — kırmızı border */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSm, styles.actionBtnSkip]}
                onPress={handleSkip}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={24} color={Colors.swipeLeft} />
              </TouchableOpacity>

              {/* Save — yeşil border */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSm, styles.actionBtnSave]}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <Ionicons name="heart" size={22} color={Colors.swipeRight} />
              </TouchableOpacity>
            </View>
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
    borderColor: Colors.textOnAccent,
    shadowColor: Colors.textOnAccent,
  },
  surpriseBorderPurple: {
    borderColor: Colors.accentPrimary,
    shadowColor: Colors.accentPrimary,
  },

  // ─── Swipe overlay'ler — semantic renkler ──────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  saveOverlay: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
  skipOverlay: {
    backgroundColor: 'rgba(239,68,68,0.15)',
  },
  overlayIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white10,
  },

  // ─── Sürpriz badge (base + type varyantları) ───────────────────────────────
  /** Outer: konumlama + entering animasyonu — transform içermez */
  surpriseBadgeAnchor: {
    position: 'absolute',
    top: 54,
    right: 16,
    zIndex: 20,
  },
  /** Inner: görsel stil — renk + padding + borderRadius */
  surpriseBadge: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  surpriseBadgeGold: {
    backgroundColor: Colors.gold,
  },
  surpriseBadgeWhite: {
    backgroundColor: 'rgba(255,255,255,0.94)',
  },
  surpriseBadgePurple: {
    backgroundColor: Colors.accentPrimary,
  },
  surpriseBadgeText: {
    color: Colors.background,
    fontSize: 12,
    fontWeight: '700',
  },
  surpriseBadgeTextLight: {
    color: Colors.textOnAccent,
  },

  // ─── Alt içerik ────────────────────────────────────────────────────────────
  bottomContent: {
    position: 'absolute',
    // bottom is set dynamically via inline style using bottomOffset prop
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
  },
  matchCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2.5,
    borderColor: Colors.accentPrimary,
    backgroundColor: Colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
    flexShrink: 0,
  },
  matchPercent: {
    color: Colors.textWhite,
    fontSize: 16,
    fontFamily: 'PlayfairDisplay_700Bold',
    letterSpacing: -0.3,
  },
  matchLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.3,
    marginTop: -2,
  },
  aiText: {
    color: Colors.textTertiary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.1,
    marginBottom: 16,
  },

  // ─── 2 Action Buttons — Skip / Save ────────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  actionBtnSm: {
    width: ACTION_BTN_SM,
    height: ACTION_BTN_SM,
    borderRadius: ACTION_BTN_SM / 2,
  },
  actionBtnSkip: {
    borderColor: Colors.swipeLeft,
  },
  actionBtnSave: {
    borderColor: Colors.swipeRight,
  },
});

export default SwipeableCard;
