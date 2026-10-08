/**
 * UnlockCountdown — bekleyiş ekranının (before_18) 18:00 geri sayımı. V-1 Tur 6.
 *
 * AYRI ve `memo` bileşen: `useCountdown` saniyede bir render üretir; sayaç
 * GauntletShell'in içinde yaşasaydı bütün kabuk her saniye yeniden çizilirdi.
 *
 * Sıfırda sayaç donmaz — `onElapsed` çağıranın mevcut nabız + `load()` yolunu
 * tetikler ve kabuk `bootstrapping`'e ("Hazırlanıyor" iskeleti) geçer.
 *
 * Görünüm (W1): yalnız saat:dakika ("02:50"), dakika TAVAN (`displayParts`), saniye hanesi YOK — her saniye
 * değişen rakam hareket sayılırdı (K-54, eskiden yalnız Reduce Motion'da
 * gizliydi). Geri sayım MANTIĞI (useCountdown, onElapsed) değişmedi.
 *
 * A11y (K-54):
 *   - VoiceOver → ekrandakiyle aynı değer ("2 saat 50 dakika"); iki nokta seslendirilmez.
 *   - Martian Mono 1.4x ile sınırlı (DESIGN_OS §3.5).
 */
import React, { memo } from 'react';
import { Text } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';
import { formatCountdown } from '@/hooks/countdownCore';
import { useCountdown } from '@/hooks/useCountdown';
import { MONO_MAX_FONT_SCALE } from '@/components/gauntlet/WaitingView/styles';

import { displayParts } from './displayParts';
import { styles } from './styles';

interface UnlockCountdownProps {
  /** Kapı anı — `getNextUnlockAt()`. Referansı sabit tutulmalı (useMemo). */
  target: Date;
  /** Sayaç sıfıra ulaştığında bir kez. */
  onElapsed: () => void;
}

function UnlockCountdownImpl({ target, onElapsed }: UnlockCountdownProps): React.JSX.Element {
  const { t } = useLanguage();
  const remainingMs = useCountdown(target, onElapsed);
  // Dakika TAVAN (saniye gösterilmediği için 00:00 yalnız gerçek sıfırda).
  const parts = displayParts(remainingMs);

  const hoursLabel = t('gauntlet.countdownHours', { count: parts.hours });
  const minutesLabel = t('gauntlet.countdownMinutes', { count: parts.minutes });
  const a11yLabel = parts.hours > 0
    ? t('gauntlet.countdownA11y', { hours: hoursLabel, minutes: minutesLabel })
    : minutesLabel;

  return (
    <Text
      style={styles.countdown}
      accessibilityRole="timer"
      accessibilityLabel={a11yLabel}
      maxFontSizeMultiplier={MONO_MAX_FONT_SCALE}
    >
      {formatCountdown({ ...parts, seconds: 0 }, false)}
    </Text>
  );
}

export const UnlockCountdown = memo(UnlockCountdownImpl);
