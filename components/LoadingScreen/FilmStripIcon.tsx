/**
 * FilmStripIcon — C-shaped film strip SVG recreated from the chosy.ai logo.
 * Cream/champagne tones on transparent background.
 * Designed to be rotated by the parent via Reanimated.
 */
import React from 'react';

import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Path,
  Rect,
  G,
  Circle,
} from 'react-native-svg';

interface FilmStripIconProps {
  /** Icon size (width & height) */
  size?: number;
}

/**
 * SVG recreation of the C-shaped film strip logo.
 * Uses cream/champagne gradient to match the original logo style.
 */
export function FilmStripIcon({ size = 120 }: FilmStripIconProps) {
  const center = size / 2;
  const outerR = size * 0.42;
  const innerR = size * 0.28;
  const midR = (outerR + innerR) / 2;
  const stripWidth = outerR - innerR;

  // C-shape gap: 65° opening at bottom-right
  const gapAngleDeg = 65;

  // Arc helper
  const polarToCart = (cx: number, cy: number, r: number, angleDeg: number) => {
    const rad = (angleDeg - 90) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  const startDeg = gapAngleDeg / 2;
  const endDeg = 360 - gapAngleDeg / 2;

  // Outer arc points
  const outerStart = polarToCart(center, center, outerR, startDeg);
  const outerEnd = polarToCart(center, center, outerR, endDeg);

  // Inner arc points (reverse direction)
  const innerStart = polarToCart(center, center, innerR, endDeg);
  const innerEnd = polarToCart(center, center, innerR, startDeg);

  // Main C-shape path
  const cPath = [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 1 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerStart.x} ${innerStart.y}`,
    `A ${innerR} ${innerR} 0 1 0 ${innerEnd.x} ${innerEnd.y}`,
    'Z',
  ].join(' ');

  // Sprocket holes along the middle radius
  const sprocketCount = 18;
  const sprocketR = stripWidth * 0.1;
  const sprockets: Array<{ cx: number; cy: number }> = [];

  for (let i = 0; i < sprocketCount; i++) {
    const t = i / sprocketCount;
    const angleDeg = startDeg + t * (endDeg - startDeg);
    const pos = polarToCart(center, center, midR, angleDeg);
    sprockets.push({ cx: pos.x, cy: pos.y });
  }

  // Perforation rectangles along outer and inner edges
  const perfCount = 24;
  const perfOuterR = outerR - stripWidth * 0.08;
  const perfInnerR = innerR + stripWidth * 0.08;
  const perfW = stripWidth * 0.12;
  const perfH = stripWidth * 0.18;

  const perforations: Array<{ x: number; y: number; angle: number; r: number }> = [];
  for (let i = 0; i < perfCount; i++) {
    const t = i / perfCount;
    const angleDeg = startDeg + t * (endDeg - startDeg);
    // Outer perforations
    perforations.push({
      ...polarToCart(center, center, perfOuterR, angleDeg),
      angle: angleDeg,
      r: perfOuterR,
    });
    // Inner perforations
    perforations.push({
      ...polarToCart(center, center, perfInnerR, angleDeg),
      angle: angleDeg,
      r: perfInnerR,
    });
  }

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        {/* Cream/champagne gradient matching the logo */}
        <LinearGradient id="filmGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#F5E6D0" stopOpacity={1} />
          <Stop offset="35%" stopColor="#EADBC6" stopOpacity={1} />
          <Stop offset="70%" stopColor="#D4C4AE" stopOpacity={1} />
          <Stop offset="100%" stopColor="#C4B49E" stopOpacity={1} />
        </LinearGradient>

        {/* Subtle highlight gradient for depth */}
        <LinearGradient id="highlightGrad" x1="20%" y1="0%" x2="80%" y2="100%">
          <Stop offset="0%" stopColor="#FFF8EE" stopOpacity={0.6} />
          <Stop offset="100%" stopColor="#D4C4AE" stopOpacity={0} />
        </LinearGradient>
      </Defs>

      {/* Main C-shaped film strip body */}
      <Path d={cPath} fill="url(#filmGrad)" />

      {/* Highlight overlay for 3D depth */}
      <Path d={cPath} fill="url(#highlightGrad)" />

      {/* Sprocket holes (dark cutouts along the middle) */}
      {sprockets.map((s, i) => (
        <Circle
          key={`sprocket-${i}`}
          cx={s.cx}
          cy={s.cy}
          r={sprocketR}
          fill="#0B0B0B"
          opacity={0.85}
        />
      ))}

      {/* Perforation rectangles along edges */}
      {perforations.map((p, i) => {
        return (
          <G
            key={`perf-${i}`}
            transform={`translate(${p.x}, ${p.y}) rotate(${p.angle})`}
          >
            <Rect
              x={-perfW / 2}
              y={-perfH / 2}
              width={perfW}
              height={perfH}
              rx={perfW * 0.2}
              fill="#0B0B0B"
              opacity={0.7}
            />
          </G>
        );
      })}

      {/* Inner shadow ring for depth */}
      <Circle
        cx={center}
        cy={center}
        r={innerR + 1}
        fill="none"
        stroke="rgba(0,0,0,0.15)"
        strokeWidth={1.5}
      />
    </Svg>
  );
}
