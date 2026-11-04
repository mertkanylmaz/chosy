/**
 * WatchOptionsCard — Mood sonucunun TEK "nerede izlenir" girişi (Faz 2-10a).
 *
 * Sarı CTA + "WHERE TO WATCH" bölümü + "See all" karosunun yerini alır; yalnız `ResultStage` kullanır.
 * `WatchProvidersRow` DEĞİŞMEDİ (şampiyon, MoodDeckSummary, film detayı onu kullanır).
 *
 *  loading → aynı yükseklikte iskelet (dokunulmaz)
 *  ok      → başlık, chevron, ≤3 logo, tek satır "Ülke · Özet", atıf (sola)
 *  error   → "yüklenemedi" kartı; dokununca sheet açılır (tekrar dene sheet'te). "Yayında değil" ASLA denmez.
 *
 * Kartın TAMAMI tek `Pressable`; içinde iç içe dokunulabilir öğe YOK. Ülke değişimi sheet'in içinde.
 * Atıf (JustWatch / TMDB) lisans şartıdır, kartta KALIR. Hiçbir satır dışarı açmaz.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { Image } from 'expo-image';
import { CaretRight } from 'phosphor-react-native';

import { color, radius, size, space, type } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { watchRegionName } from '@/constants/watchRegions';
import type { TmdbWatchProviders } from '@/services/tmdb';
import { brandOf } from '@/utils/watchProviderBrands';
import { watchOptionCount, watchOptionGroups, watchOptionLogos } from '@/utils/watchOptionsSummary';
import type { SheetGroupKey } from '@/utils/watchProviderList';

import { styles as rowStyles } from './styles';

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';
const LOGO = 40;
const SUMMARY_SEPARATOR = ' · ';

export type WatchOptionsCardState = 'loading' | 'ok' | 'error';

/** Atıf satırı: kart ve sheet AYNI öğeyi kullanır (marka adı çevrilmez). */
export function WatchOptionsAttribution({ style }: { style?: StyleProp<TextStyle> } = {}): React.JSX.Element {
  const { t } = useLanguage();
  return (
    <Text style={[rowStyles.attribution, style]}>
      {t('gauntlet.watchProviders.attribution')}
      {' · '}
      <Text style={rowStyles.justWatchText}>JustWatch</Text>
    </Text>
  );
}

interface WatchOptionsCardProps {
  state: WatchOptionsCardState;
  providers: TmdbWatchProviders | null;
  onPress: () => void;
}

export function WatchOptionsCard({ state, providers, onPress }: WatchOptionsCardProps): React.JSX.Element {
  const { t, region, language } = useLanguage();
  const regionName = region !== null ? watchRegionName(region, language) : '';

  if (state === 'loading') {
    // Aynı iskelet yükseklikleri: veri gelince yerleşim kaymaz.
    return (
      <View
        style={[cardStyles.card, cardStyles.skeleton]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={cardStyles.skelTitle} />
        <View style={cardStyles.logoRow} />
        <View style={cardStyles.skelLine} />
        <View style={cardStyles.skelLine} />
      </View>
    );
  }

  if (state === 'error' || providers === null) {
    return (
      <Pressable
        style={({ pressed }) => [cardStyles.card, pressed && cardStyles.pressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('gauntlet.watchProviders.watchOptions.errorTitle')}
      >
        <View style={cardStyles.titleRow}>
          <Text style={cardStyles.title} numberOfLines={2}>
            {t('gauntlet.watchProviders.watchOptions.errorTitle')}
          </Text>
          <CaretRight size={size.iconInline} color={color.text.secondary} weight="bold" />
        </View>
      </Pressable>
    );
  }

  const logos = watchOptionLogos(providers);
  const groupLabel = (key: SheetGroupKey): string =>
    key === 'rentBuy' ? t('moodGauntlet.offerHint.rent') : t(`gauntlet.watchProviders.group.${key}`);
  const categories = watchOptionGroups(providers).map(groupLabel).join(SUMMARY_SEPARATOR);
  // Ülke satırın başında: 2 satıra sığmayan uzun metinde kesilen kuyruk (kategori) olur, ülke değil.
  const summary = [regionName, categories].filter((part) => part !== '').join(SUMMARY_SEPARATOR);

  return (
    <Pressable
      style={({ pressed }) => [cardStyles.card, pressed && cardStyles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('gauntlet.watchProviders.watchOptions.a11y', {
        region: regionName,
        count: watchOptionCount(providers),
      })}
    >
      <View style={cardStyles.titleRow}>
        <Text style={cardStyles.title} numberOfLines={1}>
          {t('gauntlet.watchProviders.watchOptions.title')}
        </Text>
        <CaretRight size={size.iconInline} color={color.text.secondary} weight="bold" />
      </View>
      <View style={cardStyles.logoRow}>
        {logos.map((provider) => (
          <Image
            key={provider.provider_id}
            source={{ uri: `${TMDB_LOGO_BASE}${provider.logo_path}` }}
            style={cardStyles.logo}
            contentFit="cover"
            cachePolicy="memory-disk"
            accessibilityElementsHidden
            importantForAccessibility="no"
            accessibilityLabel={brandOf(provider).name}
          />
        ))}
      </View>
      {summary !== '' && (
        <Text style={cardStyles.summary} numberOfLines={2}>
          {summary}
        </Text>
      )}
      <WatchOptionsAttribution style={cardStyles.attributionLeft} />
    </Pressable>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    gap: space.xs,
    padding: space.base,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    backgroundColor: color.surface.raised,
  },
  pressed: { opacity: 0.7 },
  skeleton: { opacity: 0.6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  title: { ...type.body, fontWeight: '600', color: color.text.primary, flexShrink: 1 },
  logoRow: { flexDirection: 'row', gap: space.sm, minHeight: LOGO, alignItems: 'center' },
  logo: { width: LOGO, height: LOGO, borderRadius: radius.poster, backgroundColor: color.surface.base },
  summary: { ...type.caption, color: color.text.primary },
  attributionLeft: { textAlign: 'left' },
  skelTitle: { height: type.body.lineHeight, borderRadius: radius.poster, backgroundColor: color.surface.border },
  skelLine: { height: type.caption.lineHeight, borderRadius: radius.poster, backgroundColor: color.surface.border },
});
