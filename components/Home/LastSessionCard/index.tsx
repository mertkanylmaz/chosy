/**
 * LastSessionCard — Son mood session ozet karti.
 *
 * MoodContext'ten lastMoodText + lastSessionFilms okur.
 * Session yoksa (lastMoodText null) bilesen NULL doner — kart gizlenir.
 *
 * Durumlar:
 *  - Session var, 1+ film: tam gorunum (baslik + mini posterler + CTA)
 *  - Session var, 0 film: baslik + "Start swiping" CTA
 *  - Session yok: null (kart gizli)
 */

import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

// ─── Bilesen ──────────────────────────────────────────────────────────────────

/** Gosterilecek maksimum mini poster sayisi */
const MAX_VISIBLE_POSTERS = 3;

/**
 * Son mood session ozet karti.
 * lastMoodText yoksa null doner — kart tamamen gizlenir.
 */
export default function LastSessionCard() {
  const { t } = useLanguage();
  const router = useRouter();
  const { lastMoodText, lastSessionFilms } = useMood();

  // Session yoksa kart gizli
  if (!lastMoodText) return null;

  const visibleFilms = lastSessionFilms.slice(0, MAX_VISIBLE_POSTERS);
  const extraCount = lastSessionFilms.length - MAX_VISIBLE_POSTERS;

  function handlePress() {
    hapticLight();
    router.push('/(tabs)/mood');
  }

  return (
    <Animated.View
      entering={FadeInDown.delay(400).duration(400).springify()}
      style={styles.container}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.85}
        style={styles.card}
        accessibilityRole="button"
        accessibilityLabel={t('home.continueExploring')}
      >
        {/* Baslik satiri */}
        <Text style={styles.titleRow} numberOfLines={1}>
          {t('home.lastSession', { mood: lastMoodText })}
        </Text>

        {/* Film mini posterleri */}
        {visibleFilms.length > 0 ? (
          <View style={styles.postersRow}>
            {visibleFilms.map((film) => (
              <View key={film.id} style={styles.posterWrapper}>
                {film.posterUrl ? (
                  <Image
                    source={{ uri: film.posterUrl }}
                    style={styles.poster}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.posterPlaceholder}>
                    <Ionicons
                      name="film-outline"
                      size={20}
                      color={Colors.textTertiary}
                    />
                  </View>
                )}
              </View>
            ))}

            {/* +N more */}
            {extraCount > 0 && (
              <Text style={styles.extraCount}>
                {t('home.plusMore', { count: extraCount })}
              </Text>
            )}
          </View>
        ) : null}

        {/* CTA satiri */}
        <View style={styles.ctaRow}>
          <Text style={styles.ctaText}>
            {lastSessionFilms.length > 0
              ? t('home.continueExploring')
              : t('home.startSwiping')}
          </Text>
          <Ionicons
            name="arrow-forward"
            size={16}
            color={Colors.accentPrimary}
            style={{ marginLeft: Theme.spacing.xs }}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
