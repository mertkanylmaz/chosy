/**
 * Increase Contrast (iOS "Kontrastı Artır" = `isDarkerSystemColorsEnabled`).
 * Design OS §11: `smoke` → `bone`@85%, kenarlar `graphite` → `smoke`.
 *
 * Okuma başarısız olursa sessiz geçilmez: Sentry uyarısı + GÜVENLİ tarafa
 * (yüksek kontrast AÇIK) düşülür — `LightBleed/useLightBleed.ts` ile aynı ilke.
 * Okuma bitene kadar KAPALI kabul edilir (normal görünüm), değer gelince güncellenir.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import * as Sentry from '@sentry/react-native';

const EVENT = Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : 'highTextContrastChanged';

function read(): Promise<boolean> {
  return Platform.OS === 'ios'
    ? AccessibilityInfo.isDarkerSystemColorsEnabled()
    : AccessibilityInfo.isHighTextContrastEnabled();
}

export function useIncreaseContrast(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    read()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch((err: unknown) => {
        Sentry.captureMessage('PendingWatchFeedbackCard: Increase Contrast okunamadı', {
          level: 'warning',
          tags: { component: 'PendingWatchFeedbackCard' },
          extra: { error: err instanceof Error ? err.message : String(err) },
        });
        if (active) setEnabled(true);
      });
    const sub = AccessibilityInfo.addEventListener(EVENT, (value: boolean) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
