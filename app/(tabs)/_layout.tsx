/**
 * Tab navigasyon layout'u — Premium Bumble tab bar.
 *
 * Sıra: Feed (Home) → Discover (Compass) → Profile (Person)
 *
 * Aktif tab: filled ikon (violet) + label (11px bold) + dot + bounce
 * Pasif tab: outline ikon (zinc-500) + label yok
 *
 * UX Redesign v2: 4→3 tab. Watchlist tab kaldırıldı (Profile'a taşındı).
 * Mood tab "Discover" olarak yeniden adlandırıldı. watchlist.tsx dosyası
 * dizinde kalıyor ama href:null ile router'dan gizleniyor.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';

import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useLanguage } from '@/contexts/LanguageContext';
import { Colors } from '@/constants/Colors';
import { BOUNCE_CONFIG, SPRING_CONFIG, FAST_TIMING } from '@/constants/animations';

// ─── Ionicons tip yardımcısı ─────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// ─── Animated Tab Icon ────────────────────────────────────────────────────────

interface AnimatedTabIconProps {
  focused: boolean;
  children: React.ReactNode;
}

/**
 * Tab ikonu wrapper'ı.
 * Aktif olunca ikon scale 1→1.2→1 bounce yapar.
 * Altında küçük violet dot indicator fade in/out.
 */
function AnimatedTabIcon({ focused, children }: AnimatedTabIconProps) {
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(focused ? 1 : 0);
  const dotScale = useSharedValue(focused ? 1 : 0);
  const isReducedMotion = useReducedMotion();

  useEffect(() => {
    // Dot fade in/out
    dotOpacity.value = withTiming(focused ? 1 : 0, FAST_TIMING);
    dotScale.value = withSpring(focused ? 1 : 0, SPRING_CONFIG);

    // İkon bounce — sadece aktif olunca
    if (focused && !isReducedMotion) {
      scale.value = withSequence(
        withSpring(1.2, BOUNCE_CONFIG),
        withSpring(1.0, SPRING_CONFIG),
      );
    }
  }, [focused, isReducedMotion, scale, dotOpacity, dotScale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
    transform: [{ scale: dotScale.value }],
  }));

  return (
    <View style={tabIconStyles.wrapper}>
      <Animated.View style={iconStyle}>{children}</Animated.View>
      <Animated.View style={[tabIconStyles.dot, dotStyle]} />
    </View>
  );
}

// ─── Tab Icon Renderer ───────────────────────────────────────────────────────

/**
 * Outline/filled ikon seçimi — focused durumuna göre.
 */
function TabIcon({
  focused,
  filledName,
  outlineName,
}: {
  focused: boolean;
  filledName: IoniconsName;
  outlineName: IoniconsName;
}) {
  return (
    <AnimatedTabIcon focused={focused}>
      <Ionicons
        name={focused ? filledName : outlineName}
        size={24}
        color={focused ? Colors.accentPrimary : Colors.tabInactive}
      />
    </AnimatedTabIcon>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * Tab navigasyon layout'u.
 * Sıra: Feed (Home) → Discover (eski Mood) → Profile
 *
 * UX Redesign: Watchlist tab kaldırıldı, Mood "Discover" olarak yeniden adlandırıldı.
 */
export default function TabLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.accentPrimary,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => null,
        tabBarLabelStyle: styles.tabLabel,
        tabBarItemStyle: styles.tabItem,
        headerShown: useClientOnlyValue(false, true),
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.textWhite,
        headerTitleStyle: { fontFamily: 'PlayfairDisplay_700Bold' },
      }}>
      {/* 1 — Home: dashboard (kendi floating header'ı var — nav header gizle) */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          headerShown: false,
          tabBarLabel: ({ focused }) =>
            focused ? <Text style={styles.activeLabel}>{t('tabs.home')}</Text> : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} filledName="home" outlineName="home-outline" />
          ),
        }}
      />
      {/* 2 — Discover (eski Mood): Duygu girişi + AI keşif (kendi başlığı var — nav header gizle) */}
      <Tabs.Screen
        name="mood"
        options={{
          title: t('tabs.discover'),
          headerShown: false,
          tabBarLabel: ({ focused }) =>
            focused ? <Text style={styles.activeLabel}>{t('tabs.discover')}</Text> : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} filledName="compass" outlineName="compass-outline" />
          ),
        }}
      />
      {/* 3 — Profile: avatar + isim zaten kimlik gösteriyor — nav header gizle */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          headerShown: false,
          tabBarLabel: ({ focused }) =>
            focused ? <Text style={styles.activeLabel}>{t('tabs.profile')}</Text> : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} filledName="person" outlineName="person-outline" />
          ),
        }}
      />
      {/* Watchlist — tab bar'dan gizle, dosya dizinde kalıyor (expo-router gerekliliği) */}
      <Tabs.Screen
        name="watchlist"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBarBg,
    // Pill görünüm
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    borderRadius: 36,
    marginHorizontal: 16,
    // Floating gölge
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 18,
    elevation: 18,
    // Pozisyon: bottom 10 + height 64 = 74px → paddingBottom:83 ile uyumlu (9px nefes)
    position: 'absolute',
    bottom: 10,
    height: 64,
    paddingBottom: 10,
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginTop: 2,
  },
  tabItem: {
    gap: 2,
  },
  activeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accentPrimary,
    letterSpacing: 0.3,
    marginTop: 1,
  },
});

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accentPrimary,
  },
});
