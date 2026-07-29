/**
 * FilmSearchInput — Oyunlardaki film tahmin autocomplete input'u.
 *
 * Kullanıcı yazar → TMDb arama → dropdown sonuçlar → seçim.
 * Dropdown INPUT'UN ÜSTÜNDE açılır (keyboard çakışmasını önlemek için).
 */
import React, { useCallback, useRef, useState } from 'react';
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { FilmSlate, MagnifyingGlass, XCircle } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import { searchFilms } from '@/services/gameService';
import { getPosterUrl } from '@/services/tmdb';
import type { FilmSearchResult } from '@/services/gameTypes';

import { styles } from './styles';

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
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FilmSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 2) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const films = await searchFilms(text);
      setResults(films);
      setShowDropdown(films.length > 0);
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
    <View style={styles.container}>
      {/* Dropdown — INPUT'UN ÜSTÜNDE açılır */}
      {showDropdown && (
        <View style={styles.dropdown}>
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
