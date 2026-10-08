/**
 * CycleRow — champion (ve exhausted) ekranının "sonraki gösterim" satırı. F2.1.
 *
 * Dört görünüm (karar `GauntletShell/cycleRules.cycleRowPhase`):
 *   counting     → "Next screening in 5h 12m" (+ koşullu "Remind me")
 *   ready        → buton "Tonight's four are ready" — basınca geçiş uygulanır
 *   checking     → aynı buton, devre dışı (sunucuya soruluyor)
 *   any_moment   → "Any moment now" — sunucu henüz aynı cycle'ı döndürdü
 *
 * Ön planda içerik kendiliğinden DEĞİŞMEZ; satır yalnız durumunu gösterir,
 * geçişi kullanıcının basması uygular (F2.1 / C).
 *
 * "Remind me" (D): bildirim izni verilmemiş ve kalıcı reddedilmemişse sayaç
 * satırının sonunda. Sayaç ve "Remind me" AYRI erişilebilirlik öğeleridir;
 * dokunma hedefi ≥ 44pt. Kullanıcı eylemidir — askCoordinator'ın günlük
 * limitine girmez.
 */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { UnlockCountdown } from '@/components/gauntlet/UnlockCountdown';
import { useLanguage } from '@/contexts/LanguageContext';

import type { RowPhase } from '../GauntletShell/cycleRules';
import { styles } from './styles';

interface CycleRowProps {
  phase: RowPhase;
  /** Sunucunun `next_cycle_at`'i — sayaç hedefi. Referansı sabit tutulmalı (useMemo). */
  target: Date;
  /** Sayaç sıfıra ulaştığında bir kez. */
  onElapsed: () => void;
  /** "Hazır" butonuna basıldı — geçişi uygular. */
  onPressReady: () => void;
  /** Son kontrol başarısızdı (çevrimdışı / sunucu hatası) — buton altında kısa mesaj. */
  checkFailed: boolean;
  /** Verilirse sayaç satırının sonunda "Remind me" gösterilir. */
  onRemind?: () => void;
}

export function CycleRow({
  phase,
  target,
  onElapsed,
  onPressReady,
  checkFailed,
  onRemind,
}: CycleRowProps): React.JSX.Element {
  const { t } = useLanguage();

  if (phase === 'ready' || phase === 'checking') {
    return (
      <View style={styles.container}>
        <View style={styles.buttonSlot}>
          <OutlineAction
            label={t('gauntlet.cycleReady')}
            onPress={onPressReady}
            disabled={phase === 'checking'}
          />
        </View>
        {checkFailed && phase === 'ready' && (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {t('gauntlet.loadError')}
          </Text>
        )}
      </View>
    );
  }

  if (phase === 'any_moment') {
    return (
      <View style={styles.container}>
        <Text style={styles.status} accessibilityRole="text">
          {t('gauntlet.cycleAnyMoment')}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.countingRow}>
        <UnlockCountdown variant="inline" target={target} onElapsed={onElapsed} />
        {onRemind && (
          <TouchableOpacity
            onPress={onRemind}
            activeOpacity={0.7}
            style={styles.remind}
            accessibilityRole="button"
            accessibilityLabel={t('gauntlet.remindMe')}
          >
            <Text style={styles.remindText}>{t('gauntlet.remindMe')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
