/**
 * Gate açılış mantığı — saf (RN, Sentry ve ağ bağımlılığı YOK; test:
 * tests/navigation/gateBoot.test.ts).
 *
 * Neden var: `app/gate.tsx` `decide()` içindeki `supabase.auth.getSession()`
 * auth-js `initializePromise`'ini bekler; süresi dolmuş token'da bu, bir refresh
 * isteğidir ve `/auth/v1/token` için zaman aşımı yoktur (COLD-START-1, build 914
 * gözlemi: refresh 522 → ~35 sn takılma, kullanıcı sonsuz splash gördü).
 *
 * Süre dolunca isteği İPTAL ETMEYİZ ve auth-js'e dokunmayız — bu yalnız bir UI
 * eşiğidir: kullanıcıya hata gösterilir, asıl promise sonradan çözülürse gate
 * kararı otomatik yeniden çalışır.
 */

/** getSession bu süreyi aşarsa gate görünür hata durumuna geçer. */
export const GATE_SESSION_TIMEOUT_MS = 6000;

export type RaceResult<T> =
  | { status: 'resolved'; value: T }
  /** `late` AYNI promise'tir (iptal edilmedi); sonradan çözülür ya da reddeder. */
  | { status: 'timeout'; late: Promise<T> };

export type Schedule = (fn: () => void, ms: number) => () => void;

const defaultSchedule: Schedule = (fn, ms) => {
  const id = setTimeout(fn, ms);
  return () => clearTimeout(id);
};

/**
 * `promise`'i `ms` kadar bekler. Süre dolarsa `timeout` döner ve promise'e
 * DOKUNULMAZ. Süre dolmadan reddederse red olduğu gibi geçer.
 */
export function raceWithTimeout<T>(
  promise: Promise<T>,
  ms: number,
  schedule: Schedule = defaultSchedule,
): Promise<RaceResult<T>> {
  return new Promise<RaceResult<T>>((resolve, reject) => {
    const cancel = schedule(() => resolve({ status: 'timeout', late: promise }), ms);
    promise.then(
      (value) => {
        cancel();
        resolve({ status: 'resolved', value });
      },
      (err: unknown) => {
        cancel();
        reject(err);
      },
    );
  });
}

export type GateFailureReason = 'auth_timeout' | 'gate_decision_error';

export interface GateFailure {
  reason: GateFailureReason;
  /** Gate mount'undan bu yana geçen ms. */
  elapsedMs: number;
  /** Yalnız `gate_decision_error`: yakalanan hata. */
  error?: unknown;
}

export interface GateFailureDeps {
  /** Sentry'ye yazar — sessiz fallback yok. */
  report: (failure: GateFailure) => void;
  /** Görünür hata durumunu açar. */
  showError: (reason: GateFailureReason) => void;
}

/** Hata ÖNCE raporlanır, sonra gösterilir; ikisi de her zaman çağrılır. */
export function handleGateFailure(failure: GateFailure, deps: GateFailureDeps): void {
  deps.report(failure);
  deps.showError(failure.reason);
}
