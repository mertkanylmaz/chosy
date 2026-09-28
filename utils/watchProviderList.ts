/**
 * "Nerede izlenir" listesinin saf çekirdeği — V-2 Tur D.
 *
 * TMDB (JustWatch kaynaklı) bir ana sağlayıcıyı kanal varyantlarıyla birlikte
 * AYRI `provider_id`'lerle döndürür: "MGM Plus" + "MGM+ Amazon Channel" +
 * "MGM+ Roku Premium Channel". `provider_id` ile tekilleştirme bunları
 * yakalamaz; kullanıcı aynı servisi iki-üç kez görür.
 *
 * Kural:
 *   - Ana sağlayıcı listede varsa kanal varyantları gizlenir.
 *   - Yoksa grubun İLK varyantı (öncelik sırasına göre) tek başına kalır.
 *   - Tutulan öğe grubun ilk göründüğü sıraya oturur — flatrate'teki bir
 *     varyant yüzünden ana sağlayıcı listenin sonuna düşmez.
 *
 * Varyant son ekleri AÇIK listedir. Genel " Channel" soyması yapılmaz:
 * "Hallmark Channel" gibi kendi başına sağlayıcı olan adları yutardı.
 *
 * Ağ/React/cihaz bağımlılığı YOK — deno ile doğrudan test edilir
 * (`tests/gauntlet/watchProviderList.test.ts`).
 */

export interface ProviderLike {
  provider_id: number;
  provider_name: string;
}

export interface ProviderBuckets<T extends ProviderLike> {
  flatrate?: T[];
  rent?: T[];
  buy?: T[];
}

/** Küçük harfle karşılaştırılır; uzun olan önce (Roku Premium > Roku). */
const CHANNEL_SUFFIXES = [
  'roku premium channel',
  'roku channel',
  'amazon channel',
  'apple tv channel',
  'prime video channel',
] as const;

/** "MGM Plus" ve "MGM+" aynı anahtara iner. */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\bplus\b/g, '+')
    .replace(/[^a-z0-9+]/g, '');
}

/** Ad bir kanal varyantıysa ana sağlayıcı adını, değilse null döner. */
function variantBase(name: string): string | null {
  const lower = name.trim().toLowerCase();
  for (const suffix of CHANNEL_SUFFIXES) {
    if (lower.endsWith(` ${suffix}`)) {
      return name.trim().slice(0, lower.length - suffix.length).trim();
    }
  }
  return null;
}

export function dedupeChannelVariants<T extends ProviderLike>(list: readonly T[]): T[] {
  // grup anahtarı → { ilk sıra, tutulan öğe, tutulan ana mı }
  const groups = new Map<string, { order: number; item: T; isMain: boolean }>();
  let order = 0;

  for (const p of list) {
    const base = variantBase(p.provider_name);
    const isMain = base === null;
    const groupKey = normalize(base ?? p.provider_name);
    const existing = groups.get(groupKey);

    if (!existing) {
      groups.set(groupKey, { order: order++, item: p, isMain });
      continue;
    }
    // Ana sağlayıcı, daha önce tutulmuş bir varyantın yerini alır (sırası korunur).
    if (isMain && !existing.isMain) {
      existing.item = p;
      existing.isMain = true;
    }
  }

  return [...groups.values()].sort((a, b) => a.order - b.order).map((g) => g.item);
}

/**
 * flatrate > rent > buy sırasıyla `provider_id` tekrarsız + kanal varyantı
 * tekilleştirilmiş liste. `limit` verilirse tekilleştirmeden SONRA kesilir.
 */
export function flattenProviders<T extends ProviderLike>(
  providers: ProviderBuckets<T>,
  limit?: number,
): T[] {
  const out: T[] = [];
  const seen = new Set<number>();
  for (const bucket of [providers.flatrate, providers.rent, providers.buy]) {
    for (const p of bucket ?? []) {
      if (seen.has(p.provider_id)) continue;
      seen.add(p.provider_id);
      out.push(p);
    }
  }
  const deduped = dedupeChannelVariants(out);
  return limit === undefined ? deduped : deduped.slice(0, limit);
}
