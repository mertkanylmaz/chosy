/**
 * RevenueCat hazırlık sinyalleri — saf mantık (R-2, REACT-NATIVE-7 / EDGE-14).
 *
 * İki sinyal:
 *  - `RcReadySignal`      : `Purchases.configure` başarıyla bitti.
 *  - `IdentityReadySignal`: RC appUserID, Supabase auth id'ye eşitlendi.
 *
 * Neden ayrı modül: `services/purchaseService.ts` `react-native-purchases`
 * import eder, Deno testi onu yükleyemez. Geçiş mantığı (hedef güncelleme,
 * reject, timeout) bu yüzden SDK'dan bağımsız tutulur
 * (`tests/subscription/rcReadiness.test.ts`). Aynı emsal: `utils/premiumStatus.ts`.
 *
 * Reject yerine `{ ok: false }` ile settle edilir: kimsenin beklemediği
 * bir deferred "unhandled rejection" üretmesin, boş catch gerekmesin.
 */

export type SignalName = 'rc' | 'identity';

export type ReadyOutcome = { ok: true } | { ok: false; error: unknown };

/** Bekleyenin gördüğü tipli hata. `reason` neden hazır olunamadığını söyler. */
export class RcReadinessError extends Error {
  readonly signal: SignalName;
  readonly reason: 'timeout' | 'failed';
  readonly timeoutMs: number;
  readonly underlying: unknown;

  constructor(signal: SignalName, reason: 'timeout' | 'failed', timeoutMs: number, cause?: unknown) {
    super(
      reason === 'timeout'
        ? `RC ${signal} hazır olmadı (${timeoutMs}ms)`
        : `RC ${signal} hazırlanamadı`,
    );
    this.name = 'RcReadinessError';
    this.signal = signal;
    this.reason = reason;
    this.timeoutMs = timeoutMs;
    this.underlying = cause;
  }
}

interface Deferred {
  readonly promise: Promise<ReadyOutcome>;
  readonly settle: (outcome: ReadyOutcome) => void;
  state: 'pending' | 'ok' | 'failed';
}

function createDeferred(): Deferred {
  let settle!: (outcome: ReadyOutcome) => void;
  const promise = new Promise<ReadyOutcome>((resolve) => {
    settle = resolve;
  });
  const d: Deferred = {
    promise,
    state: 'pending',
    settle: (outcome) => {
      if (d.state !== 'pending') return;
      d.state = outcome.ok ? 'ok' : 'failed';
      settle(outcome);
    },
  };
  return d;
}

/**
 * Bekler; zaman aşımında `onTimeout` (Sentry yazımı çağıranda) sonra tipli hata.
 * `failed` sonuçta çağıran zaten hatayı kaynağında raporlamıştır — burada yazılmaz.
 */
async function waitFor(
  d: Deferred,
  signal: SignalName,
  timeoutMs: number,
  onTimeout: (err: RcReadinessError) => void,
): Promise<void> {
  if (d.state === 'ok') return;

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), timeoutMs);
  });

  try {
    const result = await Promise.race([d.promise, timeout]);
    if (result === 'timeout') {
      const err = new RcReadinessError(signal, 'timeout', timeoutMs);
      onTimeout(err);
      throw err;
    }
    if (!result.ok) throw new RcReadinessError(signal, 'failed', timeoutMs, result.error);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

// ─── rcReady ──────────────────────────────────────────────────────────────────

export class RcReadySignal {
  private d = createDeferred();

  get state(): Deferred['state'] {
    return this.d.state;
  }

  /** `configure` başarıyla bitti (ya da SDK zaten yapılandırılmış). */
  markReady(): void {
    if (this.d.state === 'failed') this.d = createDeferred();
    this.d.settle({ ok: true });
  }

  /** `configure` yapılamadı (key yok / native hata): bekleyenler hızlı hata alır. */
  markFailed(error: unknown): void {
    this.d.settle({ ok: false, error });
  }

  /** Başarısız olmuş sinyal yeni deneme için yeniden açılır. */
  reopenIfFailed(): void {
    if (this.d.state === 'failed') this.d = createDeferred();
  }

  wait(timeoutMs: number, onTimeout: (err: RcReadinessError) => void): Promise<void> {
    return waitFor(this.d, 'rc', timeoutMs, onTimeout);
  }
}

// ─── identityReady ────────────────────────────────────────────────────────────

/**
 * Kimlik geçişi izleyicisi.
 *
 * Kural: bekleyen bir geçiş varken yeni `begin` gelirse deferred DEĞİŞTİRİLMEZ,
 * yalnız hedef güncellenir; deferred EN SON hedef için `complete` gelince
 * resolve olur. Aksi hâlde eski deferred'i bekleyenler hiç uyanmaz.
 *
 * `target === null`: hedef henüz bilinmiyor (ilk açılış, ya da `logOut` sonrası
 * bir sonraki `identifyUser`'ı bekliyoruz).
 */
export class IdentityReadySignal {
  private d = createDeferred();
  private target: string | null = null;

  get state(): Deferred['state'] {
    return this.d.state;
  }

  get pendingTarget(): string | null {
    return this.d.state === 'pending' ? this.target : null;
  }

  /** Kimlik değişecek. Yerleşik (ok/failed) sinyal yeni pending deferred'e geçer. */
  begin(target: string | null): void {
    if (this.d.state !== 'pending') this.d = createDeferred();
    this.target = target;
  }

  /** `userId` için RC kimliği oturdu. Eski hedef için gelen tamamlanma yok sayılır. */
  complete(userId: string): void {
    if (this.d.state === 'failed') {
      this.d = createDeferred();
      this.target = null;
    }
    if (this.d.state === 'ok') {
      this.target = userId;
      return;
    }
    if (this.target !== null && this.target !== userId) return;
    this.target = userId;
    this.d.settle({ ok: true });
  }

  /** `userId` için `logIn` başarısız. Güncel hedef değilse yok sayılır. */
  fail(userId: string, error: unknown): void {
    if (this.d.state !== 'pending' || this.target !== userId) return;
    this.d.settle({ ok: false, error });
  }

  wait(timeoutMs: number, onTimeout: (err: RcReadinessError) => void): Promise<void> {
    return waitFor(this.d, 'identity', timeoutMs, onTimeout);
  }
}
