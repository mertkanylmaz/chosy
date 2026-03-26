import React, { useEffect } from 'react';

import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { styles } from './styles';

// ─── Tek Parçacık ─────────────────────────────────────────────────────────────

interface ParticleProps {
  index: number;
  count: number;
  orbitalRadius: number;
  color: string;
}

/**
 * Tek bir parçacık — kendi yörüngesinde döner, opacity/scale pulse yapar.
 */
function Particle({ index, count, orbitalRadius, color }: ParticleProps) {
  const startAngleDeg = (360 / count) * index;
  const particleOrbitalRadius = orbitalRadius * (0.5 + index * 0.1);
  const particleSize = 4 + (index % 3); // 4–6 px

  const angle = useSharedValue(startAngleDeg);
  const opacity = useSharedValue(0.3);
  const scale = useSharedValue(0.6);

  useEffect(() => {
    const delay = index * 300;

    angle.value = withDelay(
      delay,
      withRepeat(
        withTiming(startAngleDeg + 360, {
          duration: 3000 + index * 500,
          easing: Easing.linear,
        }),
        -1,
      ),
    );

    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1000 + index * 200 }),
          withTiming(0.9, { duration: 1000 + index * 200 }),
        ),
        -1,
        true,
      ),
    );

    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1500 }),
          withTiming(1.2, { duration: 1500 }),
        ),
        -1,
        true,
      ),
    );

    return () => {
      cancelAnimation(angle);
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const rad = (angle.value * Math.PI) / 180;
    return {
      transform: [
        { translateX: Math.cos(rad) * particleOrbitalRadius },
        { translateY: Math.sin(rad) * particleOrbitalRadius },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          width: particleSize,
          height: particleSize,
          borderRadius: particleSize / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

// ─── Parçacık Grubu ───────────────────────────────────────────────────────────

export interface LumiParticlesProps {
  /** Parçacık sayısı */
  count: number;
  /** Merkez etrafındaki maksimum mesafe (px) */
  radius: number;
  /** Parçacık rengi */
  color: string;
}

/**
 * LumiParticles — Lumi'nin etrafında yörüngede dönen parçacıklar.
 * Her parçacık farklı hız, başlangıç açısı ve boyuta sahip.
 */
export default function LumiParticles({ count, radius, color }: LumiParticlesProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <Particle key={i} index={i} count={count} orbitalRadius={radius} color={color} />
      ))}
    </>
  );
}
