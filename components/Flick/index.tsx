/**
 * Flick — MoodFlix sinematik kedi maskot.
 *
 * Faz 1 (AKTIF): Lumi fallback — .riv dosyası yoksa otomatik kullanılır.
 * Faz 2 (HAZIR): Rive entegrasyonu — assets/flick/flick.riv mevcut olunca
 *                USE_RIVE flag'ini true yap, Rive render aktif olur.
 * Faz 3: Lumi deprecation, tüm kullanım yerlerinde doğrudan Flick.
 *
 * Spec: .claude/specs/FLICK_MASCOT_SPEC.md
 * Rive build rehberi: .claude/specs/FLICK_RIVE_BUILD_GUIDE.md
 *
 * Rive State Machine: "FlickController"
 *   - mood (Number 0-7): idle/happy/sad/thinking/excited/surprised/love/sleepy
 *   - isSwiping (Boolean): swipe gesture aktif mi
 *   - swipeDirection (Number 0-3): none/left/right/down
 *   - celebration (Boolean): konfeti overlay efekti
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View, ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import Lumi, { type LumiMood } from '@/components/Lumi';

// ─── Feature Flag ────────────────────────────────────────────────────────────

/**
 * Rive kullanim flag'i.
 * .riv dosyasi assets/flick/flick.riv konumuna eklendikten sonra true yap.
 * False iken Lumi fallback kullanilir — runtime crash riski sifir.
 */
const USE_RIVE = false;

// ─── Rive Lazy Import ────────────────────────────────────────────────────────

// rive-react-native lazy import — sadece USE_RIVE=true oldugunda yuklenir.
// Paket henuz node_modules'da yoksa compile hatasi vermez.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RiveComponent: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let RiveFit: any = null;

/** Rive ref tipi — paket yoksa genel tip */
interface RiveRefCompat {
  setInputState: (stateMachineName: string, inputName: string, value: number | boolean) => void;
}

if (USE_RIVE) {
  try {
    // Dynamic require — tree-shaking USE_RIVE=false iken Rive bundle'a girmez
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const riveModule = require('rive-react-native');
    RiveComponent = riveModule.default;
    RiveFit = riveModule.Fit;
  } catch {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[Flick] rive-react-native yuklenemedi — Lumi fallback kullaniliyor');
    }
  }
}

// ─── Rive Sabitleri ─────────────────────────────────────────────────────────

/** Rive dosyasındaki artboard adı */
const RIVE_ARTBOARD = 'FlickMain';

/** Rive state machine adı */
const RIVE_STATE_MACHINE = 'FlickController';

/**
 * Rive resource adı — platform'a göre.
 * iOS: Bundle resource name (uzantısız)
 * Android: res/raw klasöründeki dosya adı (uzantısız)
 */
const RIVE_RESOURCE = Platform.select({
  ios: 'flick',
  android: 'flick',
  default: 'flick',
});

/** Rive state machine input adları — .riv dosyasındakilerle birebir eşleşmeli */
const RIVE_INPUTS = {
  mood: 'mood',
  isSwiping: 'isSwiping',
  swipeDirection: 'swipeDirection',
  celebration: 'celebration',
} as const;

// ─── Tipler ──────────────────────────────────────────────────────────────────

/** Flick'in 8 duygu durumu — Rive state machine'deki mood input'u (0-7) */
export type FlickMood =
  | 'idle'      // 0
  | 'happy'     // 1
  | 'sad'       // 2
  | 'thinking'  // 3
  | 'excited'   // 4
  | 'surprised' // 5
  | 'love'      // 6
  | 'sleepy';   // 7

/** FlickMood → Rive input number eşlemesi */
export const FLICK_MOOD_INDEX: Record<FlickMood, number> = {
  idle: 0,
  happy: 1,
  sad: 2,
  thinking: 3,
  excited: 4,
  surprised: 5,
  love: 6,
  sleepy: 7,
} as const;

/** Swipe yönü — Rive swipeDirection input'u (0-3) */
export type FlickSwipeDirection = 0 | 1 | 2 | 3;
// 0=none, 1=left, 2=right, 3=down

/** Flick component props — CDO spec'ten birebir */
export interface FlickProps {
  /** Piksel boyutu — Rive runtime scale eder */
  size: 48 | 96 | 120 | 256;
  /** Emotion state (0-7) */
  mood: FlickMood;
  /** Swipe gesture aktif mi */
  isSwiping?: boolean;
  /** Swipe yönü (0=none, 1=left, 2=right, 3=down) */
  swipeDirection?: FlickSwipeDirection;
  /** Milestone/streak kutlama efekti */
  celebration?: boolean;
  /** Sparkle efektleri (varsayılan: size >= 120) */
  showEffects?: boolean;
  /** Dış container stili */
  style?: ViewStyle;
}

// ─── Lumi Fallback Eşlemesi ──────────────────────────────────────────────────

/** FlickMood → LumiMood fallback mapping (spec'ten) */
const FLICK_TO_LUMI: Record<FlickMood, LumiMood> = {
  idle: 'idle',
  happy: 'happy',
  sad: 'idle',          // Lumi'de sad yok, idle'a fallback
  thinking: 'thinking',
  excited: 'excited',
  surprised: 'excited', // Lumi'de surprised yok
  love: 'happy',        // Lumi'de love yok
  sleepy: 'calm',       // Lumi'de sleepy yok
};

/** Flick size → Lumi size eşlemesi */
const FLICK_TO_LUMI_SIZE: Record<number, 'small' | 'medium' | 'large'> = {
  48: 'small',
  96: 'medium',
  120: 'large',
  256: 'large',
};

// ─── Rive Renderer ──────────────────────────────────────────────────────────

/**
 * Rive ile Flick render eden iç component.
 * USE_RIVE=true ve .riv dosyası mevcut olduğunda kullanılır.
 */
function FlickRive({
  size,
  mood,
  isSwiping = false,
  swipeDirection = 0,
  celebration = false,
}: Omit<FlickProps, 'showEffects' | 'style'>) {
  const riveRef = useRef<RiveRefCompat>(null);

  /** Memoized mood index — gereksiz Rive input güncellemesi önlenir */
  const moodIndex = FLICK_MOOD_INDEX[mood];

  /**
   * State machine input setter.
   * setInputState çağrısı Rive runtime'a input değişikliği bildirir,
   * state machine otomatik olarak doğru state'e geçer.
   */
  const setInput = useCallback((inputName: string, value: number | boolean) => {
    try {
      if (typeof value === 'boolean') {
        riveRef.current?.setInputState(RIVE_STATE_MACHINE, inputName, value);
      } else {
        riveRef.current?.setInputState(RIVE_STATE_MACHINE, inputName, value);
      }
    } catch {
      // Rive henüz mount olmamış olabilir — sessizce geç
    }
  }, []);

  // ── mood input senkronizasyonu ────────────────────────────────────────────
  useEffect(() => {
    setInput(RIVE_INPUTS.mood, moodIndex);
  }, [moodIndex, setInput]);

  // ── isSwiping input senkronizasyonu ───────────────────────────────────────
  useEffect(() => {
    setInput(RIVE_INPUTS.isSwiping, isSwiping);
  }, [isSwiping, setInput]);

  // ── swipeDirection input senkronizasyonu ──────────────────────────────────
  useEffect(() => {
    setInput(RIVE_INPUTS.swipeDirection, swipeDirection);
  }, [swipeDirection, setInput]);

  // ── celebration input senkronizasyonu ─────────────────────────────────────
  useEffect(() => {
    setInput(RIVE_INPUTS.celebration, celebration);
  }, [celebration, setInput]);

  return (
    <RiveComponent
      ref={riveRef}
      resourceName={RIVE_RESOURCE}
      artboardName={RIVE_ARTBOARD}
      stateMachineName={RIVE_STATE_MACHINE}
      autoplay
      fit={RiveFit?.Contain}
      style={{ width: size, height: size }}
    />
  );
}

// ─── Ana Component ──────────────────────────────────────────────────────────

/**
 * Flick maskot component.
 *
 * USE_RIVE=true ise Rive'dan render eder.
 * USE_RIVE=false ise Lumi fallback kullanır.
 * useReducedMotion() true ise statik görsel gösterir.
 *
 * Dışarıdaki props API'si her durumda aynı kalır.
 */
const Flick: React.FC<FlickProps> = React.memo(({
  size,
  mood,
  isSwiping = false,
  swipeDirection = 0,
  celebration = false,
  showEffects,
  style,
}) => {
  const reducedMotion = useReducedMotion();

  // Erişilebilirlik
  const accessibilityProps = useMemo(() => ({
    accessible: true,
    accessibilityLabel: 'Flick, MoodFlix mascot',
    accessibilityRole: 'image' as const,
    accessibilityState: { busy: mood === 'thinking' },
  }), [mood]);

  // Reduced motion — statik görsel (hem Rive hem Lumi bypass)
  if (reducedMotion) {
    return (
      <View
        style={[styles.container, { width: size, height: size }, style]}
        {...accessibilityProps}
      >
        <View
          style={[
            styles.staticFlick,
            {
              width: size * 0.6,
              height: size * 0.6,
              borderRadius: size * 0.3,
            },
          ]}
        />
      </View>
    );
  }

  // ── Rive render (Faz 2) ─────────────────────────────────────────────────
  // Rive componenti null ise (paket yüklenemedi) Lumi fallback'e düş
  if (USE_RIVE && RiveComponent != null) {
    return (
      <View
        style={[styles.container, { width: size, height: size }, style]}
        {...accessibilityProps}
      >
        <FlickRive
          size={size}
          mood={mood}
          isSwiping={isSwiping}
          swipeDirection={swipeDirection}
          celebration={celebration}
        />
      </View>
    );
  }

  // ── Lumi fallback (Faz 1) ──────────────────────────────────────────────
  const lumiMood = FLICK_TO_LUMI[mood];
  const lumiSize = FLICK_TO_LUMI_SIZE[size] ?? 'medium';
  const shouldShowEffects = showEffects ?? size >= 120;

  return (
    <View
      style={[styles.container, { width: size, height: size }, style]}
      {...accessibilityProps}
    >
      <Lumi
        size={lumiSize}
        mood={lumiMood}
        showParticles={shouldShowEffects}
        showGlow={shouldShowEffects}
      />
    </View>
  );
});

Flick.displayName = 'Flick';

export default Flick;

declare const __DEV__: boolean;

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Reduced motion fallback — statik violet daire */
  staticFlick: {
    backgroundColor: Colors.accentHover,
    borderWidth: 2,
    borderColor: Colors.accentPrimary,
  },
});
