/**
 * Auth utility — Supabase auth kullanıcısının public.users UUID'sini döndürür.
 *
 * Bu dosya circular import'u kırmak için watchlist.ts'ten ayrılmıştır.
 * watchlist.ts ve tasteSignalService.ts (ve diğer servisler) bu dosyayı import eder.
 */
import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { logger } from '../utils/logger';
import { createIdentityCache } from '../utils/identityCache';

/**
 * `auth.users.id` → `public.users.id` bellek önbelleği (Sprint 10a).
 * Anahtar authUid: kimlik değişimi kendiliğinden geçersiz kılar. Yalnızca
 * başarılı çözüm yazılır (null/hata yazılmaz). Mantık: utils/identityCache.ts.
 * Modül seviyesi tutulan şey `app_config` değeri DEĞİL, kimlik eşlemesidir
 * (CLAUDE.md kural 6 kapsamı dışı).
 */
const identityCache = createIdentityCache();

/** Oturum sonlandığında / kimlik sıfırlandığında çağrılır. */
export function clearIdentityCache(): void {
  identityCache.clear();
}

/**
 * Oturumun auth id'si — YEREL `getSession()`, ağ yok (ölçüm: `getUser()`
 * ~215 ms medyan, her çağrıda). Oturum okunamazsa `null`.
 */
async function readLocalAuthUid(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id ?? null;
}

/** `ensureAppUser` sonucu */
export type EnsureAppUserResult =
  | { ok: true; appUserId: string }
  /**
   * `USER_NOT_FOUND`: cihazdaki JWT'nin kullanıcısı sunucuda yok (hesap
   * silindi — 30 Eyl 2026 olayı). Oturum ölü; çağıran yerel oturumu
   * kapatır ki anonim kurtarma devreye girsin.
   */
  | { ok: false; reason: 'NO_SESSION' | 'CREATE_FAILED' | 'USER_NOT_FOUND' };

/**
 * `public.users` satırının var olduğunu GARANTİ eder — oturum bootstrap'ının
 * parçası.
 *
 * ── Neden var ──────────────────────────────────────────────────────────────
 * 10 Ağu 2026'ya kadar satırı açan tek yol `getAppUserId()`'ydi ve onu
 * çağıran tek yer bir ekranın `useFocusEffect`'iydi (`app/(tabs)/index.tsx`).
 * Sonuç: 87 anonim kimlik 2026-04-23'ten beri satırsız kaldı — kotaya,
 * analitiğe ve ödeme sistemine hiç girmediler. Sosyal giriş akışının tüm
 * adımları `UPDATE` olduğu için (bkz. `authService.ts`) kayıt da satır
 * açmıyordu: 0 satır etkileyen UPDATE PostgREST'te hata değildir.
 *
 * Kimlik oluşturma bu yüzden UI katmanından çıkarıldı. Çağrı noktası
 * `app/_layout.tsx` → `onAuthStateChange('SIGNED_IN')`.
 *
 * ── Anonim / kayıtlı ayrımı YOK ────────────────────────────────────────────
 * Her `SIGNED_IN` satır alır. Anonim oturum da imzalı ve tekil bir kimliktir;
 * ayrım yapmak boşluğun ilk hâlini geri getirirdi.
 *
 * Idempotent: `upsert` + `onConflict: 'auth_id'`. Eşzamanlı çağrılar
 * yarışırsa ikisi de aynı satırı görür (`auth_id` UNIQUE — 001:16).
 *
 * Hata SESSİZ YUTULMAZ: başarısızlık Sentry'ye `error` olarak yazılır ve
 * çağırana `ok: false` döner.
 */
export async function ensureAppUser(): Promise<EnsureAppUserResult> {
  let authUserId: string;

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    // Ölü JWT: auth sunucusu kullanıcıyı tanımıyor. NO_SESSION'dan ayrı —
    // oturum cihazda VAR ama hiçbir istek çalışmaz.
    if (userError?.code === 'user_not_found') {
      return { ok: false, reason: 'USER_NOT_FOUND' };
    }
    if (!user) return { ok: false, reason: 'NO_SESSION' };
    authUserId = user.id;
  } catch (err) {
    logger.error('[auth-utils] ensureAppUser oturum okunamadı:', err, { skipBridge: true });
    Sentry.captureException(err, {
      level: 'error',
      tags: { function: 'ensureAppUser', error_code: 'APP_USER_CREATE_FAILED' },
    });
    return { ok: false, reason: 'NO_SESSION' };
  }

  try {
    const { data, error } = await supabase
      .from('users')
      .upsert({ auth_id: authUserId }, { onConflict: 'auth_id' })
      .select('id')
      .single();

    if (error || !data) {
      logger.error('[auth-utils] ensureAppUser upsert hatası:', error?.message, { skipBridge: true });
      Sentry.captureMessage(
        `ensureAppUser: public.users satırı oluşturulamadı — ${error?.message ?? 'satır dönmedi'}`,
        {
          level: 'error',
          tags: { function: 'ensureAppUser', error_code: 'APP_USER_CREATE_FAILED' },
          extra: { auth_id: authUserId, pg_code: error?.code },
        },
      );
      return { ok: false, reason: 'CREATE_FAILED' };
    }

    identityCache.set(authUserId, data.id as string);
    return { ok: true, appUserId: data.id as string };
  } catch (err) {
    logger.error('[auth-utils] ensureAppUser beklenmedik hata:', err, { skipBridge: true });
    Sentry.captureException(err, {
      level: 'error',
      tags: { function: 'ensureAppUser', error_code: 'APP_USER_CREATE_FAILED' },
      extra: { auth_id: authUserId },
    });
    return { ok: false, reason: 'CREATE_FAILED' };
  }
}

/**
 * `public.users.id`'yi yalnızca OKUR — satır oluşturmaz.
 *
 * Satır açma işi `ensureAppUser()`'a ait ve oturum bootstrap'ında bir kez
 * çalışır. Ekranlar kimlik oluşturmaz; bu yüzden UI katmanı `getAppUserId()`
 * yerine bunu kullanır. Satır yoksa `null` döner — bu bir hata değil,
 * bootstrap'ın henüz tamamlanmadığı ya da başarısız olduğu anlamına gelir
 * (o başarısızlık `ensureAppUser` tarafından Sentry'ye zaten yazılmıştır).
 */
export async function readAppUserId(): Promise<string | null> {
  try {
    const authUid = await readLocalAuthUid();
    if (!authUid) return null;

    return await identityCache.resolve(authUid, 'read', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUid)
        .maybeSingle();

      if (error) {
        logger.error('[auth-utils] readAppUserId okuma hatası:', error.message);
        return null;
      }

      return (data?.id as string) ?? null;
    });
  } catch (err) {
    logger.error('[auth-utils] readAppUserId beklenmedik hata:', err);
    return null;
  }
}

/**
 * `users` insert'i reddedildiğinde oturumun durumunu özetler (yalnız bool/sayı).
 * Token, auth id ve e-posta DÖNMEZ. Okuma başarısız olursa `sessionReadFailed`
 * işaretlenir — teşhis verisi eksikliği sessiz kalmaz.
 */
async function readSessionDiagnostics(authUid: string): Promise<{
  hasSession: boolean;
  accessTokenExpiresInSec: number | null;
  authIdMatchesSession: boolean;
  sessionReadFailed?: true;
}> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const session = data.session;
    return {
      hasSession: session !== null,
      accessTokenExpiresInSec:
        session?.expires_at != null ? session.expires_at - Math.floor(Date.now() / 1000) : null,
      authIdMatchesSession: session?.user?.id === authUid,
    };
  } catch (err) {
    Sentry.captureException(err, {
      level: 'warning',
      tags: { function: 'readSessionDiagnostics', error_code: 'APP_USER_DIAG_FAILED' },
    });
    return {
      hasSession: false,
      accessTokenExpiresInSec: null,
      authIdMatchesSession: false,
      sessionReadFailed: true,
    };
  }
}

/**
 * Auth kullanıcısının `users` tablosundaki UUID'sini döndürür.
 * Kayıt yoksa (anonim dahil) otomatik oluşturur.
 */
export async function getAppUserId(): Promise<string | null> {
  try {
    const authUid = await readLocalAuthUid();
    if (!authUid) return null;

    return await identityCache.resolve(authUid, 'get', async () => {
      // `maybeSingle`: 0 satır hata DEĞİL (data null) → insert yolu. `single`
      // 0 satırı da PGRST116 hatası olarak döndürür ve gerçek okuma hatasından
      // ayırt edilemezdi. Birden fazla satır hâlâ hata (PGRST116) → aşağıda.
      const { data, error: selectError } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUid)
        .maybeSingle();

      if (selectError) {
        // Okuma BAŞARISIZ (0 satır değil): satırın varlığı bilinmiyor, insert
        // denemek RLS hatası üretir ve teşhisi bozar (REACT-NATIVE-C). Sessiz
        // değil: `logger.warn` prod'da sessiz olduğu için Sentry'ye warning
        // seviyesinde elle yazılır.
        Sentry.captureMessage('getAppUserId: users select hatası — insert denenmedi', {
          level: 'warning',
          tags: { function: 'getAppUserId', error_code: 'APP_USER_SELECT_FAILED' },
          extra: { stage: 'getAppUserId.select', pg_code: selectError.code, message: selectError.message },
        });
        return null;
      }

      if (data) return data.id as string;

      // Kayıt yoksa oluştur — race condition için duplicate key (23505) toleransı var
      const { data: inserted, error: insertError } = await supabase
        .from('users')
        .insert({ auth_id: authUid })
        .select('id')
        .single();

      if (insertError) {
        // 23505 = unique_violation: eşzamanlı başka bir çağrı zaten INSERT yaptı
        if (insertError.code === '23505') {
          const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('auth_id', authUid)
            .single();
          return (existing?.id as string | undefined) ?? null;
        }
        // Oturum teşhisi (REACT-NATIVE-C): RLS reddi oturum yokluğundan mu,
        // süresi dolmuş token'dan mı, auth id uyuşmazlığından mı? Yalnız
        // bool/sayı — token, auth id ve e-posta ASLA loglanmaz.
        const diagnostics = await readSessionDiagnostics(authUid);
        logger.error('[auth-utils] users kaydı oluşturulamadı:', insertError.message, {
          code: 'APP_USER_INSERT_FAILED',
          extra: { stage: 'getAppUserId.insert', pg_code: insertError.code, ...diagnostics },
        });
        return null;
      }

      if (!inserted) return null;

      return inserted.id as string;
    });
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[auth-utils] getAppUserId beklenmedik hata:', err);
    }
    return null;
  }
}
