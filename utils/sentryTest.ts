/**
 * Sentry test yardimcilari — sadece __DEV__ modunda kullanilir.
 * Profile ekranindaki "Test Sentry" butonundan tetiklenir.
 */
import * as Sentry from '@sentry/react-native';

import { logger } from '@/utils/logger';

/**
 * Sentry'e test hatasi gonderir.
 * Development build'de crash reporting'in calistigini dogrulamak icin kullanilir.
 *
 * 3 farkli sinyal gonderir:
 *   1. Breadcrumb — hata oncesi context
 *   2. Message — basit bilgi mesaji
 *   3. Error — yakalanan exception (crash YAPMAZ)
 */
export function triggerTestError(): void {
  logger.log('[sentry-test] Triggering test error...');

  // Breadcrumb — Sentry event'ine ek context
  Sentry.addBreadcrumb({
    category: 'test',
    message: 'Test Sentry button tapped',
    level: 'info',
  });

  // Message event — dashboard'da gorunur
  Sentry.captureMessage('Sentry test message from Chosy.ai dev build', 'info');

  // Error event — exception olarak raporlanir (app crash YAPMAZ)
  try {
    throw new Error('Sentry test error — this is intentional');
  } catch (error) {
    Sentry.captureException(error);
    logger.log('[sentry-test] Test error captured successfully. Check Sentry dashboard.');
  }
}
