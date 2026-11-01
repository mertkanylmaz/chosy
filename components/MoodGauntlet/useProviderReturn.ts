/**
 * Dış sağlayıcıdan dönüş olayı (Faz 2-4): uygulama arka plandan `active`'e dönünce, 30 dk
 * penceresi içinde bekleyen bir sağlayıcı geçişi varsa `app_returned_after_provider {seconds_away}`.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { appReturnedAfterProviderEvent } from '@/utils/moodGauntletAnalytics';
import { providerReturn } from '@/utils/providerReturn';

import { trackMoodEvent } from './useMoodGauntlet';

export function useProviderReturnTracking(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const seconds = providerReturn.consume(Date.now());
      if (seconds !== null) trackMoodEvent(appReturnedAfterProviderEvent(seconds));
    });
    return () => sub.remove();
  }, []);
}
