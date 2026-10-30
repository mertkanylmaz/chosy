/**
 * Açılış saati — saf (RN, PostHog ve Sentry bağımlılığı YOK; test:
 * tests/navigation/bootClock.test.ts).
 *
 * COLD-START-1 ölçüm olaylarının (app_boot_started, auth_refresh_ms, boot_ready_ms,
 * boot_failed, boot_recovered, first_cards_visible) ortak sıfır noktası: bu modül
 * değerlendirildiği an, yani JS paketinin çalışmaya başladığı yaklaşık an.
 * Native splash süresi DAHİL DEĞİLDİR (JS çalışmadan önce geçen süre ölçülemez).
 *
 * Bu bir özellik bayrağı DEĞİL (app_config'ten okunmaz); kural 5'in kapsamı dışı.
 * `app/_layout.tsx` bu modülü en başta import eder ki sıfır noktası mümkün olduğunca
 * erken olsun.
 */

export interface BootClock {
  /** Sıfır noktasından beri geçen ms (negatif olmaz). */
  elapsedMs(): number;
  /**
   * İlk kartlar görününce BİR kez çağrılır: ilk çağrıda elapsed ms, sonrakilerde
   * `null` (süreç başına tek `first_cards_visible`).
   */
  markFirstCardsVisible(): number | null;
  /** Kartlar bu süreçte hiç görünmedi mi — hâlâ açılış aşamasında mıyız. */
  isBooting(): boolean;
}

export function createBootClock(now: () => number = Date.now): BootClock {
  const startedAt = now();
  let cardsVisible = false;
  return {
    elapsedMs() {
      return Math.max(0, now() - startedAt);
    },
    markFirstCardsVisible() {
      if (cardsVisible) return null;
      cardsVisible = true;
      return Math.max(0, now() - startedAt);
    },
    isBooting() {
      return !cardsVisible;
    },
  };
}

/** Süreç başına tek örnek (cold start'ta modül belleği sıfırlanır). */
export const bootClock: BootClock = createBootClock();
