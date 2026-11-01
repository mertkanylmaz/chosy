/**
 * Mood Gauntlet "Watch now" hedefi (Faz 2-3). Saf, RN / ağ yok.
 *
 *  1. Bölgedeki sağlayıcılardan MARKA başına ilki (flatrate > free > ads > rent > buy,
 *     `orderProvidersWithOffer` + marka gruplama: Netflix ≈ Netflix Standard with Ads).
 *  2. Sağlayıcı `opensApp: 'verified'` ise → sağlayıcının resmî arama URL'si (link_kind=provider).
 *  3. Aksi halde ('unverified' / tabloda yok) → JustWatch film araması (link_kind=justwatch);
 *     bölge yoksa detay.
 *  4. Hiç sağlayıcı yok / veri hazır değil → uygulama içi /film/:id (link_kind=detail).
 *
 * Film sayfasına derin bağlantımız YOK → düğme "Watch on" demez: "Find on {Provider}" / "Şurada bul: {Provider}".
 */
import { brandOf } from './watchProviderBrands';
import { orderProvidersWithOffer, type OfferType, type ProviderBuckets, type RankedProviderLike } from './watchProviderList';
import { opensAppOf, providerSearchUrl } from './watchProviderLinks';

export type WatchLinkKind = 'provider' | 'justwatch' | 'detail';
export type WatchLabelKind = 'watch' | 'rent' | 'buy';

export interface WatchTarget {
  kind: WatchLinkKind;
  /** 'detail' için null (çağıran /film/:id'ye gider). */
  url: string | null;
  /** Bölgede en az bir sağlayıcı bulundu mu (olay özelliği). */
  providerFound: boolean;
  providerId: number | null;
  /** Düğmede görünen sağlayıcı adı; sağlayıcı yoksa null. */
  providerName: string | null;
  offerType: OfferType | null;
  labelKind: WatchLabelKind;
}

export interface WatchTargetInput {
  title: string;
  /** Cihaz bölgesi (ISO-2) ya da null. */
  region: string | null;
  /** `useWatchProviders().state === 'ok'` — veri başarıyla geldi mi. */
  providersReady: boolean;
  providers: (ProviderBuckets<RankedProviderLike> & { link?: string }) | null;
}

/** JustWatch ülke yolu: ISO-2 küçük harf; GB için 'uk'. */
export function justWatchCountry(region: string): string {
  const cc = region.trim().toLowerCase();
  return cc === 'gb' ? 'uk' : cc;
}

export function justWatchSearchUrl(region: string, title: string): string {
  return `https://www.justwatch.com/${justWatchCountry(region)}/search?q=${encodeURIComponent(title)}`;
}

export function labelKindOf(offer: OfferType | null): WatchLabelKind {
  return offer === 'rent' ? 'rent' : offer === 'buy' ? 'buy' : 'watch';
}

const NONE: WatchTarget = {
  kind: 'detail',
  url: null,
  providerFound: false,
  providerId: null,
  providerName: null,
  offerType: null,
  labelKind: 'watch',
};

export function resolveWatchTarget(input: WatchTargetInput): WatchTarget {
  const { providers, providersReady, region, title } = input;
  if (!providersReady || providers === null) return NONE;
  const seenBrands = new Set<string>();
  const ordered = orderProvidersWithOffer(providers).filter((o) => {
    const key = brandOf(o.provider).key;
    if (seenBrands.has(key)) return false;
    seenBrands.add(key);
    return true;
  });
  const first = ordered[0];
  if (!first) return NONE;

  const base = {
    providerFound: true,
    providerId: first.provider.provider_id,
    providerName: brandOf(first.provider).name,
    offerType: first.offer,
    labelKind: labelKindOf(first.offer),
  };
  const direct =
    opensAppOf(first.provider.provider_id) === 'verified'
      ? providerSearchUrl(first.provider.provider_id, title)
      : null;
  if (direct !== null) return { ...base, kind: 'provider', url: direct };
  if (region !== null && region.trim().length === 2 && title.trim().length > 0) {
    return { ...base, kind: 'justwatch', url: justWatchSearchUrl(region, title) };
  }
  // Sağlayıcı var ama açılacak güvenilir adres yok → uygulama içi detay (provider_found yine true).
  return { ...base, kind: 'detail', url: null };
}
