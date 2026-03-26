/**
 * EmotionalHook — yeni kullanıcılar için sinematik giriş ekranı (Varyasyon 1).
 * Duygusal bağlantı kurar ve kullanıcıyı Mood sekmesine yönlendirir.
 */

import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { hapticMedium, hapticSelection } from '@/utils/haptics';

import styles from './styles';

/**
 * Yeni kullanıcılar için duygusal giriş deneyimi.
 * Kullanıcıyı mood sekmesine yönlendirir; chip seçiminde MoodContext'e preset metin set eder.
 */
export default function EmotionalHook() {
  const router = useRouter();
  const { t } = useLanguage();
  const { setPresetMoodText } = useMood();

  /** Hızlı seçim için mood chip verileri — label'lar çeviri ile oluşturulur */
  const MOOD_CHIPS: ReadonlyArray<{ label: string; mood: string }> = [
    { label: t('entry.calm'), mood: 'Calm' },
    { label: t('entry.reflective'), mood: 'Reflective' },
    { label: t('entry.energetic'), mood: 'Energetic' },
    { label: t('entry.melancholic'), mood: 'Melancholic' },
  ];

  const handleDescribeMood = () => {
    hapticMedium();
    router.push('/(tabs)/mood');
  };

  const handleChipPress = (mood: string) => {
    hapticSelection();
    setPresetMoodText(mood);
    router.push('/(tabs)/mood');
  };

  const handleContinue = () => {
    router.replace('/(tabs)');
  };

  return (
    <LinearGradient
      colors={['#0A0E27', '#0D1B2A', '#131B30']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Logo */}
        <Animated.View entering={FadeIn.duration(800)} style={styles.logoContainer}>
          <Text style={styles.logo}>chosy.ai</Text>
        </Animated.View>

        {/* Orta içerik */}
        <Animated.View entering={FadeIn.duration(1000)} style={styles.centerContent}>
          <Text style={styles.title}>{t('entry.howAreYouFeeling')}</Text>
          <Text style={styles.subtitle}>{t('entry.letAIFind')}</Text>
        </Animated.View>

        {/* Mood chip'leri */}
        <Animated.View
          entering={SlideInDown.duration(600).delay(400)}
          style={styles.chipsRow}
        >
          {MOOD_CHIPS.map((chip) => (
            <TouchableOpacity
              key={chip.mood}
              style={styles.chip}
              onPress={() => handleChipPress(chip.mood)}
              activeOpacity={0.7}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* CTA butonları */}
        <Animated.View
          entering={SlideInDown.duration(600).delay(500)}
          style={styles.ctaContainer}
        >
          <TouchableOpacity
            style={styles.primaryButtonTouch}
            onPress={handleDescribeMood}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              style={styles.primaryButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryButtonText}>{t('entry.describeMood')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleContinue} style={styles.continueLink}>
            <Text style={styles.continueLinkText}>{t('entry.continueWhere')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </LinearGradient>
  );
}
