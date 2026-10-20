/**
 * İlk oturum funnel'ı — PostHog bağlayıcısı. Mantık: `utils/firstSessionFunnel.ts`.
 * Özellikler PII taşımaz; `first_open` ile aynı ortak alanlar.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { posthogAnalytics } from '@/services/posthog';
import {
  fireFirstSessionEvent,
  IS_UPGRADE_KEY,
  parseIsUpgrade,
  type FirstSessionEvent,
} from '@/utils/firstSessionFunnel';

/** first_open'ın sakladığı değer; yok/okunamaz → null (özellik eklenmez). */
async function readIsUpgrade(): Promise<boolean | null> {
  try {
    return parseIsUpgrade(await AsyncStorage.getItem(IS_UPGRADE_KEY));
  } catch (err) {
    Sentry.captureException(err, {
      level: 'error',
      tags: { function: 'readIsUpgrade', error_code: 'IS_UPGRADE_READ_FAILED' },
    });
    return null;
  }
}

export async function trackFirstSessionEventOnce(event: FirstSessionEvent): Promise<void> {
  const isUpgrade = await readIsUpgrade();
  const { outcome, error } = await fireFirstSessionEvent(AsyncStorage, event, () => {
    posthogAnalytics.track(event, {
      ...(isUpgrade === null ? {} : { is_upgrade: isUpgrade }),
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
