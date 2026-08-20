/**
 * useProModeAccess — Pro Mode (mood search) erisiminin TEK dogruluk kaynagi.
 *
 * Kural: `isPremium || legacy_mood_access`.
 *
 * `legacy_mood_access` (migration 090) relaunch oncesi (2026-08-17 15:30+00)
 * acilmis hesaplar icin grandfathering bayragidir: gauntlet pivotunda mood
 * search Pro katmanina tasindi, ama eski dunyada bu ozelligi kullanabilen
 * hesaplardan geri alinmaz. Kolon 090'da eklendi ve 234/234 satir icin true'ya
 * backfill edildi; gate ilk kez BURADA baglaniyor (C.9c).
 *
 * ⚠️ Fail-CLOSED: okuma bitene kadar VE hata durumunda `allowed = false`.
 * Sessiz fallback yasagi (chosy-conventions §1) geregi hata yutulmaz — Sentry
 * yerine kullanilan `logger.error` ile raporlanir ve `error` alani cagirana
 * dondurulur, boylece ekran "kilitli" ile "yuklenemedi"yi ayirt edebilir.
 */
import { useCallback, useEffect, useState } from 'react';

import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/services/supabase';
import { logger } from '@/utils/logger';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface ProModeAccess {
  /** Ekran acilabilir mi — `isPremium || legacy_mood_access` */
  allowed: boolean;
  /** Erisim aboneliktenmi grandfathering'den mi geliyor (analitik/kopya icin) */
  reason: 'premium' | 'legacy' | 'none';
  /** Kolon okumasi surerken true — bu sirada `allowed` her zaman false */
  loading: boolean;
  /** Okuma basarisiz olduysa dolu — "kilitli" ile "hata"yi ayirt etmek icin */
  error: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Pro Mode erisim durumunu dondurur.
 *
 * Abonelik durumu `useSubscription()` uzerinden gelir (istemci cache'i);
 * grandfathering bayragi her mount'ta `public.users`'tan taze okunur — modul
 * seviyesinde cache yok (chosy-conventions §6 ile ayni gerekce).
 */
export function useProModeAccess(): ProModeAccess {
  const { isPremium, isLoading: subLoading } = useSubscription();

  const [legacyAccess, setLegacyAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;

      const authId = authData?.user?.id;
      if (!authId) {
        // Oturum yok — grandfathering iddia edilemez. Hata degil.
        setLegacyAccess(false);
        return;
      }

      const { data, error: queryError } = await supabase
        .from('users')
        .select('legacy_mood_access')
        .eq('auth_id', authId)
        .single();

      if (queryError) throw queryError;

      setLegacyAccess(data?.legacy_mood_access === true);
      setError(false);
    } catch (err) {
      // Sessiz fallback yasak: erisim kapali kalir AMA cagiran taraf bunun bir
      // OKUMA HATASI oldugunu bilir ve "Pro'ya gec" yerine tekrar dene gosterir.
      logger.error('[useProModeAccess] legacy_mood_access okunamadi:', err);
      setLegacyAccess(false);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stillLoading = loading || subLoading;

  return {
    allowed: !stillLoading && (isPremium || legacyAccess),
    reason: stillLoading ? 'none' : isPremium ? 'premium' : legacyAccess ? 'legacy' : 'none',
    loading: stillLoading,
    error,
  };
}
