/**
 * Native splash kapısının modül düzeyi tek örneği (mantık: utils/splashHide.ts).
 *
 * Yazan: `app/_layout.tsx` (fontlar), `app/gate.tsx` (gate ekranı + SplashMark görseli).
 * `hideAsync` yalnız buradan çağrılır. Cold start başına sıfırlanır (modül belleği).
 */
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';

import { createSplashHideController, type SplashHideEvent } from '@/utils/splashHide';
import { logger } from '@/utils/logger';

/** Fontlar hazır olduktan sonra eksik sinyallere beklenecek en fazla süre. */
const SPLASH_FAILSAFE_MS = 1500;

function hideSplash(event: SplashHideEvent): void {
  logger.log(
    `[splash] hideAsync reason=${event.reason} missing=[${event.missing.join(',')}] +${event.elapsedMs}ms`,
  );
  if (event.reason === 'fallback') {
    Sentry.captureMessage('splash sinyalleri zamanında gelmedi, splash zorla kaldırıldı', {
      level: 'warning',
      tags: { flow: 'splash', error_code: 'SPLASH_HIDE_FALLBACK' },
      extra: { missing: event.missing, failsafe_ms: SPLASH_FAILSAFE_MS, elapsed_ms: event.elapsedMs },
    });
  }
  SplashScreen.hideAsync().catch((err) => {
    Sentry.captureException(err, {
      level: 'warning',
      tags: { flow: 'splash', error_code: 'SPLASH_HIDE_FAILED' },
    });
  });
}

const splashGate = createSplashHideController({ hide: hideSplash, failsafeMs: SPLASH_FAILSAFE_MS });

export const markSplashFontsReady = (): void => splashGate.markFontsReady();
export const markSplashGateSettled = (): void => splashGate.markGateSettled();
export const markSplashMarkLoaded = (): void => splashGate.markMarkLoaded();
