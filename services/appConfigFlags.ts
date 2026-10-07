/**
 * app_config flag okumaları.
 *
 * Sprint 10b: ayrı `.from('app_config')` istekleri KALKTI. Değerler
 * `remoteConfig`'in tek `select key, value` önbelleğinden (5 dk TTL) okunur;
 * her okuma `hydrate()` ile TTL'i kontrol eder — taze ise ağ yok, bayatsa
 * tek-uçuşla yenilenir. Okuma hatası `remoteConfig` içinde Sentry'ye yazılır;
 * burada fail-closed varsayılan (`false`) geçerlidir.
 */

import { remoteConfig } from './remoteConfig';

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
