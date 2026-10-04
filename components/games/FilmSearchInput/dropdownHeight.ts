/**
 * FilmSearchInput dropdown yuksekligi — saf hesap.
 *
 * B-1 / Fix 8: dropdown input'un USTUNE acilir (`bottom: INPUT_H + GAP`) ve
 * eskiden sabit `maxHeight: 280` tasiyordu. Kucuk ekranda klavye + QuickType
 * acikken input'un ustunde 280px yoktu; dropdown oyun header'ini (geri
 * butonu dahil) ortuyordu.
 *
 * Artik yukseklik input'un ustunde GERCEKTEN kalan alandan hesaplanir:
 * `inputTopY` input'un pencere koordinatindaki ust kenari, `boundaryTopY` ise
 * oyun icerik alaninin ust kenari (GameShell header'inin alti). Klavye
 * yuksekligi hesaba `inputTopY` uzerinden girer: GameShell'in
 * KeyboardAvoidingView'i klavye acilinca input'u klavyenin ustune tasir ve
 * olcum klavye olaylarindan sonra tazelenir (bkz. FilmSearchInput).
 *
 * React Native'den bagimsiz — `tests/games/spotlightLayout.test.ts`.
 */

/** Dropdown'in ust siniri — eski sabit; bol alanda davranis degismez */
export const DROPDOWN_MAX_H = 280;
/** Input satirinin yuksekligi (`inputRow.height`) */
export const SEARCH_INPUT_H = 52;
/** Dropdown ile input arasi bosluk — eski `bottom: 56` = 52 + 4 */
export const DROPDOWN_GAP = 4;
/**
 * P-3 "Kapat" satiri (`listControls`) — dropdown'in ALTINDA, maxHeight'in
 * icinde. HIG asgari dokunma hedefi; sonuc satirlarina kalan alan bu kadar azalir.
 */
export const SEARCH_CLOSE_ROW_H = 44;

export interface DropdownSpace {
  /** Input'un pencere koordinatinda ust kenari */
  inputTopY: number;
  /** Dropdown'in tasamayacagi ust sinir (pencere koordinati) */
  boundaryTopY: number;
}

/**
 * min(DROPDOWN_MAX_H, input ustunde kalan alan). Asla negatif donmez.
 */
export function dropdownMaxHeight({ inputTopY, boundaryTopY }: DropdownSpace): number {
  const available = Math.floor(inputTopY - DROPDOWN_GAP - boundaryTopY);
  return Math.max(0, Math.min(DROPDOWN_MAX_H, available));
}
