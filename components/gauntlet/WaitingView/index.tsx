/**
 * WaitingView — bekleyiş ekranının (before_18) SAF görünümü.
 *
 * Kendi başına ağ çağrısı, analytics, state machine bilgisi ya da saat
 * mantığı taşımaz: ne gösterileceği ve her parçanın davranışı (geri sayım,
 * bildirim CTA'sı, Spotlight teaser'ı, son şampiyon) GauntletShell'de
 * kurulur ve slot olarak gelir. Burası yalnız düzen.
 *
 * Slot koşulları GauntletShell'dedir (`unlockAt`, `waitingNotifyEligible`,
 * `showTeaser`, `waitingChampion`); bir slot `null`/`undefined` ise çizilmez.
 *
 * K-46: arşiv, Pro Mode ve keşif rotası YOK. İçerik KAYDIRILABİLİR — AX5 ve
 * küçük ekranda taşma kesilmesin.
 */
import React from 'react';
import { ScrollView, Text } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';

import { styles } from './styles';

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

export function WaitingView({
  unlockTimeLabel,
  countdown,
  notifyAction,
  teaser,
  championSection,
}: WaitingViewProps): React.JSX.Element {
  const { t } = useLanguage();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      alwaysBounceVertical={false}
    >
      <Text style={styles.title}>{t('gauntlet.before18', { time: unlockTimeLabel })}</Text>
      {countdown}
      {notifyAction}
      {teaser}
      {championSection}
    </ScrollView>
  );
}
