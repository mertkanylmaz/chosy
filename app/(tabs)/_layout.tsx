/**
 * Tab navigasyon layout'u — Premium Bumble tab bar.
 *
 * Sıra: Feed (Home) → Watchlist (Bookmark) → Mood (Sparkle/Lumi) → Profile (Person)
 *
 * Aktif tab: filled ikon (violet) + label (11px bold) + dot + bounce
 * Pasif tab: outline ikon (zinc-500) + label yok
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
import Lumi from '@/components/Lumi';
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
 * Sıra: Feed (Home) → Watchlist → Mood (Sparkle) → Profile
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
      {/* 1 — Feed: film kartları */}
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.discover'),
          tabBarLabel: ({ focused }) =>
            focused ? <Text style={styles.activeLabel}>{t('tabs.discover')}</Text> : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} filledName="home" outlineName="home-outline" />
          ),
        }}
      />
      {/* 2 — Watchlist: İzleme listesi */}
      <Tabs.Screen
        name="watchlist"
        options={{
          title: t('tabs.watchlist'),
          tabBarLabel: ({ focused }) =>
            focused ? <Text style={styles.activeLabel}>{t('tabs.watchlist')}</Text> : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} filledName="bookmark" outlineName="bookmark-outline" />
          ),
        }}
      />
      {/* 3 — Mood: Duygu girişi */}
      <Tabs.Screen
        name="mood"
        options={{
          title: t('tabs.home'),
          tabBarLabel: ({ focused }) =>
            focused ? <Text style={styles.activeLabel}>{t('tabs.home')}</Text> : null,
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon focused={focused}>
              {focused ? (
                <Lumi size="small" mood="idle" />
              ) : (
                <Ionicons
                  name="sparkles-outline"
                  size={24}
                  color={Colors.tabInactive}
                />
              )}
            </AnimatedTabIcon>
          ),
        }}
      />
      {/* 4 — Profile: Ayarlar ve dil */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarLabel: ({ focused }) =>
            focused ? <Text style={styles.activeLabel}>{t('tabs.profile')}</Text> : null,
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} filledName="person" outlineName="person-outline" />
          ),
        }}
      />
    </Tabs>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.tabBarBg,
    borderTopColor: Colors.white10,
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
    height: 83,
    paddingBottom: 20,
    paddingTop: 8,
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
