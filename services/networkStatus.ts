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
 */

import { useEffect, useState } from 'react';

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

import { logger } from '@/utils/logger';

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

/** NetInfo aboneliği bir kez kurulur — her çağıran kendi dinleyicisini ekler. */
let unsubscribeNetInfo: (() => void) | null = null;

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

function handleStateChange(state: NetInfoState): void {
  const next = isOnlineFromState(state);
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

/** NetInfo aboneliğini (henüz kurulmadıysa) kurar. */
function ensureSubscription(): void {
  if (unsubscribeNetInfo) return;
  unsubscribeNetInfo = NetInfo.addEventListener(handleStateChange);
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
 */
export async function refreshIsOnline(): Promise<boolean> {
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
