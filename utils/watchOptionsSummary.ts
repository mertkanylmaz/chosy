/**
 * "Watch options" kartı (Faz 2-10a) için saf özet. RN / ağ yok.
 *
 * Özet satırı sabit metin DEĞİL: mevcut sheet gruplarından türetilir — yalnız verisi olan gruplar,
 * `SHEET_GROUP_ORDER` sırasında. Logo şeridi (Home-A1.2): sheet grupları sırayla (Stream → Free →
 * Rent or buy, grup içi mevcut sıra) birleştirilir ve MARKA anahtarıyla (`brandOf().key`) tekilleştirilir;
 * aynı marka birden çok grupta ise kartta bir kez, en yüksek öncelikli grubuyla görünür. Sheet'in kendisi
 * gruplar arası tekilleştirme YAPMAZ (`groupProvidersForSheet` değişmedi).
 */
import { dedupeByBrand } from './watchProviderBrands';
import {
  SHEET_GROUP_ORDER,
  groupProvidersForSheet,
  type ProviderBuckets,
  type RankedProviderLike,
  type SheetGroupKey,
} from './watchProviderList';

/** Kartta en fazla bu kadar öğe (logo + varsa "+N" rozeti). */
export const WATCH_CARD_MAX_ITEMS = 5;
/** Sağlayıcı sayısı sınırı aşarsa gösterilen logo sayısı (5. yuva "+N" rozetidir). */
export const WATCH_CARD_LOGOS_WHEN_OVERFLOW = WATCH_CARD_MAX_ITEMS - 1;

/** Verisi olan sheet grupları, `SHEET_GROUP_ORDER` sırasında. */
export function watchOptionGroups<T extends RankedProviderLike>(providers: ProviderBuckets<T>): SheetGroupKey[] {
  const groups = groupProvidersForSheet(providers);
  return SHEET_GROUP_ORDER.filter((key) => groups[key].length > 0);
}

/** Tekil (marka bazlı) sağlayıcıların tamamı: sheet grup sırası, aynı marka ilk (en yüksek) grubuyla. */
export function watchOptionItems<T extends RankedProviderLike>(providers: ProviderBuckets<T>): T[] {
  const groups = groupProvidersForSheet(providers);
  return dedupeByBrand(SHEET_GROUP_ORDER.flatMap((key) => groups[key]));
}

export interface WatchOptionStrip<T> {
  logos: T[];
  /** Logoya sığmayan tekil sağlayıcı sayısı; 0 ise rozet çizilmez. */
  overflow: number;
}

/** Kart şeridi: ≤5 tekil sağlayıcı → hepsi; fazlası → ilk 4 logo + kalan sayısı. */
export function watchOptionStrip<T extends RankedProviderLike>(providers: ProviderBuckets<T>): WatchOptionStrip<T> {
  const items = watchOptionItems(providers);
  if (items.length <= WATCH_CARD_MAX_ITEMS) return { logos: items, overflow: 0 };
  return {
    logos: items.slice(0, WATCH_CARD_LOGOS_WHEN_OVERFLOW),
    overflow: items.length - WATCH_CARD_LOGOS_WHEN_OVERFLOW,
  };
}

/** Erişilebilirlik etiketindeki servis sayısı: TEKİL (marka bazlı) toplam, kırpılmamış. */
export function watchOptionCount<T extends RankedProviderLike>(providers: ProviderBuckets<T>): number {
  return watchOptionItems(providers).length;
}
