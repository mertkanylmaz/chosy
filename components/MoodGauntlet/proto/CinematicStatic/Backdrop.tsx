/**
 * PROTOTİP — statik sahnenin ışık katmanı (tek SVG, HAREKETSİZ). Projektör nesnesi YOK.
 * Arkadan öne: ortam ışığı → şeritler → huzme → toz → vinyet → çerçeve haleleri (+ boş çerçeveler).
 * Bulanıklık filtresi kullanılmaz; yumuşak kenar üst üste binen yarı saydam katmanlardan gelir.
 * Renkler yalnız semantic tokenlardan: ışık = accent.active (beam), sıcaklık/şerit = reward.primary.
 */
import React, { useMemo } from 'react';
import { View } from 'react-native';

import Svg, { Circle, Defs, G, LinearGradient, Path, Polygon, RadialGradient, Rect, Stop } from 'react-native-svg';

import { color, radius } from '@/constants/design/semantic';

import { beamWedge, sceneLayout, toPoints, type GridFrame } from './geometry';
import { styles } from './styles';

export type StaticSceneKind = 'waiting' | 'final';

/** Hale katmanları: dışa doğru büyür ve söner (çerçevenin "ışığı tutması"). */
const HALOS = [
  { inflate: 14, opacity: 0.035 },
  { inflate: 8, opacity: 0.06 },
  { inflate: 3, opacity: 0.1 },
] as const;

/** Final sahnesinde huzme bekleme sahnesine göre kısılır: ışık posterleri boğmaz. */
const FINAL_BEAM_DIM = 0.55;

interface BackdropProps {
  kind: StaticSceneKind;
  width: number;
  height: number;
  frames: GridFrame[];
}

export function Backdrop({ kind, width, height, frames }: BackdropProps): React.JSX.Element | null {
  const waiting = kind === 'waiting';
  const layout = useMemo(() => sceneLayout(width, height, frames, waiting), [width, height, frames, waiting]);
  if (layout === null) return null;
  const { beam, glow } = layout;
  const beamK = waiting ? 1 : FINAL_BEAM_DIM;

  return (
    <View style={styles.backdrop} pointerEvents="none">
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="ambient" cx={glow.cx} cy={glow.cy} rx={glow.rx} ry={glow.ry} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color.reward.primary} stopOpacity={waiting ? 0.16 : 0.2} />
            <Stop offset="0.55" stopColor={color.reward.primary} stopOpacity={0.05} />
            <Stop offset="1" stopColor={color.reward.primary} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="source" cx={beam.apex.x} cy={beam.apex.y} r={width * 0.45} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color.accent.active} stopOpacity={0.35 * beamK} />
            <Stop offset="0.4" stopColor={color.reward.primary} stopOpacity={0.12 * beamK} />
            <Stop offset="1" stopColor={color.reward.primary} stopOpacity={0} />
          </RadialGradient>
          <LinearGradient id="beamCore" x1={beam.apex.x} y1={beam.apex.y} x2={beam.end.x} y2={beam.end.y} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color.accent.active} stopOpacity={1} />
            <Stop offset="0.55" stopColor={color.accent.active} stopOpacity={0.4} />
            <Stop offset="1" stopColor={color.accent.active} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="beamWarm" x1={beam.apex.x} y1={beam.apex.y} x2={beam.end.x} y2={beam.end.y} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color.reward.primary} stopOpacity={1} />
            <Stop offset="0.6" stopColor={color.reward.primary} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color.reward.primary} stopOpacity={0} />
          </LinearGradient>
          {/* Şerit gövdesi: gölgede koyu altın, huzmenin kestiği bölgede parlak. */}
          <LinearGradient id="stripBody" x1={0} y1={0} x2={width} y2={0} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={color.reward.primary} stopOpacity={0.28} />
            <Stop offset="0.45" stopColor={color.reward.primary} stopOpacity={0.8} />
            <Stop offset="0.72" stopColor={color.accent.active} stopOpacity={0.7} />
            <Stop offset="1" stopColor={color.reward.primary} stopOpacity={0.3} />
          </LinearGradient>
          <RadialGradient id="vignette" cx="0.5" cy="0.48" r="0.72">
            <Stop offset="0.5" stopColor={color.surface.base} stopOpacity={0} />
            <Stop offset="1" stopColor={color.surface.base} stopOpacity={0.9} />
          </RadialGradient>
          <LinearGradient id="frameBody" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color.surface.raised} stopOpacity={1} />
            <Stop offset="1" stopColor={color.surface.base} stopOpacity={1} />
          </LinearGradient>
          <LinearGradient id="frameSheen" x1="0" y1="1" x2="0.8" y2="0">
            <Stop offset="0" stopColor={color.accent.active} stopOpacity={0.1} />
            <Stop offset="0.45" stopColor={color.accent.active} stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="frameEdge" x1="0" y1="1" x2="0.6" y2="0">
            <Stop offset="0" stopColor={color.accent.active} stopOpacity={0.9} />
            <Stop offset="0.5" stopColor={color.reward.primary} stopOpacity={0.6} />
            <Stop offset="1" stopColor={color.reward.primary} stopOpacity={0.25} />
          </LinearGradient>
        </Defs>

        <Rect x={0} y={0} width={width} height={height} fill="url(#ambient)" />
        <Rect x={0} y={0} width={width} height={height} fill="url(#source)" />

        {layout.ribbons.map((r, i) => (
          <G key={`ribbon-${i}`}>
            <Path d={r.shape.outline} fill="url(#stripBody)" />
            {r.shape.windows.map((w, j) => (
              <Polygon key={`w-${j}`} points={w} fill={color.surface.base} fillOpacity={0.72} />
            ))}
            {r.shape.holes.map((h, j) => (
              <Polygon key={`h-${j}`} points={h} fill={color.surface.base} fillOpacity={0.92} />
            ))}
            <Path d={r.shape.rim} fill="none" stroke={color.accent.active} strokeOpacity={0.5} strokeWidth={1} />
          </G>
        ))}

        {layout.beamLayers.map((l, i) => (
          <Polygon
            key={`beam-${i}`}
            points={toPoints(beamWedge(beam, l.half, l.apexHalf))}
            fill={i < 2 ? 'url(#beamCore)' : 'url(#beamWarm)'}
            fillOpacity={l.opacity * beamK}
          />
        ))}

        {layout.motes.map((m, i) => (
          <Circle key={`mote-${i}`} cx={m.x} cy={m.y} r={m.r} fill={color.accent.active} fillOpacity={m.o * beamK} />
        ))}

        <Rect x={0} y={0} width={width} height={height} fill="url(#vignette)" />

        {frames.map((f, i) => (
          <G key={`frame-${i}`}>
            {HALOS.map((h) => (
              <Rect
                key={`halo-${h.inflate}`}
                x={f.x - h.inflate}
                y={f.y - h.inflate}
                width={f.w + h.inflate * 2}
                height={f.posterH + h.inflate * 2}
                rx={radius.poster + h.inflate}
                fill={color.reward.primary}
                fillOpacity={h.opacity}
              />
            ))}
            {waiting && (
              <>
                <Rect x={f.x} y={f.y} width={f.w} height={f.posterH} rx={radius.poster} fill="url(#frameBody)" />
                <Rect x={f.x} y={f.y} width={f.w} height={f.posterH} rx={radius.poster} fill="url(#frameSheen)" />
                <Rect
                  x={f.x + 0.75}
                  y={f.y + 0.75}
                  width={f.w - 1.5}
                  height={f.posterH - 1.5}
                  rx={radius.poster}
                  fill="none"
                  stroke="url(#frameEdge)"
                  strokeWidth={1.5}
                />
              </>
            )}
          </G>
        ))}
      </Svg>
    </View>
  );
}
