/**
 * Your four — kalıcı durak (Faz 2-9a). Dörtlü hazır olunca açılır ve kullanıcı "Start choosing"
 * dokunana kadar KALIR: timer, effect ya da animasyon sonu callback'iyle otomatik geçiş YOKTUR.
 * Ekranın başka hiçbir yerine dokunmak Round 1'i açmaz; yalnız CTA açar.
 *
 * Yerleşim: CTA alt güvenli alana sabit; posterler kalan alana sığacak kadar küçülür (375×667'de
 * CTA kaydırmadan görünür). Poster boyutu ızgara kutusunun ölçümünden gelir, sabit piksel yok.
 * Yapay gecikme YOK; posterler 100 ms aralıkla belirir (Reduce Motion'da hepsi birlikte ~100 ms çapraz geçiş).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { PosterTile } from '@/components/gauntlet/PosterTile';
import { POSTER_META_BLOCK_HEIGHT } from '@/components/gauntlet/PosterTile/styles';
import { MOOD_MOTION, REDUCED_MOTION_DURATION } from '@/constants/design/motion';
import { space } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GauntletFilm } from '@/types/gauntlet';
import { hapticSelection } from '@/utils/haptics';

import { styles } from './styles';

/** Izgara kutusuna (2×2) sığan en büyük poster genişliği; ölçülene kadar 0 (çizilmez). */
export function fourCellWidth(boxW: number, boxH: number): number {
  if (boxW <= 0 || boxH <= 0) return 0;
  const byWidth = (boxW - space.md) / 2;
  const byHeight = ((boxH - space.md) / 2 - POSTER_META_BLOCK_HEIGHT) * (2 / 3);
  return Math.max(0, Math.floor(Math.min(byWidth, byHeight)));
}

interface FourIntroProps {
  films: GauntletFilm[];
  /** Hızlı mood adı / profile_name / kullanıcı metni (ekranda kalır, olaya girmez). */
  moodLabel: string | null;
  /** Yalnız "Start choosing" dokunuşunda, bir kez; `dwellMs` = ekranın açık kaldığı süre. */
  onStart: (dwellMs: number) => void;
  /** Ekran gösterildiğinde bir kez. */
  onViewed: () => void;
  /** Dokunulamaz posterlere dokunuş (yalnız ölçüm; hiçbir şey açılmaz). `position` 0–3. */
  onPosterTapped: (position: number) => void;
  /** Loading L1 (yalnız ölçüm): herhangi bir poster görseli yüklendi; tekilleştirme üst bileşende. */
  onPosterLoaded?: () => void;
}

export function FourIntro({
  films,
  moodLabel,
  onStart,
  onViewed,
  onPosterTapped,
  onPosterLoaded,
}: FourIntroProps): React.JSX.Element {
  const { t } = useLanguage();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const shownAt = useRef(Date.now());
  const started = useRef(false);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    onViewed();
    // Yalnız mount'ta: aynı dörtlü için bir kez (üst bileşen set.setId ile key verir).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  }, []);

  const handleStart = useCallback(() => {
    if (started.current) return; // çift dokunuş: tek açılış, tek olay
    started.current = true;
    hapticSelection();
    onStart(Date.now() - shownAt.current);
  }, [onStart]);

  const cell = fourCellWidth(box.w, box.h);

  return (
    <View style={styles.introRoot}>
      <View style={styles.introHead}>
        {moodLabel !== null && moodLabel.length > 0 && (
          <Text style={styles.introMood} numberOfLines={1}>
            {moodLabel}
          </Text>
        )}
        <Text style={styles.introKicker}>{t('moodGauntlet.yourFour')}</Text>
        <Text style={styles.introTitle} accessibilityRole="header">
          {t('moodGauntlet.fourIntroTitle')}
        </Text>
      </View>

      <View
        style={styles.introGridBox}
        onLayout={onLayout}
        accessibilityLabel={t('moodGauntlet.yourFourA11y')}
      >
        {cell > 0 && (
          <View style={styles.introGrid}>
            {films.map((film, i) => (
              <Animated.View
                key={film.id}
                style={{ width: cell }}
                entering={
                  reduced
                    ? FadeIn.duration(REDUCED_MOTION_DURATION.crossFade)
                    : FadeIn.delay(i * MOOD_MOTION.posterStagger).duration(MOOD_MOTION.stageTransition)
                }
              >
                {/* Faz 2-9c ölçüm: devre dışı PosterTile dokunuşu yutmaz, ata Pressable alır. Erişilebilirlik
                    ağacına girmez (accessible=false); görsel geri bildirim ve eylem YOK. */}
                <Pressable accessible={false} onPress={() => onPosterTapped(i)}>
                  <PosterTile film={film} interactive={false} metaMode="yearOnly" onLoad={onPosterLoaded} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.introFooter, { paddingBottom: Math.max(insets.bottom, space.base) }]}>
        <PrimaryAction
          label={t('moodGauntlet.fourIntroCta')}
          onPress={handleStart}
          variant="gold"
        />
      </View>
    </View>
  );
}
