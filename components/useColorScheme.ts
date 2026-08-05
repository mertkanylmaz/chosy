import { useColorScheme as useColorSchemeCore } from 'react-native';

/**
 * Cihaz renk semasi — `null`/`undefined` gelirse aciga duser.
 *
 * Eski surum `=== 'unspecified'` karsilastirmasi yapiyordu; `ColorSchemeName`
 * tipi `'light' | 'dark' | null | undefined` oldugu icin bu kosul hicbir zaman
 * dogru olmuyordu (TS2367) ve sema `null` geldiginde `null` donuyordu.
 * `Themed.tsx` bu degeri `Colors[theme]` seklinde index olarak kullandigi icin
 * o durumda calisma zamaninda cokerdi.
 */
export const useColorScheme = (): 'light' | 'dark' => {
  const coreScheme = useColorSchemeCore();
  return coreScheme ?? 'light';
};
