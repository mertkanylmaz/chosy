/**
 * Geri sayımın saf çekirdeği — `useCountdown`'ın saat/zamanlayıcı dışı her
 * kararı burada. Import'suz (Deno testi: tests/hooks/countdownCore.test.ts).
 *
 * Kalan süre her senkronda DUVAR SAATİNDEN yeniden hesaplanır, tik sayılarak
 * DEĞİL: arka planda JS zamanlayıcıları durur, sayılan tikler geride kalırdı.
 */

export interface CountdownParts {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface CountdownSync {
  remainingMs: number;
  /** Bu senkron sıfıra İLK ulaştı — `onElapsed` şimdi çağrılmalı. */
  elapsedNow: boolean;
}

export interface CountdownController {
  sync(nowMs: number): CountdownSync;
}

/**
 * Tek hedef için sayaç. `elapsedNow` hedef başına en fazla BİR kez true
 * döner — geçmiş hedefte ilk senkronda, arka plandan dönüşte sıfırı aşan
 * ilk senkronda; sonrakiler hep false.
 */
export function createCountdownController(targetMs: number): CountdownController {
  let fired = false;
  return {
    sync(nowMs: number): CountdownSync {
      const remainingMs = Math.max(0, targetMs - nowMs);
      const elapsedNow = remainingMs === 0 && !fired;
      if (elapsedNow) fired = true;
      return { remainingMs, elapsedNow };
    },
  };
}

/**
 * Saniyeler YUKARI yuvarlanır: 0,4 sn kala "00:00:01" görünür, "00:00:00"
 * yalnız gerçekten sıfırda — ekran `onElapsed`'ten önce sıfırı göstermez.
 */
export function countdownParts(remainingMs: number): CountdownParts {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "02:49:13"; `showSeconds` false ise (Reduce Motion) "02:49". */
export function formatCountdown(parts: CountdownParts, showSeconds: boolean): string {
  const hm = `${pad2(parts.hours)}:${pad2(parts.minutes)}`;
  return showSeconds ? `${hm}:${pad2(parts.seconds)}` : hm;
}
