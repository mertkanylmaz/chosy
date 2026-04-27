/**
 * FilmReelAnimation — Premium Selüloit Film Makarası
 *
 * 3 iç içe dönen film şeridi halkası. Her halka 3 katmandan oluşur:
 *   1. Sinematik siyah gövde (#121212) — antrasit selüloit plastik
 *   2. İç + dış kenar perforasyonları (SVG Mask — keskin dikdörtgen delikler, rx=0)
 *   3. Şampanya/altın LinearGradient yansıması (#F2D492 → #E5C07B → şeffaf)
 *      Stüdyo ışığı çapraz vuruyor gibi — dar açılı, tek yönlü
 *
 * Derinlik: SVG DropShadow filtresi (siyah, opacity:0.7, blur:10, dy:4)
 * Gradyanlar: LinearGradient (selüloit doku) + RadialGradient (arka glow)
 *
 * Animasyon (Reanimated parallax):
 *   - Dış halka: 22s, saat yönünde (en yavaş)
 *   - Orta halka: 14s, saat tersi (ters yön)
 *   - İç halka:  8s,  saat yönünde (en hızlı)
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';

import Svg, {
  Circle,
  Defs,
  FeDropShadow,
  Filter,
  G,
  LinearGradient,
  Mask,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { SIZE, styles } from './styles';

// ─── Koordinat ────────────────────────────────────────────────────────────────

/** SVG koordinat merkezi */
const CX = SIZE / 2;
const CY = SIZE / 2;

// ─── Ring Tanımları ───────────────────────────────────────────────────────────

interface RingDefinition {
  /** Benzersiz React key + SVG ID prefix */
  id: string;
  /** Dış kenar yarıçapı */
  outerRadius: number;
  /** İç kenar yarıçapı */
  innerRadius: number;
  /** Dış kenardaki perforasyon sayısı */
  outerSprocketCount: number;
  /** İç kenardaki perforasyon sayısı */
  innerSprocketCount: number;
  /** Perforasyon genişliği (teğet yönünde, px) */
  sprocketW: number;
  /** Tam tur süresi (ms) */
  duration: number;
  /** true = saat yönünde */
  clockwise: boolean;
}

const RINGS: RingDefinition[] = [
  {
    id: 'outer',
    outerRadius: 130,
    innerRadius: 110,
    outerSprocketCount: 28,
    innerSprocketCount: 22,
    sprocketW: 7,
    duration: 22000,
    clockwise: true,
  },
  {
    id: 'middle',
    outerRadius: 94,
    innerRadius: 76,
    outerSprocketCount: 20,
    innerSprocketCount: 15,
    sprocketW: 6,
    duration: 14000,
    clockwise: false,
  },
  {
    id: 'inner',
    outerRadius: 58,
    innerRadius: 43,
    outerSprocketCount: 13,
    innerSprocketCount: 9,
    sprocketW: 5,
    duration: 8000,
    clockwise: true,
  },
];

// ─── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────

/** Dereceyi radyana çevirir */
function deg2rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Belirtilen yarıçap üzerinde perforasyon dikdörtgenleri üretir.
 * SVG Mask içinde kullanılır — fill="black" → delik keser.
 *
 * @param radius   - Perforasyon merkezlerinin yarıçapı
 * @param count    - Perforasyon sayısı
 * @param w        - Genişlik (teğet yönü)
 * @param h        - Yükseklik (radyal yön)
 */
function buildSprocketHoles(
  radius: number,
  count: number,
  w: number,
  h: number,
): React.ReactElement[] {
  return Array.from({ length: count }, (_, i) => {
    const angleDeg = (360 / count) * i;
    const rad = deg2rad(angleDeg);
    const x = CX + radius * Math.cos(rad);
    const y = CY + radius * Math.sin(rad);
    // +90° → dikdörtgenin uzun kenarını halka teğetine hizalar
    const rotation = angleDeg + 90;

    return (
      <Rect
        key={i}
        x={x - w / 2}
        y={y - h / 2}
        width={w}
        height={h}
        rx={0}
        fill="black"
        transform={`rotate(${rotation}, ${x}, ${y})`}
      />
    );
  });
}

// buildGlareArc kaldırıldı — kalın "sosis" yansımalar yerine
// LinearGradient ile stüdyo ışığı efekti kullanılıyor.

// ─── FilmRing Alt Bileşeni ────────────────────────────────────────────────────

/**
 * Tek bir dönen film şeridi halkası.
 *
 * Anatomy:
 *   - SVG Mask: halka bant şekli + iç/dış kenar perforasyonları (rx=0, keskin)
 *   - Gövde: #121212 sinematik antrasit selüloit
 *   - Gradyan: şampanya/altın LinearGradient (#F2D492 → şeffaf → siyah)
 *   - Kenar: ince altın çizgi (derinlik)
 *   - Filter: SVG DropShadow siyah, opacity:0.7, blur:10, dy:4 (3D bobin illüzyonu)
 */
function FilmRing({
  id,
  outerRadius,
  innerRadius,
  outerSprocketCount,
  innerSprocketCount,
  sprocketW,
  duration,
  clockwise,
}: RingDefinition) {
  const rot = useSharedValue(0);

  const sprocketH  = 5; // perforasyon radyal yüksekliği (px)

  // Perforasyonlar kenar hizasına yakın — 4px içeride
  const outerSprocketR = outerRadius - 4;
  const innerSprocketR = innerRadius + 4;

  // SVG ID'leri (scope = bu Svg elementi)
  const maskId     = `m-${id}`;
  const gradId     = `g-${id}`;
  const filterId   = `f-${id}`;

  useEffect(() => {
    rot.value = withRepeat(
      withTiming(clockwise ? 360 : -360, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
    return () => cancelAnimation(rot);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rot.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.ringLayer, animStyle]}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>

          {/* ── Mask: halka bant + perforasyon delikleri ── */}
          <Mask id={maskId}>
            {/* Beyaz = görünür (dış daire) */}
            <Circle cx={CX} cy={CY} r={outerRadius} fill="white" />
            {/* Siyah = kesilmiş (iç daire) */}
            <Circle cx={CX} cy={CY} r={innerRadius} fill="black" />
            {/* Dış kenar perforasyonları */}
            {buildSprocketHoles(outerSprocketR, outerSprocketCount, sprocketW, sprocketH)}
            {/* İç kenar perforasyonları */}
            {buildSprocketHoles(innerSprocketR, innerSprocketCount, sprocketW, sprocketH)}
          </Mask>

          {/* ── Şampanya/altın stüdyo ışığı gradyanı ──
               Çapraz (sol-üst → sağ-alt): parlak highlight → şeffaf → koyu gölge
               Dar açılı, keskin — "sosis" arc yok */}
          <LinearGradient id={gradId} x1="5%" y1="5%" x2="95%" y2="95%">
            <Stop offset="0%"   stopColor="#F2D492" stopOpacity={0.55} />
            <Stop offset="22%"  stopColor="#E5C07B" stopOpacity={0.28} />
            <Stop offset="48%"  stopColor="#E5C07B" stopOpacity={0.04} />
            <Stop offset="100%" stopColor="#000000" stopOpacity={0.28} />
          </LinearGradient>

          {/* ── DropShadow filtresi: güçlü 3D makara derinliği ──
               Siyah, opacity 0.7 — katmanlar birbirinin üstünde yüzüyor gibi */}
          <Filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
            <FeDropShadow
              dx={0}
              dy={4}
              stdDeviation={10}
              floodColor="#000000"
              floodOpacity={0.7}
            />
          </Filter>

        </Defs>

        {/* ── Ana bant: mask + filter uygulanmış ── */}
        <G mask={`url(#${maskId})`} filter={`url(#${filterId})`}>

          {/* Sinematik antrasit gövde — #121212 siyah selüloit plastik */}
          <Rect
            x={0} y={0}
            width={SIZE} height={SIZE}
            fill="#121212"
          />

          {/* Stüdyo ışığı şampanya/altın LinearGradient — çapraz, dar, keskin */}
          <Rect
            x={0} y={0}
            width={SIZE} height={SIZE}
            fill={`url(#${gradId})`}
          />

        </G>

        {/* Kenar detay çizgileri — ince altın, mask dışında */}
        <Circle
          cx={CX} cy={CY}
          r={outerRadius - 0.5}
          stroke={Colors.goldMid}
          strokeWidth={0.8}
          strokeOpacity={0.28}
          fill="none"
        />
        <Circle
          cx={CX} cy={CY}
          r={innerRadius + 0.5}
          stroke={Colors.goldMid}
          strokeWidth={0.8}
          strokeOpacity={0.22}
          fill="none"
        />

      </Svg>
    </Animated.View>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * FilmSeridi — 3 katlı gerçekçi film makarası animasyonu.
 *
 * Kullanım yerleri:
 *   - auth.tsx: hesap açılış ekranı
 *   - watchlist.tsx: boş watchlist durumu
 *   - AIProcessingOverlay: AI analiz bekleme ekranı
 *   - MilestoneCelebration: curator_5 achievement overlay
 *
 * Teknik: react-native-svg (Mask + Filter + LinearGradient) + Reanimated parallax
 *
 * @alias FilmSeridi
 */
export default function FilmSeridi() {
  return (
    <View style={styles.container}>

      {/* Arka plan radyal glow — statik */}
      <View style={styles.glowLayer}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <RadialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%"   stopColor={Colors.gold} stopOpacity={0.16} />
              <Stop offset="40%"  stopColor={Colors.gold} stopOpacity={0.05} />
              <Stop offset="100%" stopColor={Colors.gold} stopOpacity={0}    />
            </RadialGradient>
          </Defs>
          <Circle cx={CX} cy={CY} r={SIZE / 2} fill="url(#bgGlow)" />
        </Svg>
      </View>

      {/* 3 film şeridi halkası */}
      {RINGS.map((ring) => (
        <FilmRing key={ring.id} {...ring} />
      ))}

      {/* Merkez projektör noktası */}
      <View style={styles.centerDot} />

    </View>
  );
}
