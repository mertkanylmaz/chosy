/**
 * PROTOTİP rotası — Cinematic Discovery Loading (proto/cinematic-loading, CTO onayı 06.11.2026).
 *
 * Prod'da erişilemez: `__DEV__` false iken ana sayfaya yönlenir. Laboratuvar bileşeni yalnız
 * `__DEV__` dalında `require` edilir; prod derlemede `__DEV__` sabitlenip dal katlandığı için
 * modül bundle'a girmez (profile.tsx sentryTest deseni). Production akışına bağlanmaz.
 */
import React from 'react';

import { Redirect } from 'expo-router';

type LabModule = typeof import('@/components/MoodGauntlet/proto/CinematicLoadingLab');

export default function DevCinematicLoadingRoute(): React.JSX.Element {
  const Lab = __DEV__
    ? (require('@/components/MoodGauntlet/proto/CinematicLoadingLab') as LabModule).CinematicLoadingLab
    : null;
  if (Lab === null) return <Redirect href="/" />;
  return <Lab />;
}
