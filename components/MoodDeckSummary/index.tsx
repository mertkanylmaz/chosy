/**
 * MoodDeckSummary — Mood deck swipe ozet ekrani.
 *
 * 8 filmlik deste bittikten sonra gosterilir:
 *   - Begeni istatistikleri (liked / disliked)
 *   - Hero kart: en yuksek matchScore'lu begenilen film (veya en iyi genel)
 *   - Begenilen filmlerin mini poster strip'i
 *   - "Yeni Mood Ara" + "Watchlist'e Git" aksiyon butonlari
 *   - insufficient_results notu (< 8 film geldiyse)
 */
import React, { useEffect } from 'react';
import { FlatList, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Ionicons } from '@expo/vector-icons';
import { hapticSuccess } from '@/utils/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import { Film } from '@/types/film';

import styles from './styles';

// ── Props ─────────────────────────────────────────────────────────────────────

interface MoodDeckSummaryProps {
  /** Begenilen filmler (swiped right, watchlist'e eklendi) */
  likedFilms: Film[];
  /** Begenilmeyen filmler (swiped left) */
  dislikedFilms: Film[];
  /** Deste boyutu (genelde 8, insufficient ise daha az) */
  deckSize: number;
  /** Backend 8'den az film dondurduyse */
  insufficientResults?: boolean;
  /** "Yeni Mood Ara" butonu */
  onNewMood: () => void;
  /** "Watchlist'e Git" butonu */
  onGoWatchlist: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

/** Mood deck tamamlandiktan sonra gosterilen ozet ekrani */
export default function MoodDeckSummary({
  likedFilms,
  dislikedFilms,
  deckSize,
  insufficientResults,
  onNewMood,
  onGoWatchlist,
}: MoodDeckSummaryProps) {
  const { t } = useLanguage();

  // Haptic + analytics on mount
  useEffect(() => {
    hapticSuccess();
    posthogAnalytics.track('mood_deck_completed', {
      liked_count: likedFilms.length,
      disliked_count: dislikedFilms.length,
      deck_size: deckSize,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Hero: en yuksek matchScore'lu begenilen film, yoksa genel en iyi
  const allFilms = [...likedFilms, ...dislikedFilms];
  const heroFilm = likedFilms.length > 0
    ? likedFilms.reduce((best, f) => (f.matchScore > best.matchScore ? f : best), likedFilms[0])
    : allFilms.length > 0
      ? allFilms.reduce((best, f) => (f.matchScore > best.matchScore ? f : best), allFilms[0])
      : null;

  const hasLiked = likedFilms.length > 0;

  // ── Render helpers ────────────────────────────────────────────────────────

  const handleNewMood = () => {
    posthogAnalytics.track('mood_deck_summary_action', { action: 'new_mood' });
    onNewMood();
  };

  const handleGoWatchlist = () => {
    posthogAnalytics.track('mood_deck_summary_action', { action: 'watchlist' });
    onGoWatchlist();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(100).springify()}>
        <Text style={styles.headerEmoji}>{hasLiked ? '\uD83C\uDFAC' : '\uD83E\uDD14'}</Text>
        <Text style={styles.title}>
          {hasLiked
            ? t('deckSummary.title', { count: likedFilms.length })
            : t('deckSummary.noLikesTitle')}
        </Text>
        <Text style={styles.subtitle}>
          {hasLiked
            ? t('deckSummary.subtitle')
            : t('deckSummary.noLikesSubtitle')}
        </Text>
      </Animated.View>

      {/* Stats */}
      <Animated.View entering={FadeInDown.delay(200).springify()} style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, styles.statNumberLiked]}>{likedFilms.length}</Text>
          <Text style={styles.statLabel}>{t('deckSummary.liked')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{dislikedFilms.length}</Text>
          <Text style={styles.statLabel}>{t('deckSummary.passed')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{deckSize}</Text>
          <Text style={styles.statLabel}>{t('deckSummary.total')}</Text>
        </View>
      </Animated.View>

      {/* Hero recommendation */}
      {heroFilm && (
        <Animated.View entering={FadeInDown.delay(300).springify()}>
          <View style={styles.heroCard}>
            <Image
              source={{ uri: heroFilm.posterUrl }}
              style={styles.heroPoster}
              contentFit="cover"
              transition={200}
            />
            <View style={styles.heroInfo}>
              <Text style={styles.heroBadge}>
                {hasLiked ? t('deckSummary.tonightsPick') : t('deckSummary.topMatch')}
              </Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{heroFilm.title}</Text>
              <Text style={styles.heroYear}>{heroFilm.year}</Text>
              {heroFilm.matchScore > 0 && (
                <View style={styles.heroMatchBadge}>
                  <Ionicons name="sparkles" size={14} color="#E8A838" />
                  <Text style={styles.heroMatchText}>{heroFilm.matchScore}% match</Text>
                </View>
              )}
            </View>
          </View>
        </Animated.View>
      )}

      {/* Liked films poster strip */}
      {likedFilms.length > 1 && (
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Text style={styles.sectionLabel}>{t('deckSummary.addedToWatchlist')}</Text>
          <FlatList
            data={likedFilms}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            style={styles.posterStrip}
            contentContainerStyle={styles.posterStripContent}
            renderItem={({ item }) => (
              <View style={styles.posterCard}>
                <Image
                  source={{ uri: item.posterUrl }}
                  style={styles.posterImage}
                  contentFit="cover"
                  transition={150}
                />
                <Text style={styles.posterTitle} numberOfLines={1}>{item.title}</Text>
              </View>
            )}
          />
        </Animated.View>
      )}

      {/* Insufficient results note */}
      {insufficientResults && (
        <Animated.View entering={FadeInDown.delay(450).springify()}>
          <Text style={styles.insufficientNote}>{t('deckSummary.insufficientNote')}</Text>
        </Animated.View>
      )}

      {/* Action buttons */}
      <Animated.View entering={FadeInDown.delay(500).springify()} style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleNewMood}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>{t('deckSummary.newMood')}</Text>
        </TouchableOpacity>

        {hasLiked && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleGoWatchlist}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryBtnText}>{t('deckSummary.goWatchlist')}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </ScrollView>
  );
}
