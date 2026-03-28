/**
 * ConfettiEffect — Milestone kutlama konfeti parçacık sistemi.
 *
 * 20-30 parçacık, yukarı fırlatma + gravity düşme.
 * Renkler: violet + gold + success (CDO spec'ten).
 *
 * Spec: .claude/specs/GAMIFICATION_UI_SPEC.md — Component 2 / Konfeti
 */
import React, { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONFETTI_COLORS = [Colors.accentPrimary, Colors.gold, Colors.success];
const PARTICLE_COUNT = 24;
const DURATION = 2500;

// ─── Tipler ──────────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
  isCircle: boolean;
  rotation: number;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ConfettiEffectProps {
  /** Oynatılıyor mu */
  active: boolean;
  /** Ekstra konfeti (büyük milestone'lar için) */
  intense?: boolean;
}

// ─── Tek parçacık ────────────────────────────────────────────────────────────

function ConfettiParticle({ particle, active }: { particle: Particle; active: boolean }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      translateY.value = 0;
      opacity.value = 0;
      return;
    }

    // Yukarı fırlatma + gravity düşme
    opacity.value = withDelay(
      particle.delay,
      withSequence(
        withTiming(1, { duration: 100 }),
        withDelay(DURATION - 500, withTiming(0, { duration: 400 })),
      ),
    );

    translateY.value = withDelay(
      particle.delay,
      withSequence(
        // Yukarı fırlatma
        withTiming(-300 - Math.random() * 200, {
          duration: DURATION * 0.3,
          easing: Easing.out(Easing.quad),
        }),
        // Gravity düşme
        withTiming(600, {
          duration: DURATION * 0.7,
          easing: Easing.in(Easing.quad),
        }),
      ),
    );

    rotate.value = withDelay(
      particle.delay,
      withTiming(particle.rotation + 360 * 2, {
        duration: DURATION,
        easing: Easing.linear,
      }),
    );
  }, [active, particle, translateY, opacity, rotate]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        confettiStyles.particle,
        {
          left: particle.x,
          width: particle.size,
          height: particle.size,
          borderRadius: particle.isCircle ? particle.size / 2 : 2,
          backgroundColor: particle.color,
        },
        animatedStyle,
      ]}
    />
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

const ConfettiEffect: React.FC<ConfettiEffectProps> = React.memo(({
  active,
  intense = false,
}) => {
  const count = intense ? PARTICLE_COUNT + 16 : PARTICLE_COUNT;

  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * SCREEN_WIDTH,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: Math.random() > 0.5 ? 8 : 6,
      delay: Math.random() * 300,
      isCircle: Math.random() > 0.5,
      rotation: Math.random() * 360,
    })),
    [count],
  );

  if (!active) return null;

  return (
    <View style={confettiStyles.container} pointerEvents="none">
      {particles.map((p) => (
        <ConfettiParticle key={p.id} particle={p} active={active} />
      ))}
    </View>
  );
});

ConfettiEffect.displayName = 'ConfettiEffect';

export default ConfettiEffect;

// ─── Stiller ─────────────────────────────────────────────────────────────────

const confettiStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  particle: {
    position: 'absolute',
    top: '50%',
  },
});
