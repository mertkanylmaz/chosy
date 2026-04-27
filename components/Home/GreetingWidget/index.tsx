/**
 * GreetingWidget — Home Header selamlama bileşeni.
 *
 * Gunun saatine gore dinamik selamlama + kullanici adi gosterir.
 * Stagger animasyonu: FadeInDown, 0ms ve 100ms delay ile iki satir.
 */

import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';

import { styles } from './styles';

// ─── Yardimci ─────────────────────────────────────────────────────────────────

/**
 * Mevcut saate gore i18n selamlama anahtarini dondurur.
 *
 * | Aralik   | Anahtar                  |
 * |----------|--------------------------|
 * | 05-11    | home.greetingMorning     |
 * | 12-16    | home.greetingAfternoon   |
 * | 17-20    | home.greetingEvening     |
 * | 21-04    | home.greetingNight       |
 */
function getGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'home.greetingMorning';
  if (hour >= 12 && hour < 17) return 'home.greetingAfternoon';
  if (hour >= 17 && hour < 21) return 'home.greetingEvening';
  return 'home.greetingNight';
}

// ─── Prop tipi ────────────────────────────────────────────────────────────────

export interface GreetingWidgetProps {
  /** Kullanici adi — null ise sadece selamlama gosterilir */
  username: string | null;
}

// ─── Bilesen ──────────────────────────────────────────────────────────────────

/**
 * Gunun saatine gore kisisellesmis selamlama widget'i.
 * Home Header'da FeedScreen'in ust kisminda yer alir.
 */
function GreetingWidget({ username }: GreetingWidgetProps) {
  const { t } = useLanguage();

  const greetingText = username
    ? `${t(getGreetingKey())}, ${username}`
    : t(getGreetingKey());

  return (
    <View style={styles.container}>
      {/* Selamlama satiri — Animated.View sarmalı: Animated.Text+entering Reanimated warning'i önler */}
      <Animated.View entering={FadeInDown.duration(400).springify().damping(18)}>
        <Text style={styles.greeting}>{greetingText}</Text>
      </Animated.View>

      {/* Alt baslik */}
      <Animated.View entering={FadeInDown.delay(100).duration(400).springify().damping(18)}>
        <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
      </Animated.View>
    </View>
  );
}

export default React.memo(GreetingWidget);
