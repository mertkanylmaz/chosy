/**
 * DailyThemeCard — Günün gizli bağlantısı (tema) kartı.
 *
 * Kilitliyken yalnızca "???" ve ilerleme sayacı gösterir; tema etiketi
 * sunucudan GELMEZ (Hard Rule 1 — etiket oynanmamış bulmaca için ipucudur).
 * Temalı oyunların hepsi tamamlanınca bağlantı ve film şeridi açılır.
 */
import React, { useCallback, useState } from 'react';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinkSimple, Lock } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { getDailyTheme } from '@/services/gameApi';
import { trackThemeRevealed, trackThemeTeaserViewed } from '@/utils/gameAnalytics';
import { logger } from '@/utils/logger';
import type { DailyThemeState } from '@/types/game';

import { styles } from './styles';

/**
 * Günün temasını yükler ve kilitli/açık duruma göre kart çizer.
 * Tema yoksa (state='none') hiçbir şey render edilmez.
 */
export function DailyThemeCard(): React.JSX.Element | null {
  const { t } = useLanguage();
  const [theme, setTheme] = useState<DailyThemeState | null>(null);
  const [error, setError] = useState(false);

  const loadTheme = useCallback(async () => {
    try {
      setError(false);
      const puzzleDate = new Date().toLocaleDateString('en-CA');
      const data = await getDailyTheme(puzzleDate);
      setTheme(data);

      if (data.state === 'unlocked') {
        trackThemeRevealed(data.theme_type, data.films.length);
      } else if (data.state === 'locked') {
        trackThemeTeaserViewed(data.completed, data.total);
      }
    } catch (err) {
      // Hard Rule 5: sessiz fallback yok — kullanıcıya görünür hata + retry
      logger.error('[DailyThemeCard] Tema yüklenemedi:', err);
      setError(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTheme();
    }, [loadTheme]),
  );

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>{t('games.theme.error')}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadTheme} activeOpacity={0.7} accessibilityRole="button" >
            <Text style={styles.retryText}>{t('games.theme.retry')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!theme || theme.state === 'none') return null;

  if (theme.state === 'locked') {
    return (
      <Animated.View entering={FadeInUp.duration(300)} style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Lock size={20} color={Colors.textSecondary} weight="duotone" />
            <Text style={styles.titleLocked}>???</Text>
          </View>
          <Text style={styles.progressText}>
            {theme.completed}/{theme.total}
          </Text>
        </View>
        <Text style={styles.subtitle}>{t('games.theme.locked_subtitle')}</Text>
        <View style={styles.dotsRow}>
          {Array.from({ length: theme.total }).map((_, i) => (
            <View key={i} style={[styles.dot, i < theme.completed && styles.dotFilled]} />
          ))}
        </View>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(400)}
      style={[styles.container, styles.containerUnlocked]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <LinkSimple size={20} color={Colors.gold} weight="duotone" />
          <Text style={styles.title}>{t('games.theme.unlocked_title')}</Text>
        </View>
        <Text style={[styles.progressText, styles.progressTextUnlocked]}>
          {theme.completed}/{theme.total}
        </Text>
      </View>

      <Text style={styles.themeLabel}>{theme.theme_label}</Text>
      <Text style={styles.subtitle}>{t(`games.theme.type_${theme.theme_type}`)}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filmStrip}
      >
        {theme.films.map((film, index) => (
          <Animated.View
            key={`${film.game_id}-${film.title}`}
            entering={FadeInUp.delay(200 + index * 100).duration(300)}
            style={styles.filmCard}
          >
            {film.poster_url ? (
              <Image source={{ uri: film.poster_url }} style={styles.poster} resizeMode="cover" />
            ) : (
              <View style={styles.poster} />
            )}
            <Text style={styles.filmTitle} numberOfLines={2}>
              {film.title}
            </Text>
            <Text style={styles.filmGame}>{t(`games.${film.game_id}.title`)}</Text>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}
