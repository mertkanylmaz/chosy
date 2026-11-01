/**
 * Mood Gauntlet "Where to watch" bağlamı (Faz 2-3 → Faz 2-8). Saf, RN / ağ yok.
 *
 * Faz 2-8: CTA artık dışarı bağlantı ÜRETMEZ — uygulama içi native sheet'i açar. Bu modül yalnız
 * olay özellikleri için "bölgede sağlayıcı var mı, ilki hangisi" bilgisini çıkarır:
 * bölgedeki sağlayıcılardan MARKA başına ilki (Faz 2-5 katmanları K1–K5, bkz.
 * `watchProviderList.ProviderTier`; `orderProvidersWithOffer` + marka gruplama).
 * JustWatch / TMDB / sağlayıcı arama adresleri kaldırıldı (geçmiş git'te).
 */
import { brandOf } from './watchProviderBrands';
import { offerLabelKind, orderProvidersWithOffer, type OfferLabelKind, type OfferType, type ProviderBuckets, type RankedProviderLike } from './watchProviderList';

export type WatchLabelKind = 'watch' | 'rent' | 'buy';

export interface WatchTarget {
  /** Bölgede en az bir sağlayıcı bulundu mu (olay özelliği). */
  providerFound: boolean;
  providerId: number | null;
  /** Sağlayıcı yoksa null. */
  providerName: string | null;
  offerType: OfferType | null;
  /** Logo altı etiket grubu (A2): subscription | addon | free | ads | rent | buy. */
  offerLabel: OfferLabelKind | null;
  labelKind: WatchLabelKind;
}

export interface WatchTargetInput {
  /** `useWatchProviders().state === 'ok'` — veri başarıyla geldi mi. */
  providersReady: boolean;
  providers: ProviderBuckets<RankedProviderLike> | null;
}

export function labelKindOf(offer: OfferType | null): WatchLabelKind {
  return offer === 'rent' ? 'rent' : offer === 'buy' ? 'buy' : 'watch';
}

const NONE: WatchTarget = {
  providerFound: false,
  providerId: null,
  providerName: null,
  offerType: null,
  offerLabel: null,
  labelKind: 'watch',
};

export function resolveWatchTarget(input: WatchTargetInput): WatchTarget {
  const { providers, providersReady } = input;
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
  return {
    providerFound: true,
    providerId: first.provider.provider_id,
    providerName: brandOf(first.provider).name,
    offerType: first.offer,
    offerLabel: offerLabelKind(first.offer, first.tier),
    labelKind: labelKindOf(first.offer),
  };
}
