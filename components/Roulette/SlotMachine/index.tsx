/**
 * SlotMachine — 3 sutunlu poster slot makinesi.
 *
 * Watchlist Roulette ekraninda kullanilir.
 * Her sutun (reel) dikeyde poster listesi akar, staggered durur.
 * Son poster = secilen film (jackpot).
 *
 * V7 — expo-image fix:
 *   - ROOT CAUSE: RN Image hizli Reanimated scroll sirasinda decode etmiyor
 *     → renkli placeholder'lar gorunuyordu
 *   - FIX: expo-image (memory-disk cache + aninda decode) kullan
 *   - Casino-grade easing: dramatik yavaslama
 *   - Tap-to-stop: kullanici dokunarak erken durdurabilir
 *   - Variable timing: her spin farkli hissedilir
 */
import React, { useCallback, useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { logger } from '@/utils/logger';

// --- Sabitler ---

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/** Slot machine 3 sutun — poster boyutlari */
const SLOT_GAP = 6;
const SLOT_H_PAD = 24;
const SLOT_COL_WIDTH = Math.floor(
  (SCREEN_WIDTH - SLOT_H_PAD * 2 - SLOT_GAP * 2) / 3,
);
const SLOT_POSTER_H = Math.floor(SLOT_COL_WIDTH * 1.5);

/** Her slot sutununda akan poster sayisi (son poster = secilen film) */
export const REEL_LENGTH = 20;

/** Base sutun durus zamanlari (ms) — staggered stop */
const BASE_STOP_TIMES = [3000, 4000, 5000];

/** Variable timing — her spin farkli hissedilsin */
function getVariableStopTimes(): [number, number, number] {
  const variance = () => Math.floor(Math.random() * 400) - 200; // -200..+200ms
  return [
    BASE_STOP_TIMES[0] + variance(),
    BASE_STOP_TIMES[1] + variance(),
    BASE_STOP_TIMES[2] + variance(),
  ];
}

/** Son sutun durma + reveal gecikmesi */
export const RESULT_DELAY = BASE_STOP_TIMES[2] + 800;

/** Eski export uyumluluk */
export const REEL_STOP_TIMES = BASE_STOP_TIMES;

// --- Disa aktarilan boyut sabitleri ---

export { SLOT_COL_WIDTH, SLOT_POSTER_H, SLOT_GAP, SLOT_H_PAD };

// --- buildReelPosters ---

/**
 * Bir slot sutunu icin poster URL listesi olusturur.
 * Son eleman her zaman pickedPosterUrl olur (slot orada durur).
 * Diger posterler rastgele havuzdan secilir.
 */
export function buildReelPosters(
  allPosters: string[],
  pickedPosterUrl: string,
  length: number,
): string[] {
  const fillerPool = allPosters.filter((url) => url !== pickedPosterUrl);
  const pool = fillerPool.length >= 3 ? fillerPool : (allPosters.length > 0 ? allPosters : []);

  const reelPosters: string[] = [];
  for (let i = 0; i < length - 1; i++) {
    if (pool.length > 0) {
      const randomUrl = pool[Math.floor(Math.random() * pool.length)];
      reelPosters.push(randomUrl);
    } else {
      reelPosters.push('');
    }
  }
  reelPosters.push(pickedPosterUrl);
  return reelPosters;
}

// --- Reel poster renk paleti (fallback — poster yuklenemezse) ---

const PLACEHOLDER_COLORS = [
  '#2D1B3D', '#1B2D3D', '#3D2D1B', '#1B3D2D',
  '#3D1B2D', '#2D3D1B', '#1B1B3D', '#3D1B1B',
  '#1B3D3D', '#3D3D1B', '#2D1B2D', '#1B2D1B',
];

// --- ReelPoster ---

/**
 * Tek poster karosu.
 *
 * KRITIK: expo-image kullanir (react-native Image DEGIL).
 * RN Image hizli Reanimated translateY sirasinda decode etmiyor,
 * sadece renkli placeholder gorunuyordu.
 *
 * expo-image avantajlari:
 *   - memory-disk cache: prefetch edilen image aninda render
 *   - recyclingKey: reel pozisyonuna gore image yeniden kullanir
 *   - transition=0: cache'den gelince animasyon yok, aninda gorunur
 */
const ReelPoster = React.memo(function ReelPoster({
  url,
  index,
}: {
  url: string;
  index: number;
}) {
  const bgColor = PLACEHOLDER_COLORS[index % PLACEHOLDER_COLORS.length];

  return (
    <View style={[styles.reelPoster, { backgroundColor: bgColor }]}>
      {url ? (
        <Image
          source={{ uri: url }}
          style={styles.reelPosterImage}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`reel-${index}`}
          transition={0}
        />
      ) : null}
    </View>
  );
});

// --- SlotReel ---

interface SlotReelProps {
  posters: string[];
  stopTime: number;
  onStop?: () => void;
  forceStop: { value: number };
}

/**
 * Tek slot sutunu. Dikeyde poster listesi yukari kayar, son posterde durur.
 *
 * Casino-grade bezier easing: hizli basla, dramatik yavasla.
 */
function SlotReel({ posters, stopTime, onStop, forceStop }: SlotReelProps) {
  const translateY = useSharedValue(0);
  const animStarted = useRef(false);
  const reelStopped = useRef(false);

  const totalScroll = (posters.length - 1) * SLOT_POSTER_H;

  const notifyStop = useCallback(() => {
    if (!reelStopped.current) {
      reelStopped.current = true;
      if (onStop) onStop();
    }
  }, [onStop]);

  const startAnimation = useCallback(() => {
    if (animStarted.current) return;
    animStarted.current = true;

    logger.log('[SlotReel] Starting animation',
      'posters:', posters.length,
      'totalScroll:', totalScroll,
      'stopTime:', stopTime,
    );

    translateY.value = 0;
    translateY.value = withTiming(-totalScroll, {
      duration: stopTime,
      // Casino-grade easing: hizli donus, dramatik son yavaslama
      // %60 sure tam hizda, son %40 ağır frenleme
      easing: Easing.bezier(0.15, 0.85, 0.05, 1.0),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posters.length, stopTime]);

  // Force stop — kullanici dokundu
  useAnimatedReaction(
    () => forceStop.value,
    (val) => {
      if (val === 1 && !reelStopped.current) {
        cancelAnimation(translateY);
        translateY.value = withTiming(-totalScroll, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        });
        runOnJS(notifyStop)();
      }
    },
  );

  useEffect(() => {
    if (posters.length <= 1) return;

    // expo-image cache'den render — kisa bekleme image decode icin
    const startTimer = setTimeout(() => {
      startAnimation();
    }, 250); // 250ms mount + image decode stabilizasyonu

    const stopTimer = setTimeout(() => {
      notifyStop();
    }, stopTime + 200);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(stopTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (posters.length === 0) {
    return (
      <View style={styles.reelWindow}>
        <View style={[styles.reelPoster, { backgroundColor: Colors.bgElevated }]} />
      </View>
    );
  }

  return (
    <View style={styles.reelWindow}>
      <Animated.View style={[styles.reelStrip, animStyle]}>
        {posters.map((url, i) => (
          <ReelPoster key={`p${i}`} url={url} index={i} />
        ))}
      </Animated.View>

      {/* Ust gradient — slot kenar efekti */}
      <LinearGradient
        colors={[Colors.background, 'transparent']}
        style={styles.reelGradientTop}
        pointerEvents="none"
      />
      {/* Alt gradient — slot kenar efekti */}
      <LinearGradient
        colors={['transparent', Colors.background]}
        style={styles.reelGradientBottom}
        pointerEvents="none"
      />
    </View>
  );
}

// --- SlotMachine ---

/** Imperative handle — tap-to-stop icin */
export interface SlotMachineHandle {
  forceStopAll: () => void;
}

interface SlotMachineProps {
  reelData: string[][];
  glowStyle: { opacity: number };
  onReelStop: (reelIndex: number) => void;
  tapHintText?: string;
}

/**
 * 3 sutunlu slot makinesi.
 * Tap-to-stop + variable timing + expo-image poster reels.
 */
const SlotMachine = forwardRef<SlotMachineHandle, SlotMachineProps>(
  function SlotMachine({ reelData, glowStyle, onReelStop, tapHintText }, ref) {
    const forceStop = useSharedValue(0);
    const stopTimesRef = useRef(getVariableStopTimes());

    useImperativeHandle(ref, () => ({
      forceStopAll: () => {
        forceStop.value = 1;
      },
    }));

    const handleTap = useCallback(() => {
      if (forceStop.value === 0) {
        logger.log('[SlotMachine] Tap-to-stop triggered');
        forceStop.value = 1;
      }
    }, [forceStop]);

    return (
      <Pressable onPress={handleTap}>
        <View style={styles.slotMachine}>
          <Animated.View style={[styles.jackpotGlow, glowStyle]} />

          <View style={styles.slotFrame}>
            <View style={styles.slotColumns}>
              {reelData.map((posters, colIdx) => (
                <SlotReel
                  key={`reel-${colIdx}-${posters.length}`}
                  posters={posters}
                  stopTime={stopTimesRef.current[colIdx]}
                  onStop={() => onReelStop(colIdx)}
                  forceStop={forceStop}
                />
              ))}
            </View>

            <View style={styles.winLine} pointerEvents="none" />
          </View>

          <Animated.View style={styles.tapHintContainer}>
            <Animated.Text style={styles.tapHintText}>
              {tapHintText || 'Tap to stop'}
            </Animated.Text>
          </Animated.View>
        </View>
      </Pressable>
    );
  },
);

export default SlotMachine;

// --- Stiller ---

const styles = StyleSheet.create({
  slotMachine: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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

  reelWindow: {
    width: SLOT_COL_WIDTH,
    height: SLOT_POSTER_H,
    overflow: 'hidden',
    borderRadius: Theme.borderRadius.sm,
    backgroundColor: Colors.bgElevated,
  },
  reelStrip: {
    width: SLOT_COL_WIDTH,
  },
  reelPoster: {
    width: SLOT_COL_WIDTH,
    height: SLOT_POSTER_H,
    overflow: 'hidden',
  },
  reelPosterImage: {
    width: SLOT_COL_WIDTH,
    height: SLOT_POSTER_H,
  },

  reelGradientTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 24,
    zIndex: 2,
  },
  reelGradientBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 24,
    zIndex: 2,
  },

  winLine: {
    position: 'absolute',
    left: 4,
    right: 4,
    top: '50%',
    height: 2,
    backgroundColor: Colors.gold,
    opacity: 0.5,
    borderRadius: 1,
  },

  tapHintContainer: {
    marginTop: 8,
    opacity: 0.5,
  },
  tapHintText: {
    fontSize: 12,
    color: Colors.textLightGrey,
    textAlign: 'center',
  },
});
