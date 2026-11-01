/**
 * Sağlayıcı marka gruplama (Faz 2-4). Saf: RN / ağ yok.
 *
 * TMDB aynı markayı farklı `provider_id`'lerle verir: "Netflix" + "Netflix Standard with Ads",
 * "Prime Video" + "Amazon Video", "Paramount+" varyantları, "Apple TV" + "Apple TV Store".
 * Kullanıcı tek logo görür; CTA en uygun teklifi seçer (flatrate > free > ads > rent > buy —
 * girdi zaten `orderProviders` sırasındadır, ilk görülen kalır).
 *
 * Bilinen markalar kimlikle eşlenir; bilinmeyenler adın "with Ads" soneki atılarak
 * normalleştirilir (kanal varyantları `watchProviderList.dedupeChannelVariants`'te).
 */
import type { ProviderLike } from './watchProviderList';

interface Brand {
  readonly key: string;
  /** CTA'da görünen ad. */
  readonly name: string;
  readonly ids: readonly number[];
}

const BRANDS: readonly Brand[] = [
  { key: 'netflix', name: 'Netflix', ids: [8, 1796, 175] },
  { key: 'prime', name: 'Prime Video', ids: [9, 119, 10, 613, 2100] },
  { key: 'disney', name: 'Disney+', ids: [337] },
  { key: 'hbomax', name: 'HBO Max', ids: [1899, 384] },
  { key: 'apple', name: 'Apple TV', ids: [350, 2] },
  { key: 'googleplay', name: 'Google Play', ids: [3] },
  { key: 'youtube', name: 'YouTube', ids: [192, 235] },
  { key: 'hulu', name: 'Hulu', ids: [15] },
  { key: 'paramount', name: 'Paramount+', ids: [531, 2303, 2616, 2304] },
  { key: 'peacock', name: 'Peacock', ids: [386, 387] },
  { key: 'mubi', name: 'MUBI', ids: [11] },
  { key: 'tod', name: 'TOD', ids: [1826] },
  { key: 'tabii', name: 'tabii', ids: [2235] },
];

const BRAND_BY_ID = new Map<number, Brand>(BRANDS.flatMap((b) => b.ids.map((id) => [id, b] as const)));

/** " Standard with Ads", " Basic with Ads", " with Ads" sonekini atar. */
function stripAdsSuffix(name: string): string {
  return name.trim().replace(/\s+(?:standard\s+|basic\s+)?with\s+ads$/i, '').trim();
}

/**
 * Kanal eklentisi sonekleri (Faz 2-5, K4): Amazon / Apple / Roku üzerinden satılan alt abonelik.
 * `watchProviderList.CHANNEL_SUFFIXES` ile aynı kuralın görünen-ad tarafı; uzun olan önce.
 */
const CHANNEL_SUFFIX_RE = /\s+(?:roku premium channel|roku channel|amazon channel|apple tv channel|prime video channel)$/i;

/** Ad bir kanal eklentisi mi ("Lionsgate+ Amazon Channel")? */
export function isChannelAddonName(name: string): boolean {
  return CHANNEL_SUFFIX_RE.test(name.trim());
}

function stripChannelSuffix(name: string): string {
  return name.trim().replace(CHANNEL_SUFFIX_RE, '').trim();
}

/**
 * Kademe sonekleri (Faz 2-8): "Paramount Plus Premium / Essential" aynı markanın abonelik kademesidir.
 * Yalnız ad SONUNDA ve kanal/reklam sonekleri atıldıktan SONRA uygulanır.
 */
const TIER_SUFFIX_RE = /\s+(?:premium|essential|basic|standard|ultimate)$/i;

function stripTierSuffix(name: string): string {
  return name.trim().replace(TIER_SUFFIX_RE, '').trim();
}

function normalizeKey(name: string): string {
  return stripTierSuffix(stripChannelSuffix(stripAdsSuffix(name)))
    .toLowerCase()
    .replace(/\bplus\b/g, '+')
    .replace(/[^a-z0-9+]/g, '');
}

/**
 * Bilinen markaların normalleştirilmiş AD anahtarı → marka. Tabloda kimliği olmayan kanal/kademe
 * varyantları ("Paramount+ Amazon Channel", id 582) ada göre aynı markaya iner; böylece id'li
 * ("Paramount Plus Premium", 2303) ve adlı varyant tek marka sayılır. Genel kural — marka başına
 * ayrı kod yok: yeni marka BRANDS'a eklenince otomatik kapsanır.
 */
const BRAND_BY_NAME_KEY = new Map<string, Brand>(BRANDS.map((b) => [normalizeKey(b.name), b] as const));

export interface BrandInfo {
  key: string;
  name: string;
}

export function brandOf(p: ProviderLike): BrandInfo {
  const known = BRAND_BY_ID.get(p.provider_id);
  if (known) return { key: known.key, name: known.name };
  const nameKey = normalizeKey(p.provider_name);
  const byName = BRAND_BY_NAME_KEY.get(nameKey);
  if (byName) return { key: byName.key, name: byName.name };
  const stripped = stripTierSuffix(stripChannelSuffix(stripAdsSuffix(p.provider_name)));
  return { key: `name:${nameKey}`, name: stripped.length > 0 ? stripped : p.provider_name };
}

/** Aynı markanın varyantlarından yalnız İLK görüleni tutar (sıra korunur). */
export function dedupeByBrand<T extends ProviderLike>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const p of list) {
    const key = brandOf(p).key;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

/**
 * K1 — "ana marka": flatrate'te listenin en üstüne çıkan servisler. Anahtarlar `brandOf().key`.
 * TR servisleri (TV+, Exxen, Gain) TMDB'de kimlikle eşlenmediği için ad anahtarıyla gelir.
 */
const MAIN_BRAND_KEYS: ReadonlySet<string> = new Set([
  'netflix',
  'prime',
  'disney',
  'hbomax',
  'apple',
  'hulu',
  'paramount',
  'peacock',
  'mubi',
  'tod',
  'tabii',
  // Kimliği tanınmayan eski/alternatif adlar (TMDB adları dönemsel değişir).
  'name:netflix',
  'name:primevideo',
  'name:amazonprimevideo',
  'name:disney+',
  'name:hbomax',
  'name:max',
  'name:appletv+',
  'name:hulu',
  'name:paramount+',
  'name:peacock',
  'name:peacockpremium',
  'name:mubi',
  'name:tv+',
  'name:exxen',
  'name:gain',
]);

/** "Amazon Video" (10) bir mağazadır, abonelik markası değil; K1 yalnız Prime Video + reklamlı varyantı. */
const PRIME_STORE_IDS: ReadonlySet<number> = new Set([10]);

/** Kanal eklentisi OLMAYAN ana marka mı (K1 adayı)? Kova kararı çağıranındır. */
export function isMainBrand(p: ProviderLike): boolean {
  if (isChannelAddonName(p.provider_name)) return false;
  if (PRIME_STORE_IDS.has(p.provider_id)) return false;
  return MAIN_BRAND_KEYS.has(brandOf(p).key);
}
