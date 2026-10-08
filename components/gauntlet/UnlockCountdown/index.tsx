/**
 * UnlockCountdown — champion ekranında bir sonraki cycle geçişine geri sayım
 * ("Next screening in 5h 12m"). V-1 Tur 6'da bekleme ekranı için doğdu, F2'de
 * champion ekranına taşındı.
 *
 * AYRI ve `memo` bileşen: `useCountdown` saniyede bir render üretir; sayaç
 * GauntletShell'in içinde yaşasaydı bütün kabuk her saniye yeniden çizilirdi.
 *
 * Hedef sunucunun söylediği `next_cycle_at`'tir (istemci 18:00 hesaplamaz).
 * Sıfırda sayaç donmaz — `onElapsed` kabuğun cycle kontrolünü tetikler; sunucu
 * yeni cycle'ı döndürürse hedef değişir, aynı cycle ise ekran olduğu gibi kalır.
 *
 * Görünüm: tek satır, `type.caption` (13/18, iOS footnote ölçüsü), ikincil
 * metin rengi; dakika TAVAN (`displayParts`), saniye hanesi YOK — her saniye
 * değişen rakam hareket sayılırdı (K-54). Rakamlar `tabular-nums`.
 *
 * A11y (K-54): VoiceOver ekrandakiyle aynı değeri okur ("5 saat 12 dakika").
 */
import React, { memo } from 'react';
import { Text } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';
import { useCountdown } from '@/hooks/useCountdown';

import { displayParts } from './displayParts';
import { formatDuration } from './formatDuration';
import { styles } from './styles';

interface UnlockCountdownProps {
  /** Geçiş anı — sunucunun `next_cycle_at`'i. Referansı sabit tutulmalı (useMemo). */
  target: Date;
  /** Sayaç sıfıra ulaştığında bir kez. */
  onElapsed: () => void;
  variant?: 'inline';
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
  const time = formatDuration(parts, (key, vars) => t(`gauntlet.${key}`, vars));

  return (
    <Text style={styles.inline} accessibilityRole="timer" accessibilityLabel={a11yLabel}>
      {t('gauntlet.nextScreening', { time })}
    </Text>
  );
}

export const UnlockCountdown = memo(UnlockCountdownImpl);
