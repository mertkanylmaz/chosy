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
import * as StoreReview from 'expo-store-review';
import { hapticLight, hapticSelection, hapticSuccess } from '@/utils/haptics';
import FilmSeridi from '@/components/FilmReelAnimation';
import styles from './styles';

/** AIProcessingOverlay props */
interface AIProcessingProps {
  /** Overlay görünür mü */
  visible: boolean;
  /** Tüm animasyon tamamlanınca çağrılır (opsiyonel) */
  onComplete?: () => void;
  /** i18n çeviri fonksiyonu */
  t: (key: string, opts?: Record<string, string | number>) => string;
}

type StepState = 'waiting' | 'active' | 'completed';

interface StepItem {
  key: string;
  state: StepState;
}

const STEP_KEYS = ['aiProcessing.step1', 'aiProcessing.step2', 'aiProcessing.step3'];

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
export default function AIProcessingOverlay({ visible, onComplete, t }: AIProcessingProps) {
  const [steps, setSteps] = useState<StepItem[]>(
    STEP_KEYS.map(key => ({ key, state: 'waiting' })),
  );

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const overlayOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(15);
  const stepsOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);

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
    cancelAnimation(scaleInner);
    overlayOpacity.value = 0;
    titleOpacity.value = 0;
    titleTranslateY.value = 15;
    stepsOpacity.value = 0;
    subtitleOpacity.value = 0;
    scaleInner.value = 0.3;
    setSteps(STEP_KEYS.map(key => ({ key, state: 'waiting' })));
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

    // Adım 2 tamamlandı (1900ms) + App Store review tetikle
    const t3 = setTimeout(() => {
      hapticSelection();
      setSteps(prev => prev.map(s => ({ ...s, state: 'completed' })));
      hapticSuccess();
      // App Store review — tamamlanma aninda tetikle (dopamin zirvesi)
      StoreReview.isAvailableAsync().then((available) => {
        if (available) StoreReview.requestReview();
      }).catch(() => {});
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
      cancelAnimation(scaleInner);
    };
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const stepsAnimStyle = useAnimatedStyle(() => ({ opacity: stepsOpacity.value }));
  const subtitleAnimStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.root, overlayStyle]}>

      {/* Film makarasi animasyonu — C harfi seklinde donen film seritleri */}
      <View style={styles.spiralContainer}>
        <FilmSeridi />
      </View>

      {/* Başlık */}
      <Animated.Text style={[styles.title, titleAnimStyle]}>
        {t('aiProcessing.title')}
      </Animated.Text>

      {/* Alt yazı */}
      <Animated.Text style={[styles.subtitle, subtitleAnimStyle]}>
        {t('aiProcessing.subtitle')}
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
              {t(step.key)}
            </Text>
          </View>
        ))}
      </Animated.View>
    </Animated.View>
  );
}
