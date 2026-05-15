/**
 * FilmSearchInput — Oyunlardaki film tahmin autocomplete input'u.
 *
 * Kullanıcı yazar → TMDb arama → dropdown sonuçlar → seçim.
 */
import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import { searchFilms } from '@/services/gameService';
import { getPosterUrl } from '@/services/tmdb';
import type { FilmSearchResult } from '@/services/gameTypes';

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
      setQuery(film.title);
      setShowDropdown(false);
      setResults([]);
      onSelect(film);
    },
    [onSelect],
  );

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={20} color={Colors.textTertiary} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          placeholder={placeholder ?? t('games.pinpoint.search_placeholder')}
          placeholderTextColor={Colors.textTertiary}
          editable={!disabled}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setQuery('');
              setResults([]);
              setShowDropdown(false);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={results.slice(0, 6)}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const poster = getPosterUrl(item.posterPath, 'w92');
              return (
                <TouchableOpacity
                  style={styles.resultRow}
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
                      <Ionicons name="film" size={16} color={Colors.textTertiary} />
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
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: Theme.borderRadius.md,
    paddingHorizontal: Theme.spacing.md,
    height: 48,
    gap: Theme.spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textWhite,
  },
  dropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: Colors.bgElevated,
    borderRadius: Theme.borderRadius.md,
    maxHeight: 240,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Theme.spacing.md,
    paddingVertical: Theme.spacing.sm,
    gap: Theme.spacing.sm,
  },
  resultPoster: {
    width: 32,
    height: 48,
    borderRadius: 4,
  },
  noPoster: {
    backgroundColor: Colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  resultYear: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
