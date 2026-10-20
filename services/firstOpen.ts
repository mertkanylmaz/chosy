/**
 * `first_open` — kurulum başına TAM BİR KEZ.
 *
 * Reklam testinde (Apple Ads) funnel'in ilk halkası. İlk açılış gömülü paketi
 * çalıştırdığı için (`fallbackToCacheTimeout: 0`) olay ikili dosyaya gömülü
 * JS'ten çıkmalı — bu yüzden `_layout` açılışında, auth/ağ beklemeden çağrılır.
 *
 * Bayrak AsyncStorage'da kalıcıdır ve `sessionReset` temizliğinden muaftır
 * (`FIRST_OPEN_FLAG_KEY`): hesap silme/çıkış cihazın kurulumunu değiştirmez.
 * Okuma hatasında olay GÖNDERİLMEZ (çift sayım riski) ve Sentry'ye yazılır.
 * Özellikler PII taşımaz.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { deviceTimeZone } from '@/services/gauntletService';
import { posthogAnalytics } from '@/services/posthog';

export const FIRST_OPEN_FLAG_KEY = 'chosy_first_open_sent';

function deviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale || 'unknown';
  } catch (err) {
    Sentry.captureException(err, { level: 'warning', tags: { function: 'trackFirstOpenOnce', step: 'locale' } });
    return 'unknown';
  }
}

export async function trackFirstOpenOnce(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(FIRST_OPEN_FLAG_KEY)) !== null) return;
  } catch (err) {
    Sentry.captureException(err, {
      level: 'error',
      tags: { function: 'trackFirstOpenOnce', error_code: 'FIRST_OPEN_FLAG_READ_FAILED' },
    });
    return;
  }

  posthogAnalytics.track('first_open', {
    timezone: deviceTimeZone() ?? 'unknown',
    locale: deviceLocale(),
    app_version: Constants.expoConfig?.version ?? 'unknown',
    build: Constants.nativeBuildVersion ?? 'unknown',
    update_id: Updates.updateId ?? 'embedded',
    is_embedded_launch: Updates.isEmbeddedLaunch,
  });

  try {
    await AsyncStorage.setItem(FIRST_OPEN_FLAG_KEY, new Date().toISOString());
  } catch (err) {
    // Olay gitti ama bayrak yazılamadı → sonraki açılışta tekrar gider.
    Sentry.captureException(err, {
      level: 'error',
      tags: { function: 'trackFirstOpenOnce', error_code: 'FIRST_OPEN_FLAG_WRITE_FAILED' },
    });
  }
}
