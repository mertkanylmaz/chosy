/**
 * ChampionWatchOptions — Home / Daily Pick'in TEK izleme girişi (Home-A1).
 *
 * Sarı "Where to watch ↗" CTA'nın ve `WatchProvidersRow` bloğunun (etiket, ülke satırı,
 * logo satırı, "See all") yerini alır. Pro Result'taki onaylı `WatchOptionsCard` ve
 * `ProvidersSheet` OLDUĞU GİBİ kullanılır; bu dosya yalnız durum → görünüm eşlemesini yapar.
 *
 *  loading     → kart iskeleti (düzen zıplamaz)
 *  watch       → kart (ok ya da error); dokunuş mevcut `ProvidersSheet`'i açar. Sheet açılışı
 *                `where_to_watch_opened{surface:'champion'}` atar — Home'un birincil niyet olayı.
 *  unavailable → "Not streaming in X · Change" (bölgede sağlayıcı yok)
 *  hidden      → noRegion satırı + Change (ülke seçici olmadan bölge seçilemez)
 *
 * Mod kararı `resultCtaMode` (Result ile aynı saf fonksiyon). Hiçbir yol dışarı açmaz;
 * film detayına erişim ChampionReveal'da poster dokunuşu ve başlık `activate` ile durur.
 */
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { watchRegionName } from '@/constants/watchRegions';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TmdbWatchProviders } from '@/services/tmdb';
import { hapticLight } from '@/utils/haptics';
import type { ResultCtaMode } from '@/utils/moodResultCta';

import { ProvidersSheet } from '../WatchProviders/ProvidersSheet';
import { RegionPickerSheet } from '../WatchProviders/RegionPickerSheet';
import { WatchOptionsAttribution, WatchOptionsCard, type WatchOptionsCardState } from '../WatchProviders/WatchOptionsCard';
import { regionStyles } from '../WatchProviders/styles';
import type { WatchProvidersState } from '../WatchProviders/useWatchProviders';

interface ChampionWatchOptionsProps {
  mode: ResultCtaMode;
  state: WatchProvidersState;
  providers: TmdbWatchProviders | null;
  onRetry: () => void;
  filmId: string;
}

export function ChampionWatchOptions({
  mode,
  state,
  providers,
  onRetry,
  filmId,
}: ChampionWatchOptionsProps): React.JSX.Element {
  const { t, region, language } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const countryName = region !== null ? watchRegionName(region, language) : '';

  const openSheet = useCallback(() => {
    void hapticLight();
    setSheetOpen(true);
  }, []);

  if (mode === 'loading' || mode === 'watch') {
    return (
      <View style={styles.block}>
        <WatchOptionsCard
          state={state === 'loading' ? 'loading' : (state as WatchOptionsCardState)}
          providers={providers}
          onPress={openSheet}
        />
        {/* TEK ProvidersSheet örneği; ülke seçici sheet'in İÇİNDE. */}
        <ProvidersSheet
          visible={sheetOpen}
          onClose={() => setSheetOpen(false)}
          state={state}
          providers={providers}
          onRetry={onRetry}
          filmId={filmId}
          surface="champion"
          attribution={<WatchOptionsAttribution />}
        />
      </View>
    );
  }

  const message =
    mode === 'unavailable'
      ? t('moodGauntlet.notStreaming', { country: countryName })
      : t('gauntlet.watchProviders.noRegion');

  return (
    <View style={styles.block}>
      <View style={regionStyles.noteRow}>
        <Text style={[regionStyles.noteText, styles.note]}>
          {message}
          {' · '}
        </Text>
        <TouchableOpacity
          style={regionStyles.changeBtn}
          onPress={() => {
            void hapticLight();
            setRegionOpen(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('gauntlet.watchProviders.changeA11y')}
        >
          <Text style={regionStyles.changeText}>{t('gauntlet.watchProviders.change')}</Text>
        </TouchableOpacity>
      </View>
      <RegionPickerSheet visible={regionOpen} onClose={() => setRegionOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { alignSelf: 'stretch' },
  note: { textAlign: 'center' },
});
