/**
 * FilmSearchInput arama kapisi — bayat arama yanitlarini ayiklar (P-3 A3).
 *
 * Debounce zamanlayicisini temizlemek yetmez: 300 ms dolmus ve istek
 * yoldaysa, X / satir secimi sonrasi donen yanit listeyi bos input'un
 * ustunde yeniden acardi. Her iptal ve her yeni arama kapiyi ilerletir;
 * yanit yalniz kendi bileti hala gecerliyse uygulanir. Ayni mekanizma
 * sira disi donen eski yaniti da (yeni sorgunun sonuclarini ezmesin) ayiklar.
 *
 * React Native'den bagimsiz — `tests/games/filmSearchList.test.ts`.
 */

export interface SearchGate {
  /** Yeni arama baslatirken alinan bilet */
  ticket(): number;
  /** Bekleyen/yoldaki her aramayi bayatlatir */
  cancel(): void;
  /** Bilet hala gecerli mi (arada iptal ya da yeni arama olmadi mi) */
  isCurrent(ticket: number): boolean;
}

export function createSearchGate(): SearchGate {
  let seq = 0;
  return {
    ticket: () => seq,
    cancel: () => {
      seq += 1;
    },
    isCurrent: (ticket) => ticket === seq,
  };
}
