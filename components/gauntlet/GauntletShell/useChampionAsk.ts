/**
 * useChampionAsk — champion ekranındaki tek modal istemin tetikleyicisi.
 *
 * Karar `services/askCoordinator.resolveAsk()`'ta; bu hook yalnız NE ZAMAN
 * sorulacağını yönetir. İki tetik (CTO kararı, 3 Eki 2026):
 *
 *   (a) spotlight_return — Spotlight kartına basıldıysa, Shell yeniden odak
 *       aldığında bugünkü Spotlight durumu okunur. `completed` ise karar
 *       verilir; yarıda bırakıldıysa (in_progress) ask YOK.
 *   (b) dwell — Spotlight kartı görünür alanda TAMAMEN ve etkileşimsiz
 *       `ASK_DWELL_MS` kalırsa karar verilir.
 *
 * P-1c E — Spotlight bugün yoksa (NO_PUZZLE) kart çizilmez; `cardlessDwell`
 * true gelir ve dwell kart ölçüsü yerine reveal'ın görsel bitişine çapalanır
 * (bitiş + `ASK_DWELL_MS`). Karar `unavailable` ile, ağa yeniden çıkmadan
 * verilir. Spotlight varken `cardlessDwell` false — S-2 davranışı aynen.
 *
 * Blur / AppState tabanlı tetik YOK: sheet'ler pencere seviyesinde `Modal`,
 * başka bir tab'ın üstünde açılırdı. Oyun sırasında (champion dışı) hook
 * pasiftir — `active` false iken zamanlayıcı kurulmaz.
 *
 * ── "Etkileşimsiz" tanımı ──────────────────────────────────────────────────
 * Kaydırma içeriğine her dokunuş zamanlayıcıyı durdurur ve dwell'i SİLAHSIZ
 * bırakır; yalnızca bir kaydırma hareketinin bitişi yeniden silahlar. Böylece
 * champion içinden açılan bir sheet (izleme sağlayıcıları, arşiv paywall'ı)
 * açıkken ask onun üstüne binmez — dokunuş sheet'i açtı, kaydırma yok.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { useFocusEffect } from 'expo-router';

import { resolveAsk, readSpotlightStateForAsk } from '@/services/askCoordinator';
import { posthogAnalytics } from '@/services/posthog';
import { markUserFlag } from '@/services/userFlags';
import {
  canStartDwell,
  type AskTrigger,
  type AskType,
  type SpotlightState,
} from '@/utils/askDecision';

/** Dwell fallback: kart bu kadar ms görünür ve etkileşimsiz kalırsa sor. */
export const ASK_DWELL_MS = 8000;

interface ShownAsk {
  type: AskType;
  trigger: AskTrigger;
  dayIndex: number;
}

interface UseChampionAskOptions {
  /** Champion dalı ekranda mı (completed_today + champion, interstitial yok). */
  active: boolean;
  /** Kaydırma içeriğini alttan örten pay (yüzen tab bar). */
  bottomInset: number;
  /**
   * P-1c E: Spotlight bugün yok (NO_PUZZLE) VE reveal'ın görsel bitişi geldi.
   * True iken dwell kart ölçüsü beklemez; karar `unavailable` ile verilir.
   */
  cardlessDwell: boolean;
}

export interface ChampionAskBindings {
  askType: AskType | null;
  onSpotlightPress: () => void;
  onCardLayout: (e: LayoutChangeEvent) => void;
  onScrollLayout: (e: LayoutChangeEvent) => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onTouchStart: () => void;
  onScrollSettled: () => void;
  onAuthClose: (completed: boolean) => void;
  onNotifClose: (granted: boolean) => void;
}

export function useChampionAsk({
  active,
  bottomInset,
  cardlessDwell,
}: UseChampionAskOptions): ChampionAskBindings {
  const [ask, setAsk] = useState<ShownAsk | null>(null);

  const mountedRef = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;
  const bottomInsetRef = useRef(bottomInset);
  bottomInsetRef.current = bottomInset;
  const cardlessRef = useRef(cardlessDwell);
  cardlessRef.current = cardlessDwell;
  const askRef = useRef(ask);
  askRef.current = ask;

  const focusedRef = useRef(false);
  const inFlightRef = useRef(false);
  const spotlightVisitedRef = useRef(false);
  /** Bu odak oturumunda bir karar zaten istendi — tekrar ağa çıkılmaz. */
  const resolvedThisFocusRef = useRef(false);
  const dwellArmedRef = useRef(true);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const metricsRef = useRef({ cardY: 0, cardHeight: 0, scrollY: 0, viewportHeight: 0 });

  const clearDwell = useCallback(() => {
    if (dwellTimerRef.current) {
      clearTimeout(dwellTimerRef.current);
      dwellTimerRef.current = null;
    }
  }, []);

  const canAsk = useCallback(
    () =>
      mountedRef.current &&
      activeRef.current &&
      focusedRef.current &&
      askRef.current === null &&
      !inFlightRef.current &&
      !resolvedThisFocusRef.current,
    [],
  );

  const fire = useCallback(
    (trigger: AskTrigger, knownSpotlightState?: SpotlightState) => {
      if (!canAsk()) return;
      inFlightRef.current = true;
      resolvedThisFocusRef.current = true;
      clearDwell();
      void resolveAsk(trigger, knownSpotlightState).then((decision) => {
        inFlightRef.current = false;
        if (!decision) return;
        // Karar sürerken odak/champion kaybolduysa gösterilmez; gösterim
        // yine de bugüne yazılmıştır — bilinen ve kabul edilen kayıp.
        if (!mountedRef.current || !activeRef.current || !focusedRef.current) return;
        setAsk({ type: decision.type, trigger, dayIndex: decision.dayIndex });
        posthogAnalytics.track('ask_shown', {
          ask_type: decision.type,
          trigger,
          day_index: decision.dayIndex,
        });
      });
    },
    [canAsk, clearDwell],
  );

  const evaluateDwell = useCallback(() => {
    clearDwell();
    if (!dwellArmedRef.current || !canAsk()) return;
    const m = metricsRef.current;
    const cardless = cardlessRef.current;
    if (!canStartDwell({ ...m, bottomInset: bottomInsetRef.current, cardless })) return;
    dwellTimerRef.current = setTimeout(() => {
      dwellTimerRef.current = null;
      // Kartsız dalda durum zaten biliniyor — Spotlight için ağa yeniden çıkılmaz.
      fire('dwell', cardless ? 'unavailable' : undefined);
    }, ASK_DWELL_MS);
  }, [canAsk, clearDwell, fire]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearDwell();
    };
  }, [clearDwell]);

  // Champion dalına giriş/çıkış: girişte dwell değerlendirilir, çıkışta
  // zamanlayıcı düşer (oyun sırasında hiçbir ask kurulmaz).
  useEffect(() => {
    if (active) {
      evaluateDwell();
    } else {
      clearDwell();
    }
  }, [active, evaluateDwell, clearDwell]);

  // P-1c E: kartsız çapa — reveal bitişi (ya da yokluğun öğrenildiği an,
  // hangisi sonraysa) dwell'i başlatır. Spotlight varken bu bayrak hiç true
  // olmaz; efekt yalnız ilk render'da koşar ve `evaluateDwell` eskisi gibi
  // kart ölçüsüne bakar.
  useEffect(() => {
    if (cardlessDwell) evaluateDwell();
  }, [cardlessDwell, evaluateDwell]);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      resolvedThisFocusRef.current = false;
      dwellArmedRef.current = true;

      if (spotlightVisitedRef.current && activeRef.current) {
        spotlightVisitedRef.current = false;
        resolvedThisFocusRef.current = true; // dwell bu odakta tekrar sormaz
        void readSpotlightStateForAsk().then((state) => {
          if (state !== 'completed') return; // in_progress / okunamadı → ask yok
          resolvedThisFocusRef.current = false;
          fire('spotlight_return', state);
        });
      } else {
        evaluateDwell();
      }

      return () => {
        focusedRef.current = false;
        clearDwell();
      };
    }, [fire, evaluateDwell, clearDwell]),
  );

  const onSpotlightPress = useCallback(() => {
    spotlightVisitedRef.current = true;
    clearDwell();
  }, [clearDwell]);

  const onCardLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      metricsRef.current.cardY = y;
      metricsRef.current.cardHeight = height;
      evaluateDwell();
    },
    [evaluateDwell],
  );

  const onScrollLayout = useCallback(
    (e: LayoutChangeEvent) => {
      metricsRef.current.viewportHeight = e.nativeEvent.layout.height;
      evaluateDwell();
    },
    [evaluateDwell],
  );

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      metricsRef.current.scrollY = e.nativeEvent.contentOffset.y;
      // Kaydırma sürdükçe zamanlayıcı yeniden başlar — hareket etkileşimdir.
      evaluateDwell();
    },
    [evaluateDwell],
  );

  const onTouchStart = useCallback(() => {
    dwellArmedRef.current = false;
    clearDwell();
  }, [clearDwell]);

  const onScrollSettled = useCallback(() => {
    dwellArmedRef.current = true;
    evaluateDwell();
  }, [evaluateDwell]);

  /**
   * Auth sheet kapandı. `auth_prompt_seen` YALNIZ gerçek giriş tamamlanınca
   * yazılır (CTO kararı, 3 Eki 2026) — "Not now" artık yazmaz; cooldown ve
   * gösterim sayacı `chosy_ask_state`'tedir. Yazma hatası `markUserFlag`
   * içinde Sentry'ye gider; sheet yine kapanır.
   */
  const onAuthClose = useCallback((completed: boolean) => {
    const shown = askRef.current;
    setAsk(null);
    if (completed) void markUserFlag('auth_prompt_seen');
    posthogAnalytics.track('auth_prompt_closed', { completed });
    if (shown) {
      posthogAnalytics.track(completed ? 'ask_accepted' : 'ask_dismissed', {
        ask_type: shown.type,
        trigger: shown.trigger,
        day_index: shown.dayIndex,
      });
    }
  }, []);

  /**
   * Bildirim sheet'i kapandı. "Sorduk" işareti sheet'in kendi içinde yazılır.
   * `ask_accepted` = OS izni verildi; reddedilen OS diyaloğu da dismiss sayılır.
   */
  const onNotifClose = useCallback((granted: boolean) => {
    const shown = askRef.current;
    setAsk(null);
    if (shown) {
      posthogAnalytics.track(granted ? 'ask_accepted' : 'ask_dismissed', {
        ask_type: shown.type,
        trigger: shown.trigger,
        day_index: shown.dayIndex,
      });
    }
  }, []);

  return {
    askType: ask?.type ?? null,
    onSpotlightPress,
    onCardLayout,
    onScrollLayout,
    onScroll,
    onTouchStart,
    onScrollSettled,
    onAuthClose,
    onNotifClose,
  };
}
