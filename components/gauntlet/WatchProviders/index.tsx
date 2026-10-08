/**
 * WatchProvidersRow — "Nerede izlenir" (C.9b-UI C2, K-09).
 *
 * TestFlight 2.1.0 (26 Eyl 2026): önceki sheet + dokunulabilir logolar
 * kaldırıldı. Logolar TMDB'nin toplu "nerede izlenir" sayfasını açıyordu
 * (her logoda AYNI adres) — kullanıcı sağlayıcının kendi sayfasına gideceğini
 * sanıyordu. Artık satır içi, DOKUNULMAZ bir logo satırı + atıf; film detay
 * ekranının (`app/film/[id].tsx` WATCH ON bölümü) deseni.
 *
 * Durum yönetimi `useWatchProviders`'ta (dört durum); bu dosya yalnız ÇİZER.
 * `loading` satırın YERİNİ tutar — veri gelince düzen zıplamaz.
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
 * Okunamazsa `noRegion` durumu çizilir; başka bölgeye düşülmez (V-2 Tur D).
 *
 * ── Tekilleştirme ───────────────────────────────────────────────────────────
 * Kanal varyantları ("MGM+ Amazon Channel") `utils/watchProviderList`'te
 * elenir (V-2 Tur D) — film detay ekranıyla ortak saf kural.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';
import { ArrowRight } from 'phosphor-react-native';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { color, size } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import type { TmdbWatchProviders } from '@/services/tmdb';
import { hapticLight } from '@/utils/haptics';
import { groupProviders, orderProviders } from '@/utils/watchProviderList';

import { ProvidersSheet } from './ProvidersSheet';
import type { WatchProvidersState } from './useWatchProviders';
import { styles } from './styles';

/**
 * V-3 Tur G2 (V3-D5): satırda en fazla 3 logo; fazlası "See all" sheet'inde.
 * F2.3: logolar 52pt, "See all" satırın sonunda dördüncü öğe.
 * Sıralama `selectTopProviders` kuralı (flatrate > free > ads > rent > buy).
 */
const MAX_PROVIDERS = 3;

/** 60pt logo 3x'te 180px ister — w92 bulanık kalır (TMDB logo boyutları: w45…w500). */
const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w185';

interface WatchProvidersRowProps {
  state: WatchProvidersState;
  providers: TmdbWatchProviders | null;
  onRetry: () => void;
  /** `providers_see_all_opened` event'i için. */
  filmId: string;
}

export function WatchProvidersRow({
  state,
  providers,
  onRetry,
  filmId,
}: WatchProvidersRowProps): React.JSX.Element {
  const { t, region } = useLanguage();
  const [sheetOpen, setSheetOpen] = useState(false);

  // V-3 Tur G2: free/ads artık sayılır — yalnız free/ads olan film logo
  // gösterir (kurucu kararı), boş durum yalnız HİÇ sağlayıcı yokken.
  const ordered = useMemo(
    () => (state === 'ok' && providers ? orderProviders(providers) : []),
    [state, providers],
  );
  const list = ordered.slice(0, MAX_PROVIDERS);
  const groups = useMemo(
    () => (providers ? groupProviders(providers) : { stream: [], rent: [], buy: [] }),
    [providers],
  );

  const openSheet = useCallback(() => {
    void hapticLight();
    setSheetOpen(true);
    posthogAnalytics.track('providers_see_all_opened', {
      film_id: filmId,
      region,
      provider_count: ordered.length,
    });
  }, [filmId, region, ordered.length]);

  /*
    Atıf: sağlayıcı verisi TMDB'ye JustWatch'tan gelir ve TMDB kullanım
    şartları kaynağın adının gösterilmesini ister. Marka adı ÇEVRİLMEZ —
    `app/film/[id].tsx`'teki desenin aynısı (düz, sönük "JustWatch").
    "Bölgende yok" da JustWatch verisine dayanan bir iddia — boşta da durur.
  */
  const attribution = (
    <Text style={styles.attribution}>
      {t('gauntlet.watchProviders.attribution')}
      {' · '}
      <Text style={styles.justWatchText}>JustWatch</Text>
    </Text>
  );

  const renderBody = (): React.JSX.Element => {
    // Satırın yeri tutulur — pop-in yok (C2e).
    if (state === 'loading') return <View style={styles.row} />;

    // Bölge okunamadı — istek atılmadı, JustWatch'tan veri yok, atıf yok.
    if (state === 'noRegion') {
      return <Text style={styles.stateLine}>{t('gauntlet.watchProviders.noRegion')}</Text>;
    }

    if (state === 'error') {
      return (
        <>
          <Text style={styles.stateLine}>{t('gauntlet.watchProviders.error')}</Text>
          <QuietAction label={t('gauntlet.retry')} onPress={onRetry} />
        </>
      );
    }

    // `ok` ama hiçbir kovada sağlayıcı yok → boşla aynı: çizilecek logo
    // yok, dürüst tek satır. (V-3 Tur G2'ye kadar yalnız free/ads olan
    // film de buraya düşüyordu; artık logo gösterir.)
    if (list.length === 0) {
      return (
        <>
          <Text style={styles.stateLine}>{t('gauntlet.watchProviders.empty')}</Text>
          {attribution}
        </>
      );
    }

    return (
      <>
        {/* F2.3: "See all" logoların SONUNA, aynı yükseklikte dördüncü öğe.
            En fazla 3 logo + See all; ≤ 3 sağlayıcıda See all yok. */}
        <View style={styles.row}>
          {list.map((provider) => (
            <Image
              key={provider.provider_id}
              source={{ uri: `${TMDB_LOGO_BASE}${provider.logo_path}` }}
              style={styles.logo}
              contentFit="cover"
              cachePolicy="memory-disk"
              accessibilityLabel={provider.provider_name}
            />
          ))}
          {ordered.length > MAX_PROVIDERS && (
            <TouchableOpacity
              style={styles.seeAllTile}
              onPress={openSheet}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('gauntlet.watchProviders.seeAllA11y', {
                count: ordered.length,
              })}
            >
              <ArrowRight size={size.iconInline} color={color.text.primary} />
              <Text style={styles.seeAllText} numberOfLines={1}>
                {t('gauntlet.watchProviders.seeAll')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        {attribution}
        <ProvidersSheet
          visible={sheetOpen}
          groups={groups}
          onClose={() => setSheetOpen(false)}
          attribution={attribution}
        />
      </>
    );
  };

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{t('gauntlet.watchProviders.label')}</Text>
      {renderBody()}
    </View>
  );
}
