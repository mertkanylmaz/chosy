/**
 * useCountdown — hedef `Date`'e kalan süre (ms), saniyede bir güncellenir.
 *
 * - Zamanlayıcı saniye sınırına hizalanır (`setInterval` kayması yok).
 * - AppState `active` olunca duvar saatinden yeniden senkronlanır: arka
 *   planda JS zamanlayıcıları durur, dönüşte sayaç eski değerde kalmamalı.
 * - Sıfırda `onElapsed` hedef başına BİR kez çağrılır (geçmiş hedefte ilk
 *   senkronda). Sayaç sıfırda durur, tekrar tetiklemez.
 *
 * Kararların tamamı `countdownCore.ts`'te (saf, Deno testli); burada yalnız
 * zamanlayıcı ve AppState bağlantısı var.
 *
 * Her saniye render ürettiği için bu hook'u çağıran bileşen KÜÇÜK ve `memo`
 * olmalı — ekranın geri kalanı sayaçla birlikte yeniden çizilmez.
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { createCountdownController } from './countdownCore';

export function useCountdown(target: Date, onElapsed: () => void): number {
  const targetMs = target.getTime();
  const onElapsedRef = useRef(onElapsed);
  onElapsedRef.current = onElapsed;

  const [remainingMs, setRemainingMs] = useState(() => Math.max(0, targetMs - Date.now()));

  useEffect(() => {
    const controller = createCountdownController(targetMs);
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = (): void => {
      timer = null;
      const { remainingMs: next, elapsedNow } = controller.sync(Date.now());
      setRemainingMs(next);
      if (elapsedNow) onElapsedRef.current();
      if (next === 0) return;
      // Bir sonraki saniye sınırına kadar bekle; tam saniyede 1000 ms.
      timer = setTimeout(tick, next % 1000 || 1000);
    };

    tick();

    const subscription = AppState.addEventListener('change', (status) => {
      if (status !== 'active') return;
      if (timer) clearTimeout(timer);
      tick();
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [targetMs]);

  return remainingMs;
}
