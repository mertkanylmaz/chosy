/**
 * QuickNavGrid — 1×4 yatay hızlı erişim navigasyon şeridi.
 *
 * Kartlar: Discover (keşfet), Find Mood (ruh hali), Watchlist (liste), Profile
 * Her kart: ikon dairesi + kısa etiket — dikey yığılmış, yatay sıralanmış.
 * Kompakt tek satır tasarım — home dashboard'da dikey alan tasarrufu sağlar.
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { styles } from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface NavItem {
  /** Ionicons ikon adı */
  icon: IoniconsName;
  /** i18n etiket anahtarı */
  labelKey: string;
  /** Hedef rota */
  route: string;
  /** Kart vurgu rengi */
  color: string;
  /** Kart arka plan rengi (rgba) */
  bgColor: string;
}

// ─── Navigasyon öğeleri ────────────────────────────────────────────────────────

/** Her kartın renk değerleri Colors tokenlarından türetilir — elit premium tasarım */
const NAV_ITEMS: NavItem[] = [
  {
    icon: 'compass',
    labelKey: 'home.navDiscover',
    route: '/discover',
    color: '#F0E8DA',                   // cream-light
    bgColor: 'rgba(234,219,198,0.10)',
  },
  {
    icon: 'sparkles',
    labelKey: 'home.navMood',
    route: '/(tabs)/mood',
    color: '#FBBF24',                   // amber-400
    bgColor: 'rgba(251,191,36,0.10)',
  },
  {
    icon: 'library',
    labelKey: 'home.navWatchlist',
    route: '/(tabs)/watchlist',
    color: '#38BDF8',                   // sky-400
    bgColor: 'rgba(56,189,248,0.10)',
  },
  {
    icon: 'diamond',
    labelKey: 'home.navProfile',
    route: '/(tabs)/profile',
    color: '#FB923C',                   // orange-400
    bgColor: 'rgba(251,146,60,0.10)',
  },
];

// ─── Bileşen ──────────────────────────────────────────────────────────────────

/**
 * 1×4 yatay kompakt navigasyon şeridi.
 * Home dashboard'da en alt bölümde yer alır.
 */
function QuickNavGrid() {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <Animated.View
      entering={FadeInDown.delay(350).duration(400).springify().damping(18)}
      style={styles.wrapper}
    >
      <Text style={styles.sectionLabel}>{t('home.quickNav')}</Text>
      <View style={styles.strip}>
        {NAV_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.labelKey}
            style={[
              styles.card,
              {
                backgroundColor: item.bgColor,
                borderColor: item.color + '35',
              },
            ]}
            onPress={() => router.push(item.route as Href)}
            activeOpacity={0.75}
          >
            <View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: item.color + '20',
                  shadowColor: item.color,
                  ...(styles.iconGlow as Record<string, unknown>),
                },
              ]}
            >
              <Ionicons name={item.icon} size={18} color={item.color} />
            </View>
            <Text style={[styles.cardLabel, { color: item.color }]} numberOfLines={1}>
              {t(item.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </Animated.View>
  );
}

export default React.memo(QuickNavGrid);
