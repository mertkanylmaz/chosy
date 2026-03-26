import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { hapticLight, hapticSelection, hapticSuccess } from '@/utils/haptics';

import styles from './styles';

/** AIProcessingOverlay props */
interface AIProcessingProps {
  /** Overlay görünür mü */
  visible: boolean;
  /** Tüm animasyon tamamlanınca çağrılır (opsiyonel) */
  onComplete?: () => void;
}

type StepState = 'waiting' | 'active' | 'completed';

interface StepItem {
  text: string;
  state: StepState;
}

const STEPS_TEMPLATE = ['Reading emotions', 'Finding patterns', 'Matching films'];

/** Aktif adım için dönen altın spinner */
function StepSpinner() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 700, easing: Easing.linear }),
      -1,
    );
    return () => { cancelAnimation(rotation); };
  }, []);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return <Animated.View style={[styles.spinner, spinStyle]} />;
}

/**
 * AI mood analizi sırasında tam ekranı kaplayan overlay.
 * 4 iç içe dönen halka spiral animasyonu + 3 aşamalı ilerleme listesi.
 * position: absolute — Modal kullanmaz.
 */
export default function AIProcessingOverlay({ visible, onComplete }: AIProcessingProps) {
  const [steps, setSteps] = useState<StepItem[]>(
    STEPS_TEMPLATE.map(text => ({ text, state: 'waiting' })),
  );

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const overlayOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(15);
  const stepsOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

  // Halka rotasyonları — her biri farklı hız ve yön
  const rot1 = useSharedValue(0);
  const rot2 = useSharedValue(0);
  const rot3 = useSharedValue(0);
  const scaleInner = useSharedValue(0.3);

  /** Tüm animasyonları ve timer'ları temizle, state'i sıfırla */
  function resetAll() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    cancelAnimation(overlayOpacity);
    cancelAnimation(titleOpacity);
    cancelAnimation(titleTranslateY);
    cancelAnimation(stepsOpacity);
    cancelAnimation(subtitleOpacity);
    cancelAnimation(rot1);
    cancelAnimation(rot2);
    cancelAnimation(rot3);
    cancelAnimation(scaleInner);
    overlayOpacity.value = 0;
    titleOpacity.value = 0;
    titleTranslateY.value = 15;
    stepsOpacity.value = 0;
    subtitleOpacity.value = 0;
    rot1.value = 0;
    rot2.value = 0;
    rot3.value = 0;
    scaleInner.value = 0.3;
    setSteps(STEPS_TEMPLATE.map(text => ({ text, state: 'waiting' })));
  }

  useEffect(() => {
    if (!visible) {
      resetAll();
      return;
    }

    // Overlay fade in
    overlayOpacity.value = withTiming(1, { duration: 350 });
    hapticLight();

    // İç daire spring giriş
    scaleInner.value = withSpring(1, { damping: 10, stiffness: 90 });

    // Halka rotasyonları başlat — sonsuz döngü
    rot1.value = withRepeat(
      withTiming(360, { duration: 5000, easing: Easing.linear }),
      -1,
      false,
    );
    rot2.value = withRepeat(
      withTiming(-360, { duration: 3500, easing: Easing.linear }),
      -1,
      false,
    );
    rot3.value = withRepeat(
      withTiming(360, { duration: 2500, easing: Easing.linear }),
      -1,
      false,
    );

    // Başlık fade in + slide up (delay 300ms)
    const tTitle = setTimeout(() => {
      titleOpacity.value = withTiming(1, { duration: 400 });
      titleTranslateY.value = withTiming(0, { duration: 400 });
    }, 300);

    // Alt yazı (delay 500ms)
    const tSub = setTimeout(() => {
      subtitleOpacity.value = withTiming(1, { duration: 300 });
    }, 500);

    // Adımlar görünür (delay 600ms)
    const tSteps = setTimeout(() => {
      stepsOpacity.value = withTiming(1, { duration: 300 });
    }, 600);

    // Adım 0 aktif (700ms)
    const t0 = setTimeout(() => {
      setSteps(prev => prev.map((s, i) => (i === 0 ? { ...s, state: 'active' } : s)));
    }, 700);

    // Adım 0 tamamlandı → adım 1 aktif (1100ms)
    const t1 = setTimeout(() => {
      hapticSelection();
      setSteps(prev =>
        prev.map((s, i) => {
          if (i === 0) return { ...s, state: 'completed' };
          if (i === 1) return { ...s, state: 'active' };
          return s;
        }),
      );
    }, 1100);

    // Adım 1 tamamlandı → adım 2 aktif (1500ms)
    const t2 = setTimeout(() => {
      hapticSelection();
      setSteps(prev =>
        prev.map((s, i) => {
          if (i === 1) return { ...s, state: 'completed' };
          if (i === 2) return { ...s, state: 'active' };
          return s;
        }),
      );
    }, 1500);

    // Adım 2 tamamlandı (1900ms)
    const t3 = setTimeout(() => {
      hapticSelection();
      setSteps(prev => prev.map(s => ({ ...s, state: 'completed' })));
      hapticSuccess();
    }, 1900);

    // onComplete callback (2600ms) — opsiyonel
    const tDone = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2600);

    timers.current = [tTitle, tSub, tSteps, t0, t1, t2, t3, tDone];

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      cancelAnimation(overlayOpacity);
      cancelAnimation(rot1);
      cancelAnimation(rot2);
      cancelAnimation(rot3);
      cancelAnimation(scaleInner);
    };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot1.value}deg` }],
  }));
  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot2.value}deg` }],
  }));
  const ring3Style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot3.value}deg` }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleInner.value }],
  }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const stepsAnimStyle = useAnimatedStyle(() => ({ opacity: stepsOpacity.value }));
  const subtitleAnimStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.root, overlayStyle]}>

      {/* Spiral halka animasyonu */}
      <View style={styles.spiralContainer}>
        {/* Dış halka — en yavaş */}
        <Animated.View style={[styles.ring1, ring1Style]} />
        {/* Orta halka — ters yön */}
        <Animated.View style={[styles.ring2, ring2Style]} />
        {/* İç halka — en hızlı */}
        <Animated.View style={[styles.ring3, ring3Style]} />
        {/* En içteki daire — spring ile büyür */}
        <Animated.View style={[styles.ring4, innerStyle]} />
        {/* Merkez nokta */}
        <View style={styles.centerDot} />
      </View>

      {/* Başlık */}
      <Animated.Text style={[styles.title, titleAnimStyle]}>
        AI Processing
      </Animated.Text>

      {/* Alt yazı */}
      <Animated.Text style={[styles.subtitle, subtitleAnimStyle]}>
        Analyzing your mood...
      </Animated.Text>

      {/* Aşama listesi */}
      <Animated.View style={[styles.stepsList, stepsAnimStyle]}>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepRow}>
            <View style={styles.indicatorWrap}>
              {step.state === 'completed' ? (
                <Text style={styles.checkmark}>✓</Text>
              ) : step.state === 'active' ? (
                <StepSpinner />
              ) : (
                <View style={styles.spinnerPlaceholder} />
              )}
            </View>
            <Text
              style={[
                styles.stepText,
                step.state === 'active' && styles.stepTextActive,
                step.state === 'completed' && styles.stepTextCompleted,
              ]}
            >
              {step.text}
            </Text>
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}
