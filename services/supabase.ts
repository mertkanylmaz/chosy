/**
 * Supabase client — React Native AsyncStorage ile oturum kalıcılığı sağlar.
 */
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';
import { resolveIsOnline, resolveForcedHttpError } from './networkStatus';
import { isE2ETestMode } from '@/utils/e2eTestMode';

/**
 * K-42 Maestro iOS override (DUR NOKTASI onaylı). `setAirplaneMode`
 * iOS'ta network'ü gerçekten kesmiyor (Maestro'nun resmi kısıtı) — bu
 * yüzden `preview-e2e` build'inde, sahte-offline durumundayken (bkz.
 * `services/networkStatus.ts` → `chosy://e2e/set-offline`) TÜM supabase
 * istekleri (auth dahil) burada, transport seviyesinde reddedilir.
 *
 * Fırlatılan hata GERÇEK bir RN network kopmasının attığı hatanın
 * BİREBİR AYNISIDIR (`TypeError: Network request failed`) — yeni bir hata
 * tipi/mesajı ÜRETİLMEZ. Amaç: `gauntletService.ts`'teki `parseInvokeError`
 * bunu gerçek bir kesintiden ayırt edemesin (`error.context` yok →
 * `status: null` → `GauntletFetchError`), cache fallback zinciri
 * (`cache_today` → `cache_stale` → hata) kendi kodunda HİÇ DOKUNULMADAN
 * tetiklensin.
 *
 * `resolveIsOnline()` (senkron `getIsOnline()` DEĞİL) kullanılır: soğuk
 * başlangıçta uygulama BİZZAT `chosy://e2e/set-offline` link'iyle açılmış
 * olabilir (Senaryo 1/2/4) ve bu bilgi yalnız `Linking.getInitialURL()`
 * ile — yani ASENKRON — okunabilir. Senkron bir kontrol, ilk isteğin bu
 * kontrolden ÖNCE gitmesine (yarış durumu) yol açardı.
 *
 * `isE2ETestMode()` false olan HER build'de (production/preview/
 * preview-store/development) bu fonksiyon gerçek `fetch`'i olduğu gibi
 * çağırır — davranış farkı YOKTUR.
 *
 * ── İkinci mod: force-4xx (K-42 Senaryo 7, CTO onaylı) ─────────────────────
 * Sahte-offline bir TRANSPORT hatası taklit eder (`status: null` →
 * `GauntletFetchError` → kuyruk kaydı KALIR). Senaryo 7 bunun tersini
 * ister: sunucuya ULAŞILDI, KALICI bir hata döndü → kayıt ATILIR.
 * `chosy://e2e/force-4xx` bu modu açar, `chosy://e2e/clear-error` kapatır
 * (bayrak `services/networkStatus.ts`'te, deep-link handler'ın yanında).
 *
 * Neden 400 (koddan okundu, tahmin değil): `gauntletOfflineQueue.ts` yalnız
 * `GauntletHttpError && status >= 500`'ü GEÇİCİ sayar; bunun dışındaki her
 * `GauntletHttpError` kalıcıdır. `401` KULLANILAMAZDI —
 * `gauntletService.ts` onu `GauntletAuthPendingError`'a saptırır ve kayıt
 * korunur. `gauntletService.ts`'e DOKUNULMADI: sınıflandırma mantığı aynı,
 * yalnız girdisi değişiyor.
 *
 * Neden yalnız `/functions/v1/` (sahte-offline'dan farklı olarak tüm
 * istekler değil): auth token yenilemesine 400 dönmek supabase-js'in yerel
 * oturumu düşürmesine yol açabilir ve test, ölçmek istediğinden
 * (submit-choice'ın kalıcı reddi) başka bir yolu ölçerdi.
 *
 * Dönen nesne GERÇEK bir `Response`'tur — supabase-js onu normal yolundan
 * `FunctionsHttpError` (`context` dolu) olarak üretir, yani
 * `parseInvokeError` bunu gerçek bir sunucu 400'ünden ayırt edemez.
 */

/** Senaryo 7'nin taklit ettiği kalıcı hata kodu. */
const E2E_FORCED_STATUS = 400;

/** force-4xx yalnız Edge Function trafiğine uygulanır — auth'a DOKUNMAZ. */
const EDGE_FUNCTIONS_PATH = '/functions/v1/';

/**
 * `fetch` girdisinin URL'i — string, `URL` ve `Request` biçimlerini karşılar.
 * Parametre tipi açıkça yazılır: bu projede RN ve DOM `fetch` tipleri yan
 * yana yüklü ve `Parameters<typeof fetch>[0]` `URL`'i dışarıda bırakıyor.
 */
function requestUrl(input: string | Request | URL): string {
  if (typeof input === 'object' && input !== null && 'url' in input) {
    return (input as Request).url;
  }
  return String(input);
}

const supabaseFetch: typeof fetch = async (input, init) => {
  if (isE2ETestMode()) {
    const online = await resolveIsOnline();
    if (!online) {
      throw new TypeError('Network request failed');
    }

    if (requestUrl(input).includes(EDGE_FUNCTIONS_PATH) && await resolveForcedHttpError()) {
      return new Response(JSON.stringify({ error: 'e2e-forced-4xx' }), {
        status: E2E_FORCED_STATUS,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }
  return fetch(input, init);
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',      // Google OAuth web flow için gerekli
  },
  global: {
    fetch: supabaseFetch,
  },
});
