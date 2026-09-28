/**
 * ProvidersSheet — "See all" sağlayıcı listesi. V-3 Tur G2 (C5, V3-D5).
 *
 * Logo satırı en fazla 3 sağlayıcı gösterir; fazlası bu sheet'te, Stream /
 * Rent / Buy gruplarıyla. Repo sheet deseni (`ContextBar`, `AuthPromptSheet`):
 * RN `Modal` + backdrop, pencere seviyesinde — alt pay yalnız home indicator.
 *
 * Satırlar DOKUNULMAZ (TestFlight 2.1.0 kararı sürüyor: TMDB tek bir toplu
 * sayfa veriyor, sağlayıcı başına bağlantı yok). JustWatch atfı burada da
 * görünür — lisans şartı, kaldırılamaz.
 */
import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { TmdbProvider } from '@/services/tmdb';
import type { ProviderGroups } from '@/utils/watchProviderList';

import { sheetStyles as styles } from './styles';

const TMDB_LOGO_BASE = 'https://image.tmdb.org/t/p/w92';

interface ProvidersSheetProps {
  visible: boolean;
  groups: ProviderGroups<TmdbProvider>;
  onClose: () => void;
  /** Satır içi bloktaki atıf öğesinin aynısı — tek tanım. */
  attribution: React.JSX.Element;
}

export function ProvidersSheet({
  visible,
  groups,
  onClose,
  attribution,
}: ProvidersSheetProps): React.JSX.Element {
  const { t, language } = useLanguage();
  const insets = useSafeAreaInsets();

  const sections: { key: keyof ProviderGroups<TmdbProvider>; title: string }[] = [
    { key: 'stream', title: t('gauntlet.watchProviders.group.stream') },
    { key: 'rent', title: t('gauntlet.watchProviders.group.rent') },
    { key: 'buy', title: t('gauntlet.watchProviders.group.buy') },
  ];

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

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {sections.map(({ key, title }) => {
              const list = groups[key];
              // Boş grup çizilmez — başlığın altında hiçbir şey olmaması gürültü.
              if (list.length === 0) return null;
              return (
                <View key={key} style={styles.group}>
                  <Text style={styles.groupTitle} accessibilityRole="header">
                    {title.toLocaleUpperCase(language)}
                  </Text>
                  {list.map((provider) => (
                    <View key={provider.provider_id} style={styles.providerRow}>
                      <Image
                        source={{ uri: `${TMDB_LOGO_BASE}${provider.logo_path}` }}
                        style={styles.providerLogo}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                      />
                      <Text style={styles.providerName} numberOfLines={1}>
                        {provider.provider_name}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
            {attribution}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
