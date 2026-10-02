/**
 * FilmSearchInput — Oyunlardaki film tahmin autocomplete input'u.
 *
 * Kullanıcı yazar → TMDb arama → dropdown sonuçlar → seçim.
 * Dropdown INPUT'UN ÜSTÜNDE açılır (keyboard çakışmasını önlemek için).
 *
 * Dropdown yüksekliği sabit değil (B-1 / Fix 8): input'un üstünde, oyun
 * header'ının altında gerçekten kalan alana göre kısılır — hesap
 * `dropdownHeight.ts`. Ölçüm input yerleştiğinde, dropdown açıldığında ve
 * klavye açılıp kapandığında tazelenir.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { FilmSlate, MagnifyingGlass, XCircle } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useGameShellContentTop, useGameTheme } from '@/components/games/GameShell';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { searchFilms } from '@/services/gameService';
import { getPosterUrl } from '@/services/tmdb';
import type { FilmSearchResult } from '@/services/gameTypes';

import { DROPDOWN_MAX_H, dropdownMaxHeight } from './dropdownHeight';
import { createStyles } from './styles';

interface FilmSearchInputProps {
  /** Film seçildiğinde çağrılır */
  onSelect: (film: FilmSearchResult) => void;
  /** Input disabled mı */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

export function FilmSearchInput({
  onSelect,
  disabled = false,
  placeholder,
}: FilmSearchInputProps) {
  const theme = useGameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FilmSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insets = useSafeAreaInsets();
  /**
   * Üst sınır = oyun içerik alanının üstü (header'ın altı). GameShell dışında
   * veya ilk ölçümden önce `null` gelir; o zaman durum çubuğunun altı
   * kullanılır — dropdown yine ekranda kalır, yalnız header'ı örtebilir.
   */
  const shellContentTop = useGameShellContentTop();
  const boundaryTopY = shellContentTop ?? insets.top;

  const containerRef = useRef<View>(null);
  /** Input'un pencere Y'si — `null` iken eski sabit üst sınır geçerli */
  const [inputTopY, setInputTopY] = useState<number | null>(null);

  const measureInput = useCallback(() => {
    containerRef.current?.measureInWindow((_x, y) => setInputTopY(y));
  }, []);

  // Klavye KeyboardAvoidingView üzerinden input'u taşır; input'un kendi
  // onLayout'u bunu görmez (ebeveynine göre yeri değişmiyor). Klavye
  // olaylarından sonra yeniden ölçülür.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', measureInput);
    const hide = Keyboard.addListener('keyboardDidHide', measureInput);
    return () => {
      show.remove();
      hide.remove();
    };
  }, [measureInput]);

  useEffect(() => {
    if (showDropdown) measureInput();
  }, [showDropdown, measureInput]);

  const dropdownHeight =
    inputTopY === null ? DROPDOWN_MAX_H : dropdownMaxHeight({ inputTopY, boundaryTopY });

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const films = await searchFilms(text);
        setResults(films);
        setShowDropdown(films.length > 0);
      } catch (err) {
        // Savunmacı: servis bugün hatayı kendisi raporlayıp [] döner. Bu dal
        // ancak servis sözleşmesi değişirse çalışır. Kullanıcıya hata metni
        // gösterilmez (K-43) — dropdown boş kalır, iz Sentry'de.
        logger.error('[FilmSearchInput] Film araması başarısız', err, {
          code: 'FILM_SEARCH_INPUT_FAILED',
        });
        setResults([]);
        setShowDropdown(false);
      }
    }, 300);
  }, []);

  const handleSelect = useCallback(
    (film: FilmSearchResult) => {
      hapticLight();
      Keyboard.dismiss();
      setQuery('');
      setShowDropdown(false);
      setResults([]);
      onSelect(film);
    },
    [onSelect],
  );

  return (
    <View ref={containerRef} style={styles.container} onLayout={measureInput}>
      {/* Dropdown — INPUT'UN ÜSTÜNDE açılır, yüksekliği kalan alana göre */}
      {showDropdown && (
        <View style={[styles.dropdown, { maxHeight: dropdownHeight }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={false}
          >
            {results.slice(0, 6).map((item) => {
              const poster = getPosterUrl(item.posterPath, 'w92');
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.resultRow}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPress={() => handleSelect(item)}
                >
                  {poster ? (
                    <Image
                      source={{ uri: poster }}
                      style={styles.resultPoster}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.resultPoster, styles.noPoster]}>
                      <FilmSlate size={16} color={Colors.textTertiary} weight="duotone" />
                    </View>
                  )}
                  <View style={styles.resultInfo}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.resultYear}>{item.year}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Input */}
      <View style={styles.inputRow}>
        <MagnifyingGlass size={20} color={Colors.textTertiary} weight="duotone" />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder ?? t('games.search_placeholder')}
          placeholderTextColor={Colors.textTertiary}
          editable={!disabled}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
          // Sabit 52px satır — tavansız AX boyutunda metin kırpılıyordu
          maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}
        />
        {query.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              setQuery('');
              setResults([]);
              setShowDropdown(false);
            }}
          >
            <XCircle size={20} color={Colors.textTertiary} weight="duotone" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
