/**
 * PROTOTİP — Cinematic Discovery Loading (proto/cinematic-loading). Production akışına BAĞLI
 * DEĞİL; yalnız `app/dev-cinematic-loading.tsx` (__DEV__) üzerinden açılır.
 *
 * Tek bileşen hem bekleme hem Your four düzenini taşır → aşama değişince remount/sıçrama yok:
 *   films === null → bekleme: projektör + huzme + akan şerit + şeritte dört BOŞ çerçeve
 *   films !== null → çıkış (≤ 600 ms): şerit/projektör söner, çerçeveler ızgaraya, posterler
 *                    oturur, başlık + "Start choosing" belirir (alanları baştan ayrılmış).
 * Animasyon API zamanlamasını YÖNETMEZ: çıkış veri geldiği an, o anki değerlerden başlar.
 * Sahte ilerleme yok: yüzde, aşama metni, veri gelmeden film karesi yok. Görünür metin yok;
 * VoiceOver için mevcut tek satır (`loadingFinding` / `loadingAnother`) erişilebilirlik etiketidir.
 * Reduce Motion: hareket yok, statik sahne + ~100 ms çapraz geçiş.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fourCellWidth } from '@/components/MoodGauntlet/FourIntro';
import { styles as moodStyles } from '@/components/MoodGauntlet/styles';
import type { MoodLoadingKind } from '@/components/MoodGauntlet/useMoodGauntlet';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { POSTER_META_BLOCK_HEIGHT } from '@/components/gauntlet/PosterTile/styles';
import { CINEMATIC_PROTO_MOTION as M, EASE_OUT_QUART, REDUCED_MOTION_DURATION } from '@/constants/design/motion';
import { space } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { GauntletFilm } from '@/types/gauntlet';

import { Beam, FilmStrip } from './FilmStrip';
import { Frame, type ScenePhase } from './FrameGrid';
import {
  angleAt,
  beamPolygon,
  gridSlots,
  pointAt,
  STRIP_T,
  stripCurve,
  stripMetrics,
  stripPose,
  type Box,
} from './geometry';
import { LENS_OFFSET, Projector } from './Projector';
import { PROJECTOR_W, styles } from './styles';

const RM = ReduceMotion.Never;
const FRAME_INDEXES = [0, 1, 2, 3] as const;

export interface CinematicLoadingProps {
  /** null = veri yok (bekleme). Dört film gelince çıkış başlar. */
  films: GauntletFilm[] | null;
  kind: MoodLoadingKind;
  moodLabel: string | null;
  /** YALNIZ prototip: Reduce Motion'ı zorla aç/kapat; null = sistem ayarı. */
  reducedOverride: boolean | null;
  blur: boolean;
  onStart: () => void;
  /** Ölçüm: çıkışın son animasyonu (başlık + CTA) bitti. */
  onRevealSettled?: () => void;
  /** Ölçüm: bir posterin görseli yüklendi / yüklenemedi (bulanık kat, aynı URL). */
  onImageLoad?: (index: number) => void;
  onImageError?: (index: number) => void;
}

export function CinematicLoading({
  films,
  kind,
  moodLabel,
  reducedOverride,
  blur,
  onStart,
  onRevealSettled,
  onImageLoad,
  onImageError,
}: CinematicLoadingProps): React.JSX.Element {
  const { t } = useLanguage();
  const systemReduced = useReducedMotion();
  const reduced = reducedOverride ?? systemReduced;
  const insets = useSafeAreaInsets();
  const phase: ScenePhase = films === null ? 'waiting' : 'reveal';
  const fastIntro = kind === 'another';

  const [root, setRoot] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const [grid, setGrid] = useState<Box>({ x: 0, y: 0, w: 0, h: 0 });

  const projO = useSharedValue(0);
  const beamO = useSharedValue(0);
  const stripO = useSharedValue(0);
  const chromeO = useSharedValue(0);
  const flow = useSharedValue(0);
  const reel = useSharedValue(0);

  const onRootLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setRoot({ x, y, w: width, h: height });
  }, []);
  const onGridLayout = useCallback((e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setGrid({ x, y, w: width, h: height });
  }, []);

  const cell = fourCellWidth(grid.w, grid.h);
  const geo = useMemo(() => {
    const slots = gridSlots(grid, cell, space.md, POSTER_META_BLOCK_HEIGHT);
    if (slots.length === 0) return null;
    const first = slots[0];
    const last = slots[3];
    const gridTop = first.y;
    const gridBottom = last.y + last.tileH;
    const centerY = (gridTop + gridBottom) / 2;
    const metrics = stripMetrics(first.posterH, M.stripFrameScale, space.sm);
    const curve = stripCurve(root.w, centerY, first.tileH * 0.18);
    const poses = slots.map((slot, i) =>
      stripPose(slot, pointAt(curve, STRIP_T[i]), angleAt(curve, STRIP_T[i]), M.stripFrameScale),
    );
    const projectorLeft = (root.w - PROJECTOR_W) / 2;
    const lens = { x: projectorLeft + LENS_OFFSET.x, y: LENS_OFFSET.y };
    const beam = beamPolygon(lens, first.x, slots[1].x + slots[1].w, gridBottom, space.base);
    return { slots, poses, metrics, curve, projectorLeft, beam, lensY: lens.y, gridBottom };
  }, [grid, cell, root.w]);

  // ── Bekleme döngüleri: yalnız veri yokken ve hareket açıkken. ──
  const startLoops = useCallback(() => {
    const period = -(geo?.metrics.holeLen ?? 0) - (geo?.metrics.holeGap ?? 0);
    flow.value = 0;
    flow.value = withRepeat(withTiming(period, { duration: M.stripFlowPeriod, easing: Easing.linear, reduceMotion: RM }), -1, false, undefined, RM);
    reel.value = withRepeat(
      withTiming(reel.value + 360, { duration: M.reelTurn, easing: Easing.linear, reduceMotion: RM }),
      -1,
      false,
      undefined,
      RM,
    );
  }, [flow, reel, geo]);

  const stopLoops = useCallback(() => {
    cancelAnimation(flow);
    cancelAnimation(reel);
    cancelAnimation(beamO);
  }, [flow, reel, beamO]);

  useEffect(() => stopLoops, [stopLoops]);

  useEffect(() => {
    if (geo === null) return;

    if (reduced) {
      stopLoops();
      const d = { duration: REDUCED_MOTION_DURATION.crossFade, reduceMotion: RM };
      if (phase === 'waiting') {
        projO.value = withTiming(1, d);
        beamO.value = withTiming(M.beamOpacityHigh, d);
        stripO.value = withTiming(1, d);
        chromeO.value = withTiming(0, d);
      } else {
        projO.value = withTiming(0, d);
        beamO.value = withTiming(0, d);
        stripO.value = withTiming(0, d);
        chromeO.value = withTiming(1, d, (finished) => {
          if (finished === true && onRevealSettled) runOnJS(onRevealSettled)();
        });
      }
      return;
    }

    if (phase === 'waiting') {
      const fade = fastIntro ? M.introAnother : M.introProjector;
      projO.value = withTiming(1, { duration: fade, easing: EASE_OUT_QUART, reduceMotion: RM });
      stripO.value = withDelay(
        fastIntro ? 0 : M.introStripDelay,
        withTiming(1, { duration: fade, easing: EASE_OUT_QUART, reduceMotion: RM }),
        RM,
      );
      // Huzme: belirir, sonra düşük genlikte nabız (dikkat dağıtmayan, sonsuz).
      beamO.value = withDelay(
        fastIntro ? 0 : M.introBeamDelay,
        withSequence(
          RM,
          withTiming(M.beamOpacityHigh, { duration: fade, easing: EASE_OUT_QUART, reduceMotion: RM }),
          withRepeat(
            withSequence(
              RM,
              withTiming(M.beamOpacityLow, { duration: M.beamPulseHalf, easing: Easing.inOut(Easing.sin), reduceMotion: RM }),
              withTiming(M.beamOpacityHigh, { duration: M.beamPulseHalf, easing: Easing.inOut(Easing.sin), reduceMotion: RM }),
            ),
            -1,
            false,
            undefined,
            RM,
          ),
        ),
        RM,
      );
      chromeO.value = withTiming(0, { duration: M.introAnother, reduceMotion: RM });
      startLoops();
      return;
    }

    // ── Çıkış: veri geldi. Döngüler kesilir, her şey o anki değerden. ──
    cancelAnimation(beamO);
    const out = { duration: M.exitFrames, easing: EASE_OUT_QUART, reduceMotion: RM };
    projO.value = withTiming(0, out);
    beamO.value = withTiming(0, out);
    stripO.value = withTiming(0, out, (finished) => {
      if (finished === true) {
        cancelAnimation(flow);
        cancelAnimation(reel);
      }
    });
    chromeO.value = withDelay(
      M.exitChromeDelay,
      withTiming(1, { duration: M.exitFrames, easing: EASE_OUT_QUART, reduceMotion: RM }, (finished) => {
        if (finished === true && onRevealSettled) runOnJS(onRevealSettled)();
      }),
      RM,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, reduced, geo === null]);

  const chromeStyle = useAnimatedStyle(() => ({ opacity: chromeO.value }));
  const revealed = phase === 'reveal';
  const a11yLine = t(kind === 'another' ? 'moodGauntlet.loadingAnother' : 'moodGauntlet.loadingFinding');

  return (
    <View style={moodStyles.introRoot} onLayout={onRootLayout}>
      {/* Başlık alanı baştan ayrılmış (opaklık 0) → çıkışta düzen kaymaz. */}
      <Animated.View style={[moodStyles.introHead, chromeStyle]} accessibilityElementsHidden={!revealed}>
        {moodLabel !== null && moodLabel.length > 0 && (
          <Text style={moodStyles.introMood} numberOfLines={1}>
            {moodLabel}
          </Text>
        )}
        <Text style={moodStyles.introKicker}>{t('moodGauntlet.yourFour')}</Text>
        <Text style={moodStyles.introTitle} accessibilityRole="header">
          {t('moodGauntlet.fourIntroTitle')}
        </Text>
      </Animated.View>

      <View
        style={moodStyles.introGridBox}
        onLayout={onGridLayout}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={revealed ? t('moodGauntlet.yourFourA11y') : a11yLine}
      />

      <Animated.View
        style={[moodStyles.introFooter, { paddingBottom: Math.max(insets.bottom, space.base) }, chromeStyle]}
        pointerEvents={revealed ? 'auto' : 'none'}
        accessibilityElementsHidden={!revealed}
      >
        <PrimaryAction label={t('moodGauntlet.fourIntroCta')} onPress={onStart} variant="gold" />
      </Animated.View>

      {geo !== null && (
        <View style={styles.sceneLayer} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <FilmStrip width={root.w} height={root.h} curve={geo.curve} metrics={geo.metrics} opacity={stripO} flow={flow} />
          {FRAME_INDEXES.map((i) => (
            <Frame
              key={i}
              index={i}
              slot={geo.slots[i]}
              pose={geo.poses[i]}
              phase={phase}
              reduced={reduced}
              fastIntro={fastIntro}
              film={films !== null && films[i] !== undefined ? films[i] : null}
              blur={blur}
              onImageLoad={onImageLoad ?? noop}
              onImageError={onImageError ?? noop}
            />
          ))}
          <Beam width={root.w} height={root.h} points={geo.beam} top={geo.lensY} bottom={geo.gridBottom} opacity={beamO} />
          <Projector left={geo.projectorLeft} rotation={reel} opacity={projO} />
        </View>
      )}
    </View>
  );
}

function noop(): void {
  // Ölçüm geri çağrısı verilmediyse bilinçli olarak hiçbir şey yapılmaz (prototip ölçümü opsiyonel).
}
