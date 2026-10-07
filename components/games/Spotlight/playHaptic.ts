/**
 * Haptik haritasının çalıcısı — `hapticMap.ts` kararını `utils/haptics`'e iletir.
 * Yeni haptik türü eklenmez; yalnız mevcut yardımcılar.
 */
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '@/utils/haptics';

import { hapticForEvent, type SpotlightHapticEvent } from './hapticMap';

export function playSpotlightHaptic(event: SpotlightHapticEvent): void {
  switch (hapticForEvent(event)) {
    case 'light':
      hapticLight();
      return;
    case 'warning':
      hapticWarning();
      return;
    case 'success':
      hapticSuccess();
      return;
    case 'medium':
      hapticMedium();
      return;
    case null:
      return;
  }
}
