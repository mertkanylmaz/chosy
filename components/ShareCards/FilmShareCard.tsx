/**
 * FilmShareCard — Tek film paylasim template'i (1080x1350 PNG).
 *
 * Offscreen render edilir, useShareCapture ile capture edilir.
 * Film posteri + baslik + meta + mood metni + branding.
 *
 * Spec: .claude/specs/SOCIAL_SHARE_SPEC.md — Component 1
 */
import React from 'react';
import { Image, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@/constants/Colors';
import { i18n } from '@/constants/i18n';
import { localizeGenre } from '@/utils/filmFilters';

import { styles, CARD_HEIGHT } from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface FilmShareCardProps {
  /** Film bilgileri */
  film: {
    title: string;
    year: number | null;
    genres: string[];
    voteAverage: number | null;
    posterUrl: string | null;
  };
  /** Kullanicinin mood metni (opsiyonel) */
  moodText?: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

const FilmShareCard = React.forwardRef<View, FilmShareCardProps>(
  ({ film, moodText }, ref) => {
    // Meta satiri: "1994 · Drama · ★ 9.3"
    const metaParts: string[] = [];
    if (film.year) metaParts.push(String(film.year));
    if (film.genres.length > 0) metaParts.push(localizeGenre(film.genres[0], i18n.locale));
    if (film.voteAverage != null) metaParts.push(`\u2605 ${film.voteAverage.toFixed(1)}`);
    const metaText = metaParts.join(' \u00B7 ');

    return (
      <View style={styles.offscreen}>
        <View ref={ref} style={styles.filmCard} collapsable={false}>
          {/* Poster blur arka plan efekti */}
          {film.posterUrl && (
            <>
              <Image
                source={{ uri: film.posterUrl }}
                style={styles.posterBlurBg}
                blurRadius={25}
                resizeMode="cover"
              />
              <LinearGradient
                colors={[
                  Colors.cardGradientTop,
                  Colors.cardGradientBottom,
                  Colors.background,
                ]}
                style={styles.posterGradient}
              />
            </>
          )}

          {/* Poster */}
          {film.posterUrl ? (
            <Image
              source={{ uri: film.posterUrl }}
              style={styles.poster}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Text style={styles.posterPlaceholderEmoji}>{'\u{1F3AC}'}</Text>
            </View>
          )}

          {/* Baslik */}
          <Text style={styles.filmTitle} numberOfLines={2}>
            {film.title}
          </Text>

          {/* Meta */}
          {metaText.length > 0 && (
            <Text style={styles.filmMeta}>{metaText}</Text>
          )}

          {/* Mood bolumu */}
          {moodText && (
            <>
              <View style={styles.divider} />
              <View style={styles.moodQuote}>
                <Text style={styles.quoteOpen}>{'\u201C'}</Text>
                <Text style={styles.moodText} numberOfLines={3}>
                  {moodText}
                </Text>
                <Text style={styles.quoteClose}>{'\u201D'}</Text>
              </View>
            </>
          )}

          {/* Branding */}
          <View style={styles.branding}>
            <Text style={styles.brandText}>{i18n.t('share.brand')}</Text>
            <Text style={styles.tagline}>{i18n.t('share.tagline')}</Text>
          </View>
        </View>
      </View>
    );
  },
);

FilmShareCard.displayName = 'FilmShareCard';

export default FilmShareCard;
