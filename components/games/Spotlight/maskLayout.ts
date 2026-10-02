/**
 * Spotlight baslik maskesinin yerlesim hesabi — saf fonksiyonlar.
 *
 * B-1 / Fix 8: uzun baslikta maske satir satir buyuyup aksiyon barini ekran
 * disina itiyordu. Iki duzeltme burada yasar:
 *
 *   1. Kelime butunlugu — maske artik karakter bazinda degil KELIME bazinda
 *      kirilir. Bosluk ayraci kelime sinirini belirler; tire / iki nokta gibi
 *      gorunur ayraclar kelimenin icinde kalir.
 *   2. Olcek — slot boyutu ve yazisi, maske en fazla `MASK_TARGET_ROWS` satira
 *      sigsin diye `MASK_MIN_SCALE`'e kadar kucultulur. Daha uzun baslik 3+
 *      satira kirilir; o fazlalik ekranin kaydirilabilir ust bolgesinde kalir,
 *      aksiyon barini itmez.
 *
 * Yalniz YERLESIM hesaplanir. Hangi pozisyonun acik oldugu, harf dogrulamasi
 * ve puanlama bu dosyaya girmez (gorsel retrofit — oyun mantigi degismez).
 *
 * React Native'den bagimsiz tutuldu: `tests/games/spotlightLayout.test.ts`
 * Deno'da dogrudan calistirir.
 */

/** Tam olcekte slot genisligi (eski `slot.minWidth`) */
export const MASK_SLOT_W = 22;
/** Tam olcekte slot yuksekligi (eski `slot.height`) */
export const MASK_SLOT_H = 32;
/** Tam olcekte gorunur ayrac genisligi (eski `separator.minWidth`) */
export const MASK_SEP_W = 10;
/** Slotlar arasi bosluk — olceklenmez, okunurluk icin sabit */
export const MASK_GAP = 4;
/** Slot yazisi — eski `slotText` 20/24 */
export const MASK_FONT_SIZE = 20;
export const MASK_LINE_HEIGHT = 24;

/** Olcek tabani — altinda slot harfi okunurlugunu kaybediyor (onayli karar) */
export const MASK_MIN_SCALE = 0.8;
/** Hedef satir sayisi — olcek bu sayiya sigmak icin kuculur */
export const MASK_TARGET_ROWS = 2;

/** Olcek adimi; 1.0 → 0.8 arasi bes kademe (stil uretimi kademe basina bir kez) */
const SCALE_STEPS = [1, 0.95, 0.9, 0.85, MASK_MIN_SCALE] as const;

/** Maske jetonunun yerlesim icin gereken kismi (`TitleMaskToken` ile uyumlu) */
export interface MaskTokenShape {
  t: 'slot' | 'sep';
  c?: string;
}

/** Maskedeki bir hucre — `index` orijinal `title_mask` indeksi (revealed eslesmesi) */
export interface MaskCell<T extends MaskTokenShape> {
  token: T;
  index: number;
}

/** Bosluk ayraci mi? `c`'siz ayrac da eski cizimde bos gorunuyordu — ayni sayilir. */
function isWordBreak(token: MaskTokenShape): boolean {
  return token.t === 'sep' && (token.c === undefined || token.c === ' ');
}

/**
 * Maskeyi kelimelere boler. Bosluk ayraclari ciktida YER ALMAZ — kelimeler
 * arasi bosluk `wordSpacing()` ile cizilir. Ardisik bosluklar bos kelime uretmez.
 */
export function groupMaskWords<T extends MaskTokenShape>(mask: readonly T[]): MaskCell<T>[][] {
  const words: MaskCell<T>[][] = [];
  let current: MaskCell<T>[] = [];

  mask.forEach((token, index) => {
    if (isWordBreak(token)) {
      if (current.length > 0) words.push(current);
      current = [];
      return;
    }
    current.push({ token, index });
  });
  if (current.length > 0) words.push(current);

  return words;
}

/** Bir olcuyu olcege uygular — cizim ve hesap AYNI yuvarlamayi kullanir */
export function scaled(value: number, scale: number): number {
  return Math.round(value * scale);
}

function cellWidth(cell: MaskCell<MaskTokenShape>, scale: number): number {
  return scaled(cell.token.t === 'slot' ? MASK_SLOT_W : MASK_SEP_W, scale);
}

/** Kelimeler arasi bosluk — eski cizimdeki "ayrac + iki yanindaki gap" ile ayni */
export function wordSpacing(scale: number): number {
  return scaled(MASK_SEP_W, scale) + MASK_GAP * 2;
}

/**
 * Greedy satir sayimi — RN `flexWrap`'in yaptigi gibi: kelime sigmiyorsa
 * yeni satira gecer. Satirdan genis tek kelime kendi icinde hucre hucre
 * kirilir (cizimde kelime kabi da `flexWrap` tasir).
 */
export function countMaskRows(
  words: readonly (readonly MaskCell<MaskTokenShape>[])[],
  scale: number,
  rowWidth: number,
): number {
  if (words.length === 0) return 0;

  let rows = 1;
  let used = 0;
  const spacing = wordSpacing(scale);

  for (const word of words) {
    const widths = word.map((cell) => cellWidth(cell, scale));
    const total = widths.reduce((sum, w) => sum + w, 0) + MASK_GAP * (widths.length - 1);
    const needed = used === 0 ? total : used + spacing + total;

    if (needed <= rowWidth) {
      used = needed;
      continue;
    }

    if (total <= rowWidth) {
      // Kelime yeni satira tasinir
      if (used > 0) rows += 1;
      used = total;
      continue;
    }

    // Satirdan genis kelime: yeni satirdan baslar, hucre hucre kirilir
    if (used > 0) rows += 1;
    used = 0;
    for (const w of widths) {
      const next = used === 0 ? w : used + MASK_GAP + w;
      if (next <= rowWidth) {
        used = next;
      } else {
        rows += 1;
        used = w;
      }
    }
  }

  return rows;
}

/**
 * Maskenin `MASK_TARGET_ROWS` satira sigdigi EN BUYUK olcek. Hicbir kademe
 * yetmiyorsa taban (`MASK_MIN_SCALE`) doner; fazla satirlar kaydirilabilir
 * ust bolgede kalir.
 */
export function fitMaskScale(
  words: readonly (readonly MaskCell<MaskTokenShape>[])[],
  rowWidth: number,
): number {
  for (const scale of SCALE_STEPS) {
    if (countMaskRows(words, scale, rowWidth) <= MASK_TARGET_ROWS) return scale;
  }
  return MASK_MIN_SCALE;
}
