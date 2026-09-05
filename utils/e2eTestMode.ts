/**
 * E2E test modu tespiti — TEK doğruluk kaynağı.
 *
 * SADECE `preview-e2e` build profilinde `true` DÖNER (`eas.json` →
 * `EXPO_PUBLIC_APP_ENV=e2e-test`). PRODUCTION, PREVIEW, PREVIEW-STORE VE
 * DEVELOPMENT BUILD'LERİNDE BU DEĞER HİÇ SET EDİLMEZ — `isE2ETestMode()`
 * ORALARDA HER ZAMAN `false` DÖNER, MEVCUT DAVRANIŞ BİREBİR KORUNUR.
 *
 * ⚠️ Bu fonksiyonun DIŞINDA hiçbir yerde `process.env.EXPO_PUBLIC_APP_ENV`
 * OKUNMAZ (K-42 Maestro iOS override, DUR NOKTASI onaylı). Offline/gate
 * override'ları (`services/supabase.ts`, `services/networkStatus.ts`,
 * `GauntletShell`) yalnız bu fonksiyonu çağırır. Yeni bir kontrol noktası
 * gerekirse buraya eklenir, ayrı bir env okuma noktası AÇILMAZ.
 */
export function isE2ETestMode(): boolean {
  return process.env.EXPO_PUBLIC_APP_ENV === 'e2e-test';
}
