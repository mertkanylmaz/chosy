/**
 * WaitingView — bekleyiş ekranının (before_18) SAF görünümü.
 *
 * Kendi başına ağ çağrısı, analytics, state machine bilgisi ya da saat
 * mantığı taşımaz: ne gösterileceği ve her parçanın davranışı (geri sayım,
 * bildirim eylemi, Spotlight teaser'ı, son şampiyon) GauntletShell'de
 * kurulur ve slot/prop olarak gelir. Burası yalnız düzen.
 *
 * W1.1 — iOS-native düzen: tümü sola hizalı, üstten akar.
 *   1. Büyük başlık (`largeTitle`) + alt satır (`gauntlet.before18`)
 *   2. Zaman (inline geri sayım)
 *   3. Inset grup: bildirim satırı (varsa) + Spotlight satırı (varsa);
 *      ikisi de yoksa grup çizilmez
 *   4. Last Pick (yalnız şampiyon varsa): etiket + ayrı grup, tek satır
 *
 * K-46: arşiv, Pro Mode ve keşif rotası YOK. İçerik KAYDIRILABİLİR — AX5 ve
 * küçük ekranda taşma kesilmesin.
 *
 * A11y okuma sırası: başlık+alt satır → zaman → bildirim → Spotlight → Last Pick.
 */
import React from 'react';
import { ScrollView, Text, View, useWindowDimensions } from 'react-native';

import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { DISSOLVE_DURATION } from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';

import { InsetGroup } from './InsetGroup';
import { NotifyRow } from './NotifyRow';
import {
  ROW_PADDING_X,
  ROW_SEPARATOR_INSET,
  isLargeText,
  isWaitingCompact,
  styles,
} from './styles';

export interface WaitingViewProps {
  /** Kapı saati, arayüz diline göre biçimli ("6:00 PM" / "18:00"). */
  unlockTimeLabel: string;
  /** GauntletShell'deki `<UnlockCountdown variant="inline" onElapsed={runClockPulse} />`. */
  countdown?: React.ReactNode;
  /** Bildirim satırı — koşul (izin + ≥1 şampiyon) GauntletShell'de; yoksa satır çizilmez. */
  notify?: { label: string; onPress: () => void; disabled?: boolean };
  /** `showTeaser` ise `<SpotlightTeaser />`. */
  teaser?: React.ReactNode;
  /** Son şampiyon varsa `<WaitingChampionCard />`. */
  championSection?: React.ReactNode;
}

export function WaitingView({
  unlockTimeLabel,
  countdown,
  notify,
  teaser,
  championSection,
}: WaitingViewProps): React.JSX.Element {
  const { t } = useLanguage();
  const { height, fontScale } = useWindowDimensions();
  const isReducedMotion = useReducedMotion();
  const compact = isWaitingCompact(height);

  const title = t('tabs.home');
  const subtitle = t('gauntlet.before18', { time: unlockTimeLabel });

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, compact && styles.scrollContentCompact]}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical
    >
      {/* 1–2 — Başlık + alt satır tek VoiceOver öğesi; ardından zaman. */}
      <View style={styles.header}>
        <View
          style={styles.headerText}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${title}. ${subtitle}`}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        {countdown}
      </View>

      {/* 3 — Inset grup. Satır yoksa hiç çizilmez. Ayraç inset'i: yan yana düzende
          görsel/ikon sütununun sonu, büyük yazıda (görsel üstte) satır dolgusu. */}
      <InsetGroup separatorInset={isLargeText(fontScale) ? ROW_PADDING_X : ROW_SEPARATOR_INSET}>
        {notify ? (
          <NotifyRow label={notify.label} onPress={notify.onPress} disabled={notify.disabled} />
        ) : null}
        {teaser}
      </InsetGroup>

      {/* 4 — Last Pick. Geç gelirse fade-in; Reduce Motion'da anında. */}
      {championSection ? (
        <Animated.View
          style={styles.championWrap}
          entering={isReducedMotion ? undefined : FadeIn.duration(DISSOLVE_DURATION.newContender)}
        >
          {championSection}
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}
