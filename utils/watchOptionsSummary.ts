/**
 * "Watch options" kartı (Faz 2-10a) için saf özet. RN / ağ yok.
 *
 * Özet satırı sabit metin DEĞİL: mevcut sheet gruplarından türetilir — yalnız verisi olan gruplar,
 * `SHEET_GROUP_ORDER` sırasında. Logo seçimi `WatchProvidersRow`'un mantığıyla aynı bileşimdir
 * (`dedupeByBrand(orderProviders(...))`, en fazla 3). Gruplar ARASI tekilleştirme yoktur: aynı marka
 * Stream'de de Rent or buy'da da görünebilir (sheet davranışı).
 */
import { dedupeByBrand } from './watchProviderBrands';
import {
  SHEET_GROUP_ORDER,
  groupProvidersForSheet,
  orderProviders,
  type ProviderBuckets,
  type RankedProviderLike,
  type SheetGroupKey,
} from './watchProviderList';

/** `WatchProvidersRow.MAX_PROVIDERS` ile aynı sınır. */
export const WATCH_CARD_MAX_LOGOS = 3;

/** Verisi olan sheet grupları, `SHEET_GROUP_ORDER` sırasında. */
export function watchOptionGroups<T extends RankedProviderLike>(providers: ProviderBuckets<T>): SheetGroupKey[] {
  const groups = groupProvidersForSheet(providers);
  return SHEET_GROUP_ORDER.filter((key) => groups[key].length > 0);
}

/** Karttaki logolar: satırdaki seçimle aynı (marka bazlı tekil, katman sıralı, en fazla 3). */
export function watchOptionLogos<T extends RankedProviderLike>(providers: ProviderBuckets<T>): T[] {
  return dedupeByBrand(orderProviders(providers)).slice(0, WATCH_CARD_MAX_LOGOS);
}

/** Erişilebilirlik etiketindeki servis sayısı: satırdaki "See all" sayısıyla aynı (marka bazlı tekil). */
export function watchOptionCount<T extends RankedProviderLike>(providers: ProviderBuckets<T>): number {
  return dedupeByBrand(orderProviders(providers)).length;
}
