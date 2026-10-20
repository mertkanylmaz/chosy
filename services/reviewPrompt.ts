/**
 * Uygulama içi değerlendirme istemi (SKStoreReviewController) — B-211.
 *
 * Karar `utils/reviewDecision.ts` (saf, testli). Bu modül girdileri toplar:
 * şampiyon günü sayısı sunucudan (`getChampionDatesSince`, cycle `date`), sürüm
 * bayrağı AsyncStorage'dan. Özel "bizi puanla" ekranı YOK; yalnız sistem istemi.
 *
 * Bayrak (`chosy_review_prompt_version`) cihaz düzeyidir ve `sessionReset`
 * temizliğinden muaftır: hesap silme, aynı sürümde ikinci istemi doğurmasın.
 *
 * Kural 1: hiçbir hata yutulmaz — Sentry'ye yazılır, istem gösterilmez.
 * Bayrak ÖNCE yazılır, sonra gösterilir (askCoordinator ile aynı sıra): yazılamayan
 * bir istem sürüm başına bir kez kuralını delerdi.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { AppState } from 'react-native';

import { readAppUserId } from '@/services/auth-utils';
import { wasFirstOpenThisSession } from '@/services/firstOpen';
import { getChampionDatesSince } from '@/services/gauntletService';
import { posthogAnalytics } from '@/services/posthog';
import { logger } from '@/utils/logger';
import { reviewSkipReason } from '@/utils/reviewDecision';

export const REVIEW_PROMPT_VERSION_KEY = 'chosy_review_prompt_version';

/** `getChampionDatesSince` alt sınırı — tüm geçmişi kapsar (askCoordinator ile aynı). */
const ALL_TIME = '1970-01-01';

function fail(err: unknown, step: string): void {
  Sentry.captureException(err, {
    level: 'error',
    tags: { function: 'maybeRequestReview', error_code: 'REVIEW_PROMPT_FAILED', step },
  });
}

/**
 * Şampiyon seçildikten hemen sonra çağrılır. Asla fırlatmaz.
 *
 * @param paywallVisible Çağıranın bildiği paywall durumu (route tabanlı).
 */
export async function maybeRequestReview(paywallVisible: boolean): Promise<void> {
  const appVersion = Constants.expoConfig?.version ?? 'unknown';

  // Ucuz ön eleme: ağa çıkmadan önce yerel nedenler.
  let lastPromptedVersion: string | null;
  try {
    lastPromptedVersion = await AsyncStorage.getItem(REVIEW_PROMPT_VERSION_KEY);
  } catch (err) {
    fail(err, 'read_flag');
    return;
  }
  const preSkip = reviewSkipReason({
    dayCount: 3, // yalnız yerel nedenleri ayıklamak için; asıl sayı aşağıda
    appVersion,
    lastPromptedVersion,
    isFirstSession: wasFirstOpenThisSession(),
    paywallVisible,
    appActive: AppState.currentState === 'active',
  });
  if (preSkip !== null) {
    logger.log(`[review] atlandı: ${preSkip}`);
    return;
  }

  let dayCount: number;
  try {
    const userId = await readAppUserId();
    if (!userId) throw new Error('reviewPrompt: public.users.id çözülemedi');
    dayCount = (await getChampionDatesSince(userId, ALL_TIME)).length;
  } catch (err) {
    fail(err, 'day_count');
    return;
  }

  const skip = reviewSkipReason({
    dayCount,
    appVersion,
    lastPromptedVersion,
    isFirstSession: wasFirstOpenThisSession(),
    paywallVisible,
    appActive: AppState.currentState === 'active',
  });
  if (skip !== null) {
    logger.log(`[review] atlandı: ${skip}`);
    return;
  }

  try {
    if (!(await StoreReview.isAvailableAsync())) {
      // Yedek arayüz YOK (B-211). Görünür kalsın diye Sentry info; bayrak yazılmaz.
      Sentry.captureMessage('review: StoreReview kullanılamıyor — istem atlandı', {
        level: 'info',
        tags: { function: 'maybeRequestReview', error_code: 'REVIEW_UNAVAILABLE' },
        extra: { day_count: dayCount },
      });
      return;
    }
    await AsyncStorage.setItem(REVIEW_PROMPT_VERSION_KEY, appVersion);
    posthogAnalytics.track('review_prompt_requested', { day_count: dayCount });
    await StoreReview.requestReview();
  } catch (err) {
    fail(err, 'request');
  }
}
