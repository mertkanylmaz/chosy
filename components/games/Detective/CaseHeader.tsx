/**
 * CaseHeader — Detective oyunu üst bilgi çubuğu.
 *
 * Sol: Dava numarası, Orta: mm:ss geçen süre sayacı,
 * Sağ: Aşama rozeti (INVESTIGATION / DEDUCTION).
 * Sayaç `timerStartMs` anından itibaren saniye sayar.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MagnifyingGlass, Scales } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { styles } from './styles';

// ─── Teal accent (Detective tema rengi) ─────────────────────────────────────
const TEAL = '#0D9488';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CaseHeaderProps {
  /** Dava numarası (#001, #002 …) */
  caseNumber: number;
  /** Aktif aşama: 1 = Soruşturma, 2 = Yargılama */
  stage: 1 | 2;
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
export function CaseHeader({ caseNumber, stage, timerStartMs }: CaseHeaderProps) {
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

  const stageLabel =
    stage === 1
      ? t('games.detective.stage1_title')
      : t('games.detective.stage2_title');

  const StageIcon =
    stage === 1
      ? <MagnifyingGlass size={12} color={TEAL} weight="duotone" />
      : <Scales size={12} color={TEAL} weight="duotone" />;

  return (
    <View style={styles.caseHeaderContainer}>
      {/* Case number — left */}
      <Text style={styles.caseHeaderCaseNumber}>
        {t('games.detective.case_number')} #{String(caseNumber).padStart(3, '0')}
      </Text>

      {/* Timer — center */}
      <Text style={styles.caseHeaderTimer}>{formatTime(elapsedSeconds)}</Text>

      {/* Stage badge — right */}
      <View style={styles.caseHeaderStageBadge}>
        {StageIcon}
        <Text style={styles.caseHeaderStageLabel}>{stageLabel}</Text>
      </View>
    </View>
  );
}
