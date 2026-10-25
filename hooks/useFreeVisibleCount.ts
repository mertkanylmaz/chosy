/**
 * useFreeVisibleCount — `free_visible_count` (MONEY-1C) değerinin React karşılığı.
 *
 * İlk render'da güvenli varsayılan; okuma bitince gerçek değer. Okuma hatası
 * `remoteConfig` içinde Sentry'ye yazılır; burada varsayılanda kalınır.
 */
import { useEffect, useState } from 'react';

import { getFreeVisibleCount } from '@/services/appConfigFlags';
import { DEFAULT_FREE_VISIBLE_COUNT } from '@/utils/moodLock';
import { logger } from '@/utils/logger';

export function useFreeVisibleCount(): number {
  const [count, setCount] = useState(DEFAULT_FREE_VISIBLE_COUNT);

  useEffect(() => {
    let active = true;
    getFreeVisibleCount()
      .then((value) => {
        if (active) setCount(value);
      })
      .catch((err: unknown) => {
        logger.error('[useFreeVisibleCount] deger okunamadi — varsayilan', err, {
          code: 'FREE_VISIBLE_COUNT_READ_FAILED',
          sampleRate: 0.2,
        });
      });
    return () => {
      active = false;
    };
  }, []);

  return count;
}
