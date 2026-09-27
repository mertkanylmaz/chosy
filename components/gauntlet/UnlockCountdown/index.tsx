/**
 * UnlockCountdown — bekleyiş ekranının (before_18) 18:00 geri sayımı. V-1 Tur 6.
 *
 * AYRI ve `memo` bileşen: `useCountdown` saniyede bir render üretir; sayaç
 * GauntletShell'in içinde yaşasaydı bütün kabuk her saniye yeniden çizilirdi.
 *
 * Sıfırda sayaç donmaz — `onElapsed` çağıranın mevcut nabız + `load()` yolunu
 * tetikler ve kabuk `bootstrapping`'e ("Hazırlanıyor" iskeleti) geçer.
 *
 * A11y (K-54):
 *   - Reduce Motion → saniye hanesi gizli (her saniye değişen rakam hareket).
 *   - VoiceOver → "2 saat 49 dakika"; saniye ve iki nokta seslendirilmez.
 */
import React, { memo } from 'react';
import { Text } from 'react-native';

import { useReducedMotion } from 'react-native-reanimated';

import { useLanguage } from '@/contexts/LanguageContext';
import { countdownParts, formatCountdown } from '@/hooks/countdownCore';
import { useCountdown } from '@/hooks/useCountdown';

import { styles } from './styles';

interface UnlockCountdownProps {
  /** Kapı anı — `getNextUnlockAt()`. Referansı sabit tutulmalı (useMemo). */
  target: Date;
  /** Sayaç sıfıra ulaştığında bir kez. */
  onElapsed: () => void;
}

function UnlockCountdownImpl({ target, onElapsed }: UnlockCountdownProps): React.JSX.Element {
  const { t } = useLanguage();
  const isReducedMotion = useReducedMotion();
  const remainingMs = useCountdown(target, onElapsed);
  const parts = countdownParts(remainingMs);

  const hoursLabel = t('gauntlet.countdownHours', { count: parts.hours });
  const minutesLabel = t('gauntlet.countdownMinutes', { count: parts.minutes });
  const a11yLabel = parts.hours > 0
    ? t('gauntlet.countdownA11y', { hours: hoursLabel, minutes: minutesLabel })
    : minutesLabel;

  return (
    <Text style={styles.countdown} accessibilityRole="timer" accessibilityLabel={a11yLabel}>
      {formatCountdown(parts, !isReducedMotion)}
    </Text>
  );
}

export const UnlockCountdown = memo(UnlockCountdownImpl);
