/**
 * PROTOTİP — projektör: gövde + iki makara, kodla çizilmiş SVG (dış asset yok, CTO kararı
 * 06.11.2026). Makaralar yalnız transform ile döner (UI thread); Reduce Motion'da dönmez.
 */
import React from 'react';
import { View } from 'react-native';

import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

import { color } from '@/constants/design/semantic';

import { PROJECTOR_H, PROJECTOR_VIEW, PROJECTOR_W, REEL_R, styles } from './styles';

const SPOKES = [0, 120, 240] as const;
const STROKE = 1.5;

/** viewBox → pt: SVG varsayılanı `xMidYMid meet` (tek ölçek, yatayda ortalı). */
const K = Math.min(PROJECTOR_W / PROJECTOR_VIEW.w, PROJECTOR_H / PROJECTOR_VIEW.h);
const OFFSET_X = (PROJECTOR_W - PROJECTOR_VIEW.w * K) / 2;
const OFFSET_Y = (PROJECTOR_H - PROJECTOR_VIEW.h * K) / 2;

/** Merceğin ucu, projektör kutusunun sol-üstüne göre (pt). Huzme buradan başlar. */
export const LENS_OFFSET = { x: OFFSET_X + PROJECTOR_VIEW.lensX * K, y: OFFSET_Y + PROJECTOR_VIEW.lensY * K } as const;

function Reel({ cx, cy, rotation }: { cx: number; cy: number; rotation: SharedValue<number> }): React.JSX.Element {
  const d = REEL_R * 2 + 2;
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));
  return (
    <Animated.View style={[styles.reel, { left: OFFSET_X + cx * K - d / 2, top: OFFSET_Y + cy * K - d / 2 }, style]}>
      <Svg width={d} height={d} viewBox={`0 0 ${d} ${d}`}>
        <Circle cx={d / 2} cy={d / 2} r={REEL_R} stroke={color.text.secondary} strokeWidth={STROKE} fill={color.surface.raised} />
        {SPOKES.map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <Line
              key={deg}
              x1={d / 2}
              y1={d / 2}
              x2={d / 2 + Math.cos(rad) * (REEL_R - 3)}
              y2={d / 2 + Math.sin(rad) * (REEL_R - 3)}
              stroke={color.text.secondary}
              strokeWidth={STROKE}
            />
          );
        })}
        <Circle cx={d / 2} cy={d / 2} r={2.5} fill={color.text.secondary} />
      </Svg>
    </Animated.View>
  );
}

interface ProjectorProps {
  left: number;
  rotation: SharedValue<number>;
  opacity: SharedValue<number>;
}

export function Projector({ left, rotation, opacity }: ProjectorProps): React.JSX.Element {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[styles.projector, { left }, style]} pointerEvents="none">
      <View>
        <Svg width={PROJECTOR_W} height={PROJECTOR_H} viewBox={`0 0 ${PROJECTOR_VIEW.w} ${PROJECTOR_VIEW.h}`}>
          {/* Gövde */}
          <Rect x={30} y={34} width={60} height={26} rx={5} stroke={color.text.secondary} strokeWidth={STROKE} fill={color.surface.raised} />
          {/* Makara kolu */}
          <Line x1={44} y1={20} x2={52} y2={34} stroke={color.surface.border} strokeWidth={STROKE} />
          <Line x1={76} y1={18} x2={68} y2={34} stroke={color.surface.border} strokeWidth={STROKE} />
          {/* Mercek: aşağı bakar, huzme buradan çıkar */}
          <Rect x={54} y={60} width={12} height={6} rx={1.5} stroke={color.text.secondary} strokeWidth={STROKE} fill={color.accent.fill} />
        </Svg>
      </View>
      <Reel cx={44} cy={18} rotation={rotation} />
      <Reel cx={76} cy={16} rotation={rotation} />
    </Animated.View>
  );
}
