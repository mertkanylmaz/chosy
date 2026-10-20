/**
 * Gate — uygulama açılışında routing kararını verir.
 * Native splash ile birebir aynı görünümü (ink zemin + ortada splash-mark) gösterir;
 * karar hazır olunca bekletmeden yönlendirir. Görünür geçiş TEK: Stack'in `fade`'i
 * (app/_layout.tsx); gate kendi opacity animasyonunu çalıştırmaz — ikisi üst üste
 * binince altta Stack zemini görünüp kararma yaratıyordu (HOME-1 bulgu 5).
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
import { Image, StyleSheet, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { color } from '@/constants/design/semantic';
import { markGateDone } from '@/services/gateState';
import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/watchlist';
import { isGateReadyToNavigate } from '@/utils/gateDecision';
import { incrementSessionCount } from '../services/entryService';

/** Minimum splash display time (ms) — 0: native splash zaten gösterildi, ek bekleme yok. */
const MIN_SPLASH_MS = 0;

/**
 * Native splash (app.json `splash`, resizeMode contain, tam ekran) ile aynı
 * görsel: kare PNG ekran genişliğinde, ekranın ortasında (safe-area kayması yok).
 */
const SPLASH_MARK = require('../assets/images/splash-mark.png');

export default function Gate() {
  /** Yönlendirme bir kez yapılır (zamanlayıcı ve karar aynı anda hazır olabilir). */
  const navigated = useRef(false);
  const targetRoute = useRef<string | null>(null);
  const decisionReady = useRef(false);
  const minTimePassed = useRef(false);
  /** Onboarded kullanıcı (tabs'e gidiyor): MIN_SPLASH_MS beklenmez. */
  const skipMinSplash = useRef(false);

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
      // Karar verildi: (tabs) koruması (app/(tabs)/_layout.tsx) artık geçirir.
      markGateDone();
      router.replace(targetRoute.current as never);
    }
  }, []);

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
      <Image source={SPLASH_MARK} style={styles.mark} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: color.surface.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: '100%',
    aspectRatio: 1,
  },
});
