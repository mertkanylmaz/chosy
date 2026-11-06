/**
 * PROTOTİP erişim kararı (saf). Uygulama `utils/protoAccess.ts` → `canAccessProto()` kullanır;
 * bu dosya expo-updates'e bağlı değildir ki Deno testinde doğrudan doğrulanabilsin.
 *
 * Açık: dev build ya da tam olarak `preview` kanalı. `production`, null/embedded ve bilinmeyen
 * her kanal kapalı.
 */
export function isProtoAccessible(isDev: boolean, channel: string | null | undefined): boolean {
  return isDev || channel === 'preview';
}
