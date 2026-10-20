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

import { ASK_STATE_KEY } from '@/services/askCoordinator';
import { readAppUserId } from '@/services/auth-utils';
import { wasFirstOpenThisSession } from '@/services/firstOpen';
import { readCachedCycleDate } from '@/services/gauntletCache';
import { getChampionDatesSince } from '@/services/gauntletService';
import { posthogAnalytics } from '@/services/posthog';
import { askedToday, parseAskState } from '@/utils/askDecision';
import { logger } from '@/utils/logger';
import { REVIEW_PROMPT_DAY, reviewSkipReason } from '@/utils/reviewDecision';

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
 * Bu cycle gününde ask koordinatörü istem gösterdi mi — SALT OKUNUR
 * (`chosy_ask_state`; ask semantiğine yazılmaz). Okunamayan durum fırlatır.
 */
async function readAskShownToday(): Promise<boolean> {
  const today = await readCachedCycleDate();
  if (!today) throw new Error('reviewPrompt: aktif cycle tarihi yok');
  const state = parseAskState(await AsyncStorage.getItem(ASK_STATE_KEY));
  return askedToday(state, today);
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
    dayCount: REVIEW_PROMPT_DAY, // yalnız yerel nedenleri ayıklamak için; asıl sayı aşağıda
    askShownToday: false,
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
  let askShownToday: boolean;
  try {
    askShownToday = await readAskShownToday();
    const userId = await readAppUserId();
    if (!userId) throw new Error('reviewPrompt: public.users.id çözülemedi');
    dayCount = (await getChampionDatesSince(userId, ALL_TIME)).length;
  } catch (err) {
    fail(err, 'day_count');
    return;
  }

  const skip = reviewSkipReason({
    dayCount,
    askShownToday,
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
