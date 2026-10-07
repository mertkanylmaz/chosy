/**
 * FocusStill — oynanış karesi: açılan pozisyonla görüntü odağa gelir.
 *
 * Teknik: iki katlı çapraz geçiş. `blurRadius` kare kare ANİMASYONLANMAZ (her
 * değer expo-image'da yeniden işleme + GPU bulanıklaştırma demek); iki kat
 * yığılır, her katın `blurRadius`'u görünürken SABİT, yalnız opaklık animasyonlu.
 *
 *   ön kat   — opak, oturmuş düzey
 *   gelen kat — yeni düzeyle YÜKLENİR (opaklık 0), `onLoad` gelince üstten
 *               belirir; bitince ön kat olur, eski kat sessizce 0'a iner
 *
 * Eski kat geçiş boyunca opak kalır → iki yarı saydam kat arasında zemin
 * parlamaz ("dip" yok). Kurallar:
 *   - ilk mount / resume: animasyon yok, doğru düzey doğrudan çizilir
 *   - düzey değişmediyse (yanlış harf, sheet aç/kapa, re-render) hiçbir şey olmaz
 *   - hızlı ardışık değişim: gelen kat yeni düzeye yeniden hedeflenir, kuyruk yok
 *   - unmount: animasyon iptal edilir, bayat geri çağrı state'e dokunmaz
 *   - gelen katın `onLoad`'u SPOTLIGHT_STILL_LOAD_TIMEOUT_MS içinde gelmezse kat
 *     yine de öne alınır + SPOTLIGHT_STILL_LOAD_TIMEOUT kaydı (focusWatchdog.ts)
 *
 * Yeni oyun state'i yok — tek girdi `blurRadius` (kanonik ilerlemeden türer).
 * Sonuç ekranı bu bileşeni KULLANMAZ (SpotlightStill › ResultStill).
 */
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
  SPOTLIGHT_FOCUS_STEP,
} from '@/constants/design/motion';
import { logger } from '@/utils/logger';

import { SPOTLIGHT_STILL_LOAD_TIMEOUT_MS } from './constants';
import { createLoadWatchdog, type LoadWatchdog } from './focusWatchdog';
import type { createStyles } from './styles';

type Layer = 0 | 1;

interface FocusStillProps {
  uri: string;
  /** Hedef bulanıklık — `blurForProgress` çıktısı */
  blurRadius: number;
  styles: ReturnType<typeof createStyles>;
  /** VoiceOver etiketi — kare tek `image` öğesi, düğme değil */
  accessibilityLabel: string;
  /** Kutunun üstünde yüzen chrome */
  children?: ReactNode;
}

const other = (layer: Layer): Layer => (layer === 0 ? 1 : 0);

export function FocusStill({
  uri,
  blurRadius,
  styles,
  accessibilityLabel,
  children,
}: FocusStillProps) {
  const isReducedMotion = useReducedMotion();
  const duration = isReducedMotion
    ? REDUCED_MOTION_DURATION.crossFade
    : SPOTLIGHT_FOCUS_STEP.duration;

  /** Her katın o an yüklediği bulanıklık — görünürken değişmez */
  const [blurs, setBlurs] = useState<[number, number]>([blurRadius, blurRadius]);
  /** Üstte çizilen kat (gelen kat belirirken o) */
  const [top, setTop] = useState<Layer>(0);
  /** İlk kare yüklenince true: sonraki yüklemelerde expo-image kendi geçişini kapatır */
  const [ready, setReady] = useState(false);

  const opacity0 = useSharedValue(1);
  const opacity1 = useSharedValue(0);
  const style0 = useAnimatedStyle(() => ({ opacity: opacity0.value }));
  const style1 = useAnimatedStyle(() => ({ opacity: opacity1.value }));

  /** Son istenen düzey — render'dan bağımsız karar için */
  const targetRef = useRef(blurRadius);
  const blursRef = useRef<[number, number]>([blurRadius, blurRadius]);
  /** Oturmuş, opak kat */
  const frontRef = useRef<Layer>(0);
  /** Yeni düzeyi taşıyan kat (yükleniyor ya da belirmekte); yoksa null */
  const incomingRef = useRef<Layer | null>(null);
  /** Gelen katın EN SON düzeyi henüz yüklenmedi */
  const awaitingRef = useRef(false);
  const firstLoadedRef = useRef(false);
  const mountedRef = useRef(true);
  const watchdogRef = useRef<LoadWatchdog | null>(null);
  if (watchdogRef.current === null) {
    watchdogRef.current = createLoadWatchdog<ReturnType<typeof setTimeout>>(
      { set: (cb, ms) => setTimeout(cb, ms), clear: (h) => clearTimeout(h) },
      SPOTLIGHT_STILL_LOAD_TIMEOUT_MS,
    );
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      watchdogRef.current?.cancel();
      cancelAnimation(opacity0);
      cancelAnimation(opacity1);
    };
    // opacity* kararlı referans
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const opacityOf = useCallback(
    (layer: Layer) => (layer === 0 ? opacity0 : opacity1),
    // opacity* kararlı referans
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const setLayerBlur = useCallback((layer: Layer, value: number) => {
    const next: [number, number] = [...blursRef.current];
    next[layer] = value;
    blursRef.current = next;
    setBlurs(next);
  }, []);

  /** Düzey değişti mi — yalnız değişince katman işi yapılır */
  useEffect(() => {
    if (blurRadius === targetRef.current) return;
    targetRef.current = blurRadius;

    if (!firstLoadedRef.current) {
      // Ekranda henüz kare yok: geçiş sunulacak bir şey yok, doğru düzeyi yükle
      blursRef.current = [blurRadius, blurRadius];
      setBlurs([blurRadius, blurRadius]);
      return;
    }

    // Yeniden hedefleme: belirmekte olan kat varsa onu, yoksa arkadaki katı kullan
    const incoming = incomingRef.current ?? other(frontRef.current);
    incomingRef.current = incoming;
    awaitingRef.current = true;
    setLayerBlur(incoming, blurRadius);
    // Yeniden hedefleme taze süre alır; önceki zamanlayıcı arm içinde iptal olur
    watchdogRef.current?.arm(() => loadTimeoutRef.current());
  }, [blurRadius, setLayerBlur]);

  /** Çapraz geçiş bitti: gelen kat ön kat olur, eski kat sessizce gizlenir */
  const settle = useCallback(
    (layer: Layer) => {
      if (!mountedRef.current || incomingRef.current !== layer || awaitingRef.current) return;
      opacityOf(other(layer)).value = 0;
      frontRef.current = layer;
      incomingRef.current = null;
    },
    [opacityOf],
  );

  /** Gelen katı öne al: çapraz geçiş — yükleme ve zaman aşımı AYNI yolu kullanır */
  const promote = useCallback(
    (layer: Layer) => {
      awaitingRef.current = false;
      setTop(layer);
      withFocusTiming(opacityOf(layer), duration, () => settle(layer));
    },
    [duration, opacityOf, settle],
  );

  const handleLoad = useCallback(
    (layer: Layer) => {
      if (!firstLoadedRef.current) {
        // İlk kare — animasyonsuz; resume'da da doğrudan doğru düzey
        if (layer === 0) {
          firstLoadedRef.current = true;
          setReady(true);
        }
        return;
      }
      if (!awaitingRef.current || incomingRef.current !== layer) return;
      // Bayat yükleme: bu kat artık başka düzey istiyor
      if (blursRef.current[layer] !== targetRef.current) return;

      watchdogRef.current?.cancel();
      promote(layer);
    },
    [promote],
  );

  /**
   * `onLoad` süresinde gelmedi: varsayım (blurRadius değişince yeniden yükleme)
   * tutmuyor olabilir. Görsel eski düzeyde sıkışmasın diye gelen kat yine de
   * öne alınır; olay kayda geçer (cihazda varsayımı doğrulamak için).
   */
  const handleLoadTimeout = useCallback(() => {
    const layer = incomingRef.current;
    if (!mountedRef.current || layer === null || !awaitingRef.current) return;
    logger.error(
      '[spotlight] Odak katmani onLoad gelmedi — kat yine de one alindi',
      new Error('SPOTLIGHT_STILL_LOAD_TIMEOUT'),
      {
        code: 'SPOTLIGHT_STILL_LOAD_TIMEOUT',
        extra: { backdrop_url: uri, blur_radius: targetRef.current, timeout_ms: SPOTLIGHT_STILL_LOAD_TIMEOUT_MS },
      },
    );
    promote(layer);
  }, [promote, uri]);
  // Bekçi her zaman en güncel işleyiciyi çağırır (arm anındaki kapanış bayatlamasın)
  const loadTimeoutRef = useRef(handleLoadTimeout);
  loadTimeoutRef.current = handleLoadTimeout;

  const handleError = useCallback(
    (layer: Layer, error: string) => {
      // Yalnız geçişin gelen katı: ilk kare/ön kat hata davranışı değişmedi
      if (incomingRef.current !== layer || !awaitingRef.current) return;
      watchdogRef.current?.cancel();
      logger.error('[spotlight] Odak karesi yuklenemedi — onceki netlik kaldi', error, {
        code: 'SPOTLIGHT_STILL_LOAD',
        extra: { backdrop_url: uri },
      });
      // Çapraz geçiş yok, ön kat görünür kalır
      awaitingRef.current = false;
      incomingRef.current = null;
      opacityOf(layer).value = 0;
    },
    [opacityOf, uri],
  );

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={styles.stillWrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.stillLayer, top === 0 ? styles.layerTop : styles.layerBase, style0]}>
        <Image
          source={{ uri }}
          style={styles.still}
          contentFit="cover"
          blurRadius={blurs[0]}
          transition={ready ? 0 : 300}
          onLoad={() => handleLoad(0)}
          onError={(e) => handleError(0, e.error)}
          accessible={false}
        />
      </Animated.View>
      <Animated.View style={[styles.stillLayer, top === 1 ? styles.layerTop : styles.layerBase, style1]}>
        <Image
          source={{ uri }}
          style={styles.still}
          contentFit="cover"
          blurRadius={blurs[1]}
          transition={0}
          onLoad={() => handleLoad(1)}
          onError={(e) => handleError(1, e.error)}
          accessible={false}
        />
      </Animated.View>
      {children}
    </Animated.View>
  );
}

/** Opaklığı 1'e çeker; yalnız KESİNTİSİZ bitişte `onDone` (yeniden hedefleme sayılmaz) */
function withFocusTiming(
  value: { value: number },
  duration: number,
  onDone: () => void,
): void {
  value.value = withTiming(1, { duration, easing: EASE_OUT_QUART }, (finished) => {
    if (finished) runOnJS(onDone)();
  });
}
