/**
 * userCache — `public.users` satırı için oturum içi okuma önbelleği (PERF-1).
 *
 * Neden: aynı satırın farklı kolonları ekran açılışında 4-5 ayrı GET ile
 * okunuyordu (useProModeAccess, readUserFlags, profil, push_enabled).
 *
 * Kurallar:
 *  - Bellek içi; AsyncStorage'a YAZILMAZ (yetki/abonelik kararı taşıyan alanlar
 *    süreç yeniden başlayınca taze okunur).
 *  - TTL 60 sn. Aynı anda giden istekler tekilleştirilir; yolda olan bir istek
 *    istenen kolonları kapsıyorsa ona katılınır.
 *  - Satır hem `id` hem `auth_id` ile aranabilir; ikisi de her okumada çekilir ve
 *    iki anahtara birden yazılır.
 *  - Hata ve "satır yok" ÖNBELLEĞE ALINMAZ (sonraki çağrı yeniden dener).
 *  - Yazan kod `invalidateUserCache()` çağırır. Yolda olan istek invalidate'ten
 *    önce başladıysa sonucu önbelleğe girmez (bayat veri yazılmasın).
 *  - Güvenlik kararı DEĞİL: yetki sunucuda (RLS); bu yalnız okuma sıklığını düşürür.
 */
import { supabase } from './supabase';

const TTL_MS = 60_000;

export type UserLookup = 'id' | 'auth_id';

export interface UserRowError {
  message: string;
  code?: string;
}

export interface UserRowResult<T> {
  /** Satır yoksa `null` (hata değil). */
  data: T | null;
  error: UserRowError | null;
}

interface CacheEntry {
  row: Record<string, unknown>;
  columns: Set<string>;
  at: number;
}

interface InFlight {
  columns: Set<string>;
  promise: Promise<UserRowResult<Record<string, unknown>>>;
}

const entries = new Map<string, CacheEntry>();
const inflight = new Map<string, InFlight>();
/** invalidate her çağrıda artar; başlangıç sayacı değişmişse sonuç önbelleğe girmez. */
let epoch = 0;

function keyOf(by: UserLookup, value: string): string {
  return `${by}:${value}`;
}

function covers(have: Set<string>, need: readonly string[]): boolean {
  return need.every((c) => have.has(c));
}

function pick<T>(row: Record<string, unknown>, columns: readonly string[]): T {
  const out: Record<string, unknown> = {};
  for (const c of columns) out[c] = row[c];
  return out as T;
}

async function fetchRow(
  by: UserLookup,
  value: string,
  columns: Set<string>,
): Promise<UserRowResult<Record<string, unknown>>> {
  const startedAt = epoch;
  try {
    // id + auth_id her zaman istenir: satır iki anahtara birden yazılır.
    const select = [...new Set(['id', 'auth_id', ...columns])].join(', ');
    const { data, error } = await supabase
      .from('users')
      .select(select)
      .eq(by, value)
      .maybeSingle();

    if (error) return { data: null, error: { message: error.message, code: error.code } };
    if (!data) return { data: null, error: null };

    const row = data as unknown as Record<string, unknown>;
    if (startedAt === epoch) {
      const entry: CacheEntry = {
        row,
        columns: new Set([...columns, 'id', 'auth_id']),
        at: Date.now(),
      };
      if (typeof row.id === 'string') entries.set(keyOf('id', row.id), entry);
      if (typeof row.auth_id === 'string') entries.set(keyOf('auth_id', row.auth_id), entry);
    }
    return { data: row, error: null };
  } catch (err) {
    return { data: null, error: { message: err instanceof Error ? err.message : String(err) } };
  }
}

/**
 * `users` satırından istenen kolonları okur (önbellekten ya da tek GET ile).
 * Dönüş şekli PostgREST `{ data, error }` ile aynıdır; `data` yalnız istenen kolonları taşır.
 */
export async function readUserRow<T>(
  by: UserLookup,
  value: string,
  columns: readonly string[],
): Promise<UserRowResult<T>> {
  const key = keyOf(by, value);

  const cached = entries.get(key);
  if (cached && Date.now() - cached.at < TTL_MS && covers(cached.columns, columns)) {
    return { data: pick<T>(cached.row, columns), error: null };
  }

  const pending = inflight.get(key);
  if (pending && covers(pending.columns, columns)) {
    const res = await pending.promise;
    return { data: res.data ? pick<T>(res.data, columns) : null, error: res.error };
  }

  // Yeni istek: istenenler + önbellekteki/yoldaki kolonlar (bir sonraki çağrı da isabet etsin).
  const wanted = new Set<string>(columns);
  if (cached) cached.columns.forEach((c) => wanted.add(c));
  if (pending) pending.columns.forEach((c) => wanted.add(c));

  const promise = fetchRow(by, value, wanted);
  const slot: InFlight = { columns: wanted, promise };
  inflight.set(key, slot);
  try {
    const res = await promise;
    return { data: res.data ? pick<T>(res.data, columns) : null, error: res.error };
  } finally {
    if (inflight.get(key) === slot) inflight.delete(key);
  }
}

/** `users` satırına yazan her kod yazmadan SONRA (başarı/hata fark etmez) çağırır. */
export function invalidateUserCache(): void {
  epoch += 1;
  entries.clear();
  inflight.clear();
}
