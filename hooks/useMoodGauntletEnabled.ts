/**
 * useMoodGauntletEnabled — `mood_gauntlet_enabled` (Pro Mode Faz 2-1) bayrağının React karşılığı.
 *
 * `loading`: okuma bitene kadar true. Pro Mode ekranı yüklenirken ESKİ ya da YENİ yolu çizmez
 * (yanlış kabuğun bir kare görünmesini önler). Hata → kapalı (eski yol) + Sentry.
 * Peek daveti gibi "bayrak açıksa gizle" tüketicileri için `enabled` (loading iken false)
 * yeterlidir: bayrak kapalıyken davranış release/2.2 ile aynı kalır.
 */
import { useEffect, useState } from 'react';

import { isMoodGauntletEnabled } from '@/services/appConfigFlags';
import { logger } from '@/utils/logger';

export interface MoodGauntletFlag {
  enabled: boolean;
  loading: boolean;
}

export function useMoodGauntletFlag(): MoodGauntletFlag {
  const [state, setState] = useState<MoodGauntletFlag>({ enabled: false, loading: true });

  useEffect(() => {
    let active = true;
    isMoodGauntletEnabled()
      .then((value) => {
        if (active) setState({ enabled: value, loading: false });
      })
      .catch((err: unknown) => {
        logger.error('[useMoodGauntletEnabled] bayrak okunamadi — kapali', err, {
          code: 'MOOD_GAUNTLET_FLAG_READ_FAILED',
          sampleRate: 0.2,
        });
        if (active) setState({ enabled: false, loading: false });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
}

export function useMoodGauntletEnabled(): boolean {
  return useMoodGauntletFlag().enabled;
}
