/**
 * ProvidersSheet — uygulama içi native "Where to watch" sunumu (Faz 2-8).
 *
 * Seçili ülke için Stream / Free / Rent or buy grupları (sıra: `SHEET_GROUP_ORDER`). Şampiyon, Spotlight (film detayı üzerinden),
 * Mood sonucu ve film detayı AYNI bileşeni kullanır (`WatchProvidersRow` sahibidir).
 *
 * Satır davranışı (Faz 2-8 kilitli kararlar):
 *  - TMDB `watch/providers` film-özel URL vermez; JustWatch / TMDB / sağlayıcı arama sayfaları
 *    birincil eylemin hedefi OLAMAZ.
 *  - Satır yalnız `constants/watchAppOpen` allowlist'indeyse dışarı açılır ve etiket SERVİSİ vaat
 *    eder ("Open Netflix"; URL = ana sayfa). Allowlist boş başlar → bugün hiçbir satır dokunulmaz.
 *  - Aksi halde satır yalnız bilgidir: logo, ad, (reklamlıysa) "with ads". Buton / chevron YOK.
 *  - Üç durum ayrı: mevcut (gruplar) · mevcut değil (`empty`: "Not streaming in X") · bilinmiyor
 *    (`error`: yüklenemedi + tekrar dene; "yayında değil" ASLA denmez; hata kaynağında Sentry'ye gider).
 * JustWatch atfı burada da görünür — lisans şartı, kaldırılamaz.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { appOpenFor } from '@/constants/watchAppOpen';
import { watchRegionName } from '@/constants/watchRegions';
import { space } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TmdbProvider, TmdbWatchProviders } from '@/services/tmdb';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import {
  providerClickedEvent,
  whereToWatchOpenedEvent,
  type ProviderClickSurface,
  type WatchOfferType,
} from '@/utils/moodGauntletAnalytics';
import { providerReturn } from '@/utils/providerReturn';
import { brandOf } from '@/utils/watchProviderBrands';
import {
  SHEET_GROUP_ORDER,
  adsOnlyIds,
  groupProvidersForSheet,
  type RentBuyKind,
  type SheetGroupKey,
} from '@/utils/watchProviderList';

import { RegionPickerSheet } from './RegionPickerSheet';
import { regionStyles, sheetStyles as styles } from './styles';
import { trackWatchEvent } from './trackWatchEvent';
import type { WatchProvidersState } from './useWatchProviders';

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

type GroupKey = SheetGroupKey;

interface ProvidersSheetProps {
  visible: boolean;
  onClose: () => void;
  state: WatchProvidersState;
  providers: TmdbWatchProviders | null;
  onRetry: () => void;
  filmId: string;
  surface: ProviderClickSurface;
  /** Satır içi bloktaki atıf öğesinin aynısı — tek tanım. */
  attribution: React.JSX.Element;
}

function offerOf(group: GroupKey, ads: boolean, rentBuy: RentBuyKind | undefined): WatchOfferType {
  if (group === 'stream') return 'flatrate';
  if (group === 'free') return ads ? 'ads' : 'free';
  return rentBuy === 'buy' ? 'buy' : 'rent';
}

export function ProvidersSheet({
  visible,
  onClose,
  state,
  providers,
  onRetry,
  filmId,
  surface,
  attribution,
}: ProvidersSheetProps): React.JSX.Element {
  const { t, language, region } = useLanguage();
  const insets = useSafeAreaInsets();
  const [regionOpen, setRegionOpen] = useState(false);
  const [openFailed, setOpenFailed] = useState(false);

  const groups = useMemo(() => {
    if (state !== 'ok' || providers === null) return null;
    return groupProvidersForSheet(providers);
  }, [state, providers]);
  const adsIds = useMemo(() => (providers === null ? new Set<number>() : adsOnlyIds(providers)), [providers]);

  // Tek birincil dönüşüm olayı: sheet her görünür olduğunda bir kez (açılış anındaki veri durumuyla).
  useEffect(() => {
    if (!visible) return;
    setOpenFailed(false);
    trackWatchEvent(whereToWatchOpenedEvent({ filmId, surface, region, state }));
    // Yalnız açılışta: veri durumu sonradan değişince (tekrar dene) ikinci olay üretilmez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const openApp = async (provider: TmdbProvider, offer: WatchOfferType, homeUrl: string): Promise<void> => {
    void hapticLight();
    trackWatchEvent(
      providerClickedEvent({
        filmId,
        surface,
        providerId: provider.provider_id,
        offerType: offer,
        region,
        kind: 'app_open',
      }),
    );
    providerReturn.markOpened(Date.now());
    try {
      await Linking.openURL(homeUrl);
    } catch (err) {
      logger.error('[watchProviders] uygulama acilamadi', err, { code: 'WATCH_APP_OPEN_FAILED' });
      setOpenFailed(true);
    }
  };

  // "Rent or buy" mevcut anahtar (`moodGauntlet.offerHint.rent`); Stream/Free başlıkları group.* altında.
  const sectionTitle = (key: GroupKey): string =>
    key === 'rentBuy' ? t('moodGauntlet.offerHint.rent') : t(`gauntlet.watchProviders.group.${key}`);
  const rentBuyLabel = (kind: RentBuyKind): string =>
    kind === 'both'
      ? t('gauntlet.watchProviders.offerRentBuy')
      : t(`gauntlet.watchProviders.group.${kind}`);
  const hasAnyGroup = groups !== null && SHEET_GROUP_ORDER.some((k) => groups[k].length > 0);

  const renderStateBody = (): React.JSX.Element | null => {
    if (state === 'error') {
      return (
        <View style={styles.stateBlock}>
          <Text style={styles.stateText}>{t('gauntlet.watchProviders.error')}</Text>
          <QuietAction label={t('gauntlet.retry')} onPress={onRetry} />
        </View>
      );
    }
    if (state === 'noRegion') {
      return (
        <View style={styles.stateBlock}>
          <Text style={styles.stateText}>{t('gauntlet.watchProviders.noRegion')}</Text>
        </View>
      );
    }
    if (state === 'empty' || (state === 'ok' && !hasAnyGroup)) {
      return (
        <View style={styles.stateBlock}>
          <Text style={styles.stateText}>
            {t('moodGauntlet.notStreaming', { country: region !== null ? watchRegionName(region, language) : '' })}
          </Text>
        </View>
      );
    }
    return null;
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('gauntlet.close')}
        />

        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            {t('gauntlet.watchProviders.sheetTitle')}
          </Text>

          {region !== null && (
            <View style={regionStyles.noteRow}>
              <Text style={regionStyles.noteText}>
                {t('gauntlet.watchProviders.availabilityIn', { country: watchRegionName(region, language) })}
                {' · '}
              </Text>
              <TouchableOpacity
                style={regionStyles.changeBtn}
                onPress={() => setRegionOpen(true)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('gauntlet.watchProviders.changeA11y')}
              >
                <Text style={regionStyles.changeText}>{t('gauntlet.watchProviders.change')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {renderStateBody()}
            {groups !== null &&
              SHEET_GROUP_ORDER.map((key) => {
                const list = groups[key];
                // Boş grup çizilmez — başlığın altında hiçbir şey olmaması gürültü.
                if (list.length === 0) return null;
                return (
                  <View key={key} style={styles.group}>
                    <Text style={styles.groupTitle} accessibilityRole="header">
                      {sectionTitle(key).toLocaleUpperCase(language)}
                    </Text>
                    {list.map((provider) => {
                      const brand = brandOf(provider);
                      const ads = key === 'free' && adsIds.has(provider.provider_id);
                      const rentBuy = key === 'rentBuy' ? groups.rentBuyKind.get(provider.provider_id) : undefined;
                      const sub = ads ? t('gauntlet.watchProviders.withAds') : rentBuy !== undefined ? rentBuyLabel(rentBuy) : null;
                      const offer = offerOf(key, ads, rentBuy);
                      const app = appOpenFor(brand.key);
                      const body = (
                        <>
                          <Image
                            source={{ uri: `${TMDB_LOGO_BASE}${provider.logo_path}` }}
                            style={styles.providerLogo}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            accessibilityElementsHidden
                            importantForAccessibility="no"
                          />
                          <View style={styles.providerText}>
                            <Text style={styles.providerName} numberOfLines={1}>
                              {brand.name}
                            </Text>
                            {sub !== null && <Text style={styles.providerSub}>{sub}</Text>}
                          </View>
                          {app !== null && (
                            <Text style={styles.openApp} numberOfLines={1}>
                              {t('gauntlet.watchProviders.openApp', { provider: brand.name })}
                            </Text>
                          )}
                        </>
                      );
                      if (app === null) {
                        return (
                          <View
                            key={provider.provider_id}
                            style={styles.providerRow}
                            accessible
                            accessibilityLabel={sub !== null ? `${brand.name}, ${sub}` : brand.name}
                          >
                            {body}
                          </View>
                        );
                      }
                      return (
                        <TouchableOpacity
                          key={provider.provider_id}
                          style={styles.providerRow}
                          activeOpacity={0.7}
                          onPress={() => void openApp(provider, offer, app.homeUrl)}
                          accessibilityRole="button"
                          accessibilityLabel={t('gauntlet.watchProviders.openApp', { provider: brand.name })}
                        >
                          {body}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            {openFailed && <Text style={styles.stateText}>{t('errors.openLink')}</Text>}
            {attribution}
          </ScrollView>
        </View>

        <RegionPickerSheet visible={regionOpen} onClose={() => setRegionOpen(false)} />
      </View>
    </Modal>
  );
}
