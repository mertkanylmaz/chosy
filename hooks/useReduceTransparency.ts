/**
 * useReduceTransparency — iOS "Şeffaflığı Azalt" ayarı (V-3 Tur G2, C1).
 *
 * Şampiyon hero'sunun geçişi bu açıkken çizilmez; poster sert kenarla biter,
 * altı düz `ink`. `useLightBleed` ile aynı okuma/dinleme deseni — o hook
 * bilinçli olarak yeniden düzenlenmedi (retrofit kapsamı dışı).
 *
 * Okuma bitene kadar AÇIK kabul edilir: önce geçiş çizip sonra kaldırmak,
 * düz zeminle başlayıp geçişi eklemekten daha rahatsız edicidir.
 * Okuma hatası sessiz geçilmez — Sentry'ye yazılır, AÇIK varsayılır.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import * as Sentry from '@sentry/react-native';

export function useReduceTransparency(): boolean {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch((err: unknown) => {
        Sentry.captureException(err, {
          tags: { component: 'useReduceTransparency' },
        });
        if (active) setEnabled(true);
      });
    const sub = AccessibilityInfo.addEventListener('reduceTransparencyChanged', (value) => {
      if (active) setEnabled(value);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
