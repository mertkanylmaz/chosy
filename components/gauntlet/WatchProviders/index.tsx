/**
 * WatchProvidersSheet — "Nerede izlenir" (C.9b-UI C2, K-09).
 *
 * K-09: "Context edit = sheet · Film detay = sheet · Paywall = sheet ·
 * Gauntlet = full-screen." Bu bir sheet'tir; Champion'ın BİRİNCİL eylemi
 * (K-20 activation bridge) onu açar.
 *
 * Önceden satır içi bir bloktu ve sağlayıcı yoksa `return null` ile SESSİZCE
 * hiç görünmüyordu — cihaz görüntüsünde Champion'da "Nerede izlenir" diye bir
 * şey yoktu. Birincil eylem olunca bu kabul edilemez oldu: durum yönetimi
 * `useWatchProviders`'a taşındı (dört durum), bu dosya yalnız ÇİZER.
 *
 * `app/film/[id].tsx`'teki `ProviderIcon` YENİDEN KULLANILMADI — dışa
 * aktarılmıyor ve o ekranın eski `Colors` tokenlarına bağlı; buraya çekmek
 * Karanlık Salon paletiyle eskisini aynı ağaçta karıştırırdı. Kopyalanan şey
 * desen, kod değil.
 *
 * ── Kimlik ──────────────────────────────────────────────────────────────────
 * `getAppUserId()` YOK, INSERT YOK.
 *
 * ── Bölge ───────────────────────────────────────────────────────────────────
 * Cihazdan gelir (`useLanguage().region`, C2c) — sabit 'US' değil.
 */
import React, { useCallback } from 'react';
import { Linking, Modal, Text, TouchableOpacity, View } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import type { TmdbProvider, TmdbWatchProviders } from '@/services/tmdb';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';

import { styles } from './styles';

/** Şampiyon ekranı bir liste ekranı değil — ilk N sağlayıcı yeter. */
const MAX_PROVIDERS = 6;

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

interface WatchProvidersSheetProps {
  visible: boolean;
  onClose: () => void;
  filmId: string;
  providers: TmdbWatchProviders | null;
  /** TMDB'nin toplu "nerede izlenir" sayfası. Yoksa dokunma hedefi kurulmaz. */
  link: string | null;
}

/** flatrate > rent > buy sırasıyla tekrarsız liste (film detay ekranıyla aynı öncelik). */
function flatten(providers: TmdbWatchProviders): TmdbProvider[] {
  const out: TmdbProvider[] = [];
  const seen = new Set<number>();
  for (const list of [providers.flatrate, providers.rent, providers.buy]) {
    for (const p of list ?? []) {
      if (seen.has(p.provider_id)) continue;
      seen.add(p.provider_id);
      out.push(p);
    }
  }
  return out.slice(0, MAX_PROVIDERS);
}

export function WatchProvidersSheet({
  visible,
  onClose,
  filmId,
  providers,
  link,
}: WatchProvidersSheetProps): React.JSX.Element {
  const { t } = useLanguage();

  const handlePress = useCallback(
    async (provider: TmdbProvider): Promise<void> => {
      if (!link) return;
      posthogAnalytics.track('provider_clicked', {
        film_id: filmId,
        provider_id: provider.provider_id,
        provider_name: provider.provider_name,
      });
      void hapticLight();
      try {
        await Linking.openURL(link);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { component: 'WatchProvidersSheet', flow: 'open_link' },
          extra: { film_id: filmId, link },
        });
        logger.error('[WatchProvidersSheet] bağlantı açılamadı:', err, {
          skipBridge: true,
          code: 'WATCH_PROVIDERS_LINK_OPEN_FAILED',
          sampleRate: 0.5,
        });
      }
    },
    [filmId, link],
  );

  const list = providers ? flatten(providers) : [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('gauntlet.close')}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.label}>{t('gauntlet.watchProviders.label')}</Text>

          <View style={styles.row}>
            {list.map((provider) => {
              const logo = (
                <Image
                  source={{ uri: `${TMDB_LOGO_BASE}${provider.logo_path}` }}
                  style={styles.logo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  accessibilityLabel={provider.provider_name}
                />
              );

              // `link` yoksa dokunma alanı HİÇ kurulmaz — basıldığında hiçbir
              // şey yapmayan bir buton göstermek yanlış bir vaat olurdu.
              if (!link) {
                return (
                  <View key={provider.provider_id} style={styles.item}>
                    {logo}
                  </View>
                );
              }

              return (
                <TouchableOpacity
                  key={provider.provider_id}
                  style={styles.item}
                  onPress={() => void handlePress(provider)}
                  accessibilityRole="link"
                  // ⚠️ "X'te aç" DEĞİL: `link` sağlayıcının kendi sayfası değil,
                  // TMDB'nin toplu "nerede izlenir" sayfasıdır (her logoda AYNI
                  // adres açılır). Etiket gideceği yeri anlatır.
                  accessibilityLabel={t('gauntlet.watchProviders.viewProviders', {
                    provider: provider.provider_name,
                  })}
                >
                  {logo}
                </TouchableOpacity>
              );
            })}
          </View>

          {/*
            Atıf: sağlayıcı verisi TMDB'ye JustWatch'tan gelir ve TMDB kullanım
            şartları kaynağın adının gösterilmesini ister. Marka adı ÇEVRİLMEZ —
            `app/film/[id].tsx:962`'deki desenin aynısı (düz, sönük "JustWatch").
          */}
          <Text style={styles.attribution}>
            {t('gauntlet.watchProviders.attribution')}
            {' · '}
            <Text style={styles.justWatchText}>JustWatch</Text>
          </Text>

          <View style={styles.closeRow}>
            <QuietAction label={t('gauntlet.close')} onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
