import React, { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
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

// ─── Animated Tab Icon ────────────────────────────────────────────────────────

interface AnimatedTabIconProps {
  focused: boolean;
  children: React.ReactNode;
}

/**
 * Tab ikonu wrapper'ı.
 * Aktif olunca ikon scale 1→1.2→1 bounce yapar.
 * Altında küçük altın dot indicator fade in/out.
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
        withSpring(1.25, BOUNCE_CONFIG),
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
        tabBarActiveTintColor: Colors.gold,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: styles.tabBar,
        tabBarBackground: () => null,
        tabBarLabelStyle: styles.tabLabel,
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
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <SymbolView
                name={{ ios: 'house.fill', android: 'home', web: 'home' }}
                tintColor={color}
                size={24}
              />
            </AnimatedTabIcon>
          ),
        }}
      />
      {/* 2 — Watchlist: İzleme listesi */}
      <Tabs.Screen
        name="watchlist"
        options={{
          title: t('tabs.watchlist'),
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <SymbolView
                name={{ ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }}
                tintColor={color}
                size={24}
              />
            </AnimatedTabIcon>
          ),
        }}
      />
      {/* 3 — Mood: Duygu girişi */}
      <Tabs.Screen
        name="mood"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon focused={focused}>
              {focused ? (
                <Lumi size="small" mood="idle" />
              ) : (
                <SymbolView
                  name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }}
                  tintColor={Colors.tabInactive}
                  size={24}
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
          tabBarIcon: ({ color, focused }) => (
            <AnimatedTabIcon focused={focused}>
              <SymbolView
                name={{ ios: 'person.fill', android: 'person', web: 'person' }}
                tintColor={color}
                size={24}
              />
            </AnimatedTabIcon>
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
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
    height: 83,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: 2,
  },
});

const tabIconStyles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.gold,
  },
});
