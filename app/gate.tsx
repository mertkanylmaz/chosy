/**
 * Gate — uygulama açılışında routing kararını verir.
 * Premium LoadingScreen gösterir, minimum 3 saniye sonra fade-out ile geçiş yapar.
 *
 * Sıra:
 *  1. Auth gating: anonim veya oturumsuz kullanıcılar → /auth
 *  2. Onboarding tamamlanmadıysa → /onboarding
 *  3. Session sayısını artır → /(tabs)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { LoadingScreen } from '@/components/LoadingScreen';
import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/watchlist';
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

        // Auth gating — Apple/Google ile giriş zorunlu
        const isAnonymous = session?.user?.is_anonymous === true;
        if (!session || isAnonymous) {
          targetRoute.current = '/auth';
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

        // Entry ekranı kaldırıldı — doğrudan ana ekrana yönlendir
        await incrementSessionCount();
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
