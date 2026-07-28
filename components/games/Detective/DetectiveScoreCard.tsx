/**
 * DetectiveScoreCard — Oyun sonu skor özet kartı.
 *
 * Animasyonlu count-up ile büyük skor sayısı (0 → score, 1.5s),
 * üç satır özet (Tahmin, Süre, İpucu), isteğe bağlı "Lucky Spot!" rozeti.
 */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import {
  Crosshair,
  Timer,
  Lightbulb,
  Star,
} from 'phosphor-react-native';
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { styles } from './styles';

// ─── Teal accent ─────────────────────────────────────────────────────────────
const TEAL = Colors.tealDeep;

// ─── Types ───────────────────────────────────────────────────────────────────

interface DetectiveScoreCardProps {
  /** Toplam kazanılan puan (0–1000) */
  score: number;
  /** Toplam tahmin sayısı */
  totalGuesses: number;
  /** Kullanılan ipucu sayısı */
  hintsUsed: number;
  /** Geçen süre (saniye cinsinden) */
  timeSeconds: number;
  /** Oyun kazanıldı mı? */
  won: boolean;
  /** Şanslı spot rozeti gösterilsin mi? */
  luckySpot: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Saniyeyi mm:ss formatına çevirir */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ─── Animated Score Number ────────────────────────────────────────────────────

interface AnimatedScoreProps {
  /** Hedef skor değeri */
  target: number;
}

/**
 * AnimatedScore — 0'dan hedef değere 1.5 saniyede count-up yapan sayı.
 */
function AnimatedScore({ target }: AnimatedScoreProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(target, {
      duration: 1500,
      easing: Easing.out(Easing.cubic),
    });
  }, [target, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    // Reanimated'da derived text için useAnimatedProps gerekir;
    // burada JS side update yöntemi yerine animatedProps pattern kullanılır.
    // Ancak Text animasyonu için basit interpolation tercih edilir:
    opacity: 1,
  }));

  // Not: Reanimated v3'te animasyonlu sayı için useAnimatedProps + TextInput
  // pattern önerilir; ancak yalın Text ile de çalışabilmek adına
  // withTiming değeri JavaScript side'da takip edilerek setState ile beslenir.
  const [displayed, setDisplayed] = React.useState(0);

  useEffect(() => {
    let start: number | null = null;
    const duration = 1500;

    const step = (timestamp: number) => {
      if (start === null) start = timestamp;
      const elapsed = timestamp - start;
      const fraction = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - fraction, 3);
      setDisplayed(Math.round(eased * target));
      if (fraction < 1) requestAnimationFrame(step);
    };

    const handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [target]);

  return (
    <Animated.View style={animatedStyle}>
      <Text style={styles.scoreCardBigScore}>{displayed}</Text>
    </Animated.View>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * DetectiveScoreCard — Oyun sonucu skor dökümü kartı.
 */
export function DetectiveScoreCard({
  score,
  totalGuesses,
  hintsUsed,
  timeSeconds,
  won,
  luckySpot,
}: DetectiveScoreCardProps) {
  const { t } = useLanguage();

  return (
    <Animated.View entering={FadeInUp.duration(400)} style={styles.scoreCardContainer}>
      {/* Büyük skor ve /1000 etiketi */}
      <View style={styles.scoreCardScoreRow}>
        <AnimatedScore target={score} />
        <Text style={styles.scoreCardOutOf}>{t('games.detective.score_label')}</Text>
      </View>

      {/* Lucky Spot rozeti */}
      {luckySpot && (
        <Animated.View
          entering={FadeInUp.delay(200).duration(300)}
          style={styles.scoreCardLuckyBadge}
        >
          <Star size={14} color={Colors.gold} weight="duotone" />
          <Text style={styles.scoreCardLuckyText}>
            {t('games.detective.lucky_spot')}
          </Text>
        </Animated.View>
      )}

      {/* Özet satırları */}
      <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.scoreCardBreakdown}>
        {/* Tahminler */}
        <View style={styles.scoreCardRow}>
          <Crosshair size={16} color={TEAL} weight="duotone" />
          <Text style={styles.scoreCardRowLabel}>{t('games.detective.guesses_label')}</Text>
          <Text style={styles.scoreCardRowValue}>{totalGuesses}</Text>
        </View>

        {/* Süre */}
        <View style={styles.scoreCardRow}>
          <Timer size={16} color={TEAL} weight="duotone" />
          <Text style={styles.scoreCardRowLabel}>{t('games.detective.time_label')}</Text>
          <Text style={styles.scoreCardRowValue}>{formatTime(timeSeconds)}</Text>
        </View>

        {/* İpuçları */}
        <View style={styles.scoreCardRow}>
          <Lightbulb size={16} color={TEAL} weight="duotone" />
          <Text style={styles.scoreCardRowLabel}>{t('games.detective.hints_label')}</Text>
          <Text style={styles.scoreCardRowValue}>{hintsUsed}</Text>
        </View>
      </Animated.View>

      {/* Sonuç mesajı */}
      <Animated.Text
        entering={FadeInUp.delay(500).duration(300)}
        style={[
          styles.scoreCardResultText,
          won ? styles.scoreCardResultWon : styles.scoreCardResultLost,
        ]}
      >
        {won
          ? t('games.detective.result_solved')
          : t('games.detective.result_cold')}
      </Animated.Text>
    </Animated.View>
  );
}
