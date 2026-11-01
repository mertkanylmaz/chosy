/**
 * RegionPickerSheet — "Nerede izlenir" ülke seçici (Faz 2-4).
 *
 * TMDB watch provider bölgeleri (139), arama kutulu düz liste. Seçim `setWatchRegion` ile
 * kaydedilir (AsyncStorage) ve sağlayıcı verisi yeni bölgeyle yenilenir (`useWatchProviders`
 * bölge değişince yeniden yükler). Sheet deseni `ProvidersSheet` ile aynı.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, space } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticSelection } from '@/utils/haptics';
import { listWatchRegions, type WatchRegionOption } from '@/utils/watchRegion';

import { regionStyles as styles } from './styles';

interface RegionPickerSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function RegionPickerSheet({ visible, onClose }: RegionPickerSheetProps): React.JSX.Element {
  const { t, language, region, setWatchRegion } = useLanguage();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const options = useMemo(() => listWatchRegions(language, query), [language, query]);

  const close = useCallback(() => {
    setQuery('');
    onClose();
  }, [onClose]);

  const choose = useCallback(
    (code: string) => {
      hapticSelection();
      void setWatchRegion(code);
      close();
    },
    [setWatchRegion, close],
  );

  const renderItem = useCallback(
    ({ item }: { item: WatchRegionOption }) => {
      const selected = item.code === region;
      return (
        <TouchableOpacity
          style={styles.row}
          onPress={() => choose(item.code)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={selected ? `${item.name}, ${t('gauntlet.watchProviders.regionCurrent')}` : item.name}
          accessibilityState={{ selected }}
        >
          <Text style={[styles.rowName, selected && styles.rowNameSelected]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.rowCode}>{item.code}</Text>
        </TouchableOpacity>
      );
    },
    [choose, region, t],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('gauntlet.watchProviders.regionClose')}
        />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            {t('gauntlet.watchProviders.regionTitle')}
          </Text>
          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={t('gauntlet.watchProviders.regionSearch')}
            placeholderTextColor={color.text.secondary}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel={t('gauntlet.watchProviders.regionSearch')}
          />
          <FlatList
            data={options}
            keyExtractor={(o) => o.code}
            renderItem={renderItem}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={<Text style={styles.empty}>{t('gauntlet.watchProviders.regionNoMatch')}</Text>}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
