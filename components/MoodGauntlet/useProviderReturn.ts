/**
 * Dış uygulamadan dönüş olayları (Faz 2-4 / 2-4d): uygulama arka plandan `active`'e dönünce,
 * 30 dk penceresi içinde bekleyen bir geçiş varsa `{seconds_away}` olayı gider.
 * Tek mekanizma (`useReturnTracking`); iki kaynak: sağlayıcı CTA'sı ve fragman düğmesi.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  appReturnedAfterProviderEvent,
  returnedAfterTrailerEvent,
  type MoodEvent,
} from '@/utils/moodGauntletAnalytics';
import { providerReturn, trailerReturn, type ProviderReturnTracker } from '@/utils/providerReturn';

import { trackMoodEvent } from './useMoodGauntlet';

function useReturnTracking(tracker: ProviderReturnTracker, makeEvent: (seconds: number) => MoodEvent): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const seconds = tracker.consume(Date.now());
      if (seconds !== null) trackMoodEvent(makeEvent(seconds));
    });
    return () => sub.remove();
  }, [tracker, makeEvent]);
}

export function useProviderReturnTracking(): void {
  useReturnTracking(providerReturn, appReturnedAfterProviderEvent);
}

export function useTrailerReturnTracking(): void {
  useReturnTracking(trailerReturn, returnedAfterTrailerEvent);
}
