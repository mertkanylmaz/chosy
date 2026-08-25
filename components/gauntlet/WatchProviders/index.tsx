/**
 * WatchProviders — "Nerede izlenir" (C.9b-2, IA §2.3).
 *
 * Şampiyon ekranındaki tek bilgi bloğu. `app/film/[id].tsx`'teki `ProviderIcon`
 * YENİDEN KULLANILMADI çünkü o bileşen dışa aktarılmıyor ve o ekranın kendi
 * stil dosyasına (eski `Colors` tokenları) bağlı; buraya çekmek Karanlık Salon
 * tokenlarıyla eski paleti aynı ağaçta karıştırırdı. Veri yolu (`tmdb_id` →
 * `fetchMovieWatchProviders`) ise BİREBİR aynı — kopyalanan şey desen, kod değil.
 *
 * ── Kimlik ──────────────────────────────────────────────────────────────────
 * Burada `getAppUserId()` YOK, INSERT YOK. `films` tablosundan yalnızca
 * `tmdb_id` OKUNUR — gauntlet ekranlarının kimlik kuralı korunur.
 *
 * ── Bölge ───────────────────────────────────────────────────────────────────
 * `fetchMovieWatchProviders` varsayılanı ('US') KULLANILIR — `app/film/[id].tsx`
 * bugün de böyle çağırıyor. Bölgeyi cihaz diline bağlamak bir ÜRÜN kararıdır
 * (hangi ülkenin kataloğu gösterilecek) ve bu turda onaylanmadı; iki ekranın
 * aynı filmde farklı sağlayıcı göstermesi ondan daha kötü olurdu.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Text, TouchableOpacity, View } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';

import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import { supabase } from '@/services/supabase';
import {
  fetchMovieWatchProviders,
  type TmdbProvider,
  type TmdbWatchProviders,
} from '@/services/tmdb';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';

import { styles } from './styles';

/** Şampiyon ekranı bir liste ekranı değil — ilk N sağlayıcı yeter. */
const MAX_PROVIDERS = 6;

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

interface WatchProvidersProps {
  /** `films.id` (UUID) — `GauntletFilm.id` ile aynı değer. */
  filmId: string;
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

export function WatchProviders({ filmId }: WatchProvidersProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const [providers, setProviders] = useState<TmdbWatchProviders | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (): Promise<void> => {
      const { data, error } = await supabase
        .from('films')
        .select('tmdb_id')
        .eq('id', filmId)
        .maybeSingle();

      if (error) {
        // Sessizce yutulmaz: bu bizim tablomuz, okunamıyorsa gerçek bir arıza.
        Sentry.captureException(error, {
          tags: { component: 'WatchProviders', flow: 'tmdb_id_lookup' },
          extra: { film_id: filmId },
        });
        logger.error(
          '[WatchProviders] tmdb_id okunamadı:', error.message,
          {
            code: 'WATCH_PROVIDERS_TMDB_ID_FAILED',
            sampleRate: 0.5,
          },
        );
        return;
      }

      const tmdbId = (data as { tmdb_id: number | null } | null)?.tmdb_id;
      if (!tmdbId) {
        // Veri boşluğu, hata değil — blok hiç gösterilmez.
        logger.warn('[WatchProviders] filmde tmdb_id yok:', filmId);
        return;
      }

      const result = await fetchMovieWatchProviders(tmdbId);
      if (cancelled) return;

      if (!result) {
        // ⚠️ `fetchMovieWatchProviders` "bu bölgede sağlayıcı yok" ile "istek
        // başarısız" durumlarının İKİSİNE de null döner (services/tmdb.ts:247
        // catch). Ayırt edilemediği için kullanıcıya hata GÖSTERİLMEZ — var
        // olmayan bir arızayı bildirmek de sessiz yutmak kadar yanlış olurdu.
        // İz breadcrumb'ta kalır; kaynaktaki belirsizlik TEKNIK_BORC kalemi.
        Sentry.addBreadcrumb({
          category: 'gauntlet.providers',
          message: 'watch providers boş döndü',
          level: 'info',
          data: { film_id: filmId, tmdb_id: tmdbId },
        });
        return;
      }

      setProviders(result);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [filmId]);

  const link = providers?.link;

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
          tags: { component: 'WatchProviders', flow: 'open_link' },
          extra: { film_id: filmId, link },
        });
        logger.error(
          '[WatchProviders] bağlantı açılamadı:', err,
          {
            code: 'WATCH_PROVIDERS_LINK_OPEN_FAILED',
            sampleRate: 0.5,
          },
        );
      }
    },
    [filmId, link],
  );

  if (!providers) return null;

  const list = flatten(providers);
  if (list.length === 0) return null;

  return (
    <View style={styles.container}>
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

          // `link` yoksa dokunma alanı HİÇ kurulmaz — basıldığında hiçbir şey
          // yapmayan bir buton göstermek yanlış bir vaat olurdu.
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
              // TMDB'nin toplu "nerede izlenir" sayfasıdır (aşağıdaki `handlePress`
              // her logoda AYNI adresi açar). Etiket gideceği yeri anlatır.
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
    </View>
  );
}
