/**
 * GenreDonutChart — Kaydedilen filmlerin genre dagilimi donut chart.
 *
 * react-native-svg ile cizilir. Max 5 dilim + "Other" grubu.
 * Ortada toplam film sayisi.
 *
 * Spec: .claude/specs/STATS_CHARTS_SPEC.md — Component 2
 */
import React, { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';

import { STAGGER_DELAY_MS } from '@/constants/animations';
import SkeletonLoader from '@/components/SkeletonLoader';

import {
  DONUT_SIZE,
  DONUT_STROKE,
  SLICE_COLORS,
  styles,
} from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

export interface GenreDonutChartProps {
  /** Genre dagilimi: { "Drama": 15, "Action": 8, ... } */
  genres: Record<string, number>;
  /** Toplam film sayisi (donut merkez metin) */
  totalFilms: number;
  /** Yukleniyor mu */
  loading: boolean;
}

/** Islenmis dilim verisi */
interface SliceData {
  name: string;
  count: number;
  percent: number;
  color: string;
}

// ─── Yardimcilar ──────────────────────────────────────────────────────────────

/**
 * Genre map'i max 5 dilim + "Other"'a donusturur.
 * Yuzde buyuklugune gore renk atanir.
 */
function processGenres(
  genres: Record<string, number>,
  total: number,
): SliceData[] {
  if (total === 0) return [];

  // Buyukten kucuge sirala
  const sorted = Object.entries(genres)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const slices: SliceData[] = [];
  let otherCount = 0;

  for (let i = 0; i < sorted.length; i++) {
    if (i < 5) {
      slices.push({
        name: sorted[i].name,
        count: sorted[i].count,
        percent: Math.round((sorted[i].count / total) * 100),
        color: SLICE_COLORS[i],
      });
    } else {
      otherCount += sorted[i].count;
    }
  }

  if (otherCount > 0) {
    slices.push({
      name: 'Other',
      count: otherCount,
      percent: Math.round((otherCount / total) * 100),
      color: SLICE_COLORS[5],
    });
  }

  return slices;
}

// ─── Donut SVG ────────────────────────────────────────────────────────────────

const RADIUS = (DONUT_SIZE - DONUT_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP_DEGREES = 2; // dilimler arasi bosluk

/**
 * SVG Circle stroke-dasharray/offset ile donut dilimleri cizer.
 * Baslangic: saat 12 yonu (-90 deg).
 */
function DonutRing({ slices }: { slices: SliceData[] }) {
  const totalPercent = slices.reduce((s, sl) => s + sl.percent, 0);
  const gapPercent = (GAP_DEGREES / 360) * 100;
  let offset = 0;

  return (
    <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
      {/* Arka plan halka */}
      <Circle
        cx={DONUT_SIZE / 2}
        cy={DONUT_SIZE / 2}
        r={RADIUS}
        stroke="#3F3F46"
        strokeWidth={DONUT_STROKE}
        fill="none"
      />

      {/* Dilimler */}
      {slices.map((slice, i) => {
        const slicePercent =
          totalPercent > 0
            ? (slice.percent / totalPercent) * 100 - gapPercent
            : 0;

        const dashLength = (slicePercent / 100) * CIRCUMFERENCE;
        const dashGap = CIRCUMFERENCE - dashLength;
        const rotation = -90 + (offset / 100) * 360;

        offset += (slice.percent / totalPercent) * 100;

        return (
          <Circle
            key={slice.name}
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={RADIUS}
            stroke={slice.color}
            strokeWidth={DONUT_STROKE}
            fill="none"
            strokeDasharray={`${dashLength} ${dashGap}`}
            strokeLinecap="butt"
            rotation={rotation}
            origin={`${DONUT_SIZE / 2}, ${DONUT_SIZE / 2}`}
          />
        );
      })}
    </Svg>
  );
}

// ─── Ana Component ────────────────────────────────────────────────────────────

const GenreDonutChart: React.FC<GenreDonutChartProps> = React.memo(({
  genres,
  totalFilms,
  loading,
}) => {
  const slices = useMemo(
    () => processGenres(genres, totalFilms),
    [genres, totalFilms],
  );

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>{'\u{1F3AC}'}</Text>
        <Text style={styles.headerTitle}>Genre DNA</Text>
      </View>

      {loading ? (
        /* Skeleton */
        <View style={styles.skeletonContainer}>
          <SkeletonLoader
            width={DONUT_SIZE}
            height={DONUT_SIZE}
            borderRadius={DONUT_SIZE / 2}
          />
          <SkeletonLoader width="80%" height={14} borderRadius={4} />
          <SkeletonLoader width="60%" height={14} borderRadius={4} />
          <SkeletonLoader width="40%" height={14} borderRadius={4} />
        </View>
      ) : totalFilms === 0 || slices.length === 0 ? (
        /* Empty */
        <View style={styles.emptyContainer}>
          <View style={styles.donutContainer}>
            <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
              <Circle
                cx={DONUT_SIZE / 2}
                cy={DONUT_SIZE / 2}
                r={RADIUS}
                stroke="#3F3F46"
                strokeWidth={DONUT_STROKE}
                fill="none"
              />
            </Svg>
            <View style={styles.centerTextContainer}>
              <Text style={styles.centerCount}>0</Text>
              <Text style={styles.centerLabel}>films</Text>
            </View>
          </View>
          <Text style={styles.emptyText}>
            Start swiping to see your genre DNA!
          </Text>
        </View>
      ) : (
        <>
          {/* Donut */}
          <View style={styles.donutContainer}>
            <DonutRing slices={slices} />
            <View style={styles.centerTextContainer}>
              <Animated.Text
                style={styles.centerCount}
                entering={FadeIn.delay(400)}
              >
                {totalFilms}
              </Animated.Text>
              <Animated.Text
                style={styles.centerLabel}
                entering={FadeIn.delay(500)}
              >
                films
              </Animated.Text>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            {slices.map((slice, i) => (
              <Animated.View
                key={slice.name}
                style={styles.legendItem}
                entering={FadeInDown.delay(i * STAGGER_DELAY_MS)}
              >
                <View
                  style={[styles.legendDot, { backgroundColor: slice.color }]}
                />
                <Text style={styles.legendName}>{slice.name}</Text>
                <Text style={styles.legendPercent}>{slice.percent}%</Text>
              </Animated.View>
            ))}
          </View>
        </>
      )}
    </View>
  );
});

GenreDonutChart.displayName = 'GenreDonutChart';

export default GenreDonutChart;
