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
import React from 'react';
import { Text, View } from 'react-native';

import { Image } from 'expo-image';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TmdbWatchProviders } from '@/services/tmdb';
import { flattenProviders } from '@/utils/watchProviderList';

import type { WatchProvidersState } from './useWatchProviders';
import { styles } from './styles';

/** Şampiyon ekranı bir liste ekranı değil — ilk N sağlayıcı yeter. */
const MAX_PROVIDERS = 6;

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

interface WatchProvidersRowProps {
  state: WatchProvidersState;
  providers: TmdbWatchProviders | null;
  onRetry: () => void;
}

export function WatchProvidersRow({
  state,
  providers,
  onRetry,
}: WatchProvidersRowProps): React.JSX.Element {
  const { t } = useLanguage();

  const list = state === 'ok' && providers ? flattenProviders(providers, MAX_PROVIDERS) : [];

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

    // `ok` ama flatrate/rent/buy boş (ör. yalnız `ads`/`free`) → boşla aynı:
    // çizilecek logo yok, dürüst tek satır.
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
        </View>
        {attribution}
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
