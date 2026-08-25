/**
 * Auth utility — Supabase auth kullanıcısının public.users UUID'sini döndürür.
 *
 * Bu dosya circular import'u kırmak için watchlist.ts'ten ayrılmıştır.
 * watchlist.ts ve tasteSignalService.ts (ve diğer servisler) bu dosyayı import eder.
 */
import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { logger } from '../utils/logger';

/** `ensureAppUser` sonucu */
export type EnsureAppUserResult =
  | { ok: true; appUserId: string }
  | { ok: false; reason: 'NO_SESSION' | 'CREATE_FAILED' };

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
    } = await supabase.auth.getUser();

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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (error) {
      logger.error('[auth-utils] readAppUserId okuma hatası:', error.message);
      return null;
    }

    return (data?.id as string) ?? null;
  } catch (err) {
    logger.error('[auth-utils] readAppUserId beklenmedik hata:', err);
    return null;
  }
}

/**
 * Auth kullanıcısının `users` tablosundaki UUID'sini döndürür.
 * Kayıt yoksa (anonim dahil) otomatik oluşturur.
 */
export async function getAppUserId(): Promise<string | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data } = await supabase
      .from('users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    if (data) return data.id as string;

    // Kayıt yoksa oluştur — race condition için duplicate key (23505) toleransı var
    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert({ auth_id: user.id })
      .select('id')
      .single();

    if (insertError) {
      // 23505 = unique_violation: eşzamanlı başka bir çağrı zaten INSERT yaptı
      if (insertError.code === '23505') {
        const { data: existing } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', user.id)
          .single();
        return existing?.id ?? null;
      }
      logger.error('[auth-utils] users kaydı oluşturulamadı:', insertError.message);
      return null;
    }

    if (!inserted) return null;

    return inserted.id as string;
  } catch (err) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[auth-utils] getAppUserId beklenmedik hata:', err);
    }
    return null;
  }
}
