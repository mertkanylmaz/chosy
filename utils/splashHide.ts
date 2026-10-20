/**
 * Native splash'in ne zaman kalkacağı — saf mantık (RN, Sentry ve expo-splash-screen
 * bağımlılığı YOK; test: tests/navigation/splashHide.test.ts).
 *
 * Splash üç sinyal TAMAMLANINCA kalkar: fontlar, gate ekranı (GateGuard→gate
 * geçişi bitti) ve gate'teki SplashMark görseli. Failsafe: fontlar hazır olduktan
 * `failsafeMs` sonra sinyaller eksik kalsa da splash kalkar ve eksik sinyaller
 * `onHide` ile bildirilir (çağıran Sentry'ye yazar — sessiz değil). `hide` en
 * fazla BİR kez çağrılır.
 *
 * Failsafe saati fontlar hazır olunca başlar: fontlar zaten eskiden de koşuldu
 * ve yavaşlarsa kök bileşen null render eder; saati daha erken başlatmak
 * boş ekranda splash'i kaldırırdı.
 */

export type SplashSignal = 'fonts' | 'gate' | 'mark';

export type SplashHideReason = 'ready' | 'fallback';

export interface SplashHideEvent {
  reason: SplashHideReason;
  /** reason 'fallback' ise gelmeyen sinyaller; 'ready' ise boş. */
  missing: SplashSignal[];
  /** İlk sinyalden (denetleyici kurulumu) hide anına kadar ms. */
  elapsedMs: number;
}

export interface SplashHideOptions {
  /** hideAsync çağrısı; en fazla bir kez. */
  hide: (event: SplashHideEvent) => void;
  failsafeMs: number;
  /** Test için enjekte edilir; varsayılan setTimeout/clearTimeout. */
  schedule?: (fn: () => void, ms: number) => () => void;
  now?: () => number;
}

export interface SplashHideController {
  markFontsReady(): void;
  /** Gate ekranı hazır VEYA beklenmesi gerekmiyor (derin bağlantı). */
  markGateSettled(): void;
  markMarkLoaded(): void;
  isHidden(): boolean;
}

const defaultSchedule = (fn: () => void, ms: number): (() => void) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

export function createSplashHideController(opts: SplashHideOptions): SplashHideController {
  const schedule = opts.schedule ?? defaultSchedule;
  const now = opts.now ?? Date.now;
  const startedAt = now();
  const done: Record<SplashSignal, boolean> = { fonts: false, gate: false, mark: false };
  let hidden = false;
  let cancelFailsafe: (() => void) | null = null;

  const missing = (): SplashSignal[] =>
    (['fonts', 'gate', 'mark'] as const).filter((s) => !done[s]);

  const hideOnce = (reason: SplashHideReason): void => {
    if (hidden) return;
    hidden = true;
    if (cancelFailsafe) {
      cancelFailsafe();
      cancelFailsafe = null;
    }
    opts.hide({ reason, missing: reason === 'ready' ? [] : missing(), elapsedMs: now() - startedAt });
  };

  const settle = (signal: SplashSignal): void => {
    if (hidden || done[signal]) return;
    done[signal] = true;
    if (missing().length === 0) hideOnce('ready');
  };

  return {
    markFontsReady() {
      if (hidden || done.fonts) return;
      cancelFailsafe = schedule(() => hideOnce('fallback'), opts.failsafeMs);
      settle('fonts');
    },
    markGateSettled() {
      settle('gate');
    },
    markMarkLoaded() {
      settle('mark');
    },
    isHidden() {
      return hidden;
    },
  };
}
