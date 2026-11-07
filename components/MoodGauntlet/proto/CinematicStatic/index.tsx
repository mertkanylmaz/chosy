/**
 * PROTOTİP — sinematik yükleme STATİK onay kapısı (kurucu kararı 07.11.2026). İki hareketsiz
 * sahne; animasyon YOK (Reanimated, zamanlayıcı, döngü kullanılmaz). Production akışına BAĞLI
 * DEĞİL; yalnız `CinematicLoadingLab` (dev / preview rotası) yükler.
 *
 *   'waiting' (a): ışık + iki şerit + dört BOŞ çerçeve, "Finding your four" + mood çipi
 *   'final'   (b): mevcut Your four başlığı + 2×2 PosterTile + "Start choosing", sönük ışık
 *
 * Yerleşim Your four ile aynı (introRoot / introHead / introGridBox / introFooter, fourCellWidth).
 * İki sahnede CTA alanı ayrılır (bekleme sahnesinde görünmez) → ızgara kutusu aynı tabandan ölçülür.
 * Asgari hücre: MIN_CELL (96 pt). Altında ızgara çizilmez, görünür dev uyarısı çıkar (sessiz
 * küçülme / çökme yok).
 */
import React, { useCallback, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fourCellWidth } from '@/components/MoodGauntlet/FourIntro';
import { styles as moodStyles } from '@/components/MoodGauntlet/styles';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { PosterTile } from '@/components/gauntlet/PosterTile';
import { POSTER_META_BLOCK_HEIGHT } from '@/components/gauntlet/PosterTile/styles';
import { space } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GauntletFilm } from '@/types/gauntlet';

import { gridSlots } from '../CinematicLoading/geometry';

import { Backdrop, type StaticSceneKind } from './Backdrop';
import { guardCell, MIN_CELL } from './geometry';
import { styles } from './styles';

export type { StaticSceneKind } from './Backdrop';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}
const EMPTY: Box = { x: 0, y: 0, w: 0, h: 0 };

export interface StaticSceneProps {
  kind: StaticSceneKind;
  /** Final sahnesinin dört filmi (bekleme sahnesinde çizilmez: veri gelmeden film karesi yok). */
  films: GauntletFilm[];
  moodLabel: string | null;
  onStart: () => void;
}

export function StaticScene({ kind, films, moodLabel, onStart }: StaticSceneProps): React.JSX.Element {
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [root, setRoot] = useState<Box>(EMPTY);
  const [grid, setGrid] = useState<Box>(EMPTY);

  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setRoot({ x, y, w: width, h: height });
  }, []);
  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setGrid({ x, y, w: width, h: height });
  }, []);

  const measured = grid.w > 0 && grid.h > 0;
  const guard = guardCell(fourCellWidth(grid.w, grid.h));
  const slots = measured && guard.ok ? gridSlots(grid, guard.cell, space.md, POSTER_META_BLOCK_HEIGHT) : [];
  const waiting = kind === 'waiting';
  const hasMood = moodLabel !== null && moodLabel.length > 0;

  return (
    <View style={[moodStyles.introRoot, styles.root, { paddingTop: insets.top }]} onLayout={onRootLayout}>
      {root.w > 0 && slots.length === 4 && <Backdrop kind={kind} width={root.w} height={root.h} frames={slots} />}

      {waiting ? (
        <View style={styles.waitingHead}>
          <Text style={styles.waitingTitle} accessibilityRole="header">
            {t('devProto.cinematic.findingYourFour')}
          </Text>
          {hasMood && (
            <View style={styles.moodChip}>
              <Text style={styles.moodChipText} numberOfLines={1}>
                {moodLabel}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={moodStyles.introHead}>
          {hasMood && (
            <Text style={moodStyles.introMood} numberOfLines={1}>
              {moodLabel}
            </Text>
          )}
          <Text style={moodStyles.introKicker}>{t('moodGauntlet.yourFour')}</Text>
          <Text style={moodStyles.introTitle} accessibilityRole="header">
            {t('moodGauntlet.fourIntroTitle')}
          </Text>
        </View>
      )}

      <View
        style={moodStyles.introGridBox}
        onLayout={onGridLayout}
        accessibilityLabel={waiting ? t('moodGauntlet.loadingFinding') : t('moodGauntlet.yourFourA11y')}
      >
        {measured && !guard.ok && (
          <View style={styles.guard}>
            <Text style={styles.guardText}>{t('devProto.cinematic.cellGuard', { cell: guard.cell, min: MIN_CELL })}</Text>
          </View>
        )}
      </View>

      <View
        style={[moodStyles.introFooter, { paddingBottom: Math.max(insets.bottom, space.base) }, waiting && styles.footerReserved]}
        pointerEvents={waiting ? 'none' : 'auto'}
        accessibilityElementsHidden={waiting}
        importantForAccessibility={waiting ? 'no-hide-descendants' : 'auto'}
      >
        <PrimaryAction label={t('moodGauntlet.fourIntroCta')} onPress={onStart} variant="gold" />
      </View>

      {!waiting &&
        slots.map((slot, i) =>
          films[i] === undefined ? null : (
            <View key={films[i].id} style={[styles.poster, { left: slot.x, top: slot.y, width: slot.w }]}>
              <PosterTile film={films[i]} interactive={false} metaMode="yearOnly" />
            </View>
          ),
        )}
    </View>
  );
}
