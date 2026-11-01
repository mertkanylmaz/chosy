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
];

const BRAND_BY_ID = new Map<number, Brand>(BRANDS.flatMap((b) => b.ids.map((id) => [id, b] as const)));

/** " Standard with Ads", " Basic with Ads", " with Ads" sonekini atar. */
function stripAdsSuffix(name: string): string {
  return name.trim().replace(/\s+(?:standard\s+|basic\s+)?with\s+ads$/i, '').trim();
}

function normalizeKey(name: string): string {
  return stripAdsSuffix(name)
    .toLowerCase()
    .replace(/\bplus\b/g, '+')
    .replace(/[^a-z0-9+]/g, '');
}

export interface BrandInfo {
  key: string;
  name: string;
}

export function brandOf(p: ProviderLike): BrandInfo {
  const known = BRAND_BY_ID.get(p.provider_id);
  if (known) return { key: known.key, name: known.name };
  const stripped = stripAdsSuffix(p.provider_name);
  return { key: `name:${normalizeKey(p.provider_name)}`, name: stripped.length > 0 ? stripped : p.provider_name };
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
