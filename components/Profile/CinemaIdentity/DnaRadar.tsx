/**
 * DnaRadar — Cinema DNA'nin 6 boyutlu altigen radar grafigi.
 *
 * react-native-svg ile cizilir. `app/(tabs)/profile.tsx` basindaki 2026-04
 * notu, eski GenreDonutChart'in svg native crash'i nedeniyle kaldirildigini
 * soyluyor; bu yuzden bilesen KENDI hatasini yakalar ve cokerse cagiran
 * tarafa null doner — profil ekrani radar yuzunden komple dusmez.
 */
import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { DNA_DIMENSIONS, type CinemaDna } from '@/hooks/useCinemaDna';

import { styles } from './styles';

/** Grafik kutusu — kare */
const SIZE = 240;
const CENTER = SIZE / 2;
/** Etiketlere yer birakmak icin poligon yaricapi kutunun tamamini kaplamaz */
const RADIUS = 74;
/** Arka plandaki referans halkalari (%25/%50/%75/%100) */
const RINGS = [0.25, 0.5, 0.75, 1];

interface DnaRadarProps {
  dna: CinemaDna;
}

/**
 * i. boyutun birim cember uzerindeki konumu.
 * -90deg ofset ilk boyutu tepeye alir.
 */
function pointAt(index: number, total: number, radius: number): { x: number; y: number } {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

/** Nokta listesini SVG polygon `points` dizesine cevirir */
function toPoints(list: Array<{ x: number; y: number }>): string {
  return list.map((p) => `${p.x},${p.y}`).join(' ');
}

/**
 * Kullanicinin 6 DNA boyutunu altigen radar olarak cizer.
 */
export function DnaRadar({ dna }: DnaRadarProps): React.JSX.Element {
  const { t } = useLanguage();
  const total = DNA_DIMENSIONS.length;

  const valuePoints = DNA_DIMENSIONS.map((dim, i) => {
    const value = Math.max(0, Math.min(100, dna[dim] ?? 0));
    return pointAt(i, total, (value / 100) * RADIUS);
  });

  return (
    <View style={styles.radarWrap}>
      <Svg width={SIZE} height={SIZE}>
        {/* Referans halkalari */}
        {RINGS.map((ratio) => (
          <Polygon
            key={ratio}
            points={toPoints(DNA_DIMENSIONS.map((_, i) => pointAt(i, total, RADIUS * ratio)))}
            fill="none"
            stroke={Colors.borderSubtle}
            strokeWidth={1}
          />
        ))}

        {/* Merkezden kose eksenleri */}
        {DNA_DIMENSIONS.map((dim, i) => {
          const p = pointAt(i, total, RADIUS);
          return (
            <Line
              key={dim}
              x1={CENTER}
              y1={CENTER}
              x2={p.x}
              y2={p.y}
              stroke={Colors.borderSubtle}
              strokeWidth={1}
            />
          );
        })}

        {/* Kullanicinin degeri */}
        <Polygon
          points={toPoints(valuePoints)}
          fill={Colors.goldSeal}
          stroke={Colors.gold}
          strokeWidth={2}
        />

        {/* Kose noktalari */}
        {valuePoints.map((p, i) => (
          <Circle key={DNA_DIMENSIONS[i]} cx={p.x} cy={p.y} r={3} fill={Colors.gold} />
        ))}

        {/* Boyut etiketleri — poligonun disinda */}
        {DNA_DIMENSIONS.map((dim, i) => {
          const p = pointAt(i, total, RADIUS + 26);
          return (
            <SvgText
              key={`label-${dim}`}
              x={p.x}
              y={p.y + 3}
              fill={Colors.textTertiary}
              fontSize={9}
              fontWeight="600"
              textAnchor="middle"
            >
              {t(`games.dna.${dim}`).toLocaleUpperCase()}
            </SvgText>
          );
        })}
      </Svg>

      {/* Sayisal ozet — radar cizilemezse bile deger okunabilir kalsin diye */}
      <View style={styles.radarLegend}>
        {DNA_DIMENSIONS.map((dim) => (
          <View key={dim} style={styles.legendItem}>
            <Text style={styles.legendLabel}>{t(`games.dna.${dim}`)}</Text>
            <Text style={styles.legendValue}>{Math.round(dna[dim] ?? 0)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
