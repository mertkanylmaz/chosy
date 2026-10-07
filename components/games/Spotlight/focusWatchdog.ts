/**
 * Odak katmanı yükleme zaman aşımı — saf mantık (React/RN import YOK).
 *
 * FocusStill gelen katın `onLoad`'unu bekler. Gelmezse görsel eski bulanıklıkta
 * sıkışırdı; bu bekçi süre dolunca bir kez geri çağırır. Kurallar:
 *   - `arm` her çağrıda öncekini iptal eder (yeni düzeye yeniden hedefleme =
 *     taze süre, bayat zamanlayıcı terfi ettirmez)
 *   - `cancel` bekleyeni iptal eder (yükleme geldi / hata / unmount)
 *   - süre dolunca geri çağrı en fazla BİR kez çalışır
 *
 * Zamanlayıcı enjekte edilir → testte sahte saatle çalışır.
 */
export interface Scheduler<H> {
  set(callback: () => void, ms: number): H;
  clear(handle: H): void;
}

export interface LoadWatchdog {
  arm(onTimeout: () => void): void;
  cancel(): void;
  /** Bekleyen zamanlayıcı var mı */
  isArmed(): boolean;
}

export function createLoadWatchdog<H>(scheduler: Scheduler<H>, ms: number): LoadWatchdog {
  let handle: H | null = null;
  let armed = false;

  const cancel = (): void => {
    if (handle !== null) scheduler.clear(handle);
    handle = null;
    armed = false;
  };

  return {
    arm(onTimeout) {
      cancel();
      armed = true;
      handle = scheduler.set(() => {
        handle = null;
        armed = false;
        onTimeout();
      }, ms);
    },
    cancel,
    isArmed: () => armed,
  };
}
