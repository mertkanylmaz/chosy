/**
 * PROTOTİP rotası — Cinematic Discovery Loading (proto/cinematic-loading, CTO onayı 06.11.2026).
 *
 * Yalnız `__DEV__` ya da `preview` kanalında erişilebilir (`canAccessProto`); production
 * kanalında ana sayfaya yönlenir. Laboratuvar bileşeni yalnız erişim açıkken `require` edilir.
 * Kapı artık çalışma zamanı kanalına bağlı olduğu için modül production bundle'ında da
 * bulunur ama production kanalında hiç değerlendirilmez. Production akışına bağlanmaz.
 */
import React from 'react';

import { Redirect } from 'expo-router';

import { canAccessProto } from '@/utils/protoAccess';

type LabModule = typeof import('@/components/MoodGauntlet/proto/CinematicLoadingLab');

export default function DevCinematicLoadingRoute(): React.JSX.Element {
  const Lab = canAccessProto()
    ? (require('@/components/MoodGauntlet/proto/CinematicLoadingLab') as LabModule).CinematicLoadingLab
    : null;
  if (Lab === null) return <Redirect href="/" />;
  return <Lab />;
}
