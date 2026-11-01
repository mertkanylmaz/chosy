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

import { brandOf, isChannelAddonName, isMainBrand } from './watchProviderBrands';

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
 * Film detay ekranı listesi: şampiyon / Mood Gauntlet ile AYNI katman sıralaması
 * (`orderProvidersWithOffer`, Faz 2-5). `display_priority` olmayan girdi 0 sayılır (girdi sırası korunur).
 * `limit` verilirse tekilleştirmeden SONRA kesilir.
 */
export function flattenProviders<T extends ProviderLike>(
  providers: ProviderBuckets<T>,
  limit?: number,
): T[] {
  const withPriority = (list: readonly T[] | undefined): (T & RankedProviderLike)[] =>
    (list ?? []).map((p, i) => ({ display_priority: (p as Partial<RankedProviderLike>).display_priority ?? i, ...p }));
  const ordered = orderProviders<T & RankedProviderLike>({
    flatrate: withPriority(providers.flatrate),
    free: withPriority(providers.free),
    ads: withPriority(providers.ads),
    rent: withPriority(providers.rent),
    buy: withPriority(providers.buy),
  });
  return limit === undefined ? ordered : ordered.slice(0, limit);
}

// ─── V-3 Tur G2 (C5): şampiyon ekranının ilk-N seçimi ────────────────────────

/** Kova sırası (kova içi okuma sırası; SIRALAMA artık katmanlarla — bkz. `ProviderTier`). */
const RANKED_BUCKET_ORDER = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;

/** Kova içi TMDB `display_priority` sırası; kopya döner, girdi değişmez. */
function byPriority<T extends RankedProviderLike>(bucket: readonly T[] | undefined): T[] {
  return [...(bucket ?? [])].sort((a, b) => a.display_priority - b.display_priority);
}

export type OfferType = (typeof RANKED_BUCKET_ORDER)[number];

/**
 * Faz 2-5 (P0-1) sağlayıcı katmanı — TEK sıralama kuralı (şampiyon, Mood Gauntlet, film detayı):
 *   1 = flatrate + ana marka (Netflix, Prime Video, Disney+, Max/HBO Max, Apple TV+, Hulu,
 *       Paramount+, Peacock; TR: TOD, TV+, tabii, Exxen, Gain, MUBI)
 *   2 = free / ads (hepsi)
 *   3 = diğer flatrate (kanal eklentileri hariç)
 *   4 = kanal eklentileri (flatrate'te "… Amazon Channel" / "… Apple TV Channel" / "… Roku Premium Channel")
 *   5 = rent / buy
 * Katman içinde TMDB `display_priority` artan.
 */
export type ProviderTier = 1 | 2 | 3 | 4 | 5;

function tierOf(offer: OfferType, p: ProviderLike): ProviderTier {
  if (offer === 'free' || offer === 'ads') return 2;
  if (offer === 'rent' || offer === 'buy') return 5;
  if (isChannelAddonName(p.provider_name)) return 4;
  return isMainBrand(p) ? 1 : 3;
}

export interface OfferedProvider<T extends RankedProviderLike> {
  provider: T;
  /** Sağlayıcının EN İYİ katmanı veren kovası. */
  offer: OfferType;
  tier: ProviderTier;
}

/**
 * Tam sıralı liste (katman → display_priority → girdi sırası) + teklif türü.
 * Tekilleştirme kesmeden ÖNCE: `provider_id`; ana sağlayıcı abonelik/ücretsizde VARKEN kanal
 * varyantları elenir; ana yoksa grubun ilk (en iyi sıralı) varyantı kalır. Ana yalnız
 * kiralık/satın almada ise varyant (flatrate) elenmez — gerçek bir abonelik yolunu gizlemeyiz.
 */
export function orderProvidersWithOffer<T extends RankedProviderLike>(
  providers: ProviderBuckets<T>,
): OfferedProvider<T>[] {
  const best = new Map<number, OfferedProvider<T> & { idx: number }>();
  let idx = 0;
  for (const offer of RANKED_BUCKET_ORDER) {
    for (const provider of byPriority(providers[offer])) {
      const tier = tierOf(offer, provider);
      const cur = best.get(provider.provider_id);
      if (!cur || tier < cur.tier) best.set(provider.provider_id, { provider, offer, tier, idx: cur ? cur.idx : idx });
      idx += 1;
    }
  }
  const all = [...best.values()].sort(
    (a, b) => a.tier - b.tier || a.provider.display_priority - b.provider.display_priority || a.idx - b.idx,
  );
  // Streaming'de (tier ≤ 4) ana sağlayıcısı bulunan kanal varyantı grupları.
  // Faz 2-8: grup anahtarı MARKA anahtarı ("Paramount Plus Premium" kademesi ile "Paramount+ Amazon
  // Channel" kanal varyantı aynı markaya iner); ham ad eşlemesi bunu kaçırıyordu.
  const streamingMains = new Set<string>();
  for (const o of all) {
    if (variantBase(o.provider.provider_name) === null && o.tier <= 4) streamingMains.add(brandOf(o.provider).key);
  }
  const seenVariantGroup = new Set<string>();
  const out: OfferedProvider<T>[] = [];
  for (const o of all) {
    const base = variantBase(o.provider.provider_name);
    if (base !== null) {
      const g = brandOf(o.provider).key;
      if (streamingMains.has(g) || seenVariantGroup.has(g)) continue;
      seenVariantGroup.add(g);
    }
    out.push({ provider: o.provider, offer: o.offer, tier: o.tier });
  }
  return out;
}

/** Tam sıralı liste — `orderProvidersWithOffer`'ın sağlayıcı kısmı. */
export function orderProviders<T extends RankedProviderLike>(providers: ProviderBuckets<T>): T[] {
  return orderProvidersWithOffer(providers).map((o) => o.provider);
}

/**
 * Logo altı / CTA altı etiket grubu (A2). free ve ads AYRI; kanal eklentisi (K4) "addon".
 */
export type OfferLabelKind = 'subscription' | 'addon' | 'free' | 'ads' | 'rent' | 'buy';

export function offerLabelKind(offer: OfferType, tier?: ProviderTier): OfferLabelKind {
  if (offer === 'flatrate') return tier === 4 ? 'addon' : 'subscription';
  return offer;
}

/** Şampiyon ekranındaki logo satırı — en fazla `max` sağlayıcı (V3-D5). */
export function selectTopProviders<T extends RankedProviderLike>(
  providers: ProviderBuckets<T>,
  max = 3,
): T[] {
  return orderProviders(providers).slice(0, max);
}

export interface ProviderGroups<T extends RankedProviderLike> {
  /** yalnız flatrate (abonelik) */
  stream: T[];
  rent: T[];
  buy: T[];
  /** Faz 2-8: TMDB `free` + `ads` tek grupta; reklamlı olanlar `adsOnlyIds` ile ayırt edilir. */
  free: T[];
}

/**
 * Sağlayıcı sheet'inin grupları. Her grup KENDİ içinde tekilleştirilir: aynı
 * mağaza hem kiralık hem satın almada görünebilir, bu iki ayrı bilgidir.
 */
export function groupProviders<T extends RankedProviderLike>(
  providers: ProviderBuckets<T>,
): ProviderGroups<T> {
  return {
    stream: orderProviders({ flatrate: providers.flatrate }),
    rent: orderProviders({ rent: providers.rent }),
    buy: orderProviders({ buy: providers.buy }),
    free: orderProviders({ free: providers.free, ads: providers.ads }),
  };
}

/** Yalnız `ads` kovasında olan (reklamlı) kimlikler; `free` kovasında da varsa reklamsız sayılır. */
export function adsOnlyIds(providers: ProviderBuckets<ProviderLike>): Set<number> {
  const free = new Set((providers.free ?? []).map((p) => p.provider_id));
  return new Set((providers.ads ?? []).map((p) => p.provider_id).filter((id) => !free.has(id)));
}
