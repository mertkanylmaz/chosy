import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';

import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import LumiParticles from './LumiParticles';
import { styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

/** Boyut → piksel eşlemesi */
const SIZE_MAP = { small: 32, medium: 64, large: 140 } as const;

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Lumi'nin duygu durumları */
export type LumiMood = 'idle' | 'thinking' | 'happy' | 'excited' | 'calm' | 'searching';

/** Lumi maskot component props */
export interface LumiProps {
  /** Boyut adı — small: 32px, medium: 64px, large: 140px */
  size: 'small' | 'medium' | 'large';
  /** Lumi'nin duygu durumu — animasyon davranışını belirler */
  mood: LumiMood;
  /** Orb etrafında dönen parçacıklar (varsayılan: false) */
  showParticles?: boolean;
  /** Altın glow katmanı (varsayılan: true) */
  showGlow?: boolean;
  /** Dış container için ek stil */
  style?: ViewStyle;
}

// ─── Yardımcı animasyon sabitleri ─────────────────────────────────────────────

const SINE = Easing.inOut(Easing.sin);

/** Dış halka nefes animasyonu — belirtilen sürede bir döngü */
function ringBreath(duration: number) {
  return withRepeat(
    withSequence(
      withTiming(0.92, { duration, easing: SINE }),
      withTiming(1.08, { duration, easing: SINE }),
    ),
    -1,
    true,
  );
}

/** Glow opacity pulse — belirtilen süre ve peak değeriyle */
function glowPulse(duration: number, low = 0.15, high = 0.4) {
  return withRepeat(
    withSequence(
      withTiming(low, { duration, easing: SINE }),
      withTiming(high, { duration, easing: SINE }),
    ),
    -1,
    true,
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

/**
 * Lumi — Animasyonlu altın orb bileşeni.
 *
 * Tamamen react-native-reanimated v4 ile programatik çizim.
 * Dış bağımlılık yok, Lottie yok, PNG yok.
 * Mood durumuna göre farklı animasyon sekansları çalıştırır.
 */
export default function Lumi({
  size,
  mood,
  showParticles = false,
  showGlow = true,
  style,
}: LumiProps) {
  const sz = SIZE_MAP[size];
  const coreSize = sz * 0.6;
  const innerLightSize = sz * 0.3;
  const borderWidth = size === 'large' ? 2.5 : size === 'medium' ? 2 : 1.5;
  const particleCount = size === 'large' ? 8 : size === 'medium' ? 5 : 3;

  // ── Shared Values ─────────────────────────────────────────────────────────
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotate = useSharedValue(0); // derece cinsinden
  const glowOpacity = useSharedValue(0.25);
  const ringScale = useSharedValue(1);

  // ── Mood Animasyonları ────────────────────────────────────────────────────
  useEffect(() => {
    cancelAnimation(translateY);
    cancelAnimation(translateX);
    cancelAnimation(scale);
    cancelAnimation(rotate);
    cancelAnimation(glowOpacity);
    cancelAnimation(ringScale);

    translateY.value = 0;
    translateX.value = 0;
    scale.value = 1;
    rotate.value = 0;

    switch (mood) {
      case 'idle':
        translateY.value = withRepeat(
          withSequence(
            withTiming(-5, { duration: 2000, easing: SINE }),
            withTiming(5, { duration: 2000, easing: SINE }),
          ),
          -1,
          true,
        );
        glowOpacity.value = glowPulse(1200);
        ringScale.value = ringBreath(2000);
        break;

      case 'thinking':
        // Sürekli rotasyon
        rotate.value = withRepeat(
          withTiming(360, { duration: 3000, easing: Easing.linear }),
          -1,
        );
        // Hızlandırılmış glow pulse
        glowOpacity.value = glowPulse(600);
        // Hızlandırılmış ring nefesi
        ringScale.value = ringBreath(800);
        break;

      case 'happy':
        // Bir kere bounce — loop yok
        scale.value = withSequence(
          withTiming(1.2, { duration: 200, easing: Easing.out(Easing.back(1.5)) }),
          withTiming(1.0, { duration: 400, easing: Easing.out(Easing.elastic(1)) }),
        );
        glowOpacity.value = withTiming(0.6, { duration: 300 });
        ringScale.value = ringBreath(2000);
        break;

      case 'excited':
        // 3 kere hızlı bounce
        scale.value = withRepeat(
          withSequence(
            withTiming(1.15, { duration: 150 }),
            withTiming(0.95, { duration: 150 }),
            withTiming(1.0, { duration: 200 }),
          ),
          3,
        );
        glowOpacity.value = withTiming(0.7, { duration: 200 });
        ringScale.value = ringBreath(2000);
        break;

      case 'calm':
        // idle gibi ama daha yavaş
        translateY.value = withRepeat(
          withSequence(
            withTiming(-5, { duration: 3000, easing: SINE }),
            withTiming(5, { duration: 3000, easing: SINE }),
          ),
          -1,
          true,
        );
        glowOpacity.value = glowPulse(3000, 0.1, 0.25);
        ringScale.value = ringBreath(3000);
        break;

      case 'searching':
        // Yatay sallanma
        translateX.value = withRepeat(
          withSequence(
            withTiming(-8, { duration: 1500, easing: SINE }),
            withTiming(8, { duration: 1500, easing: SINE }),
          ),
          -1,
          true,
        );
        glowOpacity.value = glowPulse(1200);
        ringScale.value = ringBreath(2000);
        break;
    }

    return () => {
      cancelAnimation(translateY);
      cancelAnimation(translateX);
      cancelAnimation(scale);
      cancelAnimation(rotate);
      cancelAnimation(glowOpacity);
      cancelAnimation(ringScale);
    };
  }, [mood]);

  // ── Animated Styles ───────────────────────────────────────────────────────

  const moodStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateY: translateY.value },
        { translateX: translateX.value },
        { scale: scale.value },
        { rotate: `${rotate.value}deg` },
      ],
    };
  });

  const glowStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: glowOpacity.value,
      transform: [{ scale: 1.4 }],
    };
  });

  const ringStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: ringScale.value }],
    };
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { width: sz, height: sz }, style]}>
      {/* Mood hareketleri bu wrapper'a uygulanır */}
      <Animated.View
        style={[styles.moodWrapper, { width: sz, height: sz }, moodStyle]}
      >
        {/* Katman 1: Glow — arkada altın ışık havuzu */}
        {showGlow && (
          <Animated.View
            style={[
              styles.glow,
              { width: sz, height: sz, borderRadius: sz / 2, backgroundColor: Colors.gold },
              glowStyle,
            ]}
          />
        )}

        {/* Katman 2: Dış halka — nefes alan çerçeve */}
        <Animated.View
          style={[
            styles.outerRing,
            {
              width: sz,
              height: sz,
              borderRadius: sz / 2,
              borderWidth,
              borderColor: Colors.gold,
              opacity: 0.5,
            },
            ringStyle,
          ]}
        />

        {/* Katman 3: Core orb */}
        <View
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: Colors.gold,
            },
          ]}
        >
          {/* İç parlak nokta */}
          <View
            style={[
              styles.innerLight,
              {
                width: innerLightSize,
                height: innerLightSize,
                borderRadius: innerLightSize / 2,
                backgroundColor: Colors.goldLight,
                opacity: 0.8,
              },
            ]}
          />
        </View>

        {/* Katman 4: Parçacıklar (opsiyonel) */}
        {showParticles && (
          <LumiParticles count={particleCount} radius={sz * 0.8} color={Colors.gold} />
        )}
      </Animated.View>
    </View>
  );
}
