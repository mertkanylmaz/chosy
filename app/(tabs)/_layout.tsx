/**
 * Tab navigasyon layout'u — Native tab bar (C.9a-2 Faz 2, Senaryo A).
 *
 * Sıra: Home (sparkle) → Discover (safari, gizli) → Profile (person)
 *
 * K-04: "Tab bar native-feeling. Custom glass taklidi yok; sistemin Liquid
 * Glass davranışı kullanılır." Bu yüzden `expo-router/unstable-native-tabs`
 * kullanılır — pill/shadow/bounce/dot indicator bilinçli olarak bırakıldı,
 * native API bunları expose etmiyor (Faz 1 araştırması).
 *
 * ⚠️ BİLİNEN RİSK (bkz. docs/TEKNIK_BORC.md): discoverEnabled flag'i `hidden`
 * prop'una async fetch sonrası set ediliyor — flag `true` olursa native tab
 * navigator'ı remount eder. Flag bugün K-02 gereği hep false, tetiklenmiyor.
 */
import React, { useEffect, useState } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';

import { useLanguage } from '@/contexts/LanguageContext';
import { Colors } from '@/constants/Colors';
import { isDiscoverTabEnabled } from '@/services/appConfigFlags';

/**
 * Tab navigasyon layout'u.
 * Sıra: Home (Mood Search) → Discover (placeholder, gizli) → Profile
 */
export default function TabLayout() {
  const { t } = useLanguage();

  // ── C.9a (bible K-02): Discover tab flag ile kontrol ediliyor ───────────
  // Fail-closed: okuma bitene kadar VE hata durumunda tab gizli kalır.
  // Modül seviyesi cache yok — her mount'ta taze okunur (kural 6).
  const [discoverEnabled, setDiscoverEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    isDiscoverTabEnabled().then((enabled) => {
      if (!cancelled) setDiscoverEnabled(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <NativeTabs tintColor={Colors.accentPrimary}>
      {/* 1 — Home: Mood search + AI processing */}
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'sparkle', selected: 'sparkles' }} />
        <Label>{t('tabs.home')}</Label>
      </NativeTabs.Trigger>
      {/* 2 — Discover: C.9a (bible K-02) — nav'dan kaldırıldı, flag ile donduruldu.
          Kod (mood.tsx ve içindeki section'lar) SİLİNMEZ, yalnızca tab bar
          erişimi discover_tab_enabled flag'ine bağlı.
          ⚠️ hidden, discoverEnabled değişince navigator'ı remount eder — bkz.
          docs/TEKNIK_BORC.md, flag true yapılmadan önce oku. */}
      <NativeTabs.Trigger name="mood" hidden={!discoverEnabled}>
        <Icon sf={{ default: 'safari', selected: 'safari.fill' }} />
        <Label>{t('tabs.discover')}</Label>
      </NativeTabs.Trigger>
      {/* 3 — Profile */}
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
        <Label>{t('tabs.profile')}</Label>
      </NativeTabs.Trigger>
      {/* Watchlist — tab bar'dan gizle, dosya dizinde kalıyor (expo-router gerekliliği) */}
      <NativeTabs.Trigger name="watchlist" hidden>
        <Label>{t('tabs.watchlist')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
