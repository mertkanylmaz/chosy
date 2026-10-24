/**
 * Pro Mode arama hakkını SUNUCUDAN okur (MONEY-1C).
 *
 * `get_quota_status` RPC'si (migration 021/109) — kalan hak tek doğruluk kaynağıdır;
 * eski AsyncStorage sayacı (`quotaEngine`) bu akışta kullanılmaz. Bu okuma yalnız UX
 * kapısıdır: sunucu `parse-mood` içinde zaten zorlar.
 *
 * Okunamazsa (ağ, RPC hatası, anlaşılmaz şekil, app satırı yok) hak VARSAYILIR
 * (`{ kind: 'unknown' }` → kapı açılır). Sessiz değil: `logger.error` Sentry'ye gider.
 */
import { readAppUserId } from '@/services/auth-utils';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';
import { interpretQuotaStatus, type SearchQuota } from '@/utils/searchQuota';

export async function fetchSearchQuota(): Promise<SearchQuota> {
  try {
    const appUserId = await readAppUserId();
    // Bootstrap tamamlanmamış / satır yok: hak okunamaz. Hata değil; sunucu kararı verir.
    if (!appUserId) return { kind: 'unknown' };

    const { data, error } = await supabase.rpc('get_quota_status', { p_user_id: appUserId });
    if (error) throw new Error(`${error.code ?? 'rpc'}: ${error.message}`);

    const quota = interpretQuotaStatus(data);
    if (quota.kind === 'unknown') {
      logger.error('[searchQuota] get_quota_status anlasilmaz sekil — hak varsayiliyor', new Error('UNEXPECTED_SHAPE'), {
        code: 'SEARCH_QUOTA_UNEXPECTED_SHAPE',
        sampleRate: 0.2,
      });
    }
    return quota;
  } catch (err) {
    logger.error('[searchQuota] hak okunamadi — hak varsayiliyor', err, {
      code: 'SEARCH_QUOTA_READ_FAILED',
      sampleRate: 0.2,
    });
    return { kind: 'unknown' };
  }
}
