/**
 * Başlık maskesinin VoiceOver özeti — saf modül (RN import YOK, test edilebilir).
 *
 * Tek erişilebilir öğe: kelime sayısı, her kelimenin uzunluğu ve hangi
 * pozisyonların açık olduğu (harfleriyle). Ekranda ZATEN görünenden fazlasını
 * söylemez: görünür ayraçlar (tire, rakam…) olduğu gibi okunur, kapalı slot
 * "boş" okunur; kapalı pozisyonun harfi bilinmez zaten.
 *
 * Metinler i18n'den gelir; `t` enjekte edilir (testte sahte).
 */

/** `maskLayout.ts` MaskCell'in yapısal eşi — Deno uzantısız import çözemediği için yerel */
interface MaskCell {
  token: { t: 'slot' | 'sep'; c?: string };
  index: number;
}

/** `LanguageContext.t` ile uyumlu en küçük imza */
export type Translate = (key: string, options?: Record<string, unknown>) => string;

export type MaskCellDesc =
  | { kind: 'blank' }
  | { kind: 'letter'; ch: string }
  /** Görünür ayraç / rakam — tasarım gereği baştan açık */
  | { kind: 'fixed'; ch: string };

export interface MaskWordDesc {
  /** Tahmin edilecek slot sayısı (rakam/ayraç hariç — sunucunun letter_count'u ile aynı sayım) */
  letterCount: number;
  cells: MaskCellDesc[];
  /** Her hücre kapalı slot (görünür ayraç yok) */
  allBlank: boolean;
}

export function describeMask(
  words: readonly (readonly MaskCell[])[],
  revealed: ReadonlyMap<number, string>,
): MaskWordDesc[] {
  return words.map((word) => {
    const cells: MaskCellDesc[] = word.map(({ token, index }) => {
      if (token.t === 'sep') return { kind: 'fixed', ch: token.c ?? '' };
      const ch = revealed.get(index);
      // Locale'siz büyütme: ekrandaki slot metniyle ve sunucuyla aynı
      return ch != null ? { kind: 'letter', ch: ch.toUpperCase() } : { kind: 'blank' };
    });
    return {
      letterCount: word.filter(({ token }) => token.t === 'slot').length,
      cells,
      allBlank: cells.every((c) => c.kind === 'blank'),
    };
  });
}

const KEY = 'games.spotlight.';

/** Tek erişilebilir etiket: "Başlık. 2 kelime. Kelime 1: 3 harf, T, boş, boş. …" */
export function composeMaskLabel(
  words: readonly (readonly MaskCell[])[],
  revealed: ReadonlyMap<number, string>,
  t: Translate,
): string {
  const described = describeMask(words, revealed);
  const parts: string[] = [t(`${KEY}mask_a11y_title`)];
  if (described.length === 0) return parts[0];

  parts.push(t(`${KEY}mask_a11y_words`, { count: described.length }));

  described.forEach((word, i) => {
    const n = i + 1;
    if (word.allBlank && word.letterCount > 0) {
      parts.push(t(`${KEY}mask_a11y_word_blank`, { n, count: word.letterCount }));
      return;
    }
    const cells = word.cells
      .map((c) => (c.kind === 'blank' ? t(`${KEY}mask_a11y_blank`) : c.ch))
      .join(', ');
    parts.push(t(`${KEY}mask_a11y_word`, { n, count: word.letterCount, cells }));
  });

  return parts.join(' ');
}
