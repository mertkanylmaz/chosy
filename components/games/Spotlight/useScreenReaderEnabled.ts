/**
 * Ekran okuyucu (VoiceOver/TalkBack) açık mı — anonslar yalnız açıkken atılır.
 * İlk değer asenkron okunur; değişiklik dinlenir. Hata sessizce yutulmaz.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { logger } from '@/utils/logger';

export function useScreenReaderEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isScreenReaderEnabled()
      .then((value) => {
        if (active) setEnabled(value);
      })
      .catch((err: unknown) => {
        logger.error('[spotlight] Ekran okuyucu durumu okunamadi', err, {
          code: 'SPOTLIGHT_SCREEN_READER_STATE',
        });
      });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setEnabled);
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
