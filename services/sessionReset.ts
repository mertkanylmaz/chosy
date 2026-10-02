/**
 * Hesap silme sonrası temiz başlangıç (B-1 / Fix 4).
 *
 * Sunucu cascade'i (`deleteAccount`) başarıyla bittikten SONRA çağrılır.
 * Cihazı, uygulama ilk kez kurulmuş gibi yeni bir anonim kimliğe taşır.
 *
 * ── Sıra neden önemli ─────────────────────────────────────────────────────
 * `signOut` → `SIGNED_OUT` → `app/_layout.tsx` dinleyicisi yeni anonim
 * oturumu KENDİLİĞİNDEN açar. Bu yüzden yerel temizlik `signOut`'tan ÖNCE
 * bitmek zorunda; yoksa `chosy_watched_films` ve çevrimdışı kuyruklar bir
 * sonraki soğuk açılışta (`INITIAL_SESSION` → `syncWatchedFilms`) yeni
 * kimliğe yazılır. Yeni oturum burada AÇILMAZ — dinleyiciyle yarışan ikinci
 * bir `signInAnonymously` iki anonim kayıt (biri sahipsiz) üretirdi.
 *
 *   1. PostHog reset + Sentry kullanıcısı + RevenueCat logOut
 *   2. AsyncStorage: allowlist dışındaki HER anahtar silinir
 *   3. Bellekteki abonelik durumu free'ye
 *   4. signOut({scope:'local'}) → dinleyicinin açtığı yeni kimliği bekle
 *   5. Onboarding'e yönlendir — her durumda, hata olsa bile
 *
 * Her adım kendi hatasını Sentry'ye yazar ve sonraki adımı engellemez:
 * kullanıcı silinmiş bir kimlikte kilitli kalmamalı.
 */
import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';
import { posthogAnalytics } from './posthog';
import { logOutPurchases } from './purchaseService';
import { clearGauntletCache } from './gauntletCache';
import { logger } from '../utils/logger';
import { createIntentionalResetFlag } from '../utils/intentionalResetFlag';

/**
 * Silmeden sağ çıkan cihaz düzeyi anahtarlar. Listede olmayan her anahtar
 * silinir — yeni bir anahtar eklendiğinde varsayılan "kullanıcı verisi"dir.
 */
const DEVICE_LEVEL_KEYS: ReadonlySet<string> = new Set(['moodflix_language']);

/**
 * Temizlikten muaf prefix'ler:
 * - `sb-`: Supabase oturumu. `signOut({scope:'local'})` siler; önceden
 *   silinirse istemci bellekteki oturumu tutmaya devam eder.
 * - `.posthog-rn`: PostHog SDK'nın kendi kalıcı durumu (expo-file-system
 *   yoksa AsyncStorage'a düşer). `reset()` kimliği zaten sıfırladı; dosyayı
 *   SDK canlıyken silmek bir sonraki soğuk açılışta kimliği böler.
 */
const EXEMPT_PREFIXES: readonly string[] = ['sb-', '.posthog-rn'];

/** RC logOut ağ bekler; takılırsa oturum hiç kapanmazdı (30 Eyl olayı). */
const RC_LOGOUT_TIMEOUT_MS = 5_000;

/** Dinleyicinin yeni anonim oturumu açması için üst sınır. */
const NEW_SESSION_TIMEOUT_MS = 10_000;

// ─── Kasıtlı sıfırlama bayrağı (identity_reset) ──────────────────────────────
//
// `_layout.tsx` SIGNED_OUT kurtarma dalı yeni anonim kimlik açınca
// `identity_reset_detected` (signed_out_recovery) üretir — kimlik KAYBININ
// ölçümü. Kullanıcının kendi çıkışı / hesap silmesi kayıp değildir; bu
// bayrak o olayı bastırır. Tek kullanımlık, 30 sn süre sonlu — mantık ve
// gerekçe `utils/intentionalResetFlag.ts`'te.

const intentionalResetFlag = createIntentionalResetFlag();

/** Kasıtlı sıfırlama başlıyor — sonraki SIGNED_OUT kimlik kaybı sayılmaz. */
export function markIntentionalReset(): void {
  intentionalResetFlag.mark();
}

/**
 * Bayrağı TÜKETİR (tek kullanımlık) ve süresi içinde set edilmiş miydi
 * döner. Süresi geçmiş bayrak `false` döner — olay normal ölçülür.
 */
export function consumeIntentionalReset(): boolean {
  return intentionalResetFlag.consume();
}

export interface ResetToFreshSessionDeps {
  /** `SubscriptionContext.resetSubscriptionState` */
  resetSubscriptionState: () => void;
  /** Yığını sıfırlayıp onboarding'e götürür; geri hareketi olmamalı. */
  navigateToOnboarding: () => void;
}

type SentryLevel = 'warning' | 'error' | 'fatal';

function captureStep(err: unknown, step: string, level: SentryLevel = 'error'): void {
  Sentry.captureException(err, {
    level,
    tags: { function: 'resetToFreshSession', step },
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label}: ${ms}ms zaman aşımı`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function isExempt(key: string): boolean {
  return DEVICE_LEVEL_KEYS.has(key) || EXEMPT_PREFIXES.some((p) => key.startsWith(p));
}

/** Allowlist dışındaki tüm AsyncStorage anahtarlarını siler. Hata fırlatır. */
async function sweepUserStorage(): Promise<number> {
  // Prefix'li gauntlet cache'i kendi modülü temizler; aşağıdaki genel
  // tarama aynı anahtarları zaten kapsar, bu çağrı modülün sahipliği için.
  await clearGauntletCache();

  const keys = await AsyncStorage.getAllKeys();
  const doomed = keys.filter((k) => !isExempt(k));
  if (doomed.length > 0) {
    await AsyncStorage.multiRemove(doomed);
  }
  return doomed.length;
}

/**
 * Hesap silme sonrası cihazı yeni bir anonim kimlikle temiz başlatır.
 * Asla fırlatmaz; `navigateToOnboarding` her durumda çağrılır.
 */
export async function resetToFreshSession(deps: ResetToFreshSessionDeps): Promise<void> {
  try {
    // ── 0. Eski kimlik — yeni oturumu ondan ayırt etmek için ──────────────
    let previousAuthId: string | null = null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      previousAuthId = session?.user.id ?? null;
    } catch (err) {
      captureStep(err, 'read_session', 'warning');
    }

    // ── 1. Analitik + RevenueCat kimliği ─────────────────────────────────
    // Oturumdan ÖNCE: reset sonra çalışsaydı dinleyicinin açtığı yeni
    // kimliği silerdi. Sunucudaki PostHog kişisini delete-account siler.
    try {
      posthogAnalytics.reset();
      Sentry.setUser(null);
    } catch (err) {
      captureStep(err, 'analytics_reset');
    }

    // Çağrılmazsa on-device entitlement cache kalır → yeni hesap premium
    // görünür (BUG-002).
    try {
      await withTimeout(logOutPurchases(), RC_LOGOUT_TIMEOUT_MS, 'RevenueCat logOut');
    } catch (err) {
      captureStep(err, 'rc_logout');
    }

    // ── 2. Yerel veri ────────────────────────────────────────────────────
    // signOut'tan ÖNCE bitmeli: yeni kimlik doğduğunda eski kullanıcının
    // izlenmiş filmleri ve kuyrukları cihazda olmamalı.
    try {
      const removed = await sweepUserStorage();
      logger.log(`[sessionReset] ${removed} yerel anahtar silindi`);
    } catch (err) {
      // Temizlik yarım kaldıysa eski verinin yeni kimliğe sızma riski var.
      captureStep(err, 'storage_sweep', 'fatal');
    }

    // ── 3. Bellek ────────────────────────────────────────────────────────
    try {
      deps.resetSubscriptionState();
    } catch (err) {
      captureStep(err, 'subscription_state_reset');
    }

    // ── 4. Oturum ────────────────────────────────────────────────────────
    // Abonelik signOut'tan ÖNCE kurulur: SIGNED_IN, signOut beklenirken
    // gelebilir. Yeni anonim oturumu `_layout.tsx` dinleyicisi açar.
    let stopWaiting: () => void = () => {};
    const newIdentity = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Yeni anonim oturum ${NEW_SESSION_TIMEOUT_MS}ms içinde açılmadı`)),
        NEW_SESSION_TIMEOUT_MS,
      );
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        const authId = session?.user.id ?? null;
        if (event === 'SIGNED_IN' && authId !== null && authId !== previousAuthId) {
          clearTimeout(timer);
          resolve(authId);
        }
      });
      stopWaiting = () => {
        clearTimeout(timer);
        subscription.unsubscribe();
      };
    });

    try {
      // SIGNED_OUT signOut beklenirken yayılır — bayrak ÖNCE kurulur.
      markIntentionalReset();
      // `local`: sunucudaki kullanıcı zaten yok, `/logout` 403 dönerdi.
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) {
        // SIGNED_OUT yayılmadı; bayrak takılı kalıp sonraki gerçek kaybı
        // bastırmasın (süre sonu da korur, bu erken temizlik).
        consumeIntentionalReset();
        throw signOutError;
      }
      await newIdentity;
    } catch (err) {
      // signOut başarısızsa cihaz ölü JWT'yle kalır (bootstrap'taki
      // USER_NOT_FOUND dalı sonraki açılışta toparlar); yeni oturum
      // açılmadıysa _layout kurtarma dalı Sentry'ye ayrıca yazar.
      captureStep(err, 'sign_out_new_session', 'fatal');
    } finally {
      stopWaiting();
    }
  } finally {
    // ── 5. Yönlendirme — her durumda ─────────────────────────────────────
    try {
      deps.navigateToOnboarding();
    } catch (err) {
      captureStep(err, 'navigate_onboarding', 'fatal');
    }
  }
}
