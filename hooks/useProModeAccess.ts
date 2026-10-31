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
import { useMoodOfferEnabled } from '@/hooks/useMoodOfferEnabled';
import { fetchSearchQuota } from '@/services/searchQuota';
import { supabase } from '@/services/supabase';
import { readUserRow } from '@/services/userCache';
import { logger } from '@/utils/logger';
import { decideProModeGate, type ProModeGate, type SearchQuota } from '@/utils/searchQuota';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface ProModeAccess {
  /** Ekran acilabilir mi — `isPremium || legacy_mood_access` */
  allowed: boolean;
  /**
   * Grandfathered kohort kota duvarina tabi DEGILDIR (CTO karari, 24 Eyl 2026).
   *
   * Relaunch oncesi hesaplardan mood search geri alinmiyor; erisimi verip
   * kotayla kesmek ayni sozu iki kez bozmak olurdu. Premium bu bayraga
   * ihtiyac duymaz (kendi limiti var), bu yuzden yalnizca legacy true doner.
   *
   * ⚠️ Yalnizca ISTEMCI kapisini acar. `check_and_consume_quota` RPC'si ve
   * `parse-mood` sunucu tarafinda saymaya devam eder — arama kotasi icin
   * gercek muafiyet sunucu degisikligi ister (bkz. K-46 notu).
   */
  quotaExempt: boolean;
  /** Erisim aboneliktenmi grandfathering'den mi geliyor (analitik/kopya icin) */
  reason: 'premium' | 'legacy' | 'none';
  /** Kolon okumasi surerken true — bu sirada `allowed` her zaman false */
  loading: boolean;
  /** Okuma basarisiz olduysa dolu — "kilitli" ile "hata"yi ayirt etmek icin */
  error: boolean;
  /**
   * MONEY-1C UX kapisi. `mood_offer_enabled` KAPALIYKEN daima `allowed ? 'enter' : 'locked'`
   * (bugunku davranis). Acikken ve `withQuota` verildiyse: yetkisiz kullanicida sunucu
   * hakkina bakar — hak varsa/okunamadiysa 'enter', bittiyse 'offer'.
   * `allowed` anlami DEGISMEZ; diger tuketiciler (profile, discover) etkilenmez.
   */
  gate: ProModeGate;
  /** Sunucudan okunan arama hakki; `withQuota` yoksa / bayrak kapaliysa 'checking' DEGIL `null`. */
  searchQuota: SearchQuota | 'checking' | null;
  /** Hakki yeniden oku (ornegin kota 429 sonrasi). */
  refreshSearchQuota: () => void;
}

export interface ProModeAccessOptions {
  /** Hakki sunucudan oku (yalniz `app/pro-mode.tsx` verir — diger tuketiciler RPC atmaz). */
  withQuota?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Pro Mode erisim durumunu dondurur.
 *
 * Abonelik durumu `useSubscription()` uzerinden gelir (istemci cache'i);
 * grandfathering bayragi `public.users`'tan `services/userCache` uzerinden
 * okunur (PERF-1: bellek ici, 60 sn TTL, eszamanli istekler tekil). Bayrak yalniz
 * migration ile degisir; en kotu durumda degisiklik 60 sn gec yansir.
 */
export function useProModeAccess(options: ProModeAccessOptions = {}): ProModeAccess {
  const { withQuota = false } = options;
  const { isPremium, isLoading: subLoading } = useSubscription();
  const offerEnabled = useMoodOfferEnabled();
  const [searchQuota, setSearchQuota] = useState<SearchQuota | 'checking'>('checking');

  const [legacyAccess, setLegacyAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      // Yerel oturum (ağ yok) — kimlik sunucuda doğrulanmaz, ama aşağıdaki
      // sorgu RLS ile zaten oturumun sahibine bağlı.
      const { data: sessionData, error: authError } = await supabase.auth.getSession();
      if (authError) throw authError;

      const authId = sessionData.session?.user?.id;
      if (!authId) {
        // Oturum yok — grandfathering iddia edilemez. Hata degil.
        setLegacyAccess(false);
        return;
      }

      // PERF-1: 60 sn'lik oturum önbelleği (services/userCache) — dört tüketici
      // aynı mount'ta ayrı GET atıyordu. Satır yoksa eski `.single()` gibi hata.
      const { data, error: queryError } = await readUserRow<{ legacy_mood_access: boolean | null }>(
        'auth_id',
        authId,
        ['legacy_mood_access'],
      );

      if (queryError) throw new Error(queryError.message);
      if (!data) throw new Error('users satiri yok');

      setLegacyAccess(data?.legacy_mood_access === true);
      setError(false);
    } catch (err) {
      // Sessiz fallback yasak: erisim kapali kalir AMA cagiran taraf bunun bir
      // OKUMA HATASI oldugunu bilir ve "Pro'ya gec" yerine tekrar dene gosterir.
      logger.error(
        '[useProModeAccess] legacy_mood_access okunamadi:', err,
        {
          code: 'PRO_MODE_ACCESS_READ_FAILED',
          sampleRate: 0.5,
        },
      );
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
  const allowed = !stillLoading && (isPremium || legacyAccess);

  // Hak yalniz: bayrak acik + pro-mode ekrani istedi + yetki okumasi bitti + yetkisiz.
  const needsQuota = withQuota && offerEnabled && !stillLoading && !allowed;
  const [quotaTick, setQuotaTick] = useState(0);

  useEffect(() => {
    if (!needsQuota) return;
    let active = true;
    setSearchQuota('checking');
    void fetchSearchQuota().then((quota) => {
      if (active) setSearchQuota(quota);
    });
    return () => {
      active = false;
    };
  }, [needsQuota, quotaTick]);

  const refreshSearchQuota = useCallback(() => setQuotaTick((n) => n + 1), []);

  // Yetki/hata okunurken kapi 'enter/locked' kararini degistirmez: `stillLoading`
  // ve `error` ekranlari zaten once gelir (pro-mode.tsx sirasi).
  const gate = decideProModeGate({
    offerEnabled: withQuota && offerEnabled,
    entitled: allowed,
    quota: searchQuota,
  });

  return {
    allowed,
    gate,
    searchQuota: needsQuota ? searchQuota : null,
    refreshSearchQuota,
    // Fail-closed: okuma bitene kadar muafiyet yok, duvar durur.
    quotaExempt: !stillLoading && legacyAccess,
    reason: stillLoading ? 'none' : isPremium ? 'premium' : legacyAccess ? 'legacy' : 'none',
    loading: stillLoading,
    error,
  };
}
