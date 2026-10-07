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
 *
 * P-6a (yine yalnız `listControls`): yeni sonuçlar listenin başından çizilir
 * (`scrollTo(0)`), yalnızca-artikel sorgu ("The") aranmaz, ipucu satırı
 * gösterilir (`articleQuery.ts`).
 */
import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { CaretDown, CloudSlash, FilmSlate, MagnifyingGlass, XCircle } from 'phosphor-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useGameShellContentTop, useGameTheme } from '@/components/games/GameShell';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { searchFilms, searchFilmsStrict } from '@/services/gameService';
import { getPosterUrl } from '@/services/tmdb';
import type { FilmSearchResult } from '@/services/gameTypes';

import { isArticleOnlyQuery } from './articleQuery';
import { DROPDOWN_MAX_H, dropdownMaxHeight } from './dropdownHeight';
import {
  INITIAL_SEARCH_LIST,
  isTriedFilm,
  reduceSearchList,
  type SearchListEvent,
} from './listState';
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
  /**
   * Daha önce tahmin edilmiş filmlerin `films.id`'leri — satır soluk ve
   * dokunulamaz, "Denendi" etiketli. Verilmezse hiçbir satır etkilenmez.
   */
  triedFilmIds?: readonly string[];
  /**
   * Yerleşim. 'dropdown' (varsayılan): liste input'un ÜSTÜNDE açılır, donmuş
   * oyunların çıktısı. 'sheet' (Spotlight cevap sayfası): sonuçlar input'un
   * ALTINDA, her zaman görünür; seçim sorguyu ve sonuçları silmez; yükleniyor /
   * hata + tekrar dene / boş durumu çizilir. `listControls`, 'sheet'te yok sayılır.
   */
  layout?: 'dropdown' | 'sheet';
  /** Input mount olunca odaklanır (yalnız 'sheet'te anlamlı). */
  autoFocus?: boolean;
  /** 'sheet': input ile liste arasında tek sakin satır (ör. yanlış tahmin geri bildirimi). */
  inlineNote?: string | null;
  /**
   * 'sheet': not satırının altında tek sakin HATA satırı (ör. tahmin isteği ağ hatasıyla
   * gitmedi). Sorgu ve sonuçlar korunur, seçim açık kalır. Varsayılan null — mevcut
   * çağıranların çıktısı değişmez.
   */
  inlineError?: string | null;
  /**
   * Satır seçiminde kendi hafif haptiğini ÇALMAZ — haptiği çağıran yer sonuca
   * göre verir (Spotlight: tahmin sonucu tek haptik). Varsayılan `false`:
   * dondurulmuş oyunların davranışı aynen kalır.
   */
  silentSelect?: boolean;
}

/** 'sheet' yerleşiminin arama durumu */
type SearchStatus = 'idle' | 'loading' | 'ready' | 'offline' | 'error';

export function FilmSearchInput({
  onSelect,
  disabled = false,
  placeholder,
  catalogOnly = false,
  listControls = false,
  triedFilmIds,
  layout = 'dropdown',
  autoFocus = false,
  inlineNote = null,
  inlineError = null,
  silentSelect = false,
}: FilmSearchInputProps) {
  const isSheet = layout === 'sheet';
  const theme = useGameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FilmSearchResult[]>([]);
  /** Yalnızca-artikel sorguda ipucuna yazılan kelime (ör. "The") — yoksa null */
  const [articleHint, setArticleHint] = useState<string | null>(null);
  const [list, dispatchList] = useReducer(
    (state: typeof INITIAL_SEARCH_LIST, event: SearchListEvent) =>
      reduceSearchList(state, event, listControls),
    INITIAL_SEARCH_LIST,
  );
  const showDropdown = list.open;
  const [status, setStatus] = useState<SearchStatus>('idle');
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

  /**
   * Liste açık kaldıkça ScrollView eski kaydırma konumunu korur; yeni harfle
   * gelen sonuçlar kaydırılmış konumda, üst satırları kesik çiziliyordu (P-6 §2).
   */
  const listScrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    if (listControls) listScrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [results, listControls]);

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
      setArticleHint(null);
      setStatus('idle');
      dispatchList({ type: 'dismiss' });
      return;
    }

    const ticket = gateRef.current.ticket();
    setStatus('loading');
    debounceRef.current = setTimeout(async () => {
      // Aynı 300 ms'lik bekleme: "The K" yazarken ipucu bir an yanıp sönmez
      if (listControls && isArticleOnlyQuery(text)) {
        setResults([]);
        setArticleHint(text.trim());
        setStatus('ready');
        // İpucu tek satır — reducer için listede 1 satır var
        dispatchList({ type: 'results', count: 1 });
        return;
      }
      try {
        if (isSheet) {
          // Strict: gerçek hata "bulunamadı"dan ayrılır. Bayat yanıt kapısı aynı.
          const outcome = await searchFilmsStrict(text, catalogOnly);
          if (!gateRef.current.isCurrent(ticket)) return;
          setArticleHint(null);
          if (outcome.status === 'ok') {
            setResults(outcome.films);
            setStatus('ready');
          } else {
            setResults([]);
            setStatus(outcome.status === 'offline' ? 'offline' : 'error');
          }
          return;
        }
        const films = await searchFilms(text, catalogOnly);
        // Arada X / seçim / yeni harf geldiyse bu yanıt bayat — uygulanmaz
        if (!gateRef.current.isCurrent(ticket)) return;
        setArticleHint(null);
        setResults(films);
        setStatus('ready');
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
        setArticleHint(null);
        setStatus('error');
        dispatchList({ type: 'dismiss' });
      }
    }, 300);
  }, [catalogOnly, listControls, isSheet, cancelPendingSearch]);

  const handleSelect = useCallback(
    (film: FilmSearchResult) => {
      if (!silentSelect) hapticLight();
      if (isSheet) {
        // Sheet: sorgu, sonuçlar ve klavye yerinde kalır (yanlış tahminde yeniden denenir)
        onSelect(film);
        return;
      }
      cancelPendingSearch();
      Keyboard.dismiss();
      setQuery('');
      dispatchList({ type: 'select' });
      setResults([]);
      setArticleHint(null);
      onSelect(film);
    },
    [onSelect, cancelPendingSearch, isSheet, silentSelect],
  );

  if (isSheet) {
    const visible = results.slice(0, 6);
    return (
      <View style={styles.sheetContainer}>
        <View style={styles.inputRow}>
          <MagnifyingGlass size={20} color={Colors.textTertiary} weight="duotone" />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={handleChange}
            placeholder={placeholder ?? t('games.search_placeholder')}
            placeholderTextColor={Colors.textTertiary}
            // editable=false odagi dusurur (klavye kapanir); bekleyen tahminde
            // yalniz satir secimi kilitlenir, yazma acik kalir.
            editable
            autoFocus={autoFocus}
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="search"
            maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}
          />
          {query.length > 0 && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={t('games.search_clear')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => {
                cancelPendingSearch();
                setQuery('');
                setResults([]);
                setArticleHint(null);
                setStatus('idle');
              }}
            >
              <XCircle size={20} color={Colors.textTertiary} weight="duotone" />
            </TouchableOpacity>
          )}
        </View>

        {inlineNote ? (
          <Text style={styles.sheetNote} accessibilityLiveRegion="polite">
            {inlineNote}
          </Text>
        ) : null}

        {inlineError ? (
          // Canlı bölge YOK: duyuru çağıranın tek `AccessibilityInfo` çağrısıyla yapılır
          <View style={styles.sheetError}>
            <CloudSlash size={16} weight="duotone" color={Colors.textTertiary} />
            <Text style={styles.sheetErrorText}>{inlineError}</Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.sheetList}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
        >
          {status === 'loading' && (
            <View style={styles.sheetStatus} accessibilityRole="progressbar">
              <ActivityIndicator color={Colors.textTertiary} />
            </View>
          )}
          {status === 'error' && (
            <View style={styles.sheetStatus}>
              <Text style={styles.sheetStatusText}>{t('games.search_load_failed')}</Text>
              <TouchableOpacity
                style={styles.sheetRetry}
                accessibilityRole="button"
                onPress={() => handleChange(query)}
              >
                <Text style={styles.sheetRetryText}>{t('games.search_retry')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {status === 'offline' && (
            <View style={styles.sheetStatus}>
              <Text style={styles.sheetStatusText}>{t('games.search_offline')}</Text>
              <TouchableOpacity
                style={styles.sheetRetry}
                accessibilityRole="button"
                onPress={() => handleChange(query)}
              >
                <Text style={styles.sheetRetryText}>{t('games.search_retry')}</Text>
              </TouchableOpacity>
            </View>
          )}
          {status === 'idle' && (
            <View style={styles.sheetStatus}>
              <Text style={styles.sheetStatusText}>{t('games.search_invite')}</Text>
            </View>
          )}
          {status === 'ready' && articleHint !== null && (
            <View style={styles.hintRow} accessibilityRole="text">
              <Text style={styles.hintText}>
                {t('games.search_article_hint', { word: articleHint })}
              </Text>
            </View>
          )}
          {status === 'ready' && articleHint === null && visible.length === 0 && (
            <View style={styles.sheetStatus}>
              <Text style={styles.sheetStatusText}>{t('games.search_empty')}</Text>
            </View>
          )}
          {status === 'ready' &&
            visible.map((item) => {
              const poster = getPosterUrl(item.posterPath, 'w92');
              const tried = isTriedFilm(item.uuid, triedFilmIds);
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={[styles.resultRow, styles.sheetRow, tried && styles.resultRowTried]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    tried ? `${item.title}, ${t('games.search_tried')}` : item.title
                  }
                  accessibilityState={tried ? { disabled: true } : undefined}
                  activeOpacity={tried ? 1 : undefined}
                  onPress={() => {
                    if (!tried && !disabled) handleSelect(item);
                  }}
                >
                  {poster ? (
                    <Image source={{ uri: poster }} style={styles.resultPoster} contentFit="cover" />
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
                  {tried && (
                    <Text style={styles.triedText} maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}>
                      {t('games.search_tried')}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
        </ScrollView>
      </View>
    );
  }

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
            ref={listScrollRef}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            showsVerticalScrollIndicator={listControls}
          >
            {articleHint !== null && (
              <View style={styles.hintRow} accessibilityRole="text">
                <Text style={styles.hintText}>
                  {t('games.search_article_hint', { word: articleHint })}
                </Text>
              </View>
            )}
            {results.slice(0, 6).map((item) => {
              const poster = getPosterUrl(item.posterPath, 'w92');
              const tried = isTriedFilm(item.uuid, triedFilmIds);
              return (
                <TouchableOpacity
                  key={String(item.id)}
                  style={[styles.resultRow, tried && styles.resultRowTried]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    tried ? `${item.title}, ${t('games.search_tried')}` : item.title
                  }
                  accessibilityState={tried ? { disabled: true } : undefined}
                  // Denenmiş satır `disabled` DEĞİL: dokunuşu yakalamazsa
                  // ScrollView ("handled") klavyeyi kapatır → blur → liste
                  // kapanır. Dokunuş yakalanır, tahmin gönderilmez.
                  activeOpacity={tried ? 1 : undefined}
                  onPressIn={() => dispatchList({ type: 'rowPressIn' })}
                  onPressOut={() => dispatchList({ type: 'rowPressOut' })}
                  onPress={() => {
                    if (!tried) handleSelect(item);
                  }}
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
                  {tried && (
                    <Text style={styles.triedText} maxFontSizeMultiplier={Theme.fontScale.fixedBoxMax}>
                      {t('games.search_tried')}
                    </Text>
                  )}
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
              setArticleHint(null);
              setStatus('idle');
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
