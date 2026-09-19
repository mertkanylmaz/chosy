/**
 * RoundIndicator — tur göstergesi. DESIGN_OS v4.1 §10.1 (C.9b-UI, L-6).
 *
 * v4.0'da ● ● ○ ○ deseni + "Tur 1/3" metni vardı. v4.1'de iki değişiklik:
 *   - 4 nokta → **3 segment** (tur sayısı üçtür, dördüncü nokta yanlış vaat)
 *   - "Tur 1/3" → küçük "1/3" (nokta + tam metin çift bilgi kanalıydı)
 *
 * Erişilebilirlikte TAM metin korunur: segmentler ekran okuyucudan gizlenir
 * ve kapsayıcı "Tur 1/3" olarak seslendirilir — görsel sadeleşme VoiceOver
 * kullanıcısından bilgi eksiltmez (K-54).
 *
 * Tur değişimi Kesme'dir (§7.1) — 0ms, animasyon yok.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';

import { styles } from './styles';

interface RoundIndicatorProps {
  /** Tamamlanan + mevcut tur, 1 tabanlı (§10.1: "Tur 1/3") */
  current: 1 | 2 | 3;
  total?: 3;
  showLabel?: boolean;
}

export function RoundIndicator({
  current,
  total = 3,
  showLabel = true,
}: RoundIndicatorProps): React.JSX.Element {
  const { t } = useLanguage();
  /** VoiceOver'ın duyduğu tam metin — görselde kısaltılsa da burada tam kalır. */
  const fullLabel = t('gauntlet.roundLabel', { current, total });
  /** Görsel sayaç: yalnız "1/3". Martian Mono (sayaç, §10.1 mono istisnası). */
  const shortLabel = t('gauntlet.roundShort', { current, total });

  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={fullLabel}>
      <View style={styles.segments} importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={[styles.segment, index < current && styles.segmentActive]}
          />
        ))}
      </View>
      {showLabel && <Text style={styles.label}>{shortLabel}</Text>}
    </View>
  );
}
