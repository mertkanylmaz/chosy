/**
 * SurpriseCard — Her 5-7 filmde bir görünen özel kart.
 * SwipeCard'ın tüm swipe + gesture mantığını devralır,
 * üzerine pick tipine göre görsel katmanlar ekler.
 *
 * 3 TİP:
 *  hidden_gem  → Nabız atan altın glow border
 *  ai_pick     → Yıldız partikülleri (✦) + statik altın border
 *  unexpected  → 2D card-flip reveal (mystery → film)
 *
 * İlk render'da Haptics.notificationAsync(Success) tetikler.
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { hapticSuccess } from '@/utils/haptics';

import { Film } from '@/types/film';
import { Colors } from '@/constants/Colors';
import styles, { SCREEN_WIDTH, CARD_HEIGHT } from './styles';

// ─── Tip tanımı ────────────────────────────────────────────────────────────────

export interface SurpriseCardProps {
  film: Film;
  pickType: 'hidden_gem' | 'ai_pick' | 'unexpected';
  isActive?: boolean;
  index?: number;
  onSwipeRight?: (film: Film) => void;
  onSwipeLeft?: (film: Film) => void;
  onSwipeDown?: () => void;
  onTrailerPress?: () => void;
}

// ─── Sparkle partikülleri ──────────────────────────────────────────────────────

/** ai_pick kartı için yıldız partiküllerin konum/boyut tablosu */
const SPARKLES: ReadonlyArray<{
  x: number;
  y: number;
  size: number;
  delay: number;
}> = [
  { x: 0.12, y: 0.04, size: 16, delay: 0 },
  { x: 0.50, y: 0.02, size: 22, delay: 260 },
  { x: 0.86, y: 0.05, size: 14, delay: 130 },
  { x: 0.28, y: 0.10, size: 11, delay: 480 },
  { x: 0.70, y: 0.08, size: 18, delay: 190 },
  { x: 0.43, y: 0.13, size: 13, delay: 620 },
];

/**
 * Tek bir yıldız partiküllü animasyon bileşeni.
 * withRepeat + withSequence ile kendi kendine döngü yapar.
 */
function SparkleParticle({
  x,
  y,
  size,
  delay,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    const opacityCycle = withSequence(
      withTiming(1, { duration: 350 }),
      withTiming(0.25, { duration: 500 }),
      withTiming(1, { duration: 350 }),
      withTiming(0, { duration: 350 }),
      withTiming(0, { duration: 850 }), // bekleme
    );
    const scaleCycle = withSequence(
      withSpring(1, { damping: 7 }),
      withTiming(0.75, { duration: 500 }),
      withSpring(1.15, { damping: 7 }),
      withTiming(0, { duration: 350 }),
      withTiming(0, { duration: 850 }),
    );

    opacity.value = withDelay(delay, withRepeat(opacityCycle, -1, false));
    scale.value = withDelay(delay, withRepeat(scaleCycle, -1, false));
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x * SCREEN_WIDTH - size / 2,
          top: y * CARD_HEIGHT,
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animStyle,
      ]}
      pointerEvents="none"
    >
      <Text style={{ fontSize: size, color: Colors.gold, lineHeight: size + 2 }}>
        ✦
      </Text>
    </Animated.View>
  );
}

// ─── Ana bileşen ───────────────────────────────────────────────────────────────

/**
 * SurpriseCard — Normal SwipeCard'dan farklı görünen özel kart.
 * useFeedManager hook'u her 5-7 filmde bir bu bileşeni seçer.
 */
const SurpriseCard: React.FC<SurpriseCardProps> = ({
  film,
  pickType,
  isActive,
  index,
  onSwipeRight,
  onSwipeLeft,
  onSwipeDown,
  onTrailerPress,
}) => {
  // ── Entry animasyonu ───────────────────────────────────────────────────────
  const entryScale = useSharedValue(0.86);
  const entryOpacity = useSharedValue(0);

  // ── Glow nabzı (hidden_gem) ────────────────────────────────────────────────
  const borderGlow = useSharedValue(0.3);

  // ── Match score vurgusu ────────────────────────────────────────────────────
  const matchPulse = useSharedValue(0.75);

  // ── Card flip (unexpected) ─────────────────────────────────────────────────
  const [mysteryVisible, setMysteryVisible] = useState(
    pickType === 'unexpected',
  );
  const flipScaleX = useSharedValue(1);

  useEffect(() => {
    // Haptic — özel kart bildirimi
    hapticSuccess();

    // Entry: scale + fade in
    entryScale.value = withSpring(1, { damping: 14, stiffness: 95 });
    entryOpacity.value = withTiming(1, { duration: 220 });

    // Match score vurgu nabzı
    matchPulse.value = withDelay(
      320,
      withSequence(
        withSpring(1.12, { damping: 8 }),
        withSpring(1, { damping: 10 }),
      ),
    );

    if (pickType === 'hidden_gem') {
      // Nabız atan altın glow
      borderGlow.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    }

    if (pickType === 'unexpected') {
      // 600ms sonra kart flip: scaleX 1 → 0, içerik değiş, 0 → 1
      flipScaleX.value = withDelay(
        600,
        withTiming(
          0,
          { duration: 270, easing: Easing.in(Easing.ease) },
          () => {
            'worklet';
            runOnJS(setMysteryVisible)(false);
            flipScaleX.value = withSpring(1, {
              damping: 11,
              stiffness: 130,
            });
          },
        ),
      );
    }
  }, []);

  // ── Animated stiller ───────────────────────────────────────────────────────

  const entryStyle = useAnimatedStyle(() => ({
    transform: [{ scale: entryScale.value }],
    opacity: entryOpacity.value,
  }));

  const borderStyle = useAnimatedStyle(() => ({
    opacity: borderGlow.value,
    shadowOpacity: borderGlow.value * 0.95,
  }));

  const flipStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: flipScaleX.value }],
  }));

  const matchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: matchPulse.value }],
  }));


  const badgeText =
    pickType === 'hidden_gem'
      ? '💎 Hidden Gem'
      : pickType === 'ai_pick'
        ? "⭐ AI thinks you'll love this"
        : '🎲 Something different';

  const showOverlays = pickType !== 'unexpected' || !mysteryVisible;

  return (
    <Animated.View style={[styles.container, entryStyle]}>

      {/* ── Kart içeriği (flip animasyonu ile) ─────────────────────────── */}
      <Animated.View style={[styles.flipWrapper, flipStyle]}>
        {mysteryVisible ? (
          /* Unexpected — gizem yüzü (flip öncesi) */
          <View style={styles.mysteryFace}>
            <Text style={styles.mysteryIcon}>🎬</Text>
            <Text style={styles.mysteryTitle}>Something different...</Text>
            <Text style={styles.mysterySubtitle}>Discovering your pick</Text>
          </View>
        ) : (
          /* Gerçek film kartı — sürpriz reveal sonrası */
          <View style={styles.mysteryFace}>
            <Text style={styles.mysteryIcon}>🎬</Text>
            <Text style={styles.mysteryTitle}>{film.title}</Text>
          </View>
        )}

        {/* ── Border (flipWrapper içinde — unexpected için flip ile ölçeklenir) */}
        {showOverlays && (
          pickType === 'hidden_gem' ? (
            <Animated.View
              style={[styles.glowBorder, borderStyle]}
              pointerEvents="none"
            />
          ) : (
            <View style={styles.staticBorder} pointerEvents="none" />
          )
        )}

        {/* ── Sparkle partikülleri (ai_pick) ─────────────────────────────── */}
        {pickType === 'ai_pick' &&
          SPARKLES.map((s, i) => <SparkleParticle key={i} {...s} />)}
      </Animated.View>

      {/* ── Badge — sol üst, flip sonrası göster ───────────────────────── */}
      {showOverlays && (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeText}>{badgeText}</Text>
        </View>
      )}

      {/* ── Büyük parlak match score — sağ üst ─────────────────────────── */}
      {showOverlays && (
        <Animated.View style={[styles.matchBadge, matchStyle]} pointerEvents="none">
          <Text style={styles.matchScoreText}>{film.matchScore}%</Text>
          <Text style={styles.matchLabel}>Match</Text>
        </Animated.View>
      )}

    </Animated.View>
  );
};

export default React.memo(SurpriseCard);
