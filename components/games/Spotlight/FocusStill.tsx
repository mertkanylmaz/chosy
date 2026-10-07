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
 * parlamaz ("dip" yok). Değişmez: eski kat, gelen kat YÜKLENDİ onaylanmadan asla
 * gizlenmez; zaman aşımı ya da hata tek başına eski katı kaldırmaz. Kat durumu
 * (pending | loaded | failed) ve bilet kontrolü saf makinede (focusWatchdog.ts).
 * Kurallar:
 *   - ilk mount / resume: animasyon yok, doğru düzey doğrudan çizilir
 *   - düzey değişmediyse (yanlış harf, sheet aç/kapa, re-render) hiçbir şey olmaz
 *   - hızlı ardışık değişim: gelen kat yeni düzeye yeniden hedeflenir, kuyruk yok
 *   - unmount: animasyon iptal edilir, bayat geri çağrı state'e dokunmaz
 *   - gelen katın `onLoad`'u SPOTLIGHT_STILL_LOAD_TIMEOUT_MS içinde gelmezse kat
 *     yine de öne alınır (eski kat opak altta kalır) + SPOTLIGHT_STILL_LOAD_TIMEOUT
 *     kaydı; GEÇ gelen `onLoad` kabul edilir ve eski katı o zaman gizler
 *   - gelen katın `onError`'u: kat başarısız işaretlenir, eski kat görünür kalır
 *
 * Yeni oyun state'i yok — tek girdi `blurRadius` (kanonik ilerlemeden türer).
 * Sonuç ekranı bu bileşeni KULLANMAZ (SpotlightStill › ResultStill).
 */
import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
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
  DISSOLVE_DURATION,
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
  SPOTLIGHT_FOCUS_STEP,
} from '@/constants/design/motion';
import { logger } from '@/utils/logger';

import { SPOTLIGHT_STILL_LOAD_TIMEOUT_MS } from './constants';
import {
  createFocusState,
  createLoadWatchdog,
  focusReduce,
  type FocusEffect,
  type FocusEvent,
  type FocusState,
  type LoadWatchdog,
} from './focusWatchdog';
import type { createStyles } from './styles';

type Layer = 0 | 1;

interface FocusStillProps {
  uri: string;
  /** Hedef bulanıklık — `blurForProgress` çıktısı */
  blurRadius: number;
  styles: ReturnType<typeof createStyles>;
  /** VoiceOver etiketi — kare tek `image` öğesi, düğme değil */
  accessibilityLabel: string;
  /** İlk kare yüklenemezse kutuda gösterilen sakin tek satır (i18n çağıranda) */
  errorMessage: string;
  /** Kutunun üstünde yüzen chrome */
  children?: ReactNode;
}

export function FocusStill({
  uri,
  blurRadius,
  styles,
  accessibilityLabel,
  errorMessage,
  children,
}: FocusStillProps) {
  const isReducedMotion = useReducedMotion();
  const duration = isReducedMotion
    ? REDUCED_MOTION_DURATION.crossFade
    : SPOTLIGHT_FOCUS_STEP.duration;
  /** Kutunun ilk belirişi: yalnız opaklık; Reduce Motion'da 100ms (en yakın token: yeni rakip 360) */
  const enteringFade = FadeIn.duration(
    isReducedMotion ? REDUCED_MOTION_DURATION.crossFade : DISSOLVE_DURATION.newContender,
  );

  /** Her katın o an yüklediği bulanıklık — görünürken değişmez */
  const [blurs, setBlurs] = useState<[number, number]>([blurRadius, blurRadius]);
  /** Üstte çizilen kat (gelen kat belirirken o) */
  const [top, setTop] = useState<Layer>(0);
  /** İlk kare yüklenince true: sonraki yüklemelerde expo-image kendi geçişini kapatır */
  const [ready, setReady] = useState(false);
  /** İlk kare yüklenemedi — kutu boş kalmasın, mesaj gösterilir (oyun kullanılabilir kalır) */
  const [firstFrameFailed, setFirstFrameFailed] = useState(false);

  const opacity0 = useSharedValue(1);
  const opacity1 = useSharedValue(0);
  const style0 = useAnimatedStyle(() => ({ opacity: opacity0.value }));
  const style1 = useAnimatedStyle(() => ({ opacity: opacity1.value }));

  /** Son istenen düzey — render'dan bağımsız karar için */
  const targetRef = useRef(blurRadius);
  const uriRef = useRef(uri);
  uriRef.current = uri;
  /** Son `onError` metni — makine saf kalsın diye log etkisi buradan okur */
  const lastErrorRef = useRef('');
  const blursRef = useRef<[number, number]>([blurRadius, blurRadius]);
  /** Kat durum makinesi (focusWatchdog.ts) — görünürlük kararlarının tek kaynağı */
  const machineRef = useRef<FocusState>(createFocusState());
  const firstLoadedRef = useRef(false);
  const mountedRef = useRef(true);
  const watchdogRef = useRef<LoadWatchdog | null>(null);
  if (watchdogRef.current === null) {
    watchdogRef.current = createLoadWatchdog<ReturnType<typeof setTimeout>>(
      { set: (cb, ms) => setTimeout(cb, ms), clear: (h) => clearTimeout(h) },
      SPOTLIGHT_STILL_LOAD_TIMEOUT_MS,
    );
  }

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

  // Etkiler her zaman en güncel süre/işleyiciyle çalışsın (bayat kapanış yok)
  const dispatchRef = useRef<(event: FocusEvent) => void>(() => {});

  const runEffect = useCallback(
    (effect: FocusEffect) => {
      switch (effect.type) {
        case 'assign':
          setLayerBlur(effect.layer, targetRef.current);
          break;
        case 'armWatchdog':
          // Yeniden hedefleme taze süre alır; önceki zamanlayıcı arm içinde iptal olur
          watchdogRef.current?.arm(() => dispatchRef.current({ type: 'timeout' }));
          break;
        case 'cancelWatchdog':
          watchdogRef.current?.cancel();
          break;
        case 'startFade':
          setTop(effect.layer);
          withFocusTiming(opacityOf(effect.layer), duration, () =>
            dispatchRef.current({ type: 'fadeDone', layer: effect.layer }),
          );
          break;
        case 'hide':
          opacityOf(effect.layer).value = 0;
          break;
        case 'log':
          if (effect.code === 'SPOTLIGHT_STILL_LOAD_TIMEOUT') {
            // `onLoad` süresinde gelmedi: kat yine de öne alındı, ön kat opak kaldı;
            // olay kayda geçer (cihazda varsayımı doğrulamak için)
            logger.error(
              '[spotlight] Odak katmani onLoad gelmedi — kat one alindi, onceki kat opak kaldi',
              new Error('SPOTLIGHT_STILL_LOAD_TIMEOUT'),
              {
                code: 'SPOTLIGHT_STILL_LOAD_TIMEOUT',
                extra: {
                  backdrop_url: uriRef.current,
                  blur_radius: targetRef.current,
                  timeout_ms: SPOTLIGHT_STILL_LOAD_TIMEOUT_MS,
                },
              },
            );
          } else {
            logger.error(
              '[spotlight] Odak karesi yuklenemedi — onceki netlik kaldi',
              lastErrorRef.current,
              { code: 'SPOTLIGHT_STILL_LOAD', extra: { backdrop_url: uriRef.current } },
            );
          }
          break;
      }
    },
    [duration, opacityOf, setLayerBlur],
  );

  const dispatch = useCallback(
    (event: FocusEvent) => {
      if (!mountedRef.current) return;
      const step = focusReduce(machineRef.current, event);
      machineRef.current = step.state;
      step.effects.forEach(runEffect);
    },
    [runEffect],
  );
  dispatchRef.current = dispatch;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      // Unmount: zamanlayıcı ve animasyonlar iptal, sonrasında state'e dokunulmaz
      const step = focusReduce(machineRef.current, { type: 'unmount' });
      machineRef.current = step.state;
      mountedRef.current = false;
      watchdogRef.current?.cancel();
      cancelAnimation(opacity0);
      cancelAnimation(opacity1);
    };
    // opacity* kararlı referans
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    dispatch({ type: 'retarget' });
  }, [blurRadius, dispatch]);

  /** `ticket`: geri çağrının bağlandığı render'daki kat bileti — bayat olay makinede elenir */
  const handleLoad = useCallback(
    (layer: Layer, ticket: number) => {
      if (!firstLoadedRef.current) {
        // İlk kare — animasyonsuz; resume'da da doğrudan doğru düzey
        if (layer === 0) {
          firstLoadedRef.current = true;
          setReady(true);
          setFirstFrameFailed(false);
        }
        return;
      }
      dispatch({ type: 'load', layer, ticket });
    },
    [dispatch],
  );

  const handleError = useCallback(
    (layer: Layer, ticket: number, error: string) => {
      if (!firstLoadedRef.current) {
        // Ekranda henüz kare yok → geçiş katı da yok. Aynı URI'yi iki kat birlikte
        // yükler; tek kayıt için yalnız kat 0 raporlar (kat 1 aynı nedenle düşer).
        if (layer === 0 && mountedRef.current) {
          logger.error('[spotlight] Ilk kare yuklenemedi', error, {
            code: 'SPOTLIGHT_STILL_LOAD_FIRST',
            extra: { backdrop_url: uriRef.current, blur_radius: targetRef.current },
          });
          setFirstFrameFailed(true);
        }
        return;
      }
      lastErrorRef.current = error;
      dispatch({ type: 'error', layer, ticket });
    },
    [dispatch],
  );

  const tickets = machineRef.current.ticket;

  return (
    <Animated.View
      entering={enteringFade}
      style={styles.stillWrap}
      accessible
      accessibilityRole="image"
      accessibilityLabel={firstFrameFailed ? `${accessibilityLabel} ${errorMessage}` : accessibilityLabel}
    >
      <Animated.View style={[styles.stillLayer, top === 0 ? styles.layerTop : styles.layerBase, style0]}>
        <Image
          source={{ uri }}
          style={styles.still}
          contentFit="cover"
          blurRadius={blurs[0]}
          transition={ready ? 0 : 300}
          onLoad={() => handleLoad(0, tickets[0])}
          onError={(e) => handleError(0, tickets[0], e.error)}
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
          onLoad={() => handleLoad(1, tickets[1])}
          onError={(e) => handleError(1, tickets[1], e.error)}
          accessible={false}
        />
      </Animated.View>
      {firstFrameFailed && (
        <View style={styles.stillError} pointerEvents="none">
          <Text style={styles.stillErrorText}>{errorMessage}</Text>
        </View>
      )}
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
