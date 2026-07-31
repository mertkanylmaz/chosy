/**
 * TasteSwipe — Cold-start onboarding swipe component.
 *
 * Kullaniciya 6 curated film gosterir. Her kart icin saga (like) veya
 * sola (skip) kaydirmak zorunlu. Tamamlaninca taste signal'leri kayda
 * alinmis olur → hybrid recommendation ilk aramadan itibaren aktif.
 *
 * Her kart kendi shared value'larina sahip TasteSwipeCard instance'i
 * olarak render edilir (key={film.tmdbId}). Bu sayede kart gecisinde
 * translateX sifirlanmasi kaynaklı poster flash/glitch onlenir.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { supabase } from '@/services/supabase';
import { tasteSignals } from '@/services/tasteSignalService';
import { useLanguage } from '@/contexts/LanguageContext';

// ── Sabitler ──────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const VELOCITY_THRESHOLD = 600;
const EXIT_DISTANCE = SCREEN_WIDTH * 1.5;
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';

/**
 * 6 curated film — genre dengeli, universally recognized.
 *
 * ── ONEMLI (30 Tem 2026) ────────────────────────────────────────────────────
 * Bu liste TMDb ID tasir. `user_taste_signals.film_id` ise `films.id` (UUID)
 * FK'sidir. Eskiden `id: '278'` dogrudan sinyal servisine geciriliyordu ve her
 * insert `22P02 invalid input syntax for type uuid` ile reddedilip offline
 * kuyruga dusuyordu — kuyruk kalici olarak kilitleniyor, onboarding'in 6
 * kalibrasyon sinyali hicbir zaman yazilmiyordu.
 *
 * Alan artik `tmdbId: number`; UUID mount'ta `films` tablosundan cozuluyor.
 * posterPath TMDB w500 format.
 */
export interface ColdStartFilm {
  /** TMDb film ID — sinyal yazmadan once UUID'ye cozulur */
  tmdbId: number;
  title: string;
  year: number;
  posterPath: string;
  genre: string;
}

/** Curated cold-start films — well-known, genre-diverse */
const COLD_START_FILMS: ColdStartFilm[] = [
  { tmdbId: 278, title: 'The Shawshank Redemption', year: 1994, posterPath: '/9cqNxx0GxF0bflZmeSMuL5tnGzr.jpg', genre: 'Drama' },
  { tmdbId: 27205, title: 'Inception', year: 2010, posterPath: '/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', genre: 'Sci-Fi' },
  { tmdbId: 129, title: 'Spirited Away', year: 2001, posterPath: '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', genre: 'Animation' },
  { tmdbId: 120467, title: 'The Grand Budapest Hotel', year: 2014, posterPath: '/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg', genre: 'Comedy' },
  { tmdbId: 419430, title: 'Get Out', year: 2017, posterPath: '/mE24wUCfjK8AoBBjaMjho7Rczr7.jpg', genre: 'Thriller' },
  { tmdbId: 313369, title: 'La La Land', year: 2016, posterPath: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg', genre: 'Romance' },
];

const TOTAL_CARDS = COLD_START_FILMS.length;

// ── Props ─────────────────────────────────────────────────────────────────────

interface TasteSwipeProps {
  /** Tum kartlar tamamlandiginda cagirilir */
  onComplete: () => void;
}

// ── Per-card swipe component ──────────────────────────────────────────────────

interface TasteSwipeCardProps {
  film: ColdStartFilm;
  onSwipeComplete: (direction: 'right' | 'left') => void;
}

/**
 * Tek bir swipe karti — kendi shared value'larina sahip.
 * key={film.tmdbId} ile mount edilir → her kart gecisinde temiz state baslar,
 * translateX sifirlanma kaynaklı poster flash onlenir.
 */
function TasteSwipeCard({ film, onSwipeComplete }: TasteSwipeCardProps) {
  const { t } = useLanguage();
  const translateX = useSharedValue(0);

  /** Worklet: swipe sonrasi JS callback'e gec */
  const onSwipeDone = useCallback(
    (direction: 'right' | 'left') => {
      onSwipeComplete(direction);
    },
    [onSwipeComplete],
  );

  // ── Gesture ─────────────────────────────────────────────────────────────────

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-15, 15])
        .failOffsetY([-10, 10])
        .onUpdate((e) => {
          'worklet';
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          'worklet';
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
    'worklet';
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
  const saveOverlayStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: interpolate(
        translateX.value,
        [0, SWIPE_THRESHOLD],
        [0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  /** Skip overlay (sol) opacity */
  const skipOverlayStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: interpolate(
        translateX.value,
        [-SWIPE_THRESHOLD, 0],
        [1, 0],
        Extrapolation.CLAMP,
      ),
    };
  });

  /** Button ile sola kaydirma */
  const triggerLeft = useCallback(() => {
    translateX.value = withTiming(-EXIT_DISTANCE, { duration: 250 }, () => {
      runOnJS(onSwipeDone)('left');
    });
  }, [translateX, onSwipeDone]);

  /** Button ile saga kaydirma */
  const triggerRight = useCallback(() => {
    translateX.value = withTiming(EXIT_DISTANCE, { duration: 250 }, () => {
      runOnJS(onSwipeDone)('right');
    });
  }, [translateX, onSwipeDone]);

  return (
    <View style={styles.cardWithButtons}>
      {/* Active card — cardArea icinde absolute olarak konumlanir */}
      <View style={styles.cardArea}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.card, styles.activeCard, cardAnimatedStyle]}>
            <Image
              source={{ uri: `${TMDB_IMAGE_BASE}${film.posterPath}` }}
              style={styles.poster}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
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
              <Text style={styles.filmTitle} numberOfLines={2}>{film.title}</Text>
              <Text style={styles.filmMeta}>{film.year} · {film.genre}</Text>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Action buttons — fallback for swipe + visual hint */}
      <View style={styles.hintRow}>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={triggerLeft}
        >
          <Ionicons name="close-circle" size={32} color={Colors.error} />
          <Text style={[styles.hintText, { color: Colors.error }]}>{t('onboarding.tasteSwipeSkip')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          activeOpacity={0.7}
          onPress={triggerRight}
        >
          <Ionicons name="heart-circle" size={32} color={Colors.success} />
          <Text style={[styles.hintText, { color: Colors.success }]}>{t('onboarding.tasteSwipeLike')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

/**
 * Cold-start onboarding swipe — 6 film, zorunlu swipe.
 * Her swipe bir taste signal kaydeder.
 * Her kart kendi TasteSwipeCard instance'i — key={film.tmdbId} ile mount/unmount.
 */
export function TasteSwipe({ onComplete }: TasteSwipeProps) {
  const { t } = useLanguage();
  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * TMDb ID → `films.id` (UUID) esleme. Sinyal servisi UUID bekler.
   * `null` = henuz cozulmedi; bos obje = cozuldu ama eslesme cikmadi.
   */
  const [filmUuids, setFilmUuids] = useState<Record<number, string> | null>(null);

  /**
   * Esleme gelmeden yapilan swipe'lar burada bekler. Kullanici ilk karti
   * sorgu donmeden kaydirabilir; sinyali dusurmek yerine kuyruga aliyoruz.
   */
  const pendingSwipes = useRef<{ tmdbId: number; direction: 'right' | 'left' }[]>([]);

  /** Tek bir swipe'i UUID ile yazar */
  const writeSignal = useCallback(
    (uuidMap: Record<number, string>, tmdbId: number, direction: 'right' | 'left') => {
      const filmUuid = uuidMap[tmdbId];
      if (!filmUuid) {
        // Sessiz fallback yok — film DB'de yoksa gorunur olsun
        logger.error(`[TasteSwipe] Film not in DB, signal dropped: tmdb_id=${tmdbId}`);
        return;
      }

      const record =
        direction === 'right'
          ? tasteSignals.recordSwipeRight(filmUuid)
          : tasteSignals.recordSwipeLeft(filmUuid);

      record.catch((err) => {
        logger.error(`[TasteSwipe] swipe_${direction} signal failed:`, err);
      });
    },
    [],
  );

  /** Mount'ta TMDb ID'leri UUID'ye cozer */
  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      try {
        const { data, error } = await supabase
          .from('films')
          .select('id, tmdb_id')
          .in('tmdb_id', COLD_START_FILMS.map((f) => f.tmdbId));

        if (error) throw error;
        if (cancelled) return;

        const map: Record<number, string> = {};
        for (const row of (data ?? []) as { id: string; tmdb_id: number }[]) {
          map[row.tmdb_id] = row.id;
        }
        setFilmUuids(map);
      } catch (err) {
        if (cancelled) return;
        // Cozulemedi: onboarding akisi BLOKLANMAZ, yalnizca sinyaller yazilmaz
        logger.error('[TasteSwipe] Cold-start film UUID lookup failed:', err);
        setFilmUuids({});
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Esleme geldi — bekleyen swipe'lari yaz */
  useEffect(() => {
    if (!filmUuids) return;
    const pending = pendingSwipes.current;
    if (pending.length === 0) return;

    pendingSwipes.current = [];
    for (const { tmdbId, direction } of pending) {
      writeSignal(filmUuids, tmdbId, direction);
    }
  }, [filmUuids, writeSignal]);

  /** Swipe tamamlandi — signal kaydet, sonraki karta gec */
  const handleSwipeComplete = useCallback(
    (direction: 'right' | 'left') => {
      const film = COLD_START_FILMS[currentIndex];
      if (!film) return;

      if (direction === 'right') {
        hapticMedium();
      } else {
        hapticLight();
      }

      // Taste signal kaydi — fire-and-forget, esleme yoksa beklet
      if (filmUuids) {
        writeSignal(filmUuids, film.tmdbId, direction);
      } else {
        pendingSwipes.current.push({ tmdbId: film.tmdbId, direction });
      }

      const nextIndex = currentIndex + 1;
      if (nextIndex >= TOTAL_CARDS) {
        // Tum kartlar bitti — dirty flag tetikle ve complete callback
        hapticSuccess();
        onComplete();
      } else {
        setCurrentIndex(nextIndex);
      }
    },
    [currentIndex, onComplete, filmUuids, writeSignal],
  );

  // ── Back card scale animation (shared — parent level) ───────────────────────

  /** Back card icin basit scale-up — sabit 0.92 (aktif kart ucunca 1.0'a gecis CSS'te) */

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

      {/* Card stack + buttons — TasteSwipeCard manages own cardArea */}
      <View style={styles.stackWrapper}>
        {/* Back card (next) — static preview behind active card */}
        {nextFilm && (
          <View style={styles.backCardWrap}>
            <Animated.View style={[styles.card, styles.backCard, { transform: [{ scale: 0.92 }] }]}>
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
          </View>
        )}

        {/* Active card — key={film.tmdbId} ile her geciste fresh mount */}
        <TasteSwipeCard
          key={currentFilm.tmdbId}
          film={currentFilm}
          onSwipeComplete={handleSwipeComplete}
        />
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

  // Stack wrapper — contains back card + TasteSwipeCard (active card + buttons)
  stackWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  // Back card wrapper — absolute overlay behind active card
  backCardWrap: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  // Card with buttons — wraps active card area + hint row
  cardWithButtons: {
    alignItems: 'center',
    zIndex: 1,
  },
  // Card area — fixed size for absolute-positioned card
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
