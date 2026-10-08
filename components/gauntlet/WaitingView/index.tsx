/**
 * WaitingView — bekleyiş ekranının (before_18) SAF görünümü.
 *
 * Kendi başına ağ çağrısı, analytics, state machine bilgisi ya da saat
 * mantığı taşımaz: ne gösterileceği ve her parçanın davranışı (geri sayım,
 * bildirim CTA'sı, Spotlight teaser'ı, son şampiyon) GauntletShell'de
 * kurulur ve slot olarak gelir. Burası yalnız düzen.
 *
 * Sıra (tüm boyutlarda aynı; yalnız ölçüler kısa ekranda küçülür):
 *   1. Başlık bloğu — eyebrow + mevcut `gauntlet.before18` metni, geri sayım,
 *      (koşullu) bildirim CTA'sı
 *   2. Dört dekoratif çerçeve + tagline; yalnız kompozisyon (a)'da bir satır
 *   3. Spotlight teaser (varsa)
 *   4. Last Pick (yalnız kompozisyon (b))
 * Bölümler arasında `graphite` hairline; yalnız çizilen bölümler arasında.
 *
 * Kompozisyon: `championSection` var → (b), yok → (a). `useLastChampion`
 * yükleme ile "şampiyon yok"u ayırt etmez (ikisi de null) — (b) kullanıcısında
 * (a) satırı bir an görünüp kalkabilir (bkz. W0-delta, risk 3).
 *
 * K-46: arşiv, Pro Mode ve keşif rotası YOK. İçerik KAYDIRILABİLİR — AX5 ve
 * küçük ekranda taşma kesilmesin.
 */
import React from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';

import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { DISSOLVE_DURATION } from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';

import { DecorativeFrames } from './DecorativeFrames';
import { MONO_MAX_FONT_SCALE, isWaitingCompact, styles } from './styles';

export interface WaitingViewProps {
  /** Kapı saati, arayüz diline göre biçimli ("6:00 PM" / "18:00"). */
  unlockTimeLabel: string;
  /** GauntletShell'deki `<UnlockCountdown onElapsed={runClockPulse} />`. */
  countdown?: React.ReactNode;
  /** Bildirim CTA'sı — koşul (izin + ≥1 şampiyon) GauntletShell'de. */
  notifyAction?: React.ReactNode;
  /** `showTeaser` ise `<SpotlightTeaser />`. */
  teaser?: React.ReactNode;
  /** Son şampiyon varsa `<WaitingChampionCard />`. */
  championSection?: React.ReactNode;
}

function Separator(): React.JSX.Element {
  return <View style={styles.separator} />;
}

export function WaitingView({
  unlockTimeLabel,
  countdown,
  notifyAction,
  teaser,
  championSection,
}: WaitingViewProps): React.JSX.Element {
  const { t } = useLanguage();
  const { height } = useWindowDimensions();
  const isReducedMotion = useReducedMotion();
  const compact = isWaitingCompact(height);

  const eyebrow = t('gauntlet.waitingEyebrow');
  const title = t('gauntlet.before18', { time: unlockTimeLabel });
  const hasChampion = Boolean(championSection);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={false}
    >
      {/* 1 — Başlık bloğu. VoiceOver: eyebrow + ana satır tek öğe → geri sayım → CTA. */}
      <View style={styles.section}>
        <View
          style={styles.section}
          accessible
          accessibilityLabel={`${eyebrow}. ${title}`}
        >
          <View style={styles.eyebrowRow}>
            <View style={styles.eyebrowLine} />
            <Text style={styles.eyebrow} maxFontSizeMultiplier={MONO_MAX_FONT_SCALE}>
              {eyebrow}
            </Text>
            <View style={styles.eyebrowLine} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        {countdown}
        {notifyAction}
      </View>

      <Separator />

      {/* 2 — Dört dekoratif çerçeve (a11y'den gizli) + tagline. */}
      <View style={styles.section}>
        <DecorativeFrames />
        <Text
          style={styles.tagline}
          maxFontSizeMultiplier={MONO_MAX_FONT_SCALE}
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          {t('gauntlet.waitingFramesTagline')}
        </Text>
        {!hasChampion && (
          <Text style={styles.firstScreening}>{t('gauntlet.waitingFirstScreening')}</Text>
        )}
      </View>

      {/* 3 — Teaser. Gizliyse bölüm (ve ayracı) hiç çizilmez; içerik yeniden ortalanır. */}
      {teaser ? (
        <>
          <Separator />
          <View style={styles.section}>{teaser}</View>
        </>
      ) : null}

      {/* 4 — Last Pick (yalnız b). Geç gelirse fade-in; Reduce Motion'da anında. */}
      {championSection ? (
        <>
          <Separator />
          <Animated.View
            style={styles.section}
            entering={isReducedMotion ? undefined : FadeIn.duration(DISSOLVE_DURATION.newContender)}
          >
            {championSection}
          </Animated.View>
        </>
      ) : null}
    </ScrollView>
  );
}
