/**
 * Auth utility — Supabase auth kullanıcısının public.users UUID'sini döndürür.
 *
 * Bu dosya circular import'u kırmak için watchlist.ts'ten ayrılmıştır.
 * watchlist.ts ve tasteSignalService.ts (ve diğer servisler) bu dosyayı import eder.
 */
import { supabase } from './supabase';
import { logger } from '../utils/logger';

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
