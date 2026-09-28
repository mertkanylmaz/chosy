/**
 * useTabBarInset — ekranın altında içeriğin girmemesi gereken toplam pay
 * (tab bar + home indicator). V-2 Tur B, TEK KAYNAK: ekran bazlı sabit alt
 * dolgu yazılmaz, bu değer okunur.
 *
 * ── Neden `useBottomTabBarHeight()` değil ──────────────────────────────────
 * Tab bar `expo-router/unstable-native-tabs`; `BottomTabBarHeightContext`
 * sağlamıyor, hook throw eder. Kökteki `useSafeAreaInsets()` ise yalnız
 * pencere güvenli alanını verir (home indicator), bar'ı değil.
 *
 * ── Kaynak ──────────────────────────────────────────────────────────────────
 * Ekranı kaplayan bir `SafeAreaListener` — kendi native view'ının
 * `safeAreaInsets` değerini bildirir; UIKit tab bar'ı bu değere katar
 * (G4b telemetrisinin ölçtüğü yöntem, CTO onayı 28 Eyl 2026). `SafeAreaProvider`
 * DEĞİL, bilinçli: iç provider altındaki HER `useSafeAreaInsets()` çağrısını
 * değiştirirdi — `TabBarInsetTelemetry`'nin "dış" okuması dahil.
 *
 * İlk native olaydan önce değer kökün `insets.bottom`'udur; kütüphanenin iç
 * içe provider'ı da başlangıçta aynı şeyi yapar (parent insets). Olay
 * geldiğinde düzen güncellenir.
 *
 * Provider dışında çağrılırsa THROW eder — sessizce 0 ya da kök inset'e
 * düşmek, bar'ın altına çizilen içeriği tekrar üretirdi (kural 1).
 */
import React, { createContext, useCallback, useContext, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { SafeAreaListener, useSafeAreaInsets } from 'react-native-safe-area-context';

const TabBarInsetContext = createContext<number | null>(null);

interface TabBarInsetProviderProps {
  children: React.ReactNode;
}

/**
 * Ölçüm kutusu. Ebeveyni ekranı TAMAMEN kaplamalı — dinleyici view'ı alt
 * kenara ulaşmazsa UIKit ona bar payını katmaz.
 */
export function TabBarInsetProvider({ children }: TabBarInsetProviderProps): React.JSX.Element {
  const windowInsets = useSafeAreaInsets();
  const [measuredBottom, setMeasuredBottom] = useState<number | null>(null);

  const handleChange = useCallback(
    ({ insets }: { insets: { bottom: number } }) => {
      setMeasuredBottom((prev) => (prev === insets.bottom ? prev : insets.bottom));
    },
    [],
  );

  return (
    <TabBarInsetContext.Provider value={measuredBottom ?? windowInsets.bottom}>
      <View style={styles.fill}>
        <SafeAreaListener
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
          onChange={handleChange}
        />
        {children}
      </View>
    </TabBarInsetContext.Provider>
  );
}

/** Alt pay (pt) — tab bar dahil. `TabBarInsetProvider` altında çağrılır. */
export function useTabBarInset(): number {
  const inset = useContext(TabBarInsetContext);
  if (inset === null) {
    throw new Error('useTabBarInset: TabBarInsetProvider dışında çağrıldı');
  }
  return inset;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
