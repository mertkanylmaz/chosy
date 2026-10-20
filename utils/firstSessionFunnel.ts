/**
 * İlk oturum funnel'ı — "kurulum başına bir kez" kararının saf mantığı.
 *
 * Zincir: first_open → onboarding_completed → first_gauntlet_started →
 * first_gauntlet_completed. `first_open` kendi bayrağını `services/firstOpen.ts`
 * içinde yönetir; bu dosya diğer üç halkanın bayraklarını taşır.
 *
 * Bayraklar cihaz düzeyidir: `sessionReset` bunları siler İSTEMEZ (çıkış/hesap
 * silme kurulumu değiştirmez) — `FIRST_SESSION_FLAG_KEYS` oraya verilir.
 * Saf: React Native / Sentry importu yok, testler Deno'da çalışır.
 */

export type FirstSessionEvent =
  | 'onboarding_completed'
  | 'first_gauntlet_started'
  | 'first_gauntlet_completed';

export const FIRST_SESSION_FLAG_KEYS: Readonly<Record<FirstSessionEvent, string>> = {
  onboarding_completed: 'chosy_funnel_onboarding_completed_sent',
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
