/**
 * RitualRing — Profil avatarını çevreleyen ritüel halkası.
 *
 * Her dilim bir gün (eskiden yeniye, saat yönünde, tepeden başlar; son dilim
 * bugün). Dolu dilim `marquee` — ödül katmanı altını (E-23: altın yalnız
 * ödül), boş dilim `graphite`. Dilim sayısı parametrik: Faz 3'te DNA güven
 * göstergesi (§10.4, 9 segment) aynı bileşenle çizilebilir.
 *
 * Yalnızca çizer; doluluk hesabı `ritualWeek.ts`'te. Ebeveynini `diameter`
 * ölçüsünde doldurur (absoluteFill). Dokunuşu yutmaz — avatar butonu çalışır.
 * Butonun İÇİNE konmaz: iOS erişilebilir butonun çocuklarını gizler, halka
 * etiketi kaybolur. Butonun kardeşi olarak yerleştirilir.
 *
 * Hareket: dolu katman açılışta 0→1 opaklıkla gelir (§7 ışık süresi 600ms,
 * lineer). Reduce Motion'da §7.5 cross-fade süresi.
 */
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { color } from '@/constants/design/semantic';
import { DISSOLVE_DURATION, REDUCED_MOTION_DURATION } from '@/constants/design/motion';

/** Dilimler arası boşluk (derece). Yuvarlak uç payını da karşılar. */
const SEGMENT_GAP_DEG = 8;

interface RitualRingProps {
  /** Dilim doluluğu, eskiden yeniye. Uzunluk = dilim sayısı. */
  filled: readonly boolean[];
  /** Halkanın dış çapı (pt). */
  diameter: number;
  /** Çizgi kalınlığı (pt). */
  strokeWidth: number;
  accessibilityLabel: string;
}

/** Tepeden (−90°) saat yönünde `index`. dilimin yay path'i. */
function segmentPath(index: number, count: number, radius: number, center: number): string {
  const sweep = 360 / count;
  const startDeg = -90 + index * sweep + SEGMENT_GAP_DEG / 2;
  const endDeg = -90 + (index + 1) * sweep - SEGMENT_GAP_DEG / 2;
  const toPoint = (deg: number): string => {
    const rad = (deg * Math.PI) / 180;
    return `${center + radius * Math.cos(rad)} ${center + radius * Math.sin(rad)}`;
  };
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${toPoint(startDeg)} A ${radius} ${radius} 0 ${largeArc} 1 ${toPoint(endDeg)}`;
}

export function RitualRing({
  filled,
  diameter,
  strokeWidth,
  accessibilityLabel,
}: RitualRingProps): React.JSX.Element {
  const isReducedMotion = useReducedMotion();
  const fillOpacity = useSharedValue(0);

  useEffect(() => {
    fillOpacity.value = withTiming(1, {
      duration: isReducedMotion ? REDUCED_MOTION_DURATION.crossFade : DISSOLVE_DURATION.lightBleed,
      easing: Easing.linear,
    });
  }, [fillOpacity, isReducedMotion]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fillOpacity.value }));

  const center = diameter / 2;
  const radius = (diameter - strokeWidth) / 2;
  const count = filled.length;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}>
      <Svg width={diameter} height={diameter} style={StyleSheet.absoluteFill}>
        {filled.map((_, i) => (
          <Path
            key={`empty-${i}`}
            d={segmentPath(i, count, radius, center)}
            stroke={color.surface.border}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, fillStyle]}>
        <Svg width={diameter} height={diameter}>
          {filled.map((isFilled, i) =>
            isFilled ? (
              <Path
                key={`filled-${i}`}
                d={segmentPath(i, count, radius, center)}
                stroke={color.reward.primary}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                fill="none"
              />
            ) : null,
          )}
        </Svg>
      </Animated.View>
    </View>
  );
}
