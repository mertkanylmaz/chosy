/**
 * Anonim oturum kurtarması için devre kesici — saf mantık (AUTH-LOOP Faz 1).
 *
 * ── Neden var ───────────────────────────────────────────────────────────────
 * 22 Eki 2026: bir cihaz 10 sn'de ~30 anonim hesap açıp IP'nin anonim giriş
 * kotasını (30/saat) doldurdu. Döngü: refresh 429 → auth-js `_removeSession` →
 * `SIGNED_OUT` → `app/_layout.tsx` kurtarması `signInAnonymously()` (başarılı) →
 * yeni oturumda yine refresh 429 → … Her tur yeni bir `auth.users` satırı
 * (orphan) bırakıyor. Kurtarma BAŞARILI olduğu için hiçbir hata dalı onu
 * durdurmuyordu.
 *
 * ── Kurallar ────────────────────────────────────────────────────────────────
 * - Pencere: 60 sn içinde en fazla 3 deneme.
 * - Oturum (süreç) başına en fazla 5 deneme.
 * - Denemeler arası üstel backoff: 1, 2, 4, 8 … sn, tavan 60 sn. İlk deneme
 *   beklemez.
 * - 429 → hemen dur. `retryAfterMs` varsa o, yoksa 60 sn beklenir.
 * - Aşılırsa devre AÇILIR: yeni deneme yok, `onTrip` tek sefer çağrılır.
 * - Devre açıldıktan sonra uygulama `active` ve en az 5 dk (ve 429 beklemesi)
 *   geçtiyse TEK bir yeni deneme hakkı doğar; sayaç tavanlarını yalnız o
 *   deneme için aşar. Başarısız/başarılı fark etmez, sonrası yine tavanlara tabi.
 *
 * Burada ağ, React Native, Sentry ve analytics bağımlılığı YOKTUR: saat,
 * uyku, uygulama durumu ve giriş fonksiyonu enjekte edilir
 * (`tests/identity/authRecoveryBreaker.test.ts`).
 */

export const WINDOW_MS = 60_000;
export const MAX_ATTEMPTS_PER_WINDOW = 3;
export const MAX_ATTEMPTS_PER_SESSION = 5;
export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_CAP_MS = 60_000;
export const RATE_LIMIT_DEFAULT_WAIT_MS = 60_000;
export const COOLDOWN_MS = 5 * 60_000;

export type TripReason = 'window_limit' | 'session_cap' | 'rate_limited';

/** `signInAnonymously` hata biçiminin bu modülün okuduğu kısmı. */
export interface RecoveryError {
  status?: number | null;
  code?: string | null;
  /** auth-js yanıt başlıklarını yüzeye çıkarmaz; biri sağlarsa (ms) kullanılır. */
  retryAfterMs?: number | null;
}

export interface TripInfo {
  reason: TripReason;
  /** Bu süreçte başlatılmış toplam deneme. */
  attempts: number;
  /** Son 60 sn'deki deneme. */
  attemptsInWindow: number;
  error: unknown;
}

export type RecoveryOutcome<T> =
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown }
  /** 429: devre açıldı; hata `onTrip`'te raporlandı, çağıran ayrıca yazmaz. */
  | { status: 'rate_limited'; error: unknown }
  /** Devre açık (ya da bu çağrıda açıldı): `signIn` ÇAĞRILMADI. */
  | { status: 'blocked'; reason: TripReason }
  /** Başka bir kurtarma sürüyor: `signIn` ÇAĞRILMADI. */
  | { status: 'coalesced' }
  /** Bekleme sonrası oturum artık gerekmiyordu: `signIn` ÇAĞRILMADI. */
  | { status: 'skipped' };

export interface RecoveryDeps {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  /** Uygulama ön planda mı (cooldown yalnız `active`te biter). */
  isActive: () => boolean;
  /** Devre açıldığında, açılış başına TEK sefer. */
  onTrip: (info: TripInfo) => void;
}

export interface RunOptions {
  /** Backoff beklemesinden sonra çağrılır; false ise `signIn` çağrılmaz. */
  stillNeeded?: () => Promise<boolean>;
}

export interface AuthRecovery {
  run<T>(
    signIn: () => Promise<{ data: T; error: (RecoveryError & object) | null }>,
    options?: RunOptions,
  ): Promise<RecoveryOutcome<T>>;
  /** Devre açık ve yeni deneme hakkı doğmuş mu (saf sorgu, durumu değiştirmez). */
  isCooldownElapsed(): boolean;
}

/** n. ardışık deneme (n >= 1) öncesi gereken bekleme: 1, 2, 4, 8 … tavan 60 sn. */
export function backoffDelayMs(streak: number): number {
  if (streak <= 0) return 0;
  return Math.min(BACKOFF_BASE_MS * 2 ** (streak - 1), BACKOFF_CAP_MS);
}

/** `error.status === 429` ya da `over_*_rate_limit` kodu. */
export function isRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const { status, code } = error as RecoveryError;
  if (status === 429) return true;
  return typeof code === 'string' && /^over_.*_rate_limit$/.test(code);
}

function retryAfterOf(error: unknown): number {
  const ms = (error as RecoveryError | null)?.retryAfterMs;
  return typeof ms === 'number' && Number.isFinite(ms) && ms > 0 ? ms : RATE_LIMIT_DEFAULT_WAIT_MS;
}

export function createAuthRecovery(deps: RecoveryDeps): AuthRecovery {
  /** Başlatılmış denemelerin zaman damgaları (tümü; pencere süzgeçle okunur). */
  const attemptTimes: number[] = [];
  let streak = 0;
  let inFlight = false;
  let trippedAt: number | null = null;
  let blockedUntil = 0;
  let lastTripReason: TripReason = 'window_limit';
  /** Cooldown'dan doğan, tavanları bir denemeliğine aşan hak. */
  let grant = false;

  function cooldownElapsed(): boolean {
    return (
      trippedAt !== null &&
      deps.isActive() &&
      deps.now() >= trippedAt + COOLDOWN_MS &&
      deps.now() >= blockedUntil
    );
  }

  function attemptsInWindow(at: number): number {
    return attemptTimes.filter((t) => at - t < WINDOW_MS).length;
  }

  function trip(reason: TripReason, error: unknown): void {
    trippedAt = deps.now();
    lastTripReason = reason;
    grant = false;
    deps.onTrip({
      reason,
      attempts: attemptTimes.length,
      attemptsInWindow: attemptsInWindow(deps.now()),
      error,
    });
  }

  return {
    isCooldownElapsed: cooldownElapsed,

    async run<T>(
      signIn: () => Promise<{ data: T; error: (RecoveryError & object) | null }>,
      options?: RunOptions,
    ): Promise<RecoveryOutcome<T>> {
      if (inFlight) return { status: 'coalesced' };
      inFlight = true;
      try {
        if (trippedAt !== null) {
          if (!cooldownElapsed()) return { status: 'blocked', reason: lastTripReason };
          trippedAt = null;
          grant = true;
        }

        const t0 = deps.now();
        if (!grant) {
          if (attemptTimes.length >= MAX_ATTEMPTS_PER_SESSION) {
            trip('session_cap', null);
            return { status: 'blocked', reason: 'session_cap' };
          }
          if (attemptsInWindow(t0) >= MAX_ATTEMPTS_PER_WINDOW) {
            trip('window_limit', null);
            return { status: 'blocked', reason: 'window_limit' };
          }
        }

        // Backoff: ardışık deneme = bir öncekinden en çok tavan kadar sonra.
        const last = attemptTimes.length > 0 ? attemptTimes[attemptTimes.length - 1] : null;
        const nextStreak = !grant && last !== null && t0 - last <= BACKOFF_CAP_MS ? streak + 1 : 0;
        const wait = last === null ? 0 : Math.max(0, backoffDelayMs(nextStreak) - (t0 - last));
        if (wait > 0) {
          await deps.sleep(wait);
          if (options?.stillNeeded && !(await options.stillNeeded())) {
            return { status: 'skipped' };
          }
        }

        streak = nextStreak;
        grant = false;
        attemptTimes.push(deps.now());

        const { data, error } = await signIn();
        if (!error) return { status: 'success', data };

        if (isRateLimitError(error)) {
          blockedUntil = deps.now() + retryAfterOf(error);
          trip('rate_limited', error);
          return { status: 'rate_limited', error };
        }
        return { status: 'error', error };
      } finally {
        inFlight = false;
      }
    },
  };
}
