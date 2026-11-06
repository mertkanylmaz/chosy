/**
 * PROTOTİP — kavisli altın film şeridi + ışık huzmesi.
 *
 * Şerit: statik gövde (marquee) + iki perforasyon sırası. Akış yalnız perforasyonların
 * `strokeDashoffset`'i ile (useAnimatedProps, UI thread; JS'e kare başına iş düşmez).
 * Huzme: mercekten ızgaranın altına açılan yamuk, dikey gradyan; opaklığı üst bileşen sürer.
 * Kareler/çerçeveler veri gelene kadar SOYUT: şeritte film karesi ya da poster çizilmez.
 */
import React from 'react';

import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Polygon, Stop } from 'react-native-svg';

import { color } from '@/constants/design/semantic';

import { curvePath, type StripCurve, type StripMetrics } from './geometry';
import { styles } from './styles';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Gövdenin opaklığı: tam altın zeminde fazla parlak — "projeksiyon karanlığında" film. */
const STRIP_BODY_OPACITY = 0.85;

function Perforations({ d, metrics, flow }: { d: string; metrics: StripMetrics; flow: SharedValue<number> }): React.JSX.Element {
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: flow.value }));
  return (
    <AnimatedPath
      d={d}
      fill="none"
      stroke={color.surface.base}
      strokeWidth={metrics.holeW}
      strokeDasharray={[metrics.holeLen, metrics.holeGap]}
      animatedProps={animatedProps}
    />
  );
}

interface FilmStripProps {
  width: number;
  height: number;
  curve: StripCurve;
  metrics: StripMetrics;
  opacity: SharedValue<number>;
  flow: SharedValue<number>;
}

export function FilmStrip({ width, height, curve, metrics, opacity, flow }: FilmStripProps): React.JSX.Element {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.sceneLayer, style]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Path
          d={curvePath(curve)}
          fill="none"
          stroke={color.reward.primary}
          strokeOpacity={STRIP_BODY_OPACITY}
          strokeWidth={metrics.width}
        />
        <Perforations d={curvePath(curve, -metrics.perfOffset)} metrics={metrics} flow={flow} />
        <Perforations d={curvePath(curve, metrics.perfOffset)} metrics={metrics} flow={flow} />
      </Svg>
    </Animated.View>
  );
}

interface BeamProps {
  width: number;
  height: number;
  points: string;
  top: number;
  bottom: number;
  opacity: SharedValue<number>;
}

/** Huzmenin mercekteki / dipteki ışık yoğunluğu (beam rengi üzerinde). */
const BEAM_STOP_TOP = 0.22;
const BEAM_STOP_BOTTOM = 0;

export function Beam({ width, height, points, top, bottom, opacity }: BeamProps): React.JSX.Element {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.sceneLayer, style]} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="cinematicBeam" x1="0" y1={top} x2="0" y2={bottom} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color.accent.active} stopOpacity={BEAM_STOP_TOP} />
            <Stop offset="1" stopColor={color.accent.active} stopOpacity={BEAM_STOP_BOTTOM} />
          </LinearGradient>
        </Defs>
        <Polygon points={points} fill="url(#cinematicBeam)" />
      </Svg>
    </Animated.View>
  );
}
