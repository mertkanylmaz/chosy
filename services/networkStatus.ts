/**
 * Ağ durumu — bağlantı var/yok bilgisinin TEK kaynağı (K-42).
 *
 * ── Neden var ──────────────────────────────────────────────────────────────
 * K-42 keşfinde ölçüldü: kod tabanında ağ durumu HİÇ algılanmıyordu. Hatalar
 * yalnız `try/catch` ile yakalanıyor, "bu bir bağlantı hatası mıydı" sorusu
 * hiçbir yerde sorulmuyordu. Kuyruğa alma kararı (Parça 3/4) bu ayrımı
 * gerektiriyor: sunucu 500'ü ile offline aynı şey DEĞİL — birincisi tekrar
 * denemeye değmez, ikincisi bağlantı gelince kendiliğinden çözülür.
 *
 * ── Kapsam ─────────────────────────────────────────────────────────────────
 * Bu modül yalnız DURUM bildirir. Kuyruk yönetmez, retry yapmaz, UI kararı
 * vermez. `_layout.tsx:249`'daki AppState dinleyicisine PARALEL çalışır;
 * o dinleyici PostHog flush'ı için ayrıdır ve bu modül ona dokunmaz.
 *
 * ── isInternetReachable neden `!== false` ──────────────────────────────────
 * NetInfo bu alanı üç değerli döner: true / false / null. `null` "henüz
 * ölçülmedi" demektir (ilk event'te sık görülür). `=== true` şartı koymak
 * açılışta herkesi bir süre "offline" sayardı ve seçimler sebepsiz kuyruğa
 * düşerdi. Bu yüzden yalnız KESİN olumsuzluk (`false`) offline sayılır.
 *
 * ── E2E deep-link'i bir OVERRIDE'dır, BLOKAJ değil (K42-A) ─────────────────
 * Önceki kurulumda `isE2ETestMode()` true iken `ensureSubscription()` erken
 * dönüyor ve `NetInfo.addEventListener` satırına HİÇ ULAŞILMIYORDU; aynı
 * şekilde `refreshIsOnline()` de NetInfo'ya hiç sormuyordu. Sonuç ölçüldü
 * (K42_SIYAH_EKRAN_KESIF.md): `preview-e2e` build'inde GERÇEK uçak modu
 * hiçbir zaman algılanmıyordu — `currentOnline` sonsuza kadar `true` kalıyor,
 * `subscribeToReconnect` hiç ateşlenmiyordu. Yani "gerçek ağ durumu" yolunun
 * tam da onu sınamak için üretilen build'de ölçüm kapasitesi yoktu.
 *
 * Yeni kurulum: gerçek NetInfo aboneliği HER build'de kurulur. Deep-link
 * yalnızca bunun ÜSTÜNE yazan bir bayrak (`forcedOffline`) set eder. Bayrak
 * kapalıyken davranış, `isE2ETestMode()` değerinden BAĞIMSIZ olarak gerçek
 * NetInfo'nun dediğidir.
 *
 * ── Neden "zorla ONLINE" diye bir durum YOK ────────────────────────────────
 * Override tek eksenlidir: ya "offline taklidi yap" ya da "gerçeğe bak".
 * Bir `forcedOnline` durumu eklemek, cihaz gerçekten offline'ken
 * `getIsOnline()`'a `true` dedirtirdi — düzeltilmek istenen hatanın tam
 * simetriği. Bu yüzden `set-online`, "online ol" DEĞİL "taklidi bırak"
 * demektir; ayrı bir `clear-override` link'i eklenmedi (üçüncü bir deep-link
 * ve üçüncü bir durum, hiçbir yeni davranış kazandırmadan akıl yürütmeyi
 * zorlaştırırdı).
 */

import { useEffect, useState } from 'react';

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import * as Linking from 'expo-linking';

import { logger } from '@/utils/logger';
import { isE2ETestMode } from '@/utils/e2eTestMode';

/** Bağlantı durumu dinleyicisi. `online` o anki duruma eşittir. */
type StatusListener = (online: boolean) => void;

/** "Bağlantı geri geldi" dinleyicisi — yalnız offline→online geçişinde. */
type ReconnectListener = () => void;

/**
 * Son bilinen durum. Başlangıçta `true`: NetInfo ilk event'i gelene kadar
 * kullanıcıyı offline saymak, çevrimiçi bir cihazda yanlış kuyruklama
 * yapmak demek olurdu. İlk event genelde milisaniyeler içinde gelir.
 */
let currentOnline = true;

/**
 * Gerçek NetInfo'nun son bildirdiği durum — override'dan BAĞIMSIZ tutulur.
 *
 * Override yürürlükteyken `currentOnline` taklidi taşır, bu değişken ise
 * gerçeği taşımaya devam eder. Ayrı tutulmasının sebebi, override
 * kalktığında (`set-online`) hangi değere dönüleceğinin bilinmesi gereğidir;
 * yine de dönüş anında `NetInfo.fetch()` ile TAZELENİR (bkz. `handleE2EDeepLink`).
 */
let realOnline = true;

/**
 * E2E sahte-offline override'ı (K42-A). `true` iken gerçek NetInfo event'leri
 * `realOnline`'a yazılır ama `currentOnline`'a UYGULANMAZ.
 *
 * `isE2ETestMode()` false olan HER build'de bu bayrağı açabilecek tek yol
 * (`handleE2EDeepLink`) hiç bağlanmaz, yani kalıcı olarak `false` kalır ve
 * aşağıdaki dallar ölü koddur.
 */
let forcedOffline = false;

/**
 * Sahte KALICI SUNUCU HATASI bayrağı (K-42 Senaryo 7, CTO onaylı).
 * `currentOnline`'dan AYRI bir eksendir: offline "sunucuya ulaşılamadı"
 * (transport hatası, kuyrukta kayıt KALIR), bu ise "sunucuya ulaşıldı ve
 * kalıcı hata döndü" (kayıt ATILIR) demektir. İkisi birbirini kapatmaz.
 *
 * Bu modül yalnız BAYRAĞI tutar — gerçek 4xx yanıtını üreten yer
 * `services/supabase.ts`'teki fetch override'ıdır (`set-offline`'ın
 * `currentOnline`/fetch override iş bölümüyle birebir aynı desen).
 */
let forcedHttpError = false;

/** NetInfo aboneliği bir kez kurulur — her çağıran kendi dinleyicisini ekler. */
let unsubscribeNetInfo: (() => void) | null = null;

/** E2E deep-link aboneliği (yalnız `isE2ETestMode()` true iken kurulur). */
let unsubscribeE2EDeepLink: (() => void) | null = null;

const statusListeners = new Set<StatusListener>();
const reconnectListeners = new Set<ReconnectListener>();

/**
 * NetInfo state'ini tek bir boolean'a indirger.
 * `isConnected === false` VEYA `isInternetReachable === false` → offline.
 */
function isOnlineFromState(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

/**
 * `currentOnline`'ı günceller ve gerekirse dinleyicileri bildirir. Hem
 * gerçek NetInfo yolunun hem de aşağıdaki E2E deep-link yolunun ortak
 * çıkışıdır — ikisi de aynı bildirim/reconnect mantığından geçer.
 */
function applyOnlineState(next: boolean): void {
  const previous = currentOnline;
  currentOnline = next;

  if (next === previous) return;

  logger.log('[networkStatus] Bağlantı durumu değişti:', next ? 'online' : 'offline');

  for (const listener of statusListeners) {
    listener(next);
  }

  // Yalnız offline→online geçişi "geri geldi" sayılır. Açılıştaki ilk
  // online event'i geçiş DEĞİLDİR (currentOnline zaten true başlar) ve
  // flush tetiklemez — açılış flush'ı çağıranın kendi işidir.
  if (next && !previous) {
    for (const listener of reconnectListeners) {
      listener();
    }
  }
}

/**
 * Gerçek NetInfo yolunun TEK giriş noktası — hem `addEventListener` hem
 * `NetInfo.fetch()` buradan geçer.
 *
 * Override yürürlükteyse gerçek durum KAYDEDİLİR ama UYGULANMAZ: sahte-offline
 * testinin ortasında cihazın gerçek Wi-Fi event'i taklidi bozamaz. Sessiz
 * bir yutma değil — değer `realOnline`'da durur ve override kalkınca
 * kullanılır.
 */
function handleStateChange(state: NetInfoState): void {
  realOnline = isOnlineFromState(state);
  if (forcedOffline) return;
  applyOnlineState(realOnline);
}

/**
 * K-42 Maestro iOS override (DUR NOKTASI onaylı). `setAirplaneMode`
 * iOS'ta etkisizdir (Maestro'nun resmi kısıtı, bkz. docs/testing/MAESTRO.md)
 * — bu yüzden `preview-e2e` build'inde bir custom URL scheme DE dinlenir.
 * Maestro `openLink` komutuyla `chosy://e2e/set-offline` veya
 * `chosy://e2e/set-online` açar.
 *
 * ⚠️ K42-A: bu handler gerçek NetInfo'nun YERİNE GEÇMEZ, ÜSTÜNE YAZAR.
 * Abonelik her build'de kuruludur (`ensureSubscription`); buradaki tek iş
 * `forcedOffline` bayrağını yazmak ve sonucu uygulamaktır.
 *
 * Yalnızca `currentOnline`/`forcedOffline`'ı (ve `forcedHttpError`'ı)
 * değiştirir — asıl "isteği gerçekten düşürme" işi `services/supabase.ts`'teki
 * fetch override'ındadır, o da bu modüldeki `getIsOnline()` /
 * `resolveForcedHttpError()`'ı okur. Tek doğruluk kaynağı burasıdır.
 *
 * `force-4xx` / `clear-error` (K-42 Senaryo 7) sahte-offline'dan BAĞIMSIZ
 * bir eksendir; `set-online` `forcedHttpError`'ı temizlemez, `clear-error` de
 * bağlantı durumuna dokunmaz — senaryo ikisini arka arkaya kullanır (offline'da
 * seçim kuyruğa alınır, sonra online + force-4xx ile flush kalıcı ret alır).
 */
function handleE2EDeepLink(event: { url: string }): void {
  if (event.url.includes('e2e/set-offline')) {
    forcedOffline = true;
    applyOnlineState(false);
  } else if (event.url.includes('e2e/set-online')) {
    // "Online ol" DEĞİL, "taklidi bırak". İki adımlı, ikisi de gerekli:
    //
    // 1. Son bilinen GERÇEK duruma ANINDA dön. Bu adım atlanıp yalnız
    //    `NetInfo.fetch()` beklenseydi, fetch başarısız olduğunda uygulama
    //    sahte-offline'da ASILI KALIRDI — taklidi kapatan komut taklidi
    //    kaldıramamış olurdu.
    // 2. Sonra taze ölçüm: `realOnline` override boyunca hiç güncellenmemiş
    //    olabilir (abonelik yalnız DEĞİŞİMDE ateşlenir), bu yüzden event
    //    BEKLENMEZ, `NetInfo.fetch()` ile durum çekilir.
    //
    // k42-05'in dayandığı offline→online geçişi ve onun tetiklediği
    // `subscribeToReconnect` (1)'de doğar; (2) onu doğrular ya da düzeltir.
    forcedOffline = false;
    applyOnlineState(realOnline);
    void refreshIsOnline();
  } else if (event.url.includes('e2e/force-4xx')) {
    forcedHttpError = true;
    logger.log('[networkStatus] E2E sahte kalıcı sunucu hatası AÇIK');
  } else if (event.url.includes('e2e/clear-error')) {
    forcedHttpError = false;
    logger.log('[networkStatus] E2E sahte kalıcı sunucu hatası KAPALI');
  }
}

/**
 * Aboneliği (henüz kurulmadıysa) kurar.
 *
 * Gerçek NetInfo aboneliği HER build'de kurulur — `preview-e2e` dahil (K42-A).
 * E2E build'inde bunun ÜSTÜNE deep-link dinleyicisi de eklenir; o dinleyici
 * yalnızca `forcedOffline` bayrağını yazar, NetInfo'nun yerine GEÇMEZ.
 *
 * `NetInfo.addEventListener` abone olur olmaz mevcut durumu teslim eder
 * (netinfo 11.4.1, `internal/state.js`: `_latestState` varsa handler anında
 * çağrılır), yani abonelik kurmak ilk ölçümü de başlatır.
 */
function ensureSubscription(): void {
  if (!unsubscribeNetInfo) {
    unsubscribeNetInfo = NetInfo.addEventListener(handleStateChange);
  }
  if (isE2ETestMode() && !unsubscribeE2EDeepLink) {
    const subscription = Linking.addEventListener('url', handleE2EDeepLink);
    unsubscribeE2EDeepLink = () => subscription.remove();
  }
}

/**
 * Soğuk başlangıç güvencesi (Senaryo 1/2/4): uygulama BİZZAT
 * `chosy://e2e/set-offline` link'iyle başlatılmış olabilir — bu durumda
 * `Linking.addEventListener('url', ...)` HİÇ ateşlenmez, o yalnız ZATEN
 * ÇALIŞAN bir uygulamaya gelen SONRAKİ link'leri yakalar. Başlatıcı link
 * `Linking.getInitialURL()` ile AYRICA okunmalı. Bir kez çalışır, sonucu
 * önbelleğe alınır (aynı process'te tekrar sorulmaz).
 */
let initialE2ELinkCheck: Promise<void> | null = null;

function ensureInitialE2ELinkChecked(): Promise<void> {
  if (!initialE2ELinkCheck) {
    initialE2ELinkCheck = Linking.getInitialURL().then((url) => {
      if (url) handleE2EDeepLink({ url });
    });
  }
  return initialE2ELinkCheck;
}

/**
 * `getIsOnline()`'ın E2E-güvenli async biçimi — YALNIZ
 * `services/supabase.ts`'teki fetch override'ı kullanır. Kararın SOĞUK
 * BAŞLANGIÇTA (uygulama daha yeni `chosy://e2e/set-offline` ile açılmış
 * olabilir, bkz. `ensureInitialE2ELinkChecked`) bile doğru olması gereken
 * TEK yer orasıdır. `isE2ETestMode()` false olan HER build'de
 * `getIsOnline()` ile BİREBİR aynı değeri döner, yalnız bir Promise'e
 * sarılı — davranış farkı yoktur.
 */
export async function resolveIsOnline(): Promise<boolean> {
  ensureSubscription();
  if (isE2ETestMode()) {
    await ensureInitialE2ELinkChecked();
  }
  return currentOnline;
}

/**
 * Sahte kalıcı sunucu hatası açık mı (K-42 Senaryo 7)? YALNIZ
 * `services/supabase.ts`'teki fetch override'ı çağırır.
 *
 * `isE2ETestMode()` false olan HER build'de (production/preview/
 * preview-store/development) YAN ETKİSİZ biçimde `false` döner — abonelik
 * bile kurmaz. Bayrağı yalnız `chosy://e2e/force-4xx` deep link'i açabilir
 * ve o handler da yalnız E2E aboneliğinde bağlanır.
 *
 * `resolveIsOnline` ile aynı sebepten async: uygulama BİZZAT
 * `chosy://e2e/force-4xx` ile açılmış olabilir ve bu yalnız
 * `Linking.getInitialURL()` ile — asenkron — okunur.
 */
export async function resolveForcedHttpError(): Promise<boolean> {
  if (!isE2ETestMode()) return false;
  ensureSubscription();
  await ensureInitialE2ELinkChecked();
  return forcedHttpError;
}

/**
 * Son bilinen bağlantı durumu. Senkron okunur — çağıran beklemez.
 *
 * ⚠️ Bu bir ANLIK GÖRÜNTÜ, garanti değil: cihaz online görünürken istek yine
 * de başarısız olabilir (captive portal, DNS, sunucu erişilemez). Bu yüzden
 * çağıran taraf bunu hata yolunun YERİNE değil, hata yolunun YANINDA kullanır.
 */
export function getIsOnline(): boolean {
  ensureSubscription();
  return currentOnline;
}

/**
 * Cihazın gerçek durumunu NetInfo'dan tazeler ve döner.
 * Önbelleğe güvenmenin yeterli olmadığı karar anlarında kullanılır.
 *
 * K42-A: `isE2ETestMode()` erken dönüşü KALDIRILDI — e2e build'inde de
 * NetInfo'ya sorulur. Sahte durumun üstüne yazılmasından endişe etmeye gerek
 * yok: taklit artık `handleStateChange` içindeki `forcedOffline` guard'ıyla
 * korunuyor, yani override yürürlükteyken taze NetInfo sonucu `realOnline`'a
 * yazılır ama `currentOnline`'a uygulanmaz. Fonksiyon her iki build'de de
 * aynı kodu koşar.
 */
export async function refreshIsOnline(): Promise<boolean> {
  ensureSubscription();
  try {
    const state = await NetInfo.fetch();
    handleStateChange(state);
    return currentOnline;
  } catch (err) {
    // Yutulmuyor: NetInfo.fetch başarısızsa son bilinen durum döner ve
    // bu görünür olur. Sessiz fallback değil — kayıt bırakır.
    logger.warn('[networkStatus] NetInfo.fetch başarısız, son bilinen durum kullanılıyor:', err);
    return currentOnline;
  }
}

/**
 * Durum değişimlerine abone olur.
 * @returns Aboneliği sonlandıran fonksiyon.
 */
export function subscribeToNetworkStatus(listener: StatusListener): () => void {
  ensureSubscription();
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

/**
 * "Bağlantı geri geldi" olayına abone olur — offline→online geçişinde
 * bir kez tetiklenir. Kuyruk flush'ının tetikleyicisi budur.
 *
 * @returns Aboneliği sonlandıran fonksiyon.
 */
export function subscribeToReconnect(listener: ReconnectListener): () => void {
  ensureSubscription();
  reconnectListeners.add(listener);
  return () => {
    reconnectListeners.delete(listener);
  };
}

/**
 * React tarafı için ince sarmalayıcı. Yalnız `isOnline` döner; "geri geldi"
 * olayı efekt olduğu için `subscribeToReconnect` ile ayrı dinlenir.
 */
export function useNetworkStatus(): { isOnline: boolean } {
  const [isOnline, setIsOnline] = useState<boolean>(() => getIsOnline());

  useEffect(() => {
    // Abonelik kurulmadan önce durum değişmiş olabilir — mevcut değerle eşitle.
    setIsOnline(getIsOnline());
    return subscribeToNetworkStatus(setIsOnline);
  }, []);

  return { isOnline };
}
