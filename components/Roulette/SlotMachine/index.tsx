/**
 * SlotMachine — 3 sutunlu poster slot makinesi.
 *
 * Watchlist Roulette ekraninda kullanilir.
 * Her sutun (reel) dikeyde poster listesi akar, staggered durur.
 * Son poster = secilen film (jackpot).
 */
import React, { useEffect } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Slot machine 3 sutun — poster boyutlari */
const SLOT_GAP = 6;
const SLOT_H_PAD = 24;
const SLOT_COL_WIDTH = Math.floor((SCREEN_WIDTH - SLOT_H_PAD * 2 - SLOT_GAP * 2) / 3);
const SLOT_POSTER_H = Math.floor(SLOT_COL_WIDTH * 1.5);

/** Her slot sutununda akan poster sayisi (son poster = secilen film) */
export const REEL_LENGTH = 16;

/** Sutun durus zamanlari (ms) — staggered stop (1.2s → 1.5s → 1.8s) */
export const REEL_STOP_TIMES = [1200, 1500, 1800];

/** Son sutun durma + reveal gecikmesi */
export const RESULT_DELAY = REEL_STOP_TIMES[2] + 400;

// ─── Disa aktarilan boyut sabitleri ──────────────────────────────────────────

export { SLOT_COL_WIDTH, SLOT_POSTER_H, SLOT_GAP, SLOT_H_PAD };

// ─── buildReelPosters ──────────────────────────────────────────────────────

/**
 * Bir slot sutunu icin poster URL listesi olusturur.
 * Son eleman her zaman pickedPosterUrl olur (slot orada durur).
 * Diger posterler rastgele watchlist filmlerinden secilir.
 */
export function buildReelPosters(
  allPosters: string[],
  pickedPosterUrl: string,
  length: number,
): string[] {
  const reelPosters: string[] = [];
  for (let i = 0; i < length - 1; i++) {
    const randomUrl = allPosters[Math.floor(Math.random() * allPosters.length)];
    reelPosters.push(randomUrl);
  }
  // Son poster = secilen film (slot burada durur)
  reelPosters.push(pickedPosterUrl);
  return reelPosters;
}

// ─── SlotReel ──────────────────────────────────────────────────────────────

interface SlotReelProps {
  /** Sirayla gorunecek poster URL'leri — son eleman secilen film */
  posters: string[];
  /** Bu sutunun durma suresi (ms) */
  stopTime: number;
  /** Sutun durduğunda tetiklenir */
  onStop?: () => void;
}

/**
 * Tek bir slot sutunu. Dikeyde poster listesi akar, son posterde durur.
 */
export function SlotReel({ posters, stopTime, onStop }: SlotReelProps) {
  const translateY = useSharedValue(0);

  useEffect(() => {
    // Toplam scroll mesafesi: tum posterler - son poster (gorunur kalan)
    const totalScroll = (posters.length - 1) * SLOT_POSTER_H;

    // Hizli baslangi + yumusak durus + hafif bounce
    // Sprint spec: cubic-bezier(0.34, 1.56, 0.64, 1)
    translateY.value = withTiming(-totalScroll, {
      duration: stopTime,
      easing: Easing.bezier(0.34, 1.56, 0.64, 1),
    });

    // Haptic + callback durduğunda
    const timer = setTimeout(() => {
      if (onStop) onStop();
    }, stopTime);

    return () => clearTimeout(timer);
  }, [posters, stopTime, translateY, onStop]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.reelWindow}>
      <Animated.View style={[styles.reelStrip, animStyle]}>
        {posters.map((url, i) => (
          <Image
            key={`reel-${i}-${url}`}
            source={{ uri: url }}
            style={styles.reelPoster}
            resizeMode="cover"
          />
        ))}
      </Animated.View>

      {/* Ust-alt gradient — slot makinesi kenar efekti */}
      <LinearGradient
        colors={[Colors.background, 'transparent']}
        style={styles.reelGradientTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', Colors.background]}
        style={styles.reelGradientBottom}
        pointerEvents="none"
      />
    </View>
  );
}

// ─── SlotMachine ─────────────────────────────────────────────────────────────

interface SlotMachineProps {
  /** 3 sutun reel verisi — her biri poster URL listesi */
  reelData: string[][];
  /** Jackpot glow animasyon stili */
  glowStyle: { opacity: number };
  /** Reel durduğunda cagrılır (reelIndex: 0|1|2) */
  onReelStop: (reelIndex: number) => void;
}

/**
 * 3 sutunlu slot makinesi — cerceve + glow + win line.
 */
export default function SlotMachine({ reelData, glowStyle, onReelStop }: SlotMachineProps) {
  return (
    <View style={styles.slotMachine}>
      {/* Jackpot glow arka plan */}
      <Animated.View style={[styles.jackpotGlow, glowStyle]} />

      {/* Slot cercevesi */}
      <View style={styles.slotFrame}>
        <View style={styles.slotColumns}>
          {reelData.map((posters, colIdx) => (
            <SlotReel
              key={`col-${colIdx}-${posters.length}`}
              posters={posters}
              stopTime={REEL_STOP_TIMES[colIdx]}
              onStop={() => onReelStop(colIdx)}
            />
          ))}
        </View>

        {/* Orta cizgi gostergesi — "kazanan satir" */}
        <View style={styles.winLine} pointerEvents="none" />
      </View>
    </View>
  );
}

// ─── Stiller ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  /* Slot machine */
  slotMachine: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  jackpotGlow: {
    position: 'absolute',
    width: SCREEN_WIDTH - 20,
    height: SLOT_POSTER_H + 40,
    borderRadius: 20,
    backgroundColor: Colors.goldGlow,
  },
  slotFrame: {
    flexDirection: 'column',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.cardBorder,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.cardSolid,
    padding: 8,
    overflow: 'hidden',
  },
  slotColumns: {
    flexDirection: 'row',
    gap: SLOT_GAP,
  },

  /* Tek sutun (reel) */
  reelWindow: {
    width: SLOT_COL_WIDTH,
    height: SLOT_POSTER_H,
    overflow: 'hidden',
    borderRadius: Theme.borderRadius.sm,
  },
  reelStrip: {
    width: SLOT_COL_WIDTH,
  },
  reelPoster: {
    width: SLOT_COL_WIDTH,
    height: SLOT_POSTER_H,
    borderRadius: Theme.borderRadius.sm,
  },
  reelGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  reelGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },

  /* Kazanan satir cizgisi */
  winLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 2,
    backgroundColor: Colors.gold,
    opacity: 0.5,
  },
});
