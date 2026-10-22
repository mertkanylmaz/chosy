/**
 * Anonim oturum kurtarmasının TEK giriş noktası (AUTH-LOOP Faz 1).
 *
 * `signInAnonymously()` uygulamada yalnız `app/_layout.tsx`'in üç kurtarma
 * dalından (ilk açılış, TOKEN_REFRESHED, SIGNED_OUT) çağrılır; üçü de buradan
 * geçer. Karar mantığı `utils/authRecoveryBreaker.ts`'te (saf, birim testli);
 * burası yalnız saat/uyku/AppState/Sentry/PostHog bağlar.
 *
 * Devre açılınca Sentry'ye TEK sefer `fatal` yazılır ve PostHog'a
 * `auth_recovery_tripped` gider. Kullanıcıya yeni UI gösterilmez: oturum
 * olmadığı için Gauntlet'in mevcut 401 → hata görünümü devreye girer.
 */
import { AppState } from 'react-native';
import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { posthogAnalytics } from './posthog';
import {
  createAuthRecovery,
  type RecoveryOutcome,
  type TripInfo,
} from '@/utils/authRecoveryBreaker';

function reportTrip(info: TripInfo): void {
  const errorMessage = info.error instanceof Error ? info.error.message : null;
  Sentry.captureMessage('Anonim oturum kurtarması devre kesiciyi açtı — yeni signInAnonymously yok', {
    level: 'fatal',
    tags: { flow: 'anonymous_session_recovery', error_code: 'AUTH_RECOVERY_TRIPPED', reason: info.reason },
    extra: {
      attempts: info.attempts,
      attempts_in_window: info.attemptsInWindow,
      error: errorMessage,
    },
  });
  posthogAnalytics.track('auth_recovery_tripped', {
    reason: info.reason,
    attempts: info.attempts,
    attempts_in_window: info.attemptsInWindow,
  });
}

export const authRecovery = createAuthRecovery({
  now: Date.now,
  sleep: (ms) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  isActive: () => AppState.currentState === 'active',
  onTrip: reportTrip,
});

type AnonymousSignIn = Awaited<ReturnType<typeof supabase.auth.signInAnonymously>>;

/**
 * Oturum yoksa devre kesiciden geçerek anonim oturum açar. Bekleme sonrası
 * başka bir yol oturum kurmuşsa `skipped` döner.
 */
export function recoverAnonymousSession(): Promise<RecoveryOutcome<AnonymousSignIn['data']>> {
  return authRecovery.run(() => supabase.auth.signInAnonymously(), {
    stillNeeded: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return !session;
    },
  });
}
