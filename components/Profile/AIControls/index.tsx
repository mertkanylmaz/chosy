/**
 * AIControls — AI Personalization Sliders.
 *
 * 3 custom PanResponder slider:
 * - Energy: Calm 🧘 ↔ Energetic ⚡
 * - Pace: Slow 🐢 ↔ Fast 🐆
 * - Depth: Light 🎈 ↔ Deep 🧠
 *
 * AsyncStorage key: 'chosy_ai_preferences'
 * Değer değişince 500ms debounce ile otomatik kaydeder.
 * "Reset to default" → tüm değerleri 0.5'e döndürür.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '@/constants/Colors';
import { hapticSelection } from '@/utils/haptics';

import { styles } from './styles';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'chosy_ai_preferences';
const THUMB_SIZE = 24;
const DEFAULT_PREFS: AIPreferences = { energy: 0.5, pace: 0.5, depth: 0.5 };

// ─── Tipler ───────────────────────────────────────────────────────────────────

interface AIPreferences {
  energy: number;
  pace: number;
  depth: number;
}

interface CustomSliderProps {
  value: number;
  onValueChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
}

// ─── Custom Slider ────────────────────────────────────────────────────────────

/**
 * PanResponder tabanlı custom slider — @react-native-community/slider kullanmaz.
 * Track: 4px yükseklik, thumb: 24×24 altın daire.
 */
function CustomSlider({ value, onValueChange, leftLabel, rightLabel }: CustomSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const startValueRef = useRef(value);
  const startPageXRef = useRef(0);
  const onValueChangeRef = useRef(onValueChange);
  /** Son haptic'in tetiklendiği 0.1'lik basamak */
  const lastHapticStepRef = useRef(Math.round(value * 10));

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        startPageXRef.current = gestureState.x0;
        startValueRef.current = onValueChangeRef.current === onValueChange
          ? value
          : startValueRef.current;
        if (trackWidthRef.current > 0) {
          const x = evt.nativeEvent.locationX;
          const newVal = Math.max(0, Math.min(1, x / trackWidthRef.current));
          onValueChangeRef.current(newVal);
          startValueRef.current = newVal;
          startPageXRef.current = gestureState.x0;
        }
      },
      onPanResponderMove: (_evt, gestureState) => {
        if (trackWidthRef.current <= 0) return;
        const dx = gestureState.moveX - startPageXRef.current;
        const newVal = Math.max(
          0,
          Math.min(1, startValueRef.current + dx / trackWidthRef.current),
        );
        const step = Math.round(newVal * 10);
        if (step !== lastHapticStepRef.current) {
          lastHapticStepRef.current = step;
          hapticSelection();
        }
        onValueChangeRef.current(newVal);
      },
    }),
  ).current;

  function handleLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    trackWidthRef.current = w;
    setTrackWidth(w);
  }

  const thumbLeft = trackWidth > 0 ? value * (trackWidth - THUMB_SIZE) : 0;
  const filledWidth = trackWidth > 0 ? value * trackWidth : 0;

  let valueLabel: string;
  if (value < 0.3) {
    valueLabel = leftLabel;
  } else if (value > 0.7) {
    valueLabel = rightLabel;
  } else {
    valueLabel = 'Balanced';
  }

  return (
    <View style={styles.sliderContainer}>
      {/* Sol / Sağ label satırı */}
      <View style={styles.sliderLabelsRow}>
        <Text style={styles.sliderSideLabel}>{leftLabel}</Text>
        <Text style={styles.sliderValueLabel}>{valueLabel}</Text>
        <Text style={styles.sliderSideLabel}>{rightLabel}</Text>
      </View>

      {/* Track alanı */}
      <View
        style={styles.trackWrapper}
        onLayout={handleLayout}
        {...panResponder.panHandlers}>
        {/* Arkaplan track */}
        <View style={styles.track} />
        {/* Dolu kısım */}
        <View style={[styles.filledTrack, { width: filledWidth }]} />
        {/* Thumb */}
        <View style={[styles.thumb, { left: thumbLeft }]} />
      </View>
    </View>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

/**
 * AI tercih panel — 3 slider ile enerji, hız ve derinlik ayarı.
 */
export default function AIControls() {
  const [prefs, setPrefs] = useState<AIPreferences>(DEFAULT_PREFS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Yükleme ────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AIPreferences>;
          setPrefs({
            energy: parsed.energy ?? 0.5,
            pace: parsed.pace ?? 0.5,
            depth: parsed.depth ?? 0.5,
          });
        }
      } catch (err) {
        if (__DEV__) {
          console.error('[AIControls] yükleme hatası:', err);
        }
      }
    }
    load();
  }, []);

  // ─── Debounce kayıt ─────────────────────────────────────────────────────────

  function scheduleSave(updated: AIPreferences) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        if (__DEV__) {
          console.error('[AIControls] kayıt hatası:', err);
        }
      }
    }, 500);
  }

  function updatePref(key: keyof AIPreferences, v: number) {
    const updated = { ...prefs, [key]: v };
    setPrefs(updated);
    scheduleSave(updated);
  }

  function handleReset() {
    setPrefs(DEFAULT_PREFS);
    scheduleSave(DEFAULT_PREFS);
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.card}>
      {/* Başlık satırı */}
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.title}>AI Preferences</Text>
          <Text style={styles.subtitle}>Fine-tune your recommendations</Text>
        </View>
        <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
          <Text style={styles.resetLink}>Reset to default</Text>
        </TouchableOpacity>
      </View>

      {/* Energy slider */}
      <View style={styles.sliderGroup}>
        <Text style={styles.sliderName}>Energy</Text>
        <CustomSlider
          value={prefs.energy}
          onValueChange={(v) => updatePref('energy', v)}
          leftLabel="Calm 🧘"
          rightLabel="Energetic ⚡"
        />
      </View>

      {/* Pace slider */}
      <View style={styles.sliderGroup}>
        <Text style={styles.sliderName}>Pace</Text>
        <CustomSlider
          value={prefs.pace}
          onValueChange={(v) => updatePref('pace', v)}
          leftLabel="Slow 🐢"
          rightLabel="Fast 🐆"
        />
      </View>

      {/* Depth slider */}
      <View style={styles.sliderGroup}>
        <Text style={styles.sliderName}>Depth</Text>
        <CustomSlider
          value={prefs.depth}
          onValueChange={(v) => updatePref('depth', v)}
          leftLabel="Light 🎈"
          rightLabel="Deep 🧠"
        />
      </View>
    </View>
  );
}

declare const __DEV__: boolean;
