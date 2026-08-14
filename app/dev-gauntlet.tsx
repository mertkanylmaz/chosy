/**
 * DEV — GauntletShell cihaz test ekranı (C.2-2, CTO onayı 14.08.2026).
 *
 * Tamamı __DEV__ gated: production build'de içerik render edilmez, ana
 * ekrana yönlendirir. Tab bar'a GİRMEZ — iki-sekme yapısı kilitli
 * (DESIGN_OS §10.5). Gauntlet'ın gerçek vitrin bağlanışı Faz 2'nin işi;
 * bu route yalnızca kurucu cihaz testinin kalite kapısı için var.
 */
import React from 'react';

import { Redirect, useRouter } from 'expo-router';

import { GauntletShell } from '@/components/gauntlet/GauntletShell';

export default function DevGauntletScreen(): React.JSX.Element {
  const router = useRouter();

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  return <GauntletShell onDismiss={() => router.back()} />;
}
