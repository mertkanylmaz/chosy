/**
 * app_config anlık görüntü deposu — saf mantık (Sprint 10b).
 *
 * `services/remoteConfig.ts` bunun modül düzeyi tek örneğini tutar. Burada
 * supabase / AsyncStorage / React Native bağımlılığı YOKTUR; saat ve yükleyici
 * enjekte edilir ki TTL, tek-uçuş ve stale-while-error cihaz gerektirmeden
 * test edilebilsin (`tests/config/configStore.test.ts`).
 *
 * ── Kurallar ─────────────────────────────────────────────────────────────────
 * - TTL: anlık görüntü `ttlMs` içinde TAZE sayılır; taze iken `refresh` ağa
 *   gitmez. Sınır dahil değil (`yaş < ttlMs` taze).
 * - Tek-uçuş: eşzamanlı `refresh` çağrıları tek yükleyici çağrısını paylaşır.
 *   `force` uçuştaki isteği de paylaşır, ikinci istek AÇMAZ.
 * - Stale-while-error: yükleme hata verirse ESKİ anlık görüntü korunur ve
 *   `stale_on_error` döner; hiç anlık görüntü yoksa `error_no_cache`.
 *   Başarısız yükleme `fetchedAt`'i ilerletmez — sonraki çağrı yeniden dener.
 * - Hata fırlatılmaz, sonuç olarak döner: çağıran Sentry'ye yazmaktan sorumlu.
 * - Başarısızlık geri çekilmesi (opsiyonel `failureBackoff`): ardışık başarısız
 *   yüklemelerden sonra yükleyici `baseMs * 2^(n-1)` (üst sınır `maxMs`) dolmadan
 *   ÇAĞRILMAZ; boş önbellek + çevrimdışı iken her mount'ta istek/Sentry olayı oluşmaz.
 *   Bayat/boş görüntü hemen döner (`backing_off`). İlk başarıyla sayaç sıfırlanır,
 *   yani ağ geri gelince en geç `maxMs` içinde toparlanır (kalıcı vazgeçme YOK).
 */

export interface ConfigSnapshot {
  values: Record<string, unknown>;
  /** Epoch ms — son BAŞARILI yükleme. */
  fetchedAt: number;
}

export type RefreshStatus =
  /** TTL içinde, ağa gidilmedi. */
  | 'fresh'
  /** Yüklendi, anlık görüntü güncellendi (çağıran kalıcı depoya yazar). */
  | 'refreshed'
  /** Yükleme hata verdi, eski anlık görüntü kullanılıyor. */
  | 'stale_on_error'
  /** Yükleme hata verdi ve elde hiçbir anlık görüntü yok. */
  | 'error_no_cache'
  /** Son başarısızlıktan beri bekleme süresi dolmadı; yükleyici ÇAĞRILMADI. */
  | 'backing_off';

export interface RefreshResult {
  status: RefreshStatus;
  /** `stale_on_error` / `error_no_cache` durumunda yükleyicinin hatası. */
  error?: unknown;
}

export interface ConfigStoreOptions {
  ttlMs: number;
  /** Epoch ms. Testte sahte saat verilir. */
  now?: () => number;
  /** Verilmezse başarısız yükleme sonrası her çağrı yeniden dener (eski davranış). */
  failureBackoff?: { baseMs: number; maxMs: number };
}

export interface ConfigStore {
  getSnapshot(): ConfigSnapshot | null;
  /** Kalıcı depodan geri yüklenen anlık görüntüyü yazar (bellek boşken). */
  setSnapshot(snapshot: ConfigSnapshot): void;
  isFresh(): boolean;
  refresh(
    loader: () => Promise<Record<string, unknown>>,
    options?: { force?: boolean },
  ): Promise<RefreshResult>;
}

/**
 * Kalıcı depodaki ham metni anlık görüntüye çevirir. Kayıt yoksa `null`;
 * bozuk JSON ya da beklenmeyen şekil FIRLATIR — çağıran Sentry'ye yazar,
 * bozuk kayıt sessizce yutulmaz.
 */
export function parseSnapshot(raw: string | null): ConfigSnapshot | null {
  if (raw === null) return null;
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('config snapshot: nesne değil');
  }
  const { values, fetchedAt } = parsed as { values?: unknown; fetchedAt?: unknown };
  if (
    typeof values !== 'object' ||
    values === null ||
    Array.isArray(values) ||
    typeof fetchedAt !== 'number' ||
    !Number.isFinite(fetchedAt)
  ) {
    throw new Error('config snapshot: values/fetchedAt şekli geçersiz');
  }
  return { values: values as Record<string, unknown>, fetchedAt };
}

export function createConfigStore(options: ConfigStoreOptions): ConfigStore {
  const now = options.now ?? Date.now;
  let snapshot: ConfigSnapshot | null = null;
  let inflight: Promise<RefreshResult> | null = null;
  let failures = 0;
  let lastFailureAt = 0;

  function isBackingOff(): boolean {
    const backoff = options.failureBackoff;
    if (!backoff || failures === 0) return false;
    const wait = Math.min(backoff.baseMs * 2 ** (failures - 1), backoff.maxMs);
    return now() - lastFailureAt < wait;
  }

  function isFresh(): boolean {
    return snapshot !== null && now() - snapshot.fetchedAt < options.ttlMs;
  }

  return {
    getSnapshot: () => snapshot,

    setSnapshot(next) {
      snapshot = next;
    },

    isFresh,

    refresh(loader, refreshOptions) {
      if (inflight) return inflight;
      if (!refreshOptions?.force && isFresh()) {
        return Promise.resolve({ status: 'fresh' });
      }
      if (!refreshOptions?.force && isBackingOff()) {
        return Promise.resolve({ status: 'backing_off' });
      }

      // `Promise.resolve().then` — yükleyici senkron fırlatsa da reddedilen
      // promise olur ve `finally` her durumda çalışır.
      const promise: Promise<RefreshResult> = Promise.resolve()
        .then(loader)
        .then(
          (values): RefreshResult => {
            snapshot = { values, fetchedAt: now() };
            failures = 0;
            return { status: 'refreshed' };
          },
          (error: unknown): RefreshResult => {
            failures += 1;
            lastFailureAt = now();
            return {
              status: snapshot ? 'stale_on_error' : 'error_no_cache',
              error,
            };
          },
        )
        .finally(() => {
          if (inflight === promise) inflight = null;
        });

      inflight = promise;
      return promise;
    },
  };
}
