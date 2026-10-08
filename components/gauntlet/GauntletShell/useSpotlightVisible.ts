/**
 * useSpotlightVisible — `spotlight_card_visible` (F2.3).
 *
 * Kart en az %50 görünür halde KESİNTİSİZ 1 sn kalırsa, cycle + oturum başına
 * bir kez ateşlenir: `{ source: 'live' | 'resume' }`. Oturum = JS çalışma
 * ömrü (modül düzeyi küme); cycle = `gauntletId`.
 *
 * `spotlight_card_viewed` (kart mount + durum çözüldü) ayrı bir olaydır ve
 * dokunulmaz — bu olay "gerçekten ekranda" ölçüsüdür.
 *
 * Ölçü kaynakları `useChampionAsk` ile aynı üç olay (kart/scroll layout,
 * scroll); yalnız okur, o hook'un durumuna dokunmaz. Ekran odakta değilken
 * (başka tab, Spotlight oyunu) sayaç durur.
 */
import { useCallback, useEffect, useRef } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useFocusEffect } from 'expo-router';

import { isCardVisible, VISIBLE_DWELL_MS } from '@/components/gauntlet/SpotlightBonusCard/visibility';
import { posthogAnalytics } from '@/services/posthog';

/** Bu oturumda olayı atılmış cycle kimlikleri. */
const reportedCycles = new Set<string>();

interface Options {
  /** Champion dalı ekranda mı. */
  active: boolean;
  /** `DailyGauntlet.gauntletId`; yoksa olay atılmaz. */
  cycleKey: string | undefined;
  source: 'live' | 'resume';
  /** Kaydırma içeriğini alttan örten pay (tab bar). */
  bottomInset: number;
}

export interface SpotlightVisibleBindings {
  onCardLayout: (e: LayoutChangeEvent) => void;
  onScrollLayout: (e: LayoutChangeEvent) => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

export function useSpotlightVisible({
  active,
  cycleKey,
  source,
  bottomInset,
}: Options): SpotlightVisibleBindings {
  const metricsRef = useRef({ cardY: 0, cardHeight: 0, scrollY: 0, viewportHeight: 0 });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusedRef = useRef(false);
  const optionsRef = useRef({ active, cycleKey, source, bottomInset });
  optionsRef.current = { active, cycleKey, source, bottomInset };

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const evaluate = useCallback(() => {
    const o = optionsRef.current;
    const done = o.cycleKey === undefined || reportedCycles.has(o.cycleKey);
    const visible =
      !done &&
      o.active &&
      focusedRef.current &&
      isCardVisible({ ...metricsRef.current, bottomInset: o.bottomInset });
    if (!visible) {
      clearTimer();
      return;
    }
    if (timerRef.current) return; // görünürlük sürüyor, sayaç zaten işliyor
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const now = optionsRef.current;
      if (now.cycleKey === undefined || reportedCycles.has(now.cycleKey)) return;
      reportedCycles.add(now.cycleKey);
      posthogAnalytics.track('spotlight_card_visible', { source: now.source });
    }, VISIBLE_DWELL_MS);
  }, [clearTimer]);

  useEffect(() => {
    evaluate();
    return clearTimer;
  }, [active, cycleKey, bottomInset, evaluate, clearTimer]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      evaluate();
      return () => {
        focusedRef.current = false;
        clearTimer();
      };
    }, [evaluate, clearTimer]),
  );

  const onCardLayout = useCallback(
    (e: LayoutChangeEvent) => {
      metricsRef.current.cardY = e.nativeEvent.layout.y;
      metricsRef.current.cardHeight = e.nativeEvent.layout.height;
      evaluate();
    },
    [evaluate],
  );

  const onScrollLayout = useCallback(
    (e: LayoutChangeEvent) => {
      metricsRef.current.viewportHeight = e.nativeEvent.layout.height;
      evaluate();
    },
    [evaluate],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      metricsRef.current.scrollY = e.nativeEvent.contentOffset.y;
      evaluate();
    },
    [evaluate],
  );

  return { onCardLayout, onScrollLayout, onScroll };
}
