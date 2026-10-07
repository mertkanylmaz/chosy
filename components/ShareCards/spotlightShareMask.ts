/**
 * Spotlight paylaşım maskesi — saf (React/RN importu yok).
 *
 * Çıktı YALNIZCA sayıdır: kelime başına boş slot sayısı. Harf ve ayraç glyph'i
 * çıkışa giremez. Girdi, puzzle'ın maske YAPISIDIR (`title_mask`); `c` alanı
 * (ayraç karakteri) tip düzeyinde okunamaz; açılmış harf ve film verisi girdi
 * olarak yoktur.
 *
 * Ayraç (boşluk, tire, iki nokta…) slot sayılmaz ve kelimeyi böler. Bu, oyun
 * ekranındaki yerleşimden (`maskLayout.groupMaskWords`: yalnız boşluk böler)
 * bilinçli olarak farklıdır: kartta ayraç glyph'i yok, dolayısıyla "SPIDER-MAN"
 * tek bir 9'luk bloğa değil [6, 3]'e dönüşür.
 *
 * Test: `tests/games/spotlightShareMask.test.ts`.
 */

/** Maske jetonunun paylaşım için okunabilen tek kısmı — `c` bilerek YOK. */
export interface ShareMaskToken {
  readonly t: 'slot' | 'sep';
}

export function buildShareMask(maskTokens: readonly ShareMaskToken[]): number[] {
  const words: number[] = [];
  let run = 0;
  for (const token of maskTokens) {
    if (token.t === 'slot') {
      run += 1;
      continue;
    }
    if (run > 0) words.push(run);
    run = 0;
  }
  if (run > 0) words.push(run);
  return words;
}
