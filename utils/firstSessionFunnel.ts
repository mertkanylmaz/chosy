/**
 * İlk oturum funnel'ı — "kurulum başına bir kez" kararının saf mantığı.
 *
 * Zincir: first_open → first_onboarding_completed → first_gauntlet_started →
 * first_gauntlet_completed. `first_open` kendi bayrağını `services/firstOpen.ts`
 * içinde yönetir; bu dosya diğer üç halkanın bayraklarını taşır.
 *
 * Bayraklar cihaz düzeyidir: `sessionReset` bunları siler İSTEMEZ (çıkış/hesap
 * silme kurulumu değiştirmez) — `FIRST_SESSION_FLAG_KEYS` oraya verilir.
 * Saf: React Native / Sentry importu yok, testler Deno'da çalışır.
 */

export type FirstSessionEvent =
  | 'first_onboarding_completed'
  | 'first_gauntlet_started'
  | 'first_gauntlet_completed';

export const FIRST_SESSION_FLAG_KEYS: Readonly<Record<FirstSessionEvent, string>> = {
  first_onboarding_completed: 'chosy_funnel_first_onboarding_completed_sent',
  first_gauntlet_started: 'chosy_funnel_first_gauntlet_started_sent',
  first_gauntlet_completed: 'chosy_funnel_first_gauntlet_completed_sent',
};

export interface FlagStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export type FirstSessionOutcome = 'sent' | 'already_sent' | 'read_failed' | 'write_failed';

/**
 * Bayrak yoksa `send` çağrılır, sonra bayrak yazılır.
 * - Okuma hatası → GÖNDERME (çift sayım riski), 'read_failed'.
 * - Yazma hatası → olay gitti, 'write_failed' (sonraki açılışta tekrar gidebilir).
 * Hataları yutmaz: çağıran Sentry'ye yazar.
 */
export async function fireFirstSessionEvent(
  store: FlagStore,
  event: FirstSessionEvent,
  send: () => void,
  now: () => string = () => new Date().toISOString(),
): Promise<{ outcome: FirstSessionOutcome; error?: unknown }> {
  const key = FIRST_SESSION_FLAG_KEYS[event];
  try {
    if ((await store.getItem(key)) !== null) return { outcome: 'already_sent' };
  } catch (error) {
    return { outcome: 'read_failed', error };
  }
  send();
  try {
    await store.setItem(key, now());
  } catch (error) {
    return { outcome: 'write_failed', error };
  }
  return { outcome: 'sent' };
}

// ── is_upgrade ───────────────────────────────────────────────────────────────

/**
 * `first_open` anında hesaplanan `is_upgrade` değeri burada saklanır; sonraki
 * halkalar AYNI değeri okur (onboarding bittikten sonra yeniden hesaplamak
 * hep `true` verirdi). Cihaz düzeyi: sessionReset silmez.
 */
export const IS_UPGRADE_KEY = 'chosy_is_upgrade'

/**
 * Onboarding tamamlandı anahtarı (`app/onboarding.tsx` getOnboardingKey,
 * `app/gate.tsx` ile aynı format): `chosy_onboarded_<userId>` ya da auth yoksa
 * `chosy_onboarded`. Kullanıcı id'si first_open anında bilinmez → önek taranır.
 */
export const ONBOARDED_KEY_PREFIX = 'chosy_onboarded'

/**
 * true = bu kurulumda daha önce onboarding tamamlanmış (yani first_open bayrağı
 * olmayan eski bir sürümden güncelleme). Yalnız yerel anahtar listesi okunur.
 * Okuma hatası → value null (olay yine gider, özellik eklenmez); hata döner.
 */
export async function resolveIsUpgrade(
  getAllKeys: () => Promise<readonly string[]>,
): Promise<{ value: boolean | null; error?: unknown }> {
  try {
    const keys = await getAllKeys()
    return { value: keys.some((k) => k.startsWith(ONBOARDED_KEY_PREFIX)) }
  } catch (error) {
    return { value: null, error }
  }
}

/** Saklanan değeri çözer; yok/bozuk → null (özellik eklenmez). */
export function parseIsUpgrade(stored: string | null): boolean | null {
  if (stored === '1') return true
  if (stored === '0') return false
  return null
}

export function serializeIsUpgrade(value: boolean): string {
  return value ? '1' : '0'
}
