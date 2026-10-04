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
 *
 * `listControls` (P-3, Spotlight): liste odaktan çıkınca kapanır, altta
 * görünür "Kapat" satırı ve kaydırma göstergesi çizilir. Açık/kapalı durumu
 * `listState.ts` reducer'ında; blur'un satır dokunuşunu yutmaması orada.
 */
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { CaretDown, FilmSlate, MagnifyingGlass, XCircle } from 'phosphor-react-native';
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
import { INITIAL_SEARCH_LIST, reduceSearchList, type SearchListEvent } from './listState';
import { createSearchGate } from './searchGate';
import { createStyles } from './styles';

interface FilmSearchInputProps {
  /** Film seçildiğinde çağrılır */
  onSelect: (film: FilmSearchResult) => void;
  /** Input disabled mı */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /**
   * Yalnız katalog filmleri (TMDb fallback kapalı). Oyun çağıranları true
   * geçer: cevap her zaman katalogdadır, uuid'siz sonuç tahmin edilemez.
   */
  catalogOnly?: boolean;
  /**
   * P-3 liste kontrolleri: odaktan çıkınca kapanma, görünür "Kapat" satırı,
   * kaydırma göstergesi. Varsayılan kapalı — dondurulmuş oyunların çıktısı
   * değişmez; yalnız Spotlight açar.
   */
  listControls?: boolean;
}

export function FilmSearchInput({
  onSelect,
  disabled = false,
  placeholder,
  catalogOnly = false,
  listControls = false,
}: FilmSearchInputProps) {
  const theme = useGameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FilmSearchResult[]>([]);
  const [list, dispatchList] = useReducer(
    (state: typeof INITIAL_SEARCH_LIST, event: SearchListEvent) =>
      reduceSearchList(state, event, listControls),
    INITIAL_SEARCH_LIST,
  );
  const showDropdown = list.open;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Bayat yanıt kapısı (P-3 A3) — bkz. searchGate.ts */
  const gateRef = useRef(createSearchGate());

  /** Bekleyen 300 ms aramayı ve yoldaki isteği iptal eder */
  const cancelPendingSearch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    gateRef.current.cancel();
  }, []);

  // Unmount: zamanlayıcı ekran kapandıktan sonra istek atmasın
  useEffect(() => cancelPendingSearch, [cancelPendingSearch]);

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
    cancelPendingSearch();

    if (text.trim().length < 2) {
      setResults([]);
      dispatchList({ type: 'dismiss' });
      return;
    }

    const ticket = gateRef.current.ticket();
    debounceRef.current = setTimeout(async () => {
      try {
        const films = await searchFilms(text, catalogOnly);
        // Arada X / seçim / yeni harf geldiyse bu yanıt bayat — uygulanmaz
        if (!gateRef.current.isCurrent(ticket)) return;
        setResults(films);
        dispatchList({ type: 'results', count: films.length });
      } catch (err) {
        // Savunmacı: servis bugün hatayı kendisi raporlayıp [] döner. Bu dal
        // ancak servis sözleşmesi değişirse çalışır. Kullanıcıya hata metni
        // gösterilmez (K-43) — dropdown boş kalır, iz Sentry'de.
        logger.error('[FilmSearchInput] Film araması başarısız', err, {
          code: 'FILM_SEARCH_INPUT_FAILED',
        });
        if (!gateRef.current.isCurrent(ticket)) return;
        setResults([]);
        dispatchList({ type: 'dismiss' });
      }
    }, 300);
  }, [catalogOnly, cancelPendingSearch]);

  const handleSelect = useCallback(
    (film: FilmSearchResult) => {
      hapticLight();
      cancelPendingSearch();
      Keyboard.dismiss();
      setQuery('');
      dispatchList({ type: 'select' });
      setResults([]);
      onSelect(film);
    },
    [onSelect, cancelPendingSearch],
  );

  return (
    <View ref={containerRef} style={styles.container} onLayout={measureInput}>
      {/* Dropdown — INPUT'UN ÜSTÜNDE açılır, yüksekliği kalan alana göre */}
      {showDropdown && (
        <View style={[styles.dropdown, { maxHeight: dropdownHeight }]}>
          {/*
            "handled": satıra dokunuş klavyeyi kapatmaz → input satırın
            onPress'inden önce blur olmaz (listState.ts, tuzak katman 1).
          */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={listControls}
          >
            {results.slice(0, 6).map((item) => {
              const poster = getPosterUrl(item.posterPath, 'w92');
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={styles.resultRow}
                  accessibilityRole="button"
                  accessibilityLabel={item.title}
                  onPressIn={() => dispatchList({ type: 'rowPressIn' })}
                  onPressOut={() => dispatchList({ type: 'rowPressOut' })}
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
          {/* Görünür kapat — input'a en yakın kenarda; sorguyu silmez (X siler) */}
          {listControls && (
            <TouchableOpacity
              style={styles.closeRow}
              accessibilityRole="button"
              onPress={() => dispatchList({ type: 'dismiss' })}
            >
              <CaretDown size={14} color={Colors.textTertiary} weight="bold" />
              <Text style={styles.closeText} maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}>
                {t('games.search_close')}
              </Text>
            </TouchableOpacity>
          )}
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
          onFocus={() => dispatchList({ type: 'focus' })}
          onBlur={() => dispatchList({ type: 'blur' })}
          // Sabit 52px satır — tavansız AX boyutunda metin kırpılıyordu
          maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}
        />
        {query.length > 0 && (
          <TouchableOpacity
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => {
              cancelPendingSearch();
              setQuery('');
              setResults([]);
              dispatchList({ type: 'dismiss' });
            }}
          >
            <XCircle size={20} color={Colors.textTertiary} weight="duotone" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
