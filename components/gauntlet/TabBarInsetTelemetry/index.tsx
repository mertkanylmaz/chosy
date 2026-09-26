/**
 * TabBarInsetTelemetry — native tab bar payının SAHA ölçümü (G4b).
 *
 * `expo-router/unstable-native-tabs` bar yüksekliği için JS API'si sunmuyor
 * (`BottomTabBarHeightContext` yok) ve kökteki `useSafeAreaInsets()` yalnız
 * pencere güvenli alanını verir, bar'ı değil. Champion dalında en alttaki
 * öğeyi ölçmek de işe yaramaz: `ChampionReveal` flex:1 olduğu için kart
 * HER cihazda `insetLayer` dibine yapışır, mesafe daima `insets.bottom`'dur.
 *
 * Bu bileşen iç içe bir `SafeAreaProvider` kurar. İç provider kendi native
 * view'ının `safeAreaInsets` değerini raporlar; UIKit tab bar'ı bu değere
 * katıyorsa iç `bottom` dıştakinden BÜYÜK çıkar ve fark gerçek bar payıdır.
 * CTO kararı (26 Eyl 2026): yalnız ÖLÇÜM — düzen bu bileşene bağlanmaz.
 *
 * ── Gönderim ────────────────────────────────────────────────────────────────
 * Her mount'ta bir breadcrumb (ucuz). KURULUM BAŞINA BİR KEZ
 * `captureMessage('info')` — kota her Champion açılışında yanmasın diye.
 * Bayrak AsyncStorage'da. Bayrak okunamazsa/yazılamazsa sessiz geçilmez:
 * `captureException` atılır, ölçüm event'i gönderilmez (tekrar tekrar
 * gönderip kotayı yakmaktansa bir kez hata izi).
 *
 * Görsel çıktısı YOK: tam ekran, `pointerEvents="none"`, içerik yok.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Platform, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { styles } from './styles';

/** Kurulum başına tek event bayrağı. Ölçüm biçimi değişirse sürüm artar. */
const REPORTED_KEY = 'chosy_tabbar_inset_reported_v1';

interface InnerReading {
  innerBottom: number;
  innerTop: number;
  /** İç view'ın alt kenarı ile pencere dibi arası (frame kontrolü) */
  frameBottomGap: number;
}

function InnerInsetReader({
  onReading,
}: {
  onReading: (r: InnerReading) => void;
}): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const ref = useRef<View>(null);

  const measure = useCallback(() => {
    ref.current?.measureInWindow((_x, y, _width, height) => {
      onReading({
        innerBottom: insets.bottom,
        innerTop: insets.top,
        frameBottomGap: Dimensions.get('window').height - (y + height),
      });
    });
  }, [insets.bottom, insets.top, onReading]);

  // İç provider'ın insets'i ilk layout'tan SONRA gelebilir — onLayout tekrar
  // tetiklenmez, ölçüm elle yenilenir.
  useEffect(() => {
    measure();
  }, [measure]);

  return <View ref={ref} style={styles.fill} onLayout={measure} />;
}

export function TabBarInsetTelemetry(): React.JSX.Element {
  const outer = useSafeAreaInsets();
  const reportedRef = useRef(false);
  const [reading, setReading] = useState<InnerReading | null>(null);

  useEffect(() => {
    if (reading === null || reportedRef.current) return;
    reportedRef.current = true;

    const win = Dimensions.get('window');
    const data = {
      outer_bottom_pt: Math.round(outer.bottom),
      inner_bottom_pt: Math.round(reading.innerBottom),
      tab_bar_delta_pt: Math.round(reading.innerBottom - outer.bottom),
      inner_top_pt: Math.round(reading.innerTop),
      frame_bottom_gap_pt: Math.round(reading.frameBottomGap),
      window_pt: `${Math.round(win.width)}x${Math.round(win.height)}`,
      platform: Platform.OS,
      os_version: String(Platform.Version),
    };

    Sentry.addBreadcrumb({
      category: 'gauntlet.layout',
      message: 'tab bar inset olcumu',
      level: 'info',
      data,
    });

    void (async () => {
      try {
        if ((await AsyncStorage.getItem(REPORTED_KEY)) !== null) return;
        await AsyncStorage.setItem(REPORTED_KEY, new Date().toISOString());
      } catch (err) {
        Sentry.captureException(err, {
          tags: { component: 'TabBarInsetTelemetry', flow: 'reported_flag' },
        });
        return;
      }
      Sentry.captureMessage('tab bar inset olcumu', {
        level: 'info',
        tags: { component: 'TabBarInsetTelemetry' },
        extra: data,
      });
    })();
  }, [reading, outer.bottom]);

  return (
    <View style={styles.fill} pointerEvents="none">
      <SafeAreaProvider style={styles.fill}>
        <InnerInsetReader onReading={setReading} />
      </SafeAreaProvider>
    </View>
  );
}
