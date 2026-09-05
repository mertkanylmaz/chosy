/**
 * Supabase client — React Native AsyncStorage ile oturum kalıcılığı sağlar.
 */
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';
import { resolveIsOnline } from './networkStatus';
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
 */
const supabaseFetch: typeof fetch = async (input, init) => {
  if (isE2ETestMode()) {
    const online = await resolveIsOnline();
    if (!online) {
      throw new TypeError('Network request failed');
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
