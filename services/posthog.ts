/**
 * PostHog Analytics — product analytics event tracking.
 *
 * Lightweight wrapper around posthog-react-native.
 * Key yoksa sessizce devre disi kalir (dev ortami, CI, vb.).
 *
 * Kullanim:
 *   posthogAnalytics.init()       — app launch'ta bir kez cagir
 *   posthogAnalytics.track(...)   — event kaydet
 *   posthogAnalytics.identify()   — auth sonrasi user traits
 *   posthogAnalytics.reset()      — logout'ta cagir
 */
import PostHog from 'posthog-react-native';

import { logger } from '@/utils/logger';

// ─── Singleton ──────────────────────────────────────────────────────────────

let posthog: PostHog | null = null;

// ─── Public API ─────────────────────────────────────────────────────────────

export const posthogAnalytics = {
  /**
   * PostHog SDK'yi baslatir.
   * EXPO_PUBLIC_POSTHOG_KEY veya HOST yoksa sessizce atlar.
   */
  init(): void {
    const key = process.env.EXPO_PUBLIC_POSTHOG_KEY;
    const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;
    if (!key || !host) {
      logger.log('[posthog] PostHog disabled — no key');
      return;
    }
    posthog = new PostHog(key, { host, flushAt: 20, flushInterval: 30_000 });
    logger.log('[posthog] Initialized');
  },

  /**
   * Kullaniciyi tanit — auth sonrasi cagir.
   * @param userId  Supabase auth user id
   * @param traits  Ek ozellikler (archetype, subscription_tier, vb.)
   */
  identify(userId: string, traits?: Record<string, string | number | boolean | null>): void {
    posthog?.identify(userId, traits);
  },

  /**
   * Custom event kaydet.
   * @param eventName  Event adi (snake_case)
   * @param props      Event ozellikleri
   */
  track(eventName: string, props?: Record<string, string | number | boolean | null>): void {
    posthog?.capture(eventName, props);
  },

  /**
   * Screen view kaydet.
   * @param name   Ekran adi
   * @param props  Ek ozellikler
   */
  screen(name: string, props?: Record<string, string | number | boolean | null>): void {
    posthog?.screen(name, props);
  },

  /** Kullanici kimligini sifirla — logout'ta cagir. */
  reset(): void {
    posthog?.reset();
  },

  /** Bekleyen event'leri hemen gonder. */
  async flush(): Promise<void> {
    await posthog?.flush();
  },
};
