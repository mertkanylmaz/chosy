/**
 * Sonuç ekranı kaydırma kararı (Faz 2-6, madde 4). Saf, RN yok.
 * Yeni sonuç (yeni arama, Another four, Lighter / More intense) = (şampiyon, set sırası) çifti değişti
 * → en üste kaydır. Aynı sonuçta (film detayından dönüş, bölge değişimi, kaydet) konum KORUNUR.
 */
export function resultScrollKey(championId: string, setIndex: number): string {
  return `${championId}:${setIndex}`;
}

/** `prev` null = ilk bağlanma (ScrollView zaten en üstte) → kaydırma yok. */
export function shouldScrollToTop(prev: string | null, next: string): boolean {
  return prev !== null && prev !== next;
}
