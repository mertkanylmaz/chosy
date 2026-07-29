/**
 * CaseHeader — Detective oyunu üst bilgi çubuğu.
 *
 * Sol: Dava numarası, Orta: mm:ss geçen süre sayacı, Sağ: kalan şüpheli.
 * Sayaç `timerStartMs` anından itibaren saniye sayar.
 */
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { MagnifyingGlass } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { styles } from './styles';


// ─── Types ───────────────────────────────────────────────────────────────────

interface CaseHeaderProps {
  /** Dava numarası (#001, #002 …) */
  caseNumber: number;
  /** Kalan şüpheli sayısı — aşama rozetinin yerini aldı (tek fazlı oyun) */
  remainingCount: number;
  /** Sayacın başladığı Unix ms zaman damgası */
  timerStartMs: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Saniyeyi mm:ss formatına çevirir */
function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * CaseHeader — Oyun başlığında dava numarası, zamanlayıcı ve aşama rozetini gösterir.
 */
export function CaseHeader({ caseNumber, remainingCount, timerStartMs }: CaseHeaderProps) {
  const { t } = useLanguage();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const update = () => {
      const elapsed = Math.floor((Date.now() - timerStartMs) / 1000);
      setElapsedSeconds(elapsed);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timerStartMs]);

  return (
    <View style={styles.caseHeaderContainer}>
      {/* Case number — left */}
      <Text style={styles.caseHeaderCaseNumber}>
        {t('games.detective.case_number', { number: String(caseNumber).padStart(3, '0') })}
      </Text>

      {/* Timer — center */}
      <Text style={styles.caseHeaderTimer}>{formatTime(elapsedSeconds)}</Text>

      {/* Kalan supheli — right */}
      <View style={styles.caseHeaderStageBadge}>
        <MagnifyingGlass size={12} color={Colors.gold} weight="duotone" />
        <Text style={styles.caseHeaderStageLabel}>
          {t('games.detective.suspects_left', { count: remainingCount })}
        </Text>
      </View>
    </View>
  );
}
