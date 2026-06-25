import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { hapticLight, hapticSelection, hapticSuccess, hapticWarning } from '@/utils/haptics';
import { Colors } from '@/constants/Colors';
import FilmSeridi from '@/components/FilmReelAnimation';
import styles from './styles';

// ── Sabitler ──────────────────────────────────────────────────────────────────

/** Overlay fade-out süresi (ms) — result ekranının mount olmasına zaman tanır */
const FADE_OUT_MS = 280;

/** Timeout: bu kadar süre sonra hâlâ parseMood bitmemişse retry göster */
const TIMEOUT_MS = 12_000;

// ── Props ─────────────────────────────────────────────────────────────────────

/** AIProcessingOverlay props */
interface AIProcessingProps {
  /** Overlay görünür mü (parent phase === 'processing') */
  visible: boolean;
  /**
   * Pipeline ilerleme sinyali — parent parseMood bitince 'done' gönderir.
   * Bu sayede step animasyonu gerçek pipeline'a bağlanır.
   *   - undefined | 'parsing'  → step1 aktif
   *   - 'done'                 → tüm step'ler tamamlanır, fade-out başlar
   */
  pipelineStage?: 'parsing' | 'done';
  /** Tüm animasyon tamamlanınca çağrılır (opsiyonel) */
  onComplete?: () => void;
  /** Timeout durumunda retry tetikler */
  onRetry?: () => void;
  /** i18n çeviri fonksiyonu */
  t: (key: string, opts?: Record<string, string | number>) => string;
}

type StepState = 'waiting' | 'active' | 'completed';

interface StepItem {
  key: string;
  state: StepState;
}

const STEP_KEYS = ['aiProcessing.step1', 'aiProcessing.step2', 'aiProcessing.step3'];

// ── StepSpinner ───────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * AI mood analizi sırasında tam ekranı kaplayan overlay.
 * Film makarası animasyonu + 3 aşamalı ilerleme listesi.
 *
 * v2 İyileştirmeler:
 *   - Fade-out geçişi: siyah ekran flash'ını önler
 *   - Pipeline-aware adımlar: gerçek parseMood ilerlemesine bağlı
 *   - Timeout guard: 12s sonra retry butonu gösterir
 */
export default function AIProcessingOverlay({
  visible,
  pipelineStage,
  onComplete,
  onRetry,
  t,
}: AIProcessingProps) {
  // shouldRender: fade-out bitene kadar DOM'da kalır
  const [shouldRender, setShouldRender] = useState(false);
  const [steps, setSteps] = useState<StepItem[]>(
    STEP_KEYS.map(key => ({ key, state: 'waiting' })),
  );
  const [showTimeout, setShowTimeout] = useState(false);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const overlayOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(15);
  const stepsOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const scaleInner = useSharedValue(0.3);

  /** Tüm animasyonları ve timer'ları temizle, state'i sıfırla */
  const resetAll = useCallback(() => {
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
    setShowTimeout(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fade-out tamamlandığında DOM'dan kaldır ─────────────────────────────────
  const onFadeOutDone = useCallback(() => {
    setShouldRender(false);
    resetAll();
  }, [resetAll]);

  // ── visible değişimi: giriş animasyonu + timeout guard ──────────────────────
  useEffect(() => {
    if (visible) {
      // SHOW
      setShouldRender(true);
      setShowTimeout(false);
      resetAll();

      // Overlay fade in — anında görünür
      overlayOpacity.value = withTiming(1, { duration: 120 });
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

      // Adım 0 aktif (700ms) — "Reading emotions" parsing başladı
      const t0 = setTimeout(() => {
        setSteps(prev => prev.map((s, i) => (i === 0 ? { ...s, state: 'active' } : s)));
      }, 700);

      // Adım 0→1 geçişi (1100ms) — "Finding patterns"
      // Bu zaman-tabanlı: parseMood genelde >1s sürer, bu arada step ilerler
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

      // Timeout guard: 12s sonra retry butonu göster
      const tTimeout = setTimeout(() => {
        hapticWarning();
        setShowTimeout(true);
      }, TIMEOUT_MS);

      timers.current = [tTitle, tSub, tSteps, t0, t1, tTimeout];
    } else if (shouldRender) {
      // HIDE — fade-out ile graceful geçiş
      timers.current.forEach(clearTimeout);
      timers.current = [];

      overlayOpacity.value = withTiming(0, { duration: FADE_OUT_MS }, () => {
        runOnJS(onFadeOutDone)();
      });
    }

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Pipeline stage değişimi: step'leri gerçek duruma bağla ─────────────────
  useEffect(() => {
    if (!visible) return;

    if (pipelineStage === 'done') {
      // parseMood bitti — tüm step'leri tamamla
      hapticSelection();
      setSteps(prev =>
        prev.map((s, i) => {
          // Henüz tamamlanmamış step'leri tamamla
          if (i <= 1 && s.state !== 'completed') return { ...s, state: 'completed' };
          if (i === 2) return { ...s, state: 'active' };
          return s;
        }),
      );

      // Step 3 tamamla + success haptic (kısa gecikme — kullanıcı görsün)
      const tFinal = setTimeout(() => {
        hapticSuccess();
        setSteps(prev => prev.map(s => ({ ...s, state: 'completed' })));
      }, 300);

      timers.current.push(tFinal);
    }
  }, [pipelineStage, visible]);

  // Unmount cleanup
  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      cancelAnimation(overlayOpacity);
      cancelAnimation(scaleInner);
    };
  }, []);

  // ── Animated styles ─────────────────────────────────────────────────────────
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const stepsAnimStyle = useAnimatedStyle(() => ({ opacity: stepsOpacity.value }));
  const subtitleAnimStyle = useAnimatedStyle(() => ({ opacity: subtitleOpacity.value }));

  if (!shouldRender) return null;

  return (
    <Animated.View style={[styles.root, overlayStyle]} pointerEvents={visible ? 'auto' : 'none'}>

      {/* Film makarası animasyonu — C harfi şeklinde dönen film şeritleri */}
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

      {/* Timeout guard — retry butonu */}
      {showTimeout && onRetry && (
        <View style={styles.timeoutWrap}>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={onRetry}
            activeOpacity={0.7}
          >
            <Ionicons name="refresh" size={18} color={Colors.textOnAccent} />
            <Text style={styles.retryText}>{t('aiProcessing.retry')}</Text>
          </TouchableOpacity>
          <Text style={styles.timeoutHint}>{t('aiProcessing.slowConnection')}</Text>
        </View>
      )}
    </Animated.View>
  );
}
