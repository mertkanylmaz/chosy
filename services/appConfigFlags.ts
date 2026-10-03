/**
 * app_config flag okumaları — tek satırlık, lazy getter'lar.
 *
 * Kural 6: her çağrıda `.from('app_config').select(...)`, modül seviyesinde
 * cache YOK (gameApi.ts → getEnabledGames() deseni).
 */

import * as Sentry from '@sentry/react-native';

import { supabase } from './supabase';
import { logger } from '@/utils/logger';

/**
 * Discover tab görünür mü (app_config: discover_tab_enabled).
 *
 * C.9a (bible K-02): Discover nav'dan kalktı, kod donduruldu — bu flag
 * yalnızca tab bar erişimini kontrol eder. Okuma başarısız olursa Sentry'ye
 * düşer ve fail-closed: false döner (tab gizli kalır, sessiz fallback değil —
 * hata görünür olur).
 */
export async function isDiscoverTabEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'discover_tab_enabled')
    .single();

  if (error) {
    Sentry.captureException(error, { tags: { config: 'discover_tab_enabled' } });
    logger.error(
      '[appConfigFlags] isDiscoverTabEnabled failed:', error,
      {
        skipBridge: true,
        code: 'APP_CONFIG_DISCOVER_TAB_FAILED',
        sampleRate: 0.2,
      },
    );
    return false;
  }

  return data?.value === true;
}

/**
 * Gauntlet bağlam çubuğu görünür mü (app_config: gauntlet_context_bar_enabled).
 *
 * K-18: bağlam düzeltmesi henüz bir tahmin modelini beslemiyor ("Faz 1: bağlam
 * tahmin modeli gelince"); etkisiz kontrol kullanıcıya gösterilmez. Varsayılan
 * GİZLİ: satır yoksa (`maybeSingle` → data null) veya değer `true` değilse
 * false. Gerçek okuma hatası Sentry'ye düşer ve fail-closed: false döner.
 */
export async function isGauntletContextBarEnabled(): Promise<boolean> {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'gauntlet_context_bar_enabled')
    .maybeSingle();

  if (error) {
    Sentry.captureException(error, { tags: { config: 'gauntlet_context_bar_enabled' } });
    logger.error(
      '[appConfigFlags] isGauntletContextBarEnabled failed:', error,
      {
        skipBridge: true,
        code: 'APP_CONFIG_CONTEXT_BAR_FAILED',
        sampleRate: 0.2,
      },
    );
    return false;
  }

  return data?.value === true;
}
