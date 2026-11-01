/**
 * App Store storefront ülkesi (Faz 2-4) — `watchRegion` önceliğinin 2. basamağı.
 *
 * RevenueCat `Purchases.getStorefront()` iOS'ta hesabın mağaza ülkesini verir (alpha-3
 * "TUR" gelebilir; alpha-2'ye çevirme `utils/watchRegion.normalizeCountryCode`'da).
 * `configure` bitmeden çağrılamaz → `whenRcReady` beklenir. Zaman aşımı kaynağında
 * Sentry'ye yazılır (RC_READY_TIMEOUT); burada yeniden loglanmaz.
 *
 * Başarısızlık `null` döner — çağıran cihaz bölgesine düşer (bu zincir kurucu kararı).
 * Beklenmeyen hata sessiz değil: Sentry'ye gider.
 */
import * as Sentry from '@sentry/react-native';
import Purchases from 'react-native-purchases';

import { whenRcReady } from '@/services/purchaseService';
import { RcReadinessError } from '@/utils/rcReadiness';

export async function readStorefrontCountry(): Promise<string | null> {
  try {
    await whenRcReady(undefined, 'storefrontRegion');
    const storefront = await Purchases.getStorefront();
    return storefront?.countryCode ?? null;
  } catch (err) {
    if (err instanceof RcReadinessError) return null;
    Sentry.captureException(err, { tags: { component: 'storefrontRegion', flow: 'get_storefront' } });
    return null;
  }
}
