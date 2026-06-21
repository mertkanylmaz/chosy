/**
 * Paywall — DEPRECATED redirect stub.
 *
 * Legacy paywall ekrani kaldirildi — tum paywall gosterimleri
 * ContextualPaywall (bottom sheet modal) uzerinden yapilir.
 *
 * Bu dosya sadece deep link / eski referanslarin kirilmasini onler.
 * Acildiginda otomatik olarak geri doner.
 */

import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { logger } from '@/utils/logger';

export default function PaywallRedirect() {
  const router = useRouter();

  useEffect(() => {
    logger.warn('[paywall] Legacy paywall route erisiildi — geri yonlendiriliyor');
    // Kisa gecikme — navigation stack'in hazir olmasini bekle
    const timer = setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)' as never);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [router]);

  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
