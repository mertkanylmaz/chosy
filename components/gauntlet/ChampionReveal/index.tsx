/**
 * ChampionReveal — şampiyon ekranı, kara boşluk sekansı. DESIGN_OS §7.3, §10.2.
 *
 * Canlı final seçiminde (`animateReveal`) 720ms'lik imza an — kısaltılmaz:
 *   BLACKOUT_SEQUENCE.blackout  (120ms KESME, tam karanlık — ink §2.2)
 *   BLACKOUT_SEQUENCE.pause     (400ms nefes, hiçbir şey yok)
 *   → poster opaklık ile belirir (Geçiş)
 *   BLACKOUT_SEQUENCE.titleDelay (200ms sonra başlık, Archivo Expanded —
 *                                 bu ekrandaki TEK kullanım, display-xl)
 *   BLACKOUT_SEQUENCE.metaDelay  (200ms sonra meta, Martian Mono)
 *
 * Reduce Motion (§7.5): geçişler REDUCED_MOTION_DURATION.crossFade (100ms),
 * kara boşluk SÜRELERİ aynen korunur — hareket değil zamanlama.
 *
 * Resume yolunda (`animateReveal: false`) sekans atlanır, doğrudan gösterilir.
 *
 * Şampiyon watchlist'e OTOMATİK YAZILMAZ (PRODUCT_OS §3.7) — `onDismiss`
 * yalnızca ekranı kapatır, hiçbir yazma eylemi tetiklemez. "Sonraya bırak"
 * Faz D kapsamı.
 *
 * ⚠️ 14.08.2026 cihaz testinde bulundu: bu bileşende çıkış eylemi hiç
 * YOKTU — kullanıcı şampiyon ekranında sıkışıyordu (kök neden: plan
 * boşluğu, GauntletShell'in oyun içi olaylar tablosu completed_today→
 * champion dalına hiçbir eylem bağlamamıştı). `onDismiss` bu turda eklendi.
 */
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';

import { Image } from 'expo-image';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BLACKOUT_SEQUENCE,
  DISSOLVE_DURATION,
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
} from '@/constants/design/motion';
import type { GauntletFilm } from '@/types/gauntlet';

import { styles } from './styles';

interface ChampionRevealProps {
  champion: GauntletFilm;
  /** true: canlı final geçişi (kara boşluk sekansı); false: resume, doğrudan göster */
  animateReveal: boolean;
  /** Ekranı kapatır — YAZMA eylemi DEĞİL (§3.7). Yoksa çıkış kontrolü gösterilmez. */
  onDismiss?: () => void;
}

export function ChampionReveal({
  champion,
  animateReveal,
  onDismiss,
}: ChampionRevealProps): React.JSX.Element {
  const { t } = useLanguage();
  const isReducedMotion = useReducedMotion();

  const posterOpacity = useSharedValue(animateReveal ? 0 : 1);
  const titleOpacity = useSharedValue(animateReveal ? 0 : 1);
  const metaOpacity = useSharedValue(animateReveal ? 0 : 1);

  useEffect(() => {
    if (!animateReveal) return;

    // Kara boşluk zamanlaması Reduce Motion'da DEĞİŞMEZ (§7.5) — yalnızca
    // belirme süreleri cross-fade'e iner.
    const fadeDuration = isReducedMotion
      ? REDUCED_MOTION_DURATION.crossFade
      : DISSOLVE_DURATION.newContender;
    const fade = { duration: fadeDuration, easing: EASE_OUT_QUART };

    const posterAt = BLACKOUT_SEQUENCE.blackout + BLACKOUT_SEQUENCE.pause;
    const titleAt = posterAt + BLACKOUT_SEQUENCE.titleDelay;
    const metaAt = titleAt + BLACKOUT_SEQUENCE.metaDelay;

    posterOpacity.value = withDelay(posterAt, withTiming(1, fade));
    titleOpacity.value = withDelay(titleAt, withTiming(1, fade));
    metaOpacity.value = withDelay(metaAt, withTiming(1, fade));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateReveal, isReducedMotion]);

  const posterStyle = useAnimatedStyle(() => ({ opacity: posterOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaOpacity.value }));

  return (
    <View
      style={styles.container}
      accessibilityLabel={t('gauntlet.championAccessibilityLabel', {
        title: champion.title,
        year: champion.year,
        runtime: champion.runtime,
      })}
    >
      <Animated.View style={[styles.posterWrapper, posterStyle]}>
        <Image
          source={{ uri: champion.posterUrl }}
          style={styles.poster}
          contentFit="cover"
        />
      </Animated.View>

      <Animated.View style={titleStyle}>
        <Text style={styles.kicker}>{t('gauntlet.championTitle')}</Text>
        <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
          {champion.title}
        </Text>
      </Animated.View>

      <Animated.Text style={[styles.metaLine, metaStyle]} numberOfLines={1}>
        {t('gauntlet.posterMeta', { year: champion.year, runtime: champion.runtime })}
      </Animated.Text>

      {onDismiss && (
        <Animated.View style={[styles.dismissWrapper, metaStyle]}>
          <QuietAction label={t('gauntlet.close')} onPress={onDismiss} />
        </Animated.View>
      )}
    </View>
  );
}
