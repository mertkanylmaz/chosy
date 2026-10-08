/**
 * Cycle tarihi anahtarı (YYYY-MM-DD) — istemci tarafı doğrulama ve çözümleme.
 * SAF: React, ağ, depolama, saat yok (Deno testi: tests/gauntlet/cycleDateKey.test.ts).
 * Import'suz tutulur ki Deno `@/` alias'ı olmadan yükleyebilsin.
 *
 * Cycle tarihini SUNUCU hesaplar (`DailyGauntlet.date`, F1). İstemci onu yerel
 * saatten TÜRETMEZ; yalnızca aktif gauntlet'ten alıp taşır. Spotlight bulmaca
 * anahtarı da budur (F2) — chosy-conventions §9.4'teki "cihaz yerel tarihine
 * anahtarlanır" kuralı bu değişiklikle eskidir (kural metni değişmedi, F3'te
 * güncellenecek).
 */

/** Gerçek bir takvim tarihi mi (`2026-02-31` reddedilir). */
export function isCycleDateKey(v: unknown): v is string {
  if (typeof v !== 'string') return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const ms = Date.UTC(y, mo - 1, d);
  return new Date(ms).toISOString().slice(0, 10) === v;
}

/**
 * Spotlight ekranının tarihi: önce rota parametresi (bonus karttan geçirilir),
 * yoksa ya da geçersizse önbellekteki mevcut cycle tarihi. İkisi de yoksa
 * `null` — çağıran görünür hata gösterir; yerel tarihe SESSİZ düşüş YOK.
 * expo-router parametresi `string | string[] | undefined` gelebilir; dizi geçersizdir.
 */
export function resolveSpotlightDate(param: unknown, cached: string | null): string | null {
  if (isCycleDateKey(param)) return param;
  if (isCycleDateKey(cached)) return cached;
  return null;
}
