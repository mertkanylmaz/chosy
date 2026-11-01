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
  /** Kaçıncı düşüş (1 = ilk, 2 = sessiz yeniden denemeden sonra). Yoksa 1. */
  attempt?: 1 | 2;
  /** true: kullanıcıya HATA GÖSTERİLMEDİ, sessiz yeniden deneme başladı (yalnız attempt 1). */
  silentRetry?: boolean;
}

export interface GateFailureDeps {
  /** Sentry'ye yazar — sessiz fallback yok. */
  report: (failure: GateFailure) => void;
  /** Görünür hata durumunu açar. */
  showError: (reason: GateFailureReason) => void;
}

export interface SessionRaceOutcome<T> {
  result: RaceResult<T>;
  /** 1: ilk denemede çözüldü / ilk deneme reddetti. 2: sessiz yeniden deneme yapıldı. */
  attempts: 1 | 2;
}

/**
 * COLD-START-4: ilk `auth_timeout`'ta kullanıcıya hata göstermeden BİR kez sessiz yeniden dener
 * (aynı bütçe: `ms`). Cihaz bulgusu (build 914/915): ilk açılışta getSession ~6.9 sn'de döndü,
 * eşik 6 sn olduğu için ~1 sn "Couldn't connect" göründü, "Tekrar dene" hemen başarılı oldu.
 *
 * `start` her denemede çağrılır (auth-js aynı `initializePromise`'i paylaştığı için ikinci çağrı
 * yeni istek açmaz, süren refresh'i bekler). İlk timeout'ta `onSilentRetry` ÇAĞRILIR (raporlama
 * bunun işi: sessiz değil, yalnız kullanıcıdan gizli). İkinci deneme de düşerse `timeout` döner
 * ve çağıran hata ekranını açar. Red (reject) her iki denemede olduğu gibi geçer.
 */
export async function raceSessionWithSilentRetry<T>(
  start: () => Promise<T>,
  ms: number,
  onSilentRetry: () => void,
  schedule: Schedule = defaultSchedule,
): Promise<SessionRaceOutcome<T>> {
  const first = await raceWithTimeout(start(), ms, schedule);
  if (first.status === 'resolved') return { result: first, attempts: 1 };
  onSilentRetry();
  const second = await raceWithTimeout(start(), ms, schedule);
  return { result: second, attempts: 2 };
}

/** Hata ÖNCE raporlanır, sonra gösterilir; ikisi de her zaman çağrılır. */
export function handleGateFailure(failure: GateFailure, deps: GateFailureDeps): void {
  deps.report(failure);
  deps.showError(failure.reason);
}
