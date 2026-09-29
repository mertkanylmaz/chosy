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
import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

import { logger } from '@/utils/logger';

// ─── Singleton ──────────────────────────────────────────────────────────────

let posthog: PostHog | null = null;

/**
 * Her event'e eklenen sabit özellikler (super property) — ör. `update_id`.
 * `reset()` PostHog'un kayıtlı özelliklerini de siler; logout sonrası
 * event'ler bu bağlamı kaybetmesin diye burada tutulur ve yeniden kaydedilir.
 * Değerler süreç ömrü boyunca sabittir (sürüm/güncelleme kimliği) —
 * `app_config` değeri DEĞİL, kural 6 kapsamı dışında.
 */
let superProperties: Record<string, string> = {};

/** `register` bir Promise döner — hata yutulmaz, Sentry'ye gider (kural 1). */
function applySuperProperties(): void {
  if (!posthog || Object.keys(superProperties).length === 0) return;
  posthog.register(superProperties).catch((err: unknown) => {
    Sentry.captureException(err, { tags: { component: 'posthog', flow: 'register' } });
  });
}

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
      Sentry.captureMessage('PostHog init skipped — missing key/host', 'warning');
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
    if (!posthog) {
      Sentry.captureMessage(`PostHog not initialized, event "${eventName}" dropped`, 'warning');
      return;
    }
    posthog.capture(eventName, props);
  },

  /**
   * Screen view kaydet.
   * @param name   Ekran adi
   * @param props  Ek ozellikler
   */
  screen(name: string, props?: Record<string, string | number | boolean | null>): void {
    posthog?.screen(name, props);
  },

  /**
   * Her event'e eklenecek sabit özellikleri kaydeder (super property).
   * `init()`'ten sonra çağrılır; PostHog kapalıysa değerler yine saklanır
   * ama gönderilecek yer yoktur (init zaten Sentry'ye uyarı yazdı).
   */
  registerSuperProperties(props: Record<string, string>): void {
    superProperties = { ...superProperties, ...props };
    applySuperProperties();
  },

  /** Kullanici kimligini sifirla — logout'ta cagir. Super property'ler korunur. */
  reset(): void {
    posthog?.reset();
    applySuperProperties();
  },

  /** Bekleyen event'leri hemen gonder. */
  async flush(): Promise<void> {
    await posthog?.flush();
  },
};
