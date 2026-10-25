/**
 * Pro Mode arama hakkı — SAF mantık (MONEY-1C). Ağ / React yok, deno ile test edilir.
 *
 * Tek doğruluk kaynağı SUNUCUdur (`get_quota_status` RPC'si, `parse-mood` yanıtı).
 * İstemci yalnız UX kapısı kurar; sunucu zaten zorlar. Bu yüzden belirsizlikte
 * (okunamadı / anlaşılmaz şekil) hak VARSAYILIR: kullanıcı kapıda kilitli kalmaz,
 * sunucu gerekirse 429 verir. Varsayım sessiz değildir — çağıran loglar.
 */

/** `check_and_consume_quota` sınırsız tier/legacy için bu eşiği ya da -1'i döndürür (115/117). */
const UNLIMITED_THRESHOLD = 999999;

export type SearchQuota =
  /** `remaining: null` = sınırsız */
  | { kind: 'available'; remaining: number | null; resetsAt: string | null }
  | { kind: 'exhausted'; resetsAt: string | null }
  /** Okunamadı / anlaşılmadı — hak VARSAYILIR */
  | { kind: 'unknown' };

function asIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return Number.isNaN(Date.parse(value)) ? null : value;
}

/**
 * `get_quota_status` dönüşünü yorumlar:
 * `{ searches: { used, limit, bonus_available }, reset_at }`; `limit` -1 / ≥999999 = sınırsız.
 */
export function interpretQuotaStatus(raw: unknown): SearchQuota {
  if (!raw || typeof raw !== 'object') return { kind: 'unknown' };
  const searches = (raw as { searches?: unknown }).searches;
  if (!searches || typeof searches !== 'object') return { kind: 'unknown' };

  const { used, limit, bonus_available: bonus } = searches as Record<string, unknown>;
  if (typeof used !== 'number' || typeof limit !== 'number') return { kind: 'unknown' };

  const resetsAt = asIso((raw as { reset_at?: unknown }).reset_at);
  if (limit < 0 || limit >= UNLIMITED_THRESHOLD) {
    return { kind: 'available', remaining: null, resetsAt: null };
  }

  const bonusLeft = typeof bonus === 'number' ? Math.max(0, bonus) : 0;
  const remaining = Math.max(0, limit - used) + bonusLeft;
  return remaining > 0
    ? { kind: 'available', remaining, resetsAt }
    : { kind: 'exhausted', resetsAt };
}

/**
 * `parse-mood` yanıtındaki `remaining` / `limit` / `resets_at` (429 gövdesi dahil).
 * `remaining: null` = sınırsız; alanlar yoksa `unknown` (tahmin edilmez).
 */
export function interpretParseMoodQuota(body: unknown): SearchQuota {
  if (!body || typeof body !== 'object') return { kind: 'unknown' };
  const { remaining, resets_at: resetsAt } = body as Record<string, unknown>;
  if (remaining === null) return { kind: 'available', remaining: null, resetsAt: null };
  if (typeof remaining !== 'number') return { kind: 'unknown' };
  return remaining > 0
    ? { kind: 'available', remaining, resetsAt: asIso(resetsAt) }
    : { kind: 'exhausted', resetsAt: asIso(resetsAt) };
}

/**
 * "Bugünün ücretsiz araması" ipucu: YALNIZ sunucudan okunmuş, en az 1 kalan hak varsa.
 * 0, sınırsız (`remaining: null`), okunuyor, okunamadı (`unknown`) veya hiç okunmadı (`null`) → gizli:
 * hakkı olmayan kullanıcıya hak vaadi verilmez.
 */
export function hasFreeSearchLeft(quota: SearchQuota | 'checking' | null): boolean {
  return quota !== null && quota !== 'checking' && quota.kind === 'available' && quota.remaining !== null && quota.remaining >= 1;
}

export type ProModeGate =
  /** Pro Mode ekranı açılır */
  | 'enter'
  /** Hak okunuyor */
  | 'checking'
  /** Günlük hak bitti → teklif (bayrak açık) */
  | 'offer'
  /** Hak yok, bayrak kapalı → bugünkü kilitli ekran */
  | 'locked';

/**
 * UX kapısı. Bayrak KAPALIYKEN sonuç bugünkü `allowed ? enter : locked` ile birebir aynı
 * (regresyon testi). Açıkken: yetkili → enter; hak varsa / bilinmiyorsa → enter;
 * bitmişse → offer.
 */
export function decideProModeGate(input: {
  offerEnabled: boolean;
  /** `isPremium || legacy_mood_access` — `useProModeAccess().allowed` */
  entitled: boolean;
  quota: SearchQuota | 'checking';
}): ProModeGate {
  if (input.entitled) return 'enter';
  if (!input.offerEnabled) return 'locked';
  if (input.quota === 'checking') return 'checking';
  return input.quota.kind === 'exhausted' ? 'offer' : 'enter';
}

export interface ResetsIn {
  hours: number;
  minutes: number;
}

/** Hakkın yenilenmesine kalan süre. Geçmiş / geçersiz tarih → null (metin gösterilmez). Dakika yukarı yuvarlanır. */
export function resetsIn(resetsAt: string | null, now: Date = new Date()): ResetsIn | null {
  if (!resetsAt) return null;
  const target = Date.parse(resetsAt);
  if (Number.isNaN(target)) return null;
  const totalMinutes = Math.ceil((target - now.getTime()) / 60_000);
  if (totalMinutes <= 0) return null;
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
