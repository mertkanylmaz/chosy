/**
 * Yalnızca-artikel sorgu (P-6a) — saf hesap.
 *
 * "The" yazıldığında arama yüzlerce filme uyar ve listede rastgele görünen
 * altı sonuç çıkar. `listControls` açıkken (Spotlight) böyle bir sorgu
 * aranmaz; liste yerine "yazmaya devam et" ipucu satırı çizilir.
 *
 * Tek harfli "a" bugün 2 karakter kapısında (`index.tsx` handleChange) zaten
 * aranmıyor; küme yine de tam tutulur ki kapı değişirse davranış aynı kalsın.
 *
 * React Native'den bağımsız — `tests/games/filmSearchList.test.ts`.
 */

const ARTICLES: readonly string[] = ['the', 'a', 'an'];

/** Sorgu, boşluklar atıldığında yalnızca bir İngilizce artikel mi */
export function isArticleOnlyQuery(text: string): boolean {
  return ARTICLES.includes(text.trim().toLowerCase());
}
