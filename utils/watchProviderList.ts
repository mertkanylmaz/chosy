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
 *
 * V-3 Tur G2: `orderProviders` / `selectTopProviders` / `groupProviders` —
 * free/ads kovaları ve `display_priority` sırası (şampiyon ekranı, C5).
 * `flattenProviders` film detay ekranı için DEĞİŞMEDEN kalır.
 */

export interface ProviderLike {
  provider_id: number;
  provider_name: string;
}

export interface ProviderBuckets<T extends ProviderLike> {
  flatrate?: T[];
  /** V-3 Tur G2: TMDB `free` / `ads` kovaları — sıralamada flatrate'ten sonra. */
  free?: T[];
  ads?: T[];
  rent?: T[];
  buy?: T[];
}

/** TMDB'nin kova içi sıralama alanını taşıyan sağlayıcı (V-3 Tur G2). */
export interface RankedProviderLike extends ProviderLike {
  display_priority: number;
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

// ─── V-3 Tur G2 (C5): şampiyon ekranının ilk-N seçimi ────────────────────────

/** Kova sırası: akış → ücretsiz → reklamlı → kiralık → satın alma. */
const RANKED_BUCKET_ORDER = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;

/** Kova içi TMDB `display_priority` sırası; kopya döner, girdi değişmez. */
function byPriority<T extends RankedProviderLike>(bucket: readonly T[] | undefined): T[] {
  return [...(bucket ?? [])].sort((a, b) => a.display_priority - b.display_priority);
}

/** `provider_id` tekrarsız (ilk görülen kalır) + kanal varyantı tekilleştirmesi. */
function uniqueProviders<T extends RankedProviderLike>(list: readonly T[]): T[] {
  const seen = new Set<number>();
  const out: T[] = [];
  for (const p of list) {
    if (seen.has(p.provider_id)) continue;
    seen.add(p.provider_id);
    out.push(p);
  }
  return dedupeChannelVariants(out);
}

/**
 * Tam sıralı liste: flatrate → free → ads → rent → buy, kova içinde
 * `display_priority`. Tekilleştirme (id + kanal varyantı) kesmeden ÖNCE
 * uygulanır — "See all" sayacı ve Watch Now görünürlüğü bu uzunluğu okur.
 */
export function orderProviders<T extends RankedProviderLike>(providers: ProviderBuckets<T>): T[] {
  return uniqueProviders(RANKED_BUCKET_ORDER.flatMap((k) => byPriority(providers[k])));
}

/** Şampiyon ekranındaki logo satırı — en fazla `max` sağlayıcı (V3-D5). */
export function selectTopProviders<T extends RankedProviderLike>(
  providers: ProviderBuckets<T>,
  max = 3,
): T[] {
  return orderProviders(providers).slice(0, max);
}

export interface ProviderGroups<T extends RankedProviderLike> {
  /** flatrate + free + ads */
  stream: T[];
  rent: T[];
  buy: T[];
}

/**
 * "See all" sheet'inin grupları. Her grup KENDİ içinde tekilleştirilir: aynı
 * mağaza hem kiralık hem satın almada görünebilir, bu iki ayrı bilgidir.
 */
export function groupProviders<T extends RankedProviderLike>(
  providers: ProviderBuckets<T>,
): ProviderGroups<T> {
  return {
    stream: uniqueProviders([
      ...byPriority(providers.flatrate),
      ...byPriority(providers.free),
      ...byPriority(providers.ads),
    ]),
    rent: uniqueProviders(byPriority(providers.rent)),
    buy: uniqueProviders(byPriority(providers.buy)),
  };
}
