/**
 * app_config flag okumaları.
 *
 * Sprint 10b: ayrı `.from('app_config')` istekleri KALKTI. Değerler
 * `remoteConfig`'in tek `select key, value` önbelleğinden (5 dk TTL) okunur;
 * her okuma `hydrate()` ile TTL'i kontrol eder — taze ise ağ yok, bayatsa
 * tek-uçuşla yenilenir. Okuma hatası `remoteConfig` içinde Sentry'ye yazılır;
 * burada fail-closed varsayılan (`false`) geçerlidir.
 */

import * as Sentry from '@sentry/react-native';

import { readLocalAuthUid } from './auth-utils';
import { remoteConfig } from './remoteConfig';
import { evaluateMoodOfferEnabled, hasTesterEntries } from '@/utils/moodOfferTesters';

/**
 * Discover tab görünür mü (app_config: discover_tab_enabled).
 *
 * C.9a (bible K-02): Discover nav'dan kalktı, kod donduruldu — bu flag
 * yalnızca tab bar erişimini kontrol eder. Satır yok / okunamadı → false
 * (tab gizli kalır; hata `remoteConfig`'te Sentry'ye düşer).
 */
export async function isDiscoverTabEnabled(): Promise<boolean> {
  await remoteConfig.hydrate();
  return remoteConfig.getRaw('discover_tab_enabled') === true;
}

/**
 * Gauntlet bağlam çubuğu görünür mü (app_config: gauntlet_context_bar_enabled).
 *
 * K-18: bağlam düzeltmesi henüz bir tahmin modelini beslemiyor ("Faz 1: bağlam
 * tahmin modeli gelince"); etkisiz kontrol kullanıcıya gösterilmez. Varsayılan
 * GİZLİ: satır yoksa, okuma hatasında ve hiç önbellek yokken false; yalnızca
 * değer `true` ise açık.
 */
export async function isGauntletContextBarEnabled(): Promise<boolean> {
  await remoteConfig.hydrate();
  return remoteConfig.getRaw('gauntlet_context_bar_enabled') === true;
}

/**
 * Watch-feedback State 1'deki "I watched something else" seçeneği görünür mü
 * (app_config: watch_feedback_watched_other_enabled).
 *
 * T1b (arama sheet'i + `other_film_id`) bitmeden GÖSTERİLMEZ. Varsayılan KAPALI:
 * satır yoksa, okuma hatasında ve hiç önbellek yokken false; yalnızca değer
 * `true` ise açık. Lazy getter — modül seviyesi sabit yasak (kural 5).
 */
export async function isWatchedOtherEnabled(): Promise<boolean> {
  await remoteConfig.hydrate();
  return remoteConfig.getRaw('watch_feedback_watched_other_enabled') === true;
}

/**
 * Son çözülen oturum kimliği (auth.users.id) — yalnız tester listesi için. Senkron
 * okuyucuların (`triggerOrchestrator`) async oturum okumadan karar verebilmesi için
 * `isMoodOfferEnabled()` her çağrıda günceller. Bayrak değeri DEĞİL, kimlik önbelleği.
 */
let testerAuthId: string | null = null;

/**
 * Pro Mode daveti + ücretsiz arama teklif akışı.
 *
 * MONEY-1C. Açık = `app_config.mood_offer_enabled === true` VEYA oturumdaki
 * kimlik `app_config.mood_offer_testers` (jsonb dizi) içinde. Satır yoksa, dizi
 * geçersiz/boşsa, okuma hatasında ve hiç önbellek yokken KAPALI. Bu bir UX
 * bayrağıdır — kotayı sunucu zorlar. Kapalıyken uygulama MONEY-1C öncesi gibi davranır.
 *
 * Kimlik: `auth.users.id` (oturumdan YEREL okunur, ağ yok; `public.users.id` ek `users`
 * sorgusu ister ve bootstrap bitmeden null olur). Oturum yalnız bayrak kapalı VE liste
 * dolu iken okunur: tester olmayan kullanıcı için ek iş yok.
 * Lazy getter — modül seviyesi sabit yasak (kural 5).
 */
export async function isMoodOfferEnabled(): Promise<boolean> {
  await remoteConfig.hydrate();
  const flag: unknown = remoteConfig.get('mood_offer_enabled');
  const testers: unknown = remoteConfig.get('mood_offer_testers');
  if (flag !== true && hasTesterEntries(testers)) {
    try {
      testerAuthId = await readLocalAuthUid();
    } catch (err) {
      testerAuthId = null;
      Sentry.captureException(err, {
        level: 'warning',
        tags: { flow: 'mood_offer', step: 'tester_identity' },
      });
    }
  }
  return evaluateMoodOfferEnabled({ flag, testers, userId: testerAuthId });
}

/**
 * Senkron karar — ÖNBELLEKTEKİ config + son çözülen kimlik. Yalnız teklif zaten
 * `isMoodOfferEnabled()` ile açılmış yüzeylerin ardından çağrılan yerler için
 * (paywall orkestratörünün varyant kill-switch'i). Canlı config'i okur: bayrak/liste
 * kapatılınca bir sonraki hydrate'ten itibaren varyant üretilmez.
 */
export function isMoodOfferEnabledCached(): boolean {
  return evaluateMoodOfferEnabled({
    flag: remoteConfig.get('mood_offer_enabled'),
    testers: remoteConfig.get('mood_offer_testers'),
    userId: testerAuthId,
  });
}
