/**
 * Platform-safe haptic helper.
 * Expo Go'da ve web'de expo-haptics native modülü olmayabilir.
 * Dynamic require + try-catch ile Expo Go'da sessizce atlar.
 */
import { Platform } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Haptics: typeof import('expo-haptics') | null = null;
try {
  // Dynamic require: Expo Go'da native modül yoksa null kalır
  Haptics = require('expo-haptics');
} catch (_) {
  Haptics = null;
}

/** İlk hatada bir kez loglanır, sonra susturulur */
let _hapticWarned = false;

/**
 * Temel haptic wrapper — web ve desteklenmeyen cihazlarda sessizce geçer.
 */
async function safeHaptic(fn: () => Promise<void>): Promise<void> {
  if (Platform.OS === 'web' || !Haptics) return;
  try {
    await fn();
  } catch {
    if (__DEV__ && !_hapticWarned) {
      console.log('[haptics] not available on this device — further warnings suppressed');
      _hapticWarned = true;
    }
  }
}

export const hapticLight = () =>
  safeHaptic(() => Haptics!.impactAsync(Haptics!.ImpactFeedbackStyle.Light));

export const hapticMedium = () =>
  safeHaptic(() => Haptics!.impactAsync(Haptics!.ImpactFeedbackStyle.Medium));

export const hapticHeavy = () =>
  safeHaptic(() => Haptics!.impactAsync(Haptics!.ImpactFeedbackStyle.Heavy));

export const hapticSelection = () =>
  safeHaptic(() => Haptics!.selectionAsync());

export const hapticSuccess = () =>
  safeHaptic(() =>
    Haptics!.notificationAsync(Haptics!.NotificationFeedbackType.Success),
  );

export const hapticWarning = () =>
  safeHaptic(() =>
    Haptics!.notificationAsync(Haptics!.NotificationFeedbackType.Warning),
  );

export const hapticImpact = (style: 'Light' | 'Medium' | 'Heavy' = 'Light') =>
  safeHaptic(() =>
    Haptics!.impactAsync(Haptics!.ImpactFeedbackStyle[style]),
  );

export const hapticNotification = (
  type: 'Success' | 'Warning' | 'Error' = 'Success',
) =>
  safeHaptic(() =>
    Haptics!.notificationAsync(Haptics!.NotificationFeedbackType[type]),
  );
