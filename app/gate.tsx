/**
 * Gate — uygulama açılışında routing kararını verir.
 * Premium LoadingScreen gösterir, minimum 3 saniye sonra fade-out ile geçiş yapar.
 *
 * Sıra:
 *  1. Onboarding tamamlanmadıysa → /onboarding
 *  2. Session sayısını artır
 *  3. Relaunch öncesi hesap köprü ekranını görmediyse → /relaunch-intro (E-05)
 *  4. Aksi hâlde → /(tabs)
 *
 * K-12 (R-A-1): auth gating KALDIRILDI. Anonim kullanıcı uygulamanın tam
 * akışını görür; giriş ilk şampiyon sonrasında önerilir (K-13, R-A-2).
 * /auth ekranı silinmedi — profile'dan sign-out ve hesap silme sonrası
 * hâlâ oraya düşülüyor.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/watchlist';
import { readUserFlags } from '@/services/userFlags';
import { incrementSessionCount } from '../services/entryService';

/** Minimum splash display time (ms) */
const MIN_SPLASH_MS = 3000;

export default function Gate() {
  const [showLoading, setShowLoading] = useState(true);
  const targetRoute = useRef<string | null>(null);
  const decisionReady = useRef(false);
  const minTimePassed = useRef(false);

  /** Try to navigate if both conditions met */
  const tryNavigate = useCallback(() => {
    if (decisionReady.current && minTimePassed.current && targetRoute.current) {
      // Trigger fade-out (setShowLoading false → LoadingScreen fades → onFadeOutComplete navigates)
      setShowLoading(false);
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
        // veya sonraki açılışta tamamlanır. Anonim kullanıcı ARTIK /auth'a
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
          } catch {
            // DB kontrolü başarısız — güvenli tarafta kal, onboarding göster
          }
        }

        if (!onboarded) {
          targetRoute.current = '/onboarding';
          decisionReady.current = true;
          tryNavigate();
          return;
        }

        await incrementSessionCount();

        // ── E-05 köprü ekranı (R-A-2) ──────────────────────────────────────
        // Yalnızca relaunch ÖNCESİ kohort (legacy_mood_access, migration 090)
        // ve yalnızca bir kez (has_seen_relaunch_intro, migration 103).
        // Home'dan ÖNCE gelir — kullanıcı değişen ekranı, açıklamayı okumadan
        // görmez. Okuma başarısız olursa (null) köprü GÖSTERİLMEZ: fail-closed,
        // hata `readUserFlags` içinde Sentry'ye yazılır. Yeni kullanıcı bu
        // dala hiç girmez — legacy_mood_access onlarda false'tur.
        const flags = await readUserFlags();
        if (flags?.legacyMoodAccess && !flags.hasSeenRelaunchIntro) {
          targetRoute.current = '/relaunch-intro';
          decisionReady.current = true;
          tryNavigate();
          return;
        }

        // Entry ekranı kaldırıldı — doğrudan ana ekrana yönlendir
        targetRoute.current = '/(tabs)';
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

  /** Called after LoadingScreen fade-out animation completes */
  const handleFadeOutComplete = useCallback(() => {
    if (targetRoute.current) {
      router.replace(targetRoute.current as never);
    }
  }, []);

  return (
    <View style={styles.container}>
      <LoadingScreen
        visible={showLoading}
        onFadeOutComplete={handleFadeOutComplete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
