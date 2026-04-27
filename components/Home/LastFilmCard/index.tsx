/**
 * LastFilmCard — Watchlist'e en son eklenen filmi gösteren kart.
 *
 * Film varsa: poster küçük resim + başlık + yıl + puan + eklenme tarihi
 * Film yoksa: keşfetmeye davet eden boş durum
 *
 * CDO polish: poster shadow, rating PlayfairDisplay, kart depth uygulandı.
 */

import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import type { WatchlistItem } from '@/services/watchlist';
import { styles } from './styles';

// ─── Prop Tipi ────────────────────────────────────────────────────────────────

export interface LastFilmCardProps {
  /** En son eklenen watchlist öğesi — null ise boş durum gösterilir */
  film: WatchlistItem | null;
}

// ─── Yardımcı ─────────────────────────────────────────────────────────────────

/**
 * ISO tarihten "kaç gün önce" etiketini hesaplar.
 * t() yardımcısını parametre olarak alır — hook içinde çağrılamaz.
 */
function formatDaysAgo(
  isoDate: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days === 0) return t('home.addedToday');
  if (days === 1) return t('home.addedYesterday');
  return t('home.addedDaysAgo', { days });
}

// ─── Bileşen ──────────────────────────────────────────────────────────────────

/**
 * Son eklenen film kartı.
 */
export default function LastFilmCard({ film }: LastFilmCardProps) {
  const { t } = useLanguage();
  const router = useRouter();

  return (
    <Animated.View
      entering={FadeInDown.delay(250).duration(400).springify().damping(18)}
      style={styles.wrapper}
    >
      <Text style={styles.sectionLabel}>{t('home.lastAdded')}</Text>

      {film ? (
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push(`/film/${film.film.id}`)}
          activeOpacity={0.8}
        >
          {/* ── Poster ────────────────────────────────────────────────── */}
          {film.film.posterUrl ? (
            <Image
              source={{ uri: film.film.posterUrl }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="film-outline" size={28} color={Colors.textGrey} />
            </View>
          )}

          {/* ── Film Bilgisi ───────────────────────────────────────────── */}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={2}>
              {film.film.title}
            </Text>
            <View style={styles.metaRow}>
              {film.film.year > 0 && (
                <Text style={styles.meta}>{film.film.year}</Text>
              )}
              {film.film.voteAverage != null && film.film.voteAverage > 0 && (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  <Ionicons name="star" size={11} color={Colors.gold} />
                  <Text style={styles.rating}>
                    {film.film.voteAverage.toFixed(1)}
                  </Text>
                </>
              )}
            </View>
            <Text style={styles.addedAt}>
              {formatDaysAgo(film.addedAt, t)}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={Colors.textGrey} />
        </TouchableOpacity>
      ) : (
        /* ── Boş Durum ──────────────────────────────────────────────── */
        <View style={styles.emptyCard}>
          <Ionicons name="film-outline" size={28} color={Colors.textGrey} />
          <View style={styles.emptyText}>
            <Text style={styles.emptyTitle}>{t('home.noLastFilm')}</Text>
            <Text style={styles.emptyHint}>{t('home.noLastFilmHint')}</Text>
          </View>
        </View>
      )}
    </Animated.View>
  );
}
