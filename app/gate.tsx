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
 * COLD-START-1: `getSession()` 6 sn içinde dönmezse (token refresh takılması)
 * görünür "Bağlanamadı" durumu açılır; istek İPTAL EDİLMEZ, geç çözülürse karar
 * otomatik yeniden çalışır. Karar hatası artık sessizce /(tabs)'a düşmez.
 *
 * E-05 köprü ekranı (/relaunch-intro) yönlendirmesi R-19 ile kaldırıldı.
 *
 * K-12 (R-A-1): auth gating KALDIRILDI. Anonim kullanıcı uygulamanın tam
 * akışını görür; giriş ilk şampiyon sonrasında önerilir (K-13, R-A-2).
 * /auth ekranı Sprint 1 / 4b'de silindi: çıkış ve hesap silme
 * `resetToFreshSession` ile onboarding'e döner, giriş Profil'den yapılır.
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { router, useNavigation } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { styles as shellStyles } from '@/components/gauntlet/GauntletShell/styles';
import { SplashMark } from '@/components/SplashMark';
import { color } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { markGateDone } from '@/services/gateState';
import { markSplashGateSettled, markSplashMarkLoaded } from '@/services/splashGate';
import { posthogAnalytics } from '@/services/posthog';
import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/watchlist';
import { bootClock } from '@/utils/bootClock';
import { isGateReadyToNavigate } from '@/utils/gateDecision';
import {
  GATE_SESSION_TIMEOUT_MS,
  handleGateFailure,
  raceWithTimeout,
  type GateFailure,
  type GateFailureReason,
} from '@/utils/gateBoot';
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

/** Hata görünümü: zemin splash/gate ile aynı ink; içerik GauntletShell hata görünümüyle ortak. */
const localStyles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: color.surface.base,
  },
});

/** Sessiz değil: zaman aşımı uyarı, karar hatası exception olarak Sentry'ye gider. */
function reportGateFailure(failure: GateFailure): void {
  // PII yok: yalnız sabit neden etiketi ve süre. Her gösterimde bir olay.
  posthogAnalytics.track('boot_failed', {
    reason: failure.reason,
    elapsed_ms: bootClock.elapsedMs(),
  });
  if (failure.reason === 'auth_timeout') {
    Sentry.captureMessage('gate: getSession zaman eşiğini aştı — hata durumu gösterildi', {
      level: 'warning',
      tags: { flow: 'gate', error_code: 'GATE_AUTH_TIMEOUT' },
      extra: { gate_elapsed_ms: failure.elapsedMs, threshold_ms: GATE_SESSION_TIMEOUT_MS },
    });
    return;
  }
  Sentry.captureException(failure.error ?? new Error('gate decision error (hata nesnesi yok)'), {
    level: 'error',
    tags: { flow: 'gate', error_code: 'GATE_DECISION_ERROR' },
    extra: { gate_elapsed_ms: failure.elapsedMs },
  });
}

export default function Gate() {
  const { t } = useLanguage();
  /** Açıksa gate yönlendirmez; hata görünümü + "tekrar dene" gösterilir. */
  const [failure, setFailure] = useState<GateFailureReason | null>(null);
  /** Her `decide()` koşusu bir numara alır; eski koşunun geç sonucu yenisini ezmez. */
  const runId = useRef(0);
  const mountedAt = useRef(Date.now());
  /** Hata görünümü bu açılışta en az bir kez gösterildi mi (boot_recovered için). */
  const hadFailure = useRef(false);
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
    posthogAnalytics.track('boot_ready_ms', { ms: bootClock.elapsedMs() });
    if (hadFailure.current) {
      posthogAnalytics.track('boot_recovered', { elapsed_ms: bootClock.elapsedMs() });
    }
    // Karar verildi: (tabs) koruması (app/(tabs)/_layout.tsx) artık geçirir.
    markGateDone();
    markSplashGateSettled();
    router.replace(targetRoute.current as never);
  }, []);

  /** Yalnız logo söner; bitince (veya failsafe ile) finishExit. */
  const startExit = useCallback(() => {
    // Çıkış başladıysa gate görünür/karar verilmiştir; splash artık gate'i beklemez
    // (geçiş bitmeden karar gelirse transitionEnd gelmeyebilir).
    markSplashGateSettled();
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

  // ── HOME-7: native splash kalkışı için gate sinyali ──────────────────────
  // Soğuk açılışta yığın [gate, (tabs)]; üstteki (tabs) GateGuard'ı dismissTo ile
  // sökülünce gate ortaya çıkar (Stack fade). Splash o geçiş BİTENE kadar
  // beklemeli: gate'in `transitionEnd` (closing:false, iOS viewDidAppear) olayı.
  // Derin bağlantı/bildirimle üstte (tabs) dışında bir ekran varsa GateGuard hiç
  // mount olmaz, gate odağa gelmez: beklenmez, hemen "hazır" sayılır (aksi halde
  // açılış failsafe süresi kadar takılırdı). Gate zaten en üstteyse de hazırdır.
  const navigation = useNavigation();
  useEffect(() => {
    const state = navigation.getState();
    const topName = state?.routes[state.index]?.name;
    if (topName !== '(tabs)') {
      markSplashGateSettled();
      return undefined;
    }
    return navigation.addListener('transitionEnd' as never, ((e: { data?: { closing?: boolean } }) => {
      if (e.data?.closing === false) markSplashGateSettled();
    }) as never);
  }, [navigation]);

  /** Bu koşu hâlâ güncel mi (yeni koşu başlamadı, yönlendirme yapılmadı). */
  const isCurrentRun = useCallback((id: number) => runId.current === id && !navigated.current, []);

  const failGate = useCallback((reason: GateFailureReason, error?: unknown) => {
    hadFailure.current = true;
    handleGateFailure(
      { reason, elapsedMs: Date.now() - mountedAt.current, error },
      { report: reportGateFailure, showError: setFailure },
    );
  }, []);

  /** "Tekrar dene" effect içindeki `decide`yi yeniden çalıştırır. */
  const decideRef = useRef<(() => Promise<void>) | null>(null);
  const retry = useCallback(() => {
    setFailure(null);
    void decideRef.current?.();
  }, []);

  useEffect(() => {
    // Minimum display timer
    const timer = setTimeout(() => {
      minTimePassed.current = true;
      tryNavigate();
    }, MIN_SPLASH_MS);

    // Routing decision
    async function decide() {
      runId.current += 1;
      const id = runId.current;
      try {
        // getSession auth-js initializePromise'ini (token refresh) bekler. Süre dolarsa
        // istek iptal edilmez: görünür hata açılır, çözülünce karar yeniden çalışır.
        const race = await raceWithTimeout(supabase.auth.getSession(), GATE_SESSION_TIMEOUT_MS);
        if (!isCurrentRun(id)) return;

        if (race.status === 'timeout') {
          failGate('auth_timeout');
          race.late.then(
            () => {
              if (!isCurrentRun(id)) return;
              setFailure(null);
              void decide();
            },
            (err: unknown) => {
              if (isCurrentRun(id)) failGate('gate_decision_error', err);
            },
          );
          return;
        }
        const { data: { session } } = race.value;

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
      } catch (err) {
        // Eskiden burada sessizce /(tabs)'a gidiliyordu (kural 1/2). Artık: Sentry +
        // görünür hata durumu; kullanıcı "tekrar dene" ile kararı yeniden çalıştırır.
        if (isCurrentRun(id)) failGate('gate_decision_error', err);
      }
    }

    decideRef.current = decide;
    void decide();

    return () => clearTimeout(timer);
  }, [tryNavigate, failGate, isCurrentRun]);

  if (failure !== null) {
    return (
      <View style={localStyles.errorScreen}>
        <StatusBar style="light" />
        <View style={shellStyles.centerContent}>
          <Text style={shellStyles.stateText}>{t('gate.loadError')}</Text>
          <QuietAction label={t('gate.retry')} onPress={retry} />
        </View>
      </View>
    );
  }

  return (
    <SplashMark markStyle={markStyle} onLoad={markSplashMarkLoaded}>
      <StatusBar style="light" />
    </SplashMark>
  );
}
