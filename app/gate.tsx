/**
 * Gate — uygulama açılışında routing kararını verir.
 *
 * Sıra:
 *  1. Onboarding tamamlanmadıysa → /onboarding
 *  2. Entry bugün zaten gösterildiyse → /(tabs)
 *  3. Aksi hâlde session sayısını artır, tarihi kaydet → /entry
 */

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { Colors } from '@/constants/Colors';
import {
  incrementSessionCount,
  markEntryShown,
  wasEntryShownToday,
} from '../services/entryService';

export default function Gate() {
  useEffect(() => {
    async function decide() {
      try {
        const onboarded = await AsyncStorage.getItem('chosy_onboarded');
        if (!onboarded) {
          router.replace('/onboarding');
          return;
        }

        const shownToday = await wasEntryShownToday();
        if (shownToday) {
          router.replace('/(tabs)');
          return;
        }

        await incrementSessionCount();
        await markEntryShown();
        router.replace('/entry');
      } catch {
        router.replace('/(tabs)');
      }
    }

    decide();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator color={Colors.accentPrimary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
