/**
 * useMoodOfferEnabled — `mood_offer_enabled` (MONEY-1C) bayrağının React karşılığı.
 *
 * İlk render'da ve okuma bitene / başarısız olana kadar `false`: bayrak kapalıyken
 * hiçbir MONEY-1C yüzeyi bir kare bile görünmez. Hata `remoteConfig` içinde
 * Sentry'ye yazılır (hydrate); burada ek yutma yok, yalnız kapalı kalınır.
 */
import { useEffect, useState } from 'react';

import { isMoodOfferEnabled } from '@/services/appConfigFlags';
import { logger } from '@/utils/logger';

export function useMoodOfferEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    isMoodOfferEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch((err: unknown) => {
        logger.error('[useMoodOfferEnabled] bayrak okunamadi — kapali', err, {
          code: 'MOOD_OFFER_FLAG_READ_FAILED',
          sampleRate: 0.2,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  return enabled;
}
