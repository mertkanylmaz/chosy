/**
 * Watchlist Detail — stack screen (tab degil).
 *
 * UX Redesign: Watchlist tab kaldirildi, bu ekran Profile'dan
 * "See All" ile acilir. Back button ile Profile'a doner.
 *
 * C.9d: Watchlist ekraninin TEK kaynagi burasi. Ikizi olan
 * `app/(tabs)/watchlist.tsx` silindi (IA karari K-06 — Watchlist ayri tab
 * degil, Profile alt sayfasi). Bu dosya su islevlerin tamamini tasir:
 *   - 2-sutunlu grid + grouped (by mood) gorunumleri
 *   - Arama, siralama, izlendi filtreleme
 *   - Roulette CTA, uzun basma menu, toplu silme
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DiceFive } from 'phosphor-react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import {
  canUnwatch,
  clearWatchlist,
  getWatchlist,
  getWatchlistGroupedBySessions,
  removeFromWatchlist,
  toggleWatched,
  WatchlistGroup,
  WatchlistItem,
} from '@/services/watchlist';
// V-4 Tur C: yalniz `Colors.error` — yikici eylemlerin (kaldir, tumunu
// temizle) bilinen istisnasi; Design OS'ta tehlike token'i yok.
import { Colors } from '@/constants/Colors';
import { color, radius, size, space, type } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { isRouletteEnabled } from '@/services/gameApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { hapticSelection, hapticWarning } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import WatchlistCard from '@/components/Watchlist/WatchlistCard';
import SessionAccordion from '@/components/Watchlist/SessionAccordion';
import FilmSeridi from '@/components/FilmReelAnimation';

import { CARD_WIDTH, GRID_COL_GAP, GRID_H_PAD } from '@/components/Watchlist/WatchlistCard/styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

type SortKey = 'recently_added' | 'highest_match' | 'title' | 'year';
type ViewMode = 'list' | 'grouped';
type WatchFilter = 'unwatched' | 'watched';

interface LongPressTarget {
  filmId: string;
  filmTitle: string;
}

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const POSTER_HEIGHT = CARD_WIDTH * 1.5;

// ─── WatchlistDetailScreen ──────────────────────────────────────────────────

/**
 * Watchlist detay ekrani — stack screen olarak calisir.
 * Profile > "See All" ile acilir, back button ile Profile'a doner.
 */
export default function WatchlistDetailScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const headerAnimStyle = useStaggeredEntry(0);
  const chipsAnimStyle = useStaggeredEntry(1);

  // ── Flat list state ────────────────────────────────────────────────────────
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('recently_added');

  // ── Grouped state ──────────────────────────────────────────────────────────
  const [groups, setGroups] = useState<WatchlistGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsLoaded, setGroupsLoaded] = useState(false);

  // ── Watched state ──────────────────────────────────────────────────────────
  // Izlendi bilgisi satirin kendisinde (`item.watchedAt`, sunucu) — Fix 6.
  const [watchFilter, setWatchFilter] = useState<WatchFilter>('unwatched');

  // ── Shared state ───────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [menuTarget, setMenuTarget] = useState<LongPressTarget | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadErrorType, setLoadErrorType] = useState<import('@/utils/errorHelpers').ErrorType>('unknown');
  /**
   * Roulette erisim yolu acik mi (C.6, PRODUCT_OS §7.4). Varsayilan `false`:
   * flag okunana kadar kisayol GOSTERILMEZ. Kod ve /roulette rotasi duruyor.
   */
  const [rouletteEnabled, setRouletteEnabled] = useState(false);

  // ── Veri yukleme ──────────────────────────────────────────────────────────

  /** Duz liste yukler — izlendi durumu satirla birlikte gelir (watched_at) */
  const loadWatchlist = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await getWatchlist();
      setItems(data);
    } catch (err) {
      const { toUserError } = await import('@/utils/errorHelpers');
      const userError = toUserError(err, 'watchlist');
      setLoadErrorType(userError.type);
      setLoadError(true);
    } finally {
      setInitialLoading(false);
    }
  }, []);

  /** Session gruplarini yukler (sadece grouped mode'da cagrilir) */
  const loadGroups = useCallback(async () => {
    setGroupsLoading(true);
    try {
      const data = await getWatchlistGroupedBySessions();
      setGroups(data);
      setGroupsLoaded(true);
    } catch (err) {
      // V-4 Tur C (Kural 2): servis bugun firlatmiyor (hatayi kendisi
      // yazip [] donuyor); beklenmedik bir firlatma yine de iz birakir.
      logger.error('[WatchlistDetail] loadGroups beklenmedik hata', err, {
        code: 'WATCHLIST_GROUPS_LOAD_FAILED',
      });
      setGroups([]);
      setGroupsLoaded(true);
    } finally {
      setGroupsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
    }, [loadWatchlist]),
  );

  // Roulette flag'i her odakta lazy okunur (CLAUDE.md kural 6). Okuma hatasi
  // isRouletteEnabled icinde Sentry'ye duser ve kapali doner (fail-closed).
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void isRouletteEnabled().then((enabled) => {
        if (!cancelled) setRouletteEnabled(enabled);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  /** Gorunum modunu degistir; grouped ilk kez acilinca yukle */
  const handleViewModeChange = useCallback(
    (mode: ViewMode) => {
      hapticSelection();
      setViewMode(mode);
      if (mode === 'grouped' && !groupsLoaded) {
        loadGroups();
      }
    },
    [groupsLoaded, loadGroups],
  );

  /** Pull-to-refresh: her iki modda da calisir */
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadWatchlist();
    if (viewMode === 'grouped') {
      await loadGroups();
    }
    setIsRefreshing(false);
  }, [loadWatchlist, loadGroups, viewMode]);

  // ── Filtered / Sorted list ─────────────────────────────────────────────────

  const displayedItems = useMemo((): WatchlistItem[] => {
    let filtered = items;

    // Search filter
    if (searchQuery.length > 0) {
      filtered = filtered.filter((item) =>
        item.film.title.toLocaleLowerCase('en-US').includes(searchQuery.toLocaleLowerCase('en-US')),
      );
    }

    // Watch status filter
    if (watchFilter === 'unwatched') {
      filtered = filtered.filter((item) => item.watchedAt === null);
    } else {
      filtered = filtered.filter((item) => item.watchedAt !== null);
    }

    const sorted = [...filtered];
    switch (sortKey) {
      case 'recently_added':
        return sorted;
      case 'highest_match':
        return sorted.sort((a, b) => b.film.matchScore - a.film.matchScore);
      case 'title':
        return sorted.sort((a, b) => a.film.title.localeCompare(b.film.title));
      case 'year':
        return sorted.sort((a, b) => b.film.year - a.film.year);
      default:
        return sorted;
    }
  }, [items, sortKey, searchQuery, watchFilter]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleRemove = useCallback(
    async (filmId: string) => {
      setMenuTarget(null);
      hapticWarning();
      const snapshot = items;
      const groupsSnapshot = groups;
      setItems((prev) => prev.filter((i) => i.film.id !== filmId));
      setGroups((prev) =>
        prev
          .map((g) => ({
            ...g,
            films: g.films.filter((f) => f.film.id !== filmId),
            filmCount: g.films.filter((f) => f.film.id !== filmId).length,
          }))
          .filter((g) => g.filmCount > 0),
      );
      const success = await removeFromWatchlist(filmId);
      if (!success) {
        setItems(snapshot);
        setGroups(groupsSnapshot);
        Alert.alert(t('errors.watchlistRemove'));
      }
    },
    [items, groups, t],
  );

  const handleClearAll = useCallback(() => {
    setMenuVisible(false);
    Alert.alert(
      t('profile.clearWatchlistTitle'),
      t('profile.clearWatchlistMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.clearWatchlistConfirm'),
          style: 'destructive',
          onPress: async () => {
            const snapshot = items;
            // Yalnizca Saved (izlenmemis) silinir; izlenenler kalir (Fix 6).
            setItems((prev) => prev.filter((i) => i.watchedAt !== null));
            setGroups([]);
            try {
              await clearWatchlist();
            } catch {
              // Servis katmani (`logger.error`) hatayi Sentry'ye yazdi —
              // ikinci event uretilmez; liste geri yuklenir, kullaniciya soylenir.
              setItems(snapshot);
              Alert.alert(t('errors.watchlistClear'));
            }
          },
        },
      ],
    );
  }, [items, t]);

  /**
   * Uzun basma menusundeki izlendi/izlenmedi eylemi (Fix 6). Satir silinmez:
   * izlendi → Saved'den cikar, izlenmedi → Saved'e doner. Gauntlet kaynakli
   * isaretin menude geri alma secenegi hic cizilmez.
   */
  const handleToggleWatched = useCallback(
    async (filmId: string) => {
      setMenuTarget(null);
      const item = items.find((i) => i.film.id === filmId);
      if (!item) return;
      const currentlyWatched = item.watchedAt !== null;
      if (currentlyWatched && !canUnwatch(item.watchedSource)) return;
      hapticSelection();
      try {
        const result = await toggleWatched(filmId, currentlyWatched);
        const nowIso = new Date().toISOString();
        setItems((prev) =>
          prev.map((i) =>
            i.film.id === filmId
              ? {
                  ...i,
                  watchedAt: result.watched ? (i.watchedAt ?? nowIso) : null,
                  watchedSource: result.watched ? (i.watchedSource ?? 'manual') : null,
                }
              : i,
          ),
        );
        if (result.watched) {
          setGroups((prev) =>
            prev
              .map((g) => {
                const films = g.films.filter((f) => f.film.id !== filmId);
                return { ...g, films, filmCount: films.length };
              })
              .filter((g) => g.filmCount > 0),
          );
        } else if (groupsLoaded) {
          // Saved'e donen film hangi gruba ait — RPC'den yeniden okunur.
          await loadGroups();
        }
      } catch {
        // Servis katmani hatayi Sentry'ye yazdi; durum degismedi.
        Alert.alert(t('errors.watchedToggle'));
      }
    },
    [items, groupsLoaded, loadGroups, t],
  );

  /** Menu hedefinin izlendi durumu — duz liste tum satirlari tasir. */
  const menuItem = useMemo(
    () => (menuTarget ? items.find((i) => i.film.id === menuTarget.filmId) ?? null : null),
    [items, menuTarget],
  );
  const menuWatched = menuItem?.watchedAt != null;
  const menuCanToggleWatched = menuItem !== null && (!menuWatched || canUnwatch(menuItem.watchedSource));

  const handleCardLongPress = useCallback(
    (filmId: string, filmTitle: string) => {
      setMenuTarget({ filmId, filmTitle });
    },
    [],
  );

  // ── FlatList renderers ─────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: WatchlistItem; index: number }) => (
      <WatchlistCard
        item={item}
        itemIndex={index}
        onLongPress={handleCardLongPress}
      />
    ),
    [handleCardLongPress],
  );

  const keyExtractor = useCallback((item: WatchlistItem) => item.film.id, []);

  // ── Chips data ─────────────────────────────────────────────────────────────

  const viewChips: { key: ViewMode; label: string }[] = [
    { key: 'list', label: t('watchlist.listView') },
    { key: 'grouped', label: t('watchlist.groupedView') },
  ];

  const sortChips: { key: SortKey; label: string }[] = [
    { key: 'recently_added', label: t('watchlist.sort_recently_added') },
    { key: 'highest_match', label: t('watchlist.sort_highest_match') },
  ];

  const watchFilterChips: { key: WatchFilter; label: string }[] = [
    { key: 'unwatched', label: t('watchlist.filterUnwatched') },
    { key: 'watched', label: t('watchlist.filterWatched') },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
      {/* V-4 Tur A (V4-D3): eski tam ekran gradyan ayni rengin iki kopyasiydi
          (#0A0A0F → #0A0A0F); zemin artik `safe`'in duz `ink`'i. */}
      <StatusBar style="light" />

      {/* Header — back button + baslik + ikonlar */}
      <Animated.View style={headerAnimStyle}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
            >
              <Ionicons name="chevron-back" size={24} color={color.text.primary} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('tabs.watchlist')}</Text>
          </View>
          <View style={styles.headerIcons}>
            {/* Roulette — header kisayol ikonu (C.6: flag kapaliysa yok) */}
            {rouletteEnabled && items.length >= 3 && (
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
                accessibilityRole="button"
                accessibilityLabel={t('roulette.ctaButton')}
                onPress={() => {
                  hapticSelection();
                  router.push('/roulette' as import('expo-router').Href);
                }}
              >
                <DiceFive size={22} color={color.text.primary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={searchVisible ? t('watchlist.closeSearch') : t('watchlist.openSearch')}
              onPress={() => {
                setSearchVisible((v) => !v);
                if (searchVisible) setSearchQuery('');
              }}
            >
              <Ionicons
                name={searchVisible ? 'close-outline' : 'search-outline'}
                size={22}
                color={color.text.primary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 2, bottom: 2, left: 2, right: 2 }}
              accessibilityRole="button"
              accessibilityLabel={t('watchlist.moreOptions')}
              onPress={() => setMenuVisible(true)}
            >
              <Ionicons name="reorder-three-outline" size={24} color={color.text.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Arama Cubugu */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={color.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('watchlist.searchPlaceholder')}
            placeholderTextColor={color.text.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('watchlist.clearSearch')}
            >
              <Text style={styles.clearSearch}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Chip Satiri: Gorunum toggle + (list modunda) siralama.
          V-4 Tur C: iki grup gorsel olarak ayrisir — gorunum tek kapsul icinde
          bitisik segmentler, siralama/filtre ayrik pill'ler. Secili = `bone`
          (isik), `marquee` degil. Secim mantigi degismedi. */}
      <Animated.View style={chipsAnimStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {/* Gorunum toggle — segmentli kontrol */}
          <View style={styles.segmented} accessibilityRole="radiogroup">
            {viewChips.map(({ key, label }) => {
              const active = viewMode === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.segment, active && styles.segmentActive]}
                  onPress={() => handleViewModeChange(key)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active ? styles.chipTextActive : styles.chipTextInactive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Ayirici */}
          <View style={styles.chipDivider} />

          {/* Siralama — sadece list modunda */}
          {viewMode === 'list' &&
            sortChips.map(({ key, label }) => {
              const active = sortKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                  onPress={() => {
                    hapticSelection();
                    setSortKey(key);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active ? styles.chipTextActive : styles.chipTextInactive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}

          {/* Izlendi filtreleme — sadece list modunda */}
          {viewMode === 'list' && (
            <>
              <View style={styles.chipDivider} />
              {watchFilterChips.map(({ key, label }) => {
                const active = watchFilter === key;
                return (
                  <TouchableOpacity
                    key={`wf-${key}`}
                    style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                    onPress={() => { hapticSelection(); setWatchFilter(key); }}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        active ? styles.chipTextActive : styles.chipTextInactive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      </Animated.View>

      {/* ── Roulette CTA (>=3 film varsa, her filter modunda) ── */}
      {rouletteEnabled && !initialLoading && !loadError && items.length >= 3 && (
        <Animated.View style={chipsAnimStyle}>
          <TouchableOpacity
            style={styles.rouletteCta}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('roulette.ctaButton')}
            onPress={() => {
              hapticSelection();
              router.push('/roulette' as import('expo-router').Href);
            }}
          >
            <DiceFive size={20} color={color.text.primary} />
            <Text style={styles.rouletteCtaText}>{t('roulette.ctaButton')}</Text>
            <Ionicons name="chevron-forward" size={16} color={color.text.secondary} style={styles.rouletteCtaChevron} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ── Icerik ── */}

      {initialLoading ? (
        <View style={styles.skeletonGrid}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={styles.skeletonCard}>
              <SkeletonLoader width="100%" height={POSTER_HEIGHT} borderRadius={12} />
              <SkeletonLoader width="80%" height={14} borderRadius={6} style={{ marginTop: 8 }} />
              <SkeletonLoader width="50%" height={12} borderRadius={6} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : loadError ? (
        <ErrorState errorType={loadErrorType} onRetry={loadWatchlist} />
      ) : items.length === 0 ? (
        <EmptyState
          illustration={<FilmSeridi />}
          title={t('watchlist.emptyTitle')}
          subtitle={t('watchlist.emptySubtitle')}
          actionLabel={t('watchlist.discoverButton')}
          onAction={() => router.push('/(tabs)')}
        />
      ) : viewMode === 'grouped' ? (
        <ScrollView
          style={styles.groupedScroll}
          contentContainerStyle={styles.groupedContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={color.text.secondary}
              colors={[color.text.secondary]}
            />
          }
        >
          {groupsLoading ? (
            [0, 1, 2].map((i) => (
              <View key={i} style={styles.groupSkeleton}>
                <SkeletonLoader width="100%" height={56} borderRadius={16} />
              </View>
            ))
          ) : groups.length === 0 ? (
            <View style={styles.groupedEmpty}>
              <Text style={styles.groupedEmptyTitle}>{t('watchlist.groupedEmpty')}</Text>
              <Text style={styles.groupedEmptySubtitle}>
                {t('watchlist.groupedEmptySubtitle')}
              </Text>
            </View>
          ) : (
            groups.map((group, i) => (
              <SessionAccordion
                key={group.sessionId ?? `no-session-${i}`}
                group={group}
                groupIndex={i}
                onLongPress={handleCardLongPress}
                defaultExpanded={i === 0}
              />
            ))
          )}
        </ScrollView>
      ) : (
        <FlatList
          data={displayedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={2}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={6}
          windowSize={7}
          initialNumToRender={6}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={color.text.secondary}
              colors={[color.text.secondary]}
            />
          }
        />
      )}

      {/* ── Uzun Basma Modal ── */}
      <Modal
        visible={menuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuTarget(null)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalFilmTitle} numberOfLines={1}>
              {menuTarget?.filmTitle}
            </Text>
            {menuCanToggleWatched && (
              <TouchableOpacity
                style={styles.modalOption}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={menuWatched ? t('watchlist.markUnwatched') : t('watchlist.watched')}
                onPress={() => menuTarget && handleToggleWatched(menuTarget.filmId)}
              >
                <Text style={styles.modalOptionText}>
                  {menuWatched ? t('watchlist.markUnwatched') : `${t('watchlist.watched')} ✓`}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.modalOption}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('watchlist.addToList')}
            >
              <Text style={styles.modalOptionText}>{t('watchlist.addToList')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('share.shareFilm')}
              onPress={() => {
                if (!menuTarget) return;
                setMenuTarget(null);
                router.push(`/film/${menuTarget.filmId}` as import('expo-router').Href);
              }}
            >
              <Text style={styles.modalOptionText}>{t('share.shareFilm')}</Text>
            </TouchableOpacity>
            {/* Izlenmis satir silinmez (izleme gecmisi) — kaldir yalnizca Saved'de. */}
            {!menuWatched && (
              <TouchableOpacity
                style={[styles.modalOption, styles.modalOptionLast]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={t('watchlist.remove')}
                onPress={() => menuTarget && handleRemove(menuTarget.filmId)}
              >
                <Text style={[styles.modalOptionText, styles.modalOptionTextRed]}>
                  {t('watchlist.remove')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Menu Modal ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <Pressable
              style={styles.menuItem}
              accessibilityRole="radio"
              accessibilityLabel={t('watchlist.sort_title')}
              accessibilityState={{ selected: sortKey === 'title' && viewMode === 'list' }}
              onPress={() => {
                setSortKey('title');
                setViewMode('list');
                setMenuVisible(false);
              }}
            >
              <Text
                style={[styles.menuItemText, sortKey === 'title' && viewMode === 'list' && styles.menuItemTextActive]}
              >
                {t('watchlist.sort_title')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              accessibilityRole="radio"
              accessibilityLabel={t('watchlist.sort_year')}
              accessibilityState={{ selected: sortKey === 'year' && viewMode === 'list' }}
              onPress={() => {
                setSortKey('year');
                setViewMode('list');
                setMenuVisible(false);
              }}
            >
              <Text
                style={[styles.menuItemText, sortKey === 'year' && viewMode === 'list' && styles.menuItemTextActive]}
              >
                {t('watchlist.sort_year')}
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              accessibilityRole="button"
              accessibilityLabel={t('watchlist.clearAll')}
              onPress={handleClearAll}
            >
              <Text style={styles.menuItemTextRed}>{t('watchlist.clearAll')}</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemLast]}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.menuItemTextGrey}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Stiller ──────────────────────────────────────────────────────────────────
//
// V-4 Tur C: Design OS semantic token'lari. Tek istisna `Colors.error`
// (yikici eylemler — kaldir, tumunu temizle).

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: color.surface.base,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: space.md,
    paddingBottom: space.xs,
    paddingHorizontal: space.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  backBtn: {
    width: size.touchTarget,
    height: size.touchTarget,
    borderRadius: size.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 2,
  },
  iconBtn: {
    width: size.touchTarget,
    height: size.touchTarget,
    borderRadius: size.touchTarget / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Baslik */
  title: {
    ...type['display-m'],
    color: color.text.primary,
  },

  /* Arama */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: space.md,
    marginHorizontal: space.base,
    paddingHorizontal: space.base,
    height: size.actionHeight,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    borderRadius: space.md,
    backgroundColor: color.surface.raised,
    gap: space.sm,
  },
  searchInput: {
    ...type.body,
    flex: 1,
    color: color.text.primary,
  },
  clearSearch: {
    ...type.body,
    color: color.text.secondary,
    paddingLeft: space.xs,
  },

  /* Chip'ler */
  chipsScroll: {
    flexGrow: 0,
    marginTop: space.base,
  },
  chipsContent: {
    paddingHorizontal: space.base,
    gap: space.sm,
    alignItems: 'center',
  },
  /** Gorunum grubu — tek `charcoal` kapsul, segmentler bitisik. */
  segmented: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: radius.pill,
    backgroundColor: color.surface.raised,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  segment: {
    borderRadius: radius.pill,
    paddingHorizontal: space.base,
    paddingVertical: space.sm - 2,
  },
  segmentActive: {
    backgroundColor: color.text.primary,
  },
  /** Siralama / izlendi filtresi — ayrik pill'ler. */
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: space.base,
    paddingVertical: space.sm,
    borderWidth: size.hairline,
  },
  chipActive: {
    backgroundColor: color.text.primary,
    borderColor: color.text.primary,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: color.surface.border,
  },
  chipText: {
    ...type.caption,
    fontWeight: '600',
  },
  /** `bone` zemin uzerinde `ink` metin. */
  chipTextActive: {
    color: color.surface.base,
  },
  chipTextInactive: {
    color: color.text.secondary,
  },
  chipDivider: {
    width: size.hairline,
    height: 20,
    backgroundColor: color.surface.border,
    marginHorizontal: space.xs,
  },

  /* Roulette CTA — birincil eylem dili (`beam`@12% + @40% kenar) */
  rouletteCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.base,
    marginTop: space.base,
    paddingVertical: space.md,
    paddingHorizontal: space.base,
    borderRadius: space.md,
    backgroundColor: color.accent.fill,
    borderWidth: size.hairline,
    borderColor: color.accent.edgeStrong,
    gap: space.sm,
  },
  rouletteCtaText: {
    ...type['body-strong'],
    color: color.text.primary,
  },
  rouletteCtaChevron: {
    marginLeft: 'auto',
  },

  /* FlatList (list mode) */
  list: {
    flex: 1,
    marginTop: space.base,
  },
  listContent: {
    paddingHorizontal: GRID_H_PAD,
    paddingBottom: space.base,
  },
  columnWrapper: {
    gap: GRID_COL_GAP,
    marginBottom: space.base,
  },

  /* Skeleton grid */
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_COL_GAP,
    paddingHorizontal: GRID_H_PAD,
    paddingTop: space.base,
  },
  skeletonCard: {
    width: CARD_WIDTH,
  },

  /* Grouped view */
  groupedScroll: {
    flex: 1,
    marginTop: space.base,
  },
  groupedContent: {
    paddingBottom: space.base,
  },
  groupSkeleton: {
    marginHorizontal: space.base,
    marginBottom: space.md,
  },
  groupedEmpty: {
    alignItems: 'center',
    paddingTop: space.xxl,
    paddingHorizontal: space.xl,
    gap: space.sm,
  },
  groupedEmptyTitle: {
    ...type['body-strong'],
    color: color.text.primary,
    textAlign: 'center',
  },
  groupedEmptySubtitle: {
    ...type.callout,
    color: color.text.secondary,
    textAlign: 'center',
  },

  /* Uzun basma modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(color.surface.base, 0.65),
    justifyContent: 'flex-end',
    paddingBottom: space.xxl,
    paddingHorizontal: space.base,
  },
  modalCard: {
    backgroundColor: color.surface.raised,
    borderRadius: radius.surface,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
    overflow: 'hidden',
  },
  modalFilmTitle: {
    ...type.caption,
    color: color.text.secondary,
    paddingHorizontal: space.base,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.surface.border,
  },
  modalOption: {
    height: size.actionHeight,
    justifyContent: 'center',
    paddingHorizontal: space.base,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: color.surface.border,
  },
  modalOptionLast: {
    borderBottomWidth: 0,
  },
  modalOptionText: {
    ...type.body,
    color: color.text.primary,
  },
  modalOptionTextRed: {
    color: Colors.error,
  },

  /* Menu modal */
  menuOverlay: {
    flex: 1,
    backgroundColor: withAlpha(color.surface.base, 0.6),
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: color.surface.raised,
    borderTopLeftRadius: radius.surface,
    borderTopRightRadius: radius.surface,
    borderWidth: size.hairline,
    borderBottomWidth: 0,
    borderColor: color.surface.border,
    paddingTop: space.md,
    paddingBottom: space.xxl,
  },
  menuItem: {
    paddingVertical: space.base,
    paddingHorizontal: space.lg,
    borderBottomWidth: size.hairline,
    borderBottomColor: color.surface.border,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    ...type.body,
    color: color.text.primary,
  },
  /** Secili siralama — `bone` agirlik, `marquee` degil. */
  menuItemTextActive: {
    ...type['body-strong'],
    color: color.text.primary,
  },
  menuItemTextRed: {
    ...type.body,
    color: Colors.error,
  },
  menuItemTextGrey: {
    ...type.body,
    color: color.text.secondary,
    textAlign: 'center',
  },
});
