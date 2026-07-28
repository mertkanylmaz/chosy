/**
 * GameShareCard — Oyun sonucu paylasim template'i (1080x1350 PNG).
 *
 * Oyun adi + emoji grid + skor + streak + bulmaca no.
 *
 * HARD RULE 9: Kartta film adi, yili veya afisi ASLA yer almaz. Paylasim
 * spoiler icermez — sirri koruma zorunlulugu viral mekanigin kendisidir.
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
  /** Streak */
  streak: number;
  /** Oyun tipi (emoji grid icin) */
  gameType: 'imposter' | 'logline' | 'quoted' | 'fadein' | 'cinemetrics' | 'spotlight' | 'detective';
  /** Gunun bulmaca numarasi — kimlik icin (film adi YERINE) */
  puzzleNo?: number;
}

/** Emoji grid olustur — oyun tipine gore */
function buildEmojiGrid(
  gameType: string,
  solved: boolean,
  attempts: number,
  maxAttempts: number,
): string {
  // Imposter 3 round uzerinden oynanir — tek sonuc rozeti daha okunakli
  if (gameType === 'imposter') {
    return solved ? '\u{1F7E2}' : '\u{1F534}';
  }

  // Deneme tabanli oyunlar (logline, quoted, fadein, cinemetrics, spotlight,
  // detective): her deneme bir kare
  const cells: string[] = [];
  for (let i = 0; i < maxAttempts; i++) {
    if (i < attempts - 1) {
      cells.push('\u{1F534}'); // yanlis tahminler
    } else if (i === attempts - 1) {
      cells.push(solved ? '\u{1F7E2}' : '\u{1F534}'); // son tahmin
    } else {
      cells.push('\u{26AB}'); // kullanilmadi
    }
  }
  return cells.join('');
}

const GameShareCard = forwardRef<View, GameShareCardProps>(
  function GameShareCard(
    { gameTitle, solved, attempts, maxAttempts, streak, gameType, puzzleNo },
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

        {/* Bulmaca kimligi — film adi ASLA yazilmaz (Hard Rule 9) */}
        {puzzleNo != null && puzzleNo > 0 && (
          <Text style={cardStyles.puzzleNo}>{`#${puzzleNo}`}</Text>
        )}

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
  puzzleNo: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Theme.spacing.md,
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
