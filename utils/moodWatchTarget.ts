/**
 * Mood Gauntlet "Watch now" hedefi (Faz 2-1b). Saf, RN / ağ yok.
 *
 *  - Kullanıcının bölgesinde en az bir sağlayıcı varsa (flatrate öncelikli sıralama, bkz.
 *    `orderProviders`): TMDB'nin bölgeye özel "nerede izlenir" bağlantısı (`providers.link`).
 *    NOT: TMDB sağlayıcı BAŞINA derin bağlantı vermez; tek bağlantı bölge sayfasıdır.
 *  - Sağlayıcı var ama `link` yoksa: JustWatch arama sayfası (ülke yolu + film adı).
 *  - Hiç sağlayıcı yoksa (ya da veri hazır değil / bölge yok): uygulama içi /film/:id.
 */
import { orderProviders, type RankedProviderLike } from './watchProviderList';

export type WatchTargetKind = 'provider_link' | 'justwatch' | 'detail';

export interface WatchTarget {
  kind: WatchTargetKind;
  /** 'detail' için null (çağıran /film/:id'ye gider). */
  url: string | null;
  /** Bölgede en az bir sağlayıcı bulundu mu (olay özelliği). */
  providerFound: boolean;
}

export interface WatchTargetInput {
  filmId: string;
  title: string;
  /** Cihaz bölgesi (ISO-2) ya da null. */
  region: string | null;
  /** `useWatchProviders().state === 'ok'` — veri başarıyla geldi mi. */
  providersReady: boolean;
  providers:
    | {
        link?: string;
        flatrate?: RankedProviderLike[];
        free?: RankedProviderLike[];
        ads?: RankedProviderLike[];
        rent?: RankedProviderLike[];
        buy?: RankedProviderLike[];
      }
    | null;
}

/** JustWatch ülke yolu: ISO-2 küçük harf; GB için 'uk'. */
export function justWatchCountry(region: string): string {
  const cc = region.trim().toLowerCase();
  return cc === 'gb' ? 'uk' : cc;
}

export function justWatchSearchUrl(region: string, title: string): string {
  return `https://www.justwatch.com/${justWatchCountry(region)}/search?q=${encodeURIComponent(title)}`;
}

const isHttpsUrl = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s]+$/.test(u);

export function resolveWatchTarget(input: WatchTargetInput): WatchTarget {
  const { providers, providersReady, region, title } = input;
  const found = providersReady && providers !== null && orderProviders(providers).length > 0;
  if (!found || providers === null) return { kind: 'detail', url: null, providerFound: false };
  if (isHttpsUrl(providers.link)) return { kind: 'provider_link', url: providers.link, providerFound: true };
  if (region !== null && region.trim().length === 2 && title.trim().length > 0) {
    return { kind: 'justwatch', url: justWatchSearchUrl(region, title), providerFound: true };
  }
  // Sağlayıcı var ama açılacak güvenilir adres yok → uygulama içi detay (provider_found yine true).
  return { kind: 'detail', url: null, providerFound: true };
}
