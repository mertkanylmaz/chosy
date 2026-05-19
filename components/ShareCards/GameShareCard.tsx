/**
 * GameShareCard — Oyun sonucu paylasim template'i (1080x1350 PNG).
 *
 * Oyun adi + emoji grid + film bilgisi + streak.
 * Chosy.ai branding.
 */
import React, { forwardRef } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { i18n } from '@/constants/i18n';

import { CARD_WIDTH, CARD_HEIGHT } from './styles';

export interface GameShareCardProps {
  /** Oyun adi (orn: "Imposter") */
  gameTitle: string;
  /** Bildi mi */
  solved: boolean;
  /** Kac denemede */
  attempts: number;
  /** Maks deneme */
  maxAttempts: number;
  /** Film adi */
  filmTitle: string;
  /** Film yili */
  filmYear: number;
  /** Streak */
  streak: number;
  /** Oyun tipi (emoji grid icin) */
  gameType: 'imposter' | 'logline' | 'quoted' | 'fadein';
}

/** Emoji grid olustur — oyun tipine gore */
function buildEmojiGrid(
  gameType: string,
  solved: boolean,
  attempts: number,
  maxAttempts: number,
): string {
  switch (gameType) {
    case 'imposter':
      return solved ? '\u{1F7E2}' : '\u{1F534}';
    case 'logline': {
      const squares: string[] = [];
      for (let i = 0; i < maxAttempts; i++) {
        if (i < attempts - 1) {
          squares.push('\u{1F534}'); // yanlis tahminler
        } else if (i === attempts - 1 && solved) {
          squares.push('\u{1F7E2}'); // dogru tahmin
        } else if (i === attempts - 1 && !solved) {
          squares.push('\u{1F534}'); // son yanlis
        } else {
          squares.push('\u{26AB}'); // kullanilmadi
        }
      }
      return squares.join('');
    }
    case 'quoted': {
      const dots: string[] = [];
      for (let i = 0; i < maxAttempts; i++) {
        if (i < attempts - 1) {
          dots.push('\u{1F534}');
        } else if (i === attempts - 1 && solved) {
          dots.push('\u{1F7E2}');
        } else if (i === attempts - 1 && !solved) {
          dots.push('\u{1F534}');
        } else {
          dots.push('\u{26AB}');
        }
      }
      return dots.join('');
    }
    default:
      return solved ? '\u{2705}' : '\u{274C}';
  }
}

const GameShareCard = forwardRef<View, GameShareCardProps>(
  function GameShareCard(
    { gameTitle, solved, attempts, maxAttempts, filmTitle, filmYear, streak, gameType },
    ref,
  ) {
    const emojiGrid = buildEmojiGrid(gameType, solved, attempts, maxAttempts);

    return (
      <View ref={ref} style={cardStyles.card} collapsable={false}>
        <LinearGradient
          colors={[Colors.bgElevated, Colors.background]}
          style={cardStyles.gradient}
        />

        {/* Oyun adi */}
        <Text style={cardStyles.gameLabel}>{gameTitle.toUpperCase()}</Text>

        {/* Sonuc emoji */}
        <Text style={cardStyles.resultEmoji}>{solved ? '\u{1F3AC}' : '\u{1F61E}'}</Text>

        {/* Emoji grid */}
        <Text style={cardStyles.emojiGrid}>{emojiGrid}</Text>

        {/* Skor */}
        <Text style={cardStyles.scoreText}>
          {solved ? `${attempts}/${maxAttempts}` : `X/${maxAttempts}`}
        </Text>

        {/* Film bilgisi */}
        <View style={cardStyles.filmBlock}>
          <Text style={cardStyles.filmTitle} numberOfLines={2}>
            {filmTitle}
          </Text>
          <Text style={cardStyles.filmYear}>{filmYear}</Text>
        </View>

        {/* Streak */}
        {streak > 0 && (
          <Text style={cardStyles.streak}>
            {`\u{1F525} ${streak} ${i18n.t('games.result.streak', { count: streak })}`}
          </Text>
        )}

        {/* Branding */}
        <View style={cardStyles.branding}>
          <Text style={cardStyles.brandText}>Chosy.ai</Text>
          <Text style={cardStyles.tagline}>{i18n.t('share.tagline')}</Text>
        </View>
      </View>
    );
  },
);

export default GameShareCard;

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: Colors.background,
    borderRadius: Theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Theme.borderRadius.xl,
  },
  gameLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textTertiary,
    letterSpacing: 2,
    marginBottom: Theme.spacing.md,
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: Theme.spacing.md,
  },
  emojiGrid: {
    fontSize: 28,
    letterSpacing: 4,
    marginBottom: Theme.spacing.md,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Theme.spacing.lg,
  },
  filmBlock: {
    alignItems: 'center',
    gap: 4,
    marginBottom: Theme.spacing.md,
  },
  filmTitle: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  filmYear: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  streak: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.gold,
    marginBottom: Theme.spacing.md,
  },
  branding: {
    position: 'absolute',
    bottom: Theme.spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  brandText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.accentPrimary,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 6,
  },
});
