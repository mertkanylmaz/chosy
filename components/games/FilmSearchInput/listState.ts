/**
 * FilmSearchInput sonuc listesi acik/kapali durumu — saf hesap.
 *
 * P-3 A1: `listControls` acikken (Spotlight) liste input odaktan cikinca
 * kapanir. TUZAK: klavye acikken bir satira dokunmak input'u satirin
 * `onPress`'inden ONCE blur ederse liste sokulur ve dokunus yutulur — tahmin
 * hic gitmez. Iki katman:
 *   1. Liste ScrollView'i `keyboardShouldPersistTaps="handled"`: satira
 *      dokunus klavyeyi kapatmaz, blur `onPress`'ten sonra (handleSelect'in
 *      `Keyboard.dismiss`'i ile) gelir.
 *   2. Bu reducer: satir basiliyken (`rowPressIn` → `select`) gelen blur
 *      listeyi KAPATMAZ; kapatmayi `select` yapar.
 *
 * `listControls` kapaliyken (donmus 5 oyun) davranis P-3 oncesiyle ayni:
 * blur listeyi etkilemez, sonuc gelince liste odaktan bagimsiz acilir.
 *
 * React Native'den bagimsiz — `tests/games/filmSearchList.test.ts`.
 */

export interface SearchListState {
  /** Sonuc listesi cizili mi */
  open: boolean;
  /** Input odakta mi */
  focused: boolean;
  /** Bir satir basili (onPressIn gelmis, onPress/iptal henuz gelmemis) */
  rowPressActive: boolean;
}

export const INITIAL_SEARCH_LIST: SearchListState = {
  open: false,
  focused: false,
  rowPressActive: false,
};

export type SearchListEvent =
  | { type: 'focus' }
  | { type: 'blur' }
  /** Debounce'lu arama dondu */
  | { type: 'results'; count: number }
  | { type: 'rowPressIn' }
  /** Basis bitti ya da kaydirmayla iptal oldu — listeyi KAPATMAZ */
  | { type: 'rowPressOut' }
  /** Satir secildi — tahmin gonderilir */
  | { type: 'select' }
  /** X, Kapat satiri, 2 karakter alti, arama hatasi */
  | { type: 'dismiss' };

export function reduceSearchList(
  state: SearchListState,
  event: SearchListEvent,
  listControls: boolean,
): SearchListState {
  switch (event.type) {
    case 'focus':
      return { ...state, focused: true };
    case 'blur':
      return {
        ...state,
        focused: false,
        open: listControls && !state.rowPressActive ? false : state.open,
      };
    case 'results':
      return {
        ...state,
        // listControls: odak yokken donen gec sonuc listeyi yeniden acmaz
        open: event.count > 0 && (!listControls || state.focused),
      };
    case 'rowPressIn':
      return { ...state, rowPressActive: true };
    case 'rowPressOut':
      return { ...state, rowPressActive: false };
    case 'select':
    case 'dismiss':
      return { ...state, open: false, rowPressActive: false };
  }
}
