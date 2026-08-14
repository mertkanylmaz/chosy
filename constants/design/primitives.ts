/**
 * Ham renk değerleri — "Karanlık Salon" paleti.
 * Kaynak: docs/os/3_CHOSY_DESIGN_OS.md §2.1, §12.2
 *
 * Hiçbir bileşen bu dosyadan doğrudan import etmez — semantic.ts üzerinden okunur.
 */

export const palette = {
  ink: '#08090B',
  charcoal: '#14161A',
  graphite: '#22252B',
  smoke: '#8A8F98',
  bone: '#ECEAE4',
  beam: '#FFF3D6',
  marquee: '#D4A72C',
} as const;

export type PaletteKey = keyof typeof palette;
