/**
 * PROTOTİP erişim kapısı (proto/cinematic-loading).
 *
 * Prototip rotası ve Profil giriş satırı yalnız dev build'de ya da `preview` kanalındaki
 * build'de erişilebilir; `production` kanalında kapalıdır. Karar: `protoAccessDecision.ts`.
 * Lazy getter — kanal her çağrıda okunur (kural 5: modül seviyesi sabit yok).
 */
import * as Updates from 'expo-updates';

import { isProtoAccessible } from '@/utils/protoAccessDecision';

export function canAccessProto(): boolean {
  return isProtoAccessible(__DEV__, Updates.channel);
}
