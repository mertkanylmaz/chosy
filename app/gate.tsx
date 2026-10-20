/**
 * Gate — uygulama açılışında routing kararını verir.
 * Native splash ile birebir aynı görünümü (ink zemin + ortada splash-mark) gösterir;
 * karar hazır olunca bekletmeden yönlendirir. Giriş animasyonu YOK (ilk kare native
 * splash ile aynı, opak). Çıkış SIRALI: önce yalnız logo söner (opacity 1→0, 200 ms),
 * zemin (ink) opak kalır; sonra `router.replace`. Böylece Stack `fade`'i (app/_layout.tsx)
 * başladığında logo zaten yoktur ve logo ile yeni ekran içeriği hiçbir karede üst üste
 * binmez (HOME-4; HOME-1 bulgu 5'te zemin kararması yüzünden bütün ekranı solduran
 * animasyon kaldırılmıştı — burada zemin solmaz).
 *
 * Sıra:
 *  1. Onboarding tamamlanmadıysa → /onboarding
 *  2. Session sayısını artır
 *  3. → /(tabs)
 *
 * E-05 köprü ekranı (/relaunch-intro) yönlendirmesi R-19 ile kaldırıldı.
 *
 * K-12 (R-A-1): auth gating KALDIRILDI. Anonim kullanıcı uygulamanın tam
 * akışını görür; giriş ilk şampiyon sonrasında önerilir (K-13, R-A-2).
 * /auth ekranı Sprint 1 / 4b'de silindi: çıkış ve hesap silme
 * `resetToFreshSession` ile onboarding'e döner, giriş Profil'den yapılır.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { color } from '@/constants/design/semantic';
import { markGateDone } from '@/services/gateState';
import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/watchlist';
import { isGateReadyToNavigate } from '@/utils/gateDecision';
import { incrementSessionCount } from '../services/entryService';

/** Minimum splash display time (ms) — 0: native splash zaten gösterildi, ek bekleme yok. */
const MIN_SPLASH_MS = 0;

/** Logo çıkış solması. Easing.out(cubic) projedeki mevcut çıkış eğrisi. */
const EXIT_FADE_MS = 200;

/**
 * Animasyon geri çağrısı hiç gelmezse (unmount, worklet kaybı) navigasyonun
 * takılmaması için tek failsafe. EXIT_FADE_MS'ten bilinçli uzun: normal yolda
 * hiç tetiklenmez, tetiklenirse Sentry'de iz kalır.
 */
const EXIT_FAILSAFE_MS = 400;

/**
 * Native splash (app.json `splash`, resizeMode contain, tam ekran) ile aynı
 * görsel: kare PNG ekran genişliğinde, ekranın ortasında (safe-area kayması yok).
 */
const SPLASH_MARK = require('../assets/images/splash-mark.png');

export default function Gate() {
  /**
   * Logo boyutu kesin piksel: ekran genişliği × ekran genişliği (kare), ekranın tam
   * ortasında. Yüzde/aspectRatio/flex cihazda (HOME-5 ölçümü) uygulanmadı.
   */
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const markSize = screenWidth;
  /** Yönlendirme bir kez yapılır (zamanlayıcı ve karar aynı anda hazır olabilir). */
  const navigated = useRef(false);
  const targetRoute = useRef<string | null>(null);
  const decisionReady = useRef(false);
  const minTimePassed = useRef(false);
  /** Onboarded kullanıcı (tabs'e gidiyor): MIN_SPLASH_MS beklenmez. */
  const skipMinSplash = useRef(false);

  const reduceMotion = useReducedMotion();
  /** `tryNavigate` kararlı kalsın diye ref üzerinden okunur. */
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;
  const markOpacity = useSharedValue(1);
  const markStyle = useAnimatedStyle(() => ({ opacity: markOpacity.value }));
  /** markGateDone + replace tam bir kez (animasyon bitişi ile failsafe yarışabilir). */
  const exited = useRef(false);
  const failsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const finishExit = useCallback(() => {
    if (exited.current) return;
    exited.current = true;
    if (failsafeTimer.current !== null) {
      clearTimeout(failsafeTimer.current);
      failsafeTimer.current = null;
    }
    // Karar verildi: (tabs) koruması (app/(tabs)/_layout.tsx) artık geçirir.
    markGateDone();
    router.replace(targetRoute.current as never);
  }, []);

  /** Yalnız logo söner; bitince (veya failsafe ile) finishExit. */
  const startExit = useCallback(() => {
    if (reduceMotionRef.current) {
      finishExit();
      return;
    }
    failsafeTimer.current = setTimeout(() => {
      failsafeTimer.current = null;
      if (exited.current) return;
      Sentry.captureMessage('gate çıkış animasyonu geri çağrısı gelmedi', {
        level: 'warning',
        tags: { flow: 'gate', error_code: 'GATE_EXIT_ANIM_FALLBACK' },
        extra: { fade_ms: EXIT_FADE_MS, failsafe_ms: EXIT_FAILSAFE_MS },
      });
      finishExit();
    }, EXIT_FAILSAFE_MS);
    // `finished` false (iptal) olsa da çıkılır: navigasyon animasyona rehin değil.
    markOpacity.value = withTiming(
      0,
      { duration: EXIT_FADE_MS, easing: Easing.out(Easing.cubic) },
      () => {
        runOnJS(finishExit)();
      },
    );
  }, [finishExit, markOpacity]);

  /** Try to navigate if both conditions met */
  const tryNavigate = useCallback(() => {
    if (
      targetRoute.current &&
      isGateReadyToNavigate({
        decisionReady: decisionReady.current,
        minTimePassed: minTimePassed.current,
        skipMinSplash: skipMinSplash.current,
      })
    ) {
      if (navigated.current) return;
      navigated.current = true;
      startExit();
    }
  }, [startExit]);

  useEffect(() => {
    // Minimum display timer
    const timer = setTimeout(() => {
      minTimePassed.current = true;
      tryNavigate();
    }, MIN_SPLASH_MS);

    // Routing decision
    async function decide() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        // Oturum henüz açılmamış olabilir (_layout.tsx signInAnonymously()
        // yarışı). Kimlik yoksa onboarding'e gidilir — anonim oturum orada
        // veya sonraki açılışta tamamlanır. Anonim kullanıcı giriş ekranına
        // zorlanmaz (K-12).
        if (!session) {
          targetRoute.current = '/onboarding';
          decisionReady.current = true;
          tryNavigate();
          return;
        }

        // public.users satırını garantile
        await getAppUserId();

        // Onboarding kontrolü — AsyncStorage cache + DB source of truth
        const userId = session.user.id;
        const userKey = `chosy_onboarded_${userId}`;
        let onboarded = await AsyncStorage.getItem(userKey);
        if (!onboarded) {
          const legacy = await AsyncStorage.getItem('chosy_onboarded');
          if (legacy) {
            await AsyncStorage.setItem(userKey, legacy);
            await AsyncStorage.removeItem('chosy_onboarded');
            onboarded = legacy;
          }
        }

        // AsyncStorage miss — DB'den kontrol et (reinstall durumu)
        if (!onboarded) {
          try {
            const appUserId = await getAppUserId();
            if (appUserId) {
              const { data: userRow } = await supabase
                .from('users')
                .select('onboarding_completed_at')
                .eq('id', appUserId)
                .single();

              if (userRow?.onboarding_completed_at) {
                // DB'de onboarding tamamlanmış — AsyncStorage cache'ini yenile
                await AsyncStorage.setItem(userKey, '1');
                onboarded = '1';
              }
            }
          } catch (err) {
            // DB kontrolü başarısız — güvenli tarafta kal, onboarding göster
            // (davranış aynı; yalnız görünür). Dönen kullanıcı yanlışlıkla
            // onboarding'e düşebilir, bu yüzden Sentry'de iz kalır.
            Sentry.captureException(err, {
              level: 'warning',
              tags: { flow: 'gate', error_code: 'GATE_ONBOARDING_DB_CHECK_FAILED' },
            });
          }
        }

        if (!onboarded) {
          targetRoute.current = '/onboarding';
          decisionReady.current = true;
          tryNavigate();
          return;
        }

        await incrementSessionCount();

        // E-05 köprü ekranı yönlendirmesi KALDIRILDI (R-19, 26 Eyl 2026):
        // hiçbir kohort /relaunch-intro'ya düşmez. Ekran dosyası ve
        // has_seen_relaunch_intro bayrağı silinmedi — geri açılabilir.

        // Entry ekranı kaldırıldı — doğrudan ana ekrana yönlendir
        targetRoute.current = '/(tabs)';
        skipMinSplash.current = true;
        decisionReady.current = true;
        tryNavigate();
      } catch {
        targetRoute.current = '/(tabs)';
        decisionReady.current = true;
        tryNavigate();
      }
    }

    decide();

    return () => clearTimeout(timer);
  }, [tryNavigate]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Animated.Image
        source={SPLASH_MARK}
        style={[
          styles.mark,
          {
            width: markSize,
            height: markSize,
            left: (screenWidth - markSize) / 2,
            top: (screenHeight - markSize) / 2,
          },
          markStyle,
        ]}
        resizeMode="contain"
        onLayout={
          __DEV__
            ? (e) => {
                const { width, height } = e.nativeEvent.layout;
                console.log(
                  `[gate] mark onLayout ${width}x${height} (beklenen ${markSize}x${markSize}, ekran ${screenWidth}x${screenHeight})`,
                );
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.surface.base,
  },
  /** Boyut ve konum render'da kesin pikselle verilir (useWindowDimensions). */
  mark: {
    position: 'absolute',
  },
});
