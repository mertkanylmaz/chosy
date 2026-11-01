/**
 * Mood Gauntlet "Watch now" hedefi (Faz 2-3). Saf, RN / ağ yok.
 *
 *  1. Bölgedeki sağlayıcılardan MARKA başına ilki (Faz 2-5 katmanları K1–K5, bkz.
 *     `watchProviderList.ProviderTier`; `orderProvidersWithOffer` + marka gruplama:
 *     Netflix ≈ Netflix Standard with Ads). Satırdaki ilk logo = buradaki ilk sağlayıcı.
 *  2. Sağlayıcı `opensApp: 'verified'` ise → sağlayıcının resmî arama URL'si (link_kind=provider_direct).
 *  3. Aksi halde → JustWatch film araması (link_kind=justwatch) YALNIZ doğrulanmış ülkelerde
 *     (`watchProviderLinks.justWatchSearchUrl`); değilse TMDB watch sayfası (link_kind=tmdb_watch,
 *     yanıttaki `link`); o da yoksa kind='none' → CTA GİZLENİR (tahmini URL üretilmez).
 *  4. Hiç sağlayıcı yok / veri hazır değil → uygulama içi /film/:id (link_kind=detail).
 *
 * CTA dürüstlüğü (Faz 2-5, P0-1b): sağlayıcı adı düğmede YALNIZ `provider_direct` iken görünür
 * ("Open in {Provider}"); justwatch / tmdb_watch → "Where to watch" (UI tarafı karar verir).
 */
import { brandOf } from './watchProviderBrands';
import { offerLabelKind, orderProvidersWithOffer, type OfferLabelKind, type OfferType, type ProviderBuckets, type RankedProviderLike } from './watchProviderList';
import { justWatchSearchUrl, opensAppOf, providerSearchUrl, tmdbWatchLink } from './watchProviderLinks';

/** 'provider_direct' yalnız `opensApp: 'verified'` sağlayıcıda (şimdilik hiçbiri). 'none' = CTA gizli. */
export type WatchLinkKind = 'justwatch' | 'tmdb_watch' | 'provider_direct' | 'detail' | 'none';
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
  /** CTA altı / logo altı etiket grubu (A2): subscription | addon | free | ads | rent | buy. */
  offerLabel: OfferLabelKind | null;
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
  offerLabel: null,
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
    offerLabel: offerLabelKind(first.offer, first.tier),
    labelKind: labelKindOf(first.offer),
  };
  const direct =
    opensAppOf(first.provider.provider_id) === 'verified'
      ? providerSearchUrl(first.provider.provider_id, title)
      : null;
  if (direct !== null) return { ...base, kind: 'provider_direct', url: direct };
  const jw = justWatchSearchUrl(region, title);
  if (jw !== null) return { ...base, kind: 'justwatch', url: jw };
  const tmdb = tmdbWatchLink(providers.link);
  if (tmdb !== null) return { ...base, kind: 'tmdb_watch', url: tmdb };
  // Sağlayıcı var ama güvenilir adres yok → CTA gizlenir (provider_found yine true).
  return { ...base, kind: 'none', url: null };
}
