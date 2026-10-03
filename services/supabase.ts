/**
 * Supabase client — React Native AsyncStorage ile oturum kalıcılığı sağlar.
 */
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants/config';
import { resolveIsOnline, resolveForcedHttpError } from './networkStatus';
import { isE2ETestMode } from '@/utils/e2eTestMode';
import { decideFetchPolicy, retryDelayMs, urlPath } from '@/utils/fetchPolicy';

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

/**
 * ── Zaman aşımı + tek yeniden deneme (Sprint 10c) ───────────────────────────
 * Karar `utils/fetchPolicy.ts`'te (metot+yol → süre/deneme). Burası yalnız
 * uygular. Zaman aşımında `fetch` kendi yerel `AbortError`'ını fırlatır ve bu
 * olduğu gibi çağırana gider — yeni hata tipi/metni YOK; ekranların mevcut
 * loadError/Sentry yolu aynen işler. Yalnız yanıt BAŞLIKLARI zaman aşımına
 * tabidir (gövde okuması değil).
 *
 * Çağıranın `signal`'i dinlenir: iptal edilirse bizim denetleyicimiz de
 * iptal olur; bu bir zaman aşımı sayılmaz → yeniden deneme ve Sentry YOK.
 */
const timeoutReported = new Set<string>();

/** Oturum başına yol başına en fazla 1 capture. Yalnız yol — sorgu/PII yok. */
function reportTimeout(method: string, url: string, timeoutMs: number): void {
  const path = urlPath(url);
  if (timeoutReported.has(path)) return;
  timeoutReported.add(path);
  Sentry.captureMessage('network_request_timeout', {
    level: 'warning',
    tags: { path, method },
    extra: { timeout_ms: timeoutMs },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithPolicy(
  input: string | Request | URL,
  init?: RequestInit,
): Promise<Response> {
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  const url = requestUrl(input);
  const policy = decideFetchPolicy(method, url);
  if (policy === null) {
    return fetch(input, init);
  }

  const callerSignal = init?.signal ?? (typeof input === 'object' && 'signal' in input ? input.signal : undefined);

  for (let attempt = 0; ; attempt += 1) {
    if (callerSignal?.aborted) {
      // Yerel AbortError'ı fetch'in kendisi üretsin.
      return fetch(input, { ...init, signal: callerSignal });
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, policy.timeoutMs);
    const onCallerAbort = () => controller.abort();
    callerSignal?.addEventListener('abort', onCallerAbort);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } catch (err) {
      if (!timedOut) throw err;
      reportTimeout(method, url, policy.timeoutMs);
      if (attempt >= policy.retries) throw err;
    } finally {
      clearTimeout(timer);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }

    await sleep(retryDelayMs(Math.random()));
  }
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
  return fetchWithPolicy(input, init);
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

/**
 * Kalıcı olmayan, kendini yenilemeyen GEÇİCİ auth istemcisi (Sprint 1 / 1b).
 *
 * Ana istemcide `signInWithIdToken` hemen `SIGNED_IN` yayar (auth-js
 * `GoTrueClient._notifyAllSubscribers`); `_layout` bootstrap'ı ve
 * GauntletShell `restartForNewIdentity` bu olayla yeni kimliğin bugünkü
 * gauntlet'ini ÜRETİR. Anonim ilerleme taşınmadan önce bu olmamalı. Bu
 * istemcideki giriş ana istemcinin dinleyicilerine ulaşmaz; token buradan
 * alınır, iş bitince oturum `supabase.auth.setSession` ile ana istemciye
 * verilir. Bu istemcide `signOut` ÇAĞRILMAZ — sunucudaki oturumu (ana
 * istemciye devredilen) iptal ederdi.
 */
export function createEphemeralAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'chosy-ephemeral-auth',
    },
    global: {
      fetch: supabaseFetch,
    },
  });
}
