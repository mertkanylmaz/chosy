/**
 * "Nerede izlenir" yükleme kararı — saf mantık (HOME-3).
 *
 * `components/gauntlet/WatchProviders/useWatchProviders.ts` bunu çağırır.
 * Burada React, Supabase, Sentry veya fetch bağımlılığı YOKTUR; bağımlılıklar
 * parametre olarak gelir (`tests/gauntlet/watchProvidersLoad.test.ts`).
 *
 * ── Neden ayrı ──────────────────────────────────────────────────────────────
 * Eskiden `films.tmdb_id` okuma hatası ile "filmin tmdb_id'si yok" aynı `null`'a
 * iniyor, ikisi de `empty` gösteriyordu: ağ yokken kullanıcı "bölgende akışta
 * yok" görüyordu. Burada üç sonuç ayrıdır:
 *   ok    → tmdb_id var, TMDB'ye sorulur
 *   none  → film için tmdb_id gerçekten yok → empty (hata değil)
 *   error → okuma başarısız (Supabase hatası / zaman aşımı / ağ) → error
 *
 * Üst sınır: select + TMDB toplamı için tek bir süre. Parça zaman aşımları
 * (supabase 5 sn ×2, TMDB 10 sn) toplamda ~20 sn eder ve auth katmanı hiç
 * sınırlı değildir; hook'un `loading`'de takılmaması bu sınıra dayanır.
 */

export type TmdbIdLookup =
  | { kind: 'ok'; tmdbId: number }
  | { kind: 'none' }
  | { kind: 'error' };

/** select + TMDB toplamı için hook seviyesinde üst sınır. */
export const WATCH_PROVIDERS_DEADLINE_MS = 12_000;

export type LoadStep = 'tmdb_id_lookup' | 'tmdb_fetch';

export type LoadOutcome<R> =
  | { kind: 'result'; result: R }
  | { kind: 'rejected'; error: unknown }
  | { kind: 'timeout'; step: LoadStep; timeoutMs: number };

/** `tmdb_id` okuma sonucunu sağlayıcı sonucuna çevirir. */
export async function resolveLookup<R>(
  lookup: TmdbIdLookup,
  results: { empty: R; error: R },
  fetchProviders: (tmdbId: number) => Promise<R>,
): Promise<R> {
  if (lookup.kind === 'none') return results.empty;
  if (lookup.kind === 'error') return results.error;
  return fetchProviders(lookup.tmdbId);
}

export interface LoadDeps<R> {
  readTmdbId: () => Promise<TmdbIdLookup>;
  fetchProviders: (tmdbId: number) => Promise<R>;
  results: { empty: R; error: R };
}

export interface StartedLoad<R> {
  promise: Promise<LoadOutcome<R>>;
  /** Zaman aşımı sayacını temizler. Çağrıldıktan sonra timeout sonucu üretilmez. */
  cancel: () => void;
}

/**
 * Yüklemeyi başlatır; sonuç tam bir kez çözülür: result | rejected | timeout.
 * Süre dolduktan sonra gelen sonuç yok sayılır (ilk çözen kazanır).
 */
export function startLoad<R>(
  deps: LoadDeps<R>,
  deadlineMs: number = WATCH_PROVIDERS_DEADLINE_MS,
): StartedLoad<R> {
  let step: LoadStep = 'tmdb_id_lookup';
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const promise = new Promise<LoadOutcome<R>>((resolve) => {
    const settle = (outcome: LoadOutcome<R>): void => {
      if (settled) return;
      settled = true;
      clear();
      resolve(outcome);
    };

    timer = setTimeout(() => {
      settle({ kind: 'timeout', step, timeoutMs: deadlineMs });
    }, deadlineMs);

    void (async () => {
      const lookup = await deps.readTmdbId();
      step = 'tmdb_fetch';
      return resolveLookup(lookup, deps.results, deps.fetchProviders);
    })().then(
      (result) => settle({ kind: 'result', result }),
      (error: unknown) => settle({ kind: 'rejected', error }),
    );
  });

  return { promise, cancel: clear };
}
