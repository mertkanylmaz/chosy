/**
 * FilmDiscoveryBridge — Oyun-film gecis koprusu.
 *
 * Oyun sonunda cozum filmini kesfetmeye tesvik eder:
 * izlenme orani, "Bu Aksam Izle", "Listeye Ekle", "Yorumlari Gor".
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Play, BookmarkSimple, ChatCircle } from 'phosphor-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import { styles, TEAL } from './styles';

interface FilmDiscoveryBridgeProps {
  /** Cozum filminin adi */
  filmTitle: string;
  /** Izlenme yuzdesi (opsiyonel) */
  watchedPercent?: number;
  /** "Bu Aksam Izle" butonuna basildiginda */
  onWatch: () => void;
  /** "Listeye Ekle" butonuna basildiginda */
  onWatchlist: () => void;
  /** "Yorumlari Gor" butonuna basildiginda */
  onReviews: () => void;
}

/**
 * FilmDiscoveryBridge — Cozum filmine yonlendiren kesif karti.
 */
export function FilmDiscoveryBridge({
  filmTitle,
  watchedPercent,
  onWatch,
  onWatchlist,
  onReviews,
}: FilmDiscoveryBridgeProps) {
  const { t } = useLanguage();

  return (
    <Animated.View entering={FadeInUp.delay(800).duration(400)} style={styles.bridgeContainer}>
      {/* Watched percentage */}
      {watchedPercent != null && watchedPercent > 0 && (
        <Text style={styles.bridgeWatchedText}>
          {t('games.detective.film_bridge_watched', { percent: String(watchedPercent) })}
        </Text>
      )}

      {/* Action buttons */}
      <View style={styles.bridgeActions}>
        <TouchableOpacity style={styles.bridgeActionButton} onPress={onWatch} activeOpacity={0.7} accessibilityRole="button" >
          <Play size={16} color={TEAL} weight="duotone" />
          <Text style={styles.bridgeActionText}>
            {t('games.detective.film_bridge_watch')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bridgeSecondaryButton} onPress={onWatchlist} activeOpacity={0.7} accessibilityRole="button" >
          <BookmarkSimple size={16} color="#9CA3AF" weight="duotone" />
          <Text style={styles.bridgeSecondaryText}>
            {t('games.detective.film_bridge_watchlist')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.bridgeSecondaryButton} onPress={onReviews} activeOpacity={0.7} accessibilityRole="button" >
          <ChatCircle size={16} color="#9CA3AF" weight="duotone" />
          <Text style={styles.bridgeSecondaryText}>
            {t('games.detective.film_bridge_reviews')}
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
