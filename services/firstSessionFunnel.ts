/**
 * İlk oturum funnel'ı — PostHog bağlayıcısı. Mantık: `utils/firstSessionFunnel.ts`.
 * Özellikler PII taşımaz; `first_open` ile aynı ortak alanlar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { posthogAnalytics } from '@/services/posthog';
import { fireFirstSessionEvent, type FirstSessionEvent } from '@/utils/firstSessionFunnel';

export async function trackFirstSessionEventOnce(event: FirstSessionEvent): Promise<void> {
  const { outcome, error } = await fireFirstSessionEvent(AsyncStorage, event, () => {
    posthogAnalytics.track(event, {
      app_version: Constants.expoConfig?.version ?? 'unknown',
      build: Constants.nativeBuildVersion ?? 'unknown',
      update_id: Updates.updateId ?? 'embedded',
      is_embedded_launch: Updates.isEmbeddedLaunch,
    });
  });
  if (error !== undefined) {
    Sentry.captureException(error, {
      level: 'error',
      tags: {
        function: 'trackFirstSessionEventOnce',
        event,
        error_code: outcome === 'read_failed' ? 'FUNNEL_FLAG_READ_FAILED' : 'FUNNEL_FLAG_WRITE_FAILED',
      },
    });
  }
}
