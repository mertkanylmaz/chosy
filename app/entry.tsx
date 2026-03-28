/**
 * Entry ekranı — kullanıcı türüne göre dinamik giriş deneyimi.
 *
 * Routing kararı app/index.tsx'te verilir.
 * Bu ekran sadece userType'a göre doğru varyasyonu render eder:
 *   - 'new'       → EmotionalHook
 *   - 'returning' → InstantGratification
 *   - 'power'     → InteractiveStart
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';

import EmotionalHook from '@/components/Entry/EmotionalHook';
import InstantGratification from '@/components/Entry/InstantGratification';
import InteractiveStart from '@/components/Entry/InteractiveStart';
import { Colors } from '@/constants/Colors';
import { getUserType, type UserType } from '@/services/entryService';

/**
 * Entry ekranı bileşeni.
 * getUserType() çağırarak kullanıcı türünü belirler ve ilgili varyasyonu render eder.
 */
export default function EntryScreen() {
  const [userType, setUserType] = useState<UserType | null>(null);

  useEffect(() => {
    getUserType().then(setUserType);
  }, []);

  if (userType === null) {
    return (
      <LinearGradient colors={[Colors.background, Colors.background]} style={styles.loading}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </LinearGradient>
    );
  }

  if (userType === 'returning') return <InstantGratification />;
  if (userType === 'power') return <InteractiveStart />;
  return <EmotionalHook />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
