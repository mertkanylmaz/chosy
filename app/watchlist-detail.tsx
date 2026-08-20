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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';

import {
  clearWatchlist,
  getWatchlist,
  getWatchlistGroupedBySessions,
  getWatchedFilmIds,
  removeFromWatchlist,
  WatchlistGroup,
  WatchlistItem,
} from '@/services/watchlist';
import { Colors } from '@/constants/Colors';
import { isRouletteEnabled } from '@/services/gameApi';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import { hapticSelection, hapticWarning } from '@/utils/haptics';
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
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());
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

  /** Duz liste + watched durumlari yukler */
  const loadWatchlist = useCallback(async () => {
    setLoadError(false);
    try {
      const [data, watched] = await Promise.all([
        getWatchlist(),
        getWatchedFilmIds(),
      ]);
      setItems(data);
      setWatchedIds(watched);
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
    } catch {
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
      filtered = filtered.filter((item) => !watchedIds.has(item.film.id));
    } else {
      filtered = filtered.filter((item) => watchedIds.has(item.film.id));
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
  }, [items, sortKey, searchQuery, watchFilter, watchedIds]);

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
        Alert.alert(t('errors.generic'), t('errors.watchlistRemove'));
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
            setItems([]);
            setGroups([]);
            try {
              await clearWatchlist();
            } catch {
              setItems(snapshot);
              Alert.alert(t('errors.generic'), t('errors.watchlistClear'));
            }
          },
        },
      ],
    );
  }, [items, t]);

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
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.background, Colors.backgroundGradient]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Header — back button + baslik + ikonlar */}
      <Animated.View style={headerAnimStyle}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('tabs.watchlist')}</Text>
          </View>
          <View style={styles.headerIcons}>
            {/* Roulette — header kisayol ikonu (C.6: flag kapaliysa yok) */}
            {rouletteEnabled && items.length >= 3 && (
              <TouchableOpacity
                style={styles.iconBtn}
                activeOpacity={0.7}
                onPress={() => {
                  hapticSelection();
                  router.push('/roulette' as import('expo-router').Href);
                }}
              >
                <Ionicons name="dice-outline" size={22} color={Colors.gold} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={() => {
                setSearchVisible((v) => !v);
                if (searchVisible) setSearchQuery('');
              }}
            >
              <Ionicons
                name={searchVisible ? 'close-outline' : 'search-outline'}
                size={22}
                color={Colors.textWhite}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={() => setMenuVisible(true)}
            >
              <Ionicons name="reorder-three-outline" size={24} color={Colors.textWhite} />
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      {/* Arama Cubugu */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('watchlist.searchPlaceholder')}
            placeholderTextColor={Colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Chip Satiri: Gorunum toggle + (list modunda) siralama */}
      <Animated.View style={chipsAnimStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}
        >
          {/* Gorunum toggle */}
          {viewChips.map(({ key, label }) => {
            const active = viewMode === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                onPress={() => handleViewModeChange(key)}
                activeOpacity={0.8}
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
            onPress={() => {
              hapticSelection();
              router.push('/roulette' as import('expo-router').Href);
            }}
          >
            <Ionicons name="dice-outline" size={20} color={Colors.textOnAccent} />
            <Text style={styles.rouletteCtaText}>{t('roulette.ctaButton')}</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.textOnAccent} style={{ marginLeft: 'auto' }} />
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
              tintColor={Colors.gold}
              colors={[Colors.gold]}
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
              tintColor={Colors.gold}
              colors={[Colors.gold]}
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
            <TouchableOpacity style={styles.modalOption} activeOpacity={0.7}>
              <Text style={styles.modalOptionText}>{t('watchlist.watched')} ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} activeOpacity={0.7}>
              <Text style={styles.modalOptionText}>{t('watchlist.addToList')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalOption}
              activeOpacity={0.7}
              onPress={() => {
                if (!menuTarget) return;
                setMenuTarget(null);
                router.push(`/film/${menuTarget.filmId}` as import('expo-router').Href);
              }}
            >
              <Text style={styles.modalOptionText}>{t('share.shareFilm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, styles.modalOptionLast]}
              activeOpacity={0.7}
              onPress={() => menuTarget && handleRemove(menuTarget.filmId)}
            >
              <Text style={[styles.modalOptionText, styles.modalOptionTextRed]}>
                {t('watchlist.remove')}
              </Text>
            </TouchableOpacity>
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
            <Pressable style={styles.menuItem} onPress={handleClearAll}>
              <Text style={styles.menuItemTextRed}>{t('watchlist.clearAll')}</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemLast]}
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

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    paddingHorizontal: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 2,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white05,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Baslik */
  title: {
    fontSize: 28,
    fontFamily: 'PlayfairDisplay_700Bold',
    color: Colors.textWhite,
    letterSpacing: 0.3,
  },

  /* Arama */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginHorizontal: 20,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.white10,
    borderRadius: 12,
    backgroundColor: Colors.white05,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: 16,
  },
  clearSearch: {
    color: Colors.textGrey,
    fontSize: 18,
    paddingLeft: 4,
  },

  /* Chip'ler */
  chipsScroll: {
    flexGrow: 0,
    marginTop: 16,
  },
  chipsContent: {
    paddingLeft: 20,
    paddingRight: 20,
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  chipActive: {
    backgroundColor: Colors.accentPrimary,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.tabInactive,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: Colors.textOnAccent,
  },
  chipTextInactive: {
    color: Colors.textGrey,
  },
  chipDivider: {
    width: 1,
    height: 18,
    backgroundColor: Colors.white10,
    marginHorizontal: 4,
  },

  /* Roulette CTA */
  rouletteCta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: Colors.accentPrimary,
    gap: 10,
  },
  rouletteCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },

  /* FlatList (list mode) */
  list: {
    flex: 1,
    marginTop: 20,
  },
  listContent: {
    paddingHorizontal: GRID_H_PAD,
    paddingBottom: 20,
  },
  columnWrapper: {
    gap: GRID_COL_GAP,
    marginBottom: 20,
  },

  /* Skeleton grid */
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_COL_GAP,
    paddingHorizontal: GRID_H_PAD,
    paddingTop: 16,
  },
  skeletonCard: {
    width: CARD_WIDTH,
  },

  /* Grouped view */
  groupedScroll: {
    flex: 1,
    marginTop: 20,
  },
  groupedContent: {
    paddingBottom: 20,
  },
  groupSkeleton: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  groupedEmpty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
    gap: 10,
  },
  groupedEmptyTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textWhite,
    textAlign: 'center',
  },
  groupedEmptySubtitle: {
    fontSize: 14,
    color: Colors.textGrey,
    textAlign: 'center',
    lineHeight: 20,
  },

  /* Uzun basma modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: Colors.cardSolid,
    borderRadius: 16,
    overflow: 'hidden',
  },
  modalFilmTitle: {
    fontSize: 13,
    color: Colors.textGrey,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.white10,
  },
  modalOption: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.white10,
  },
  modalOptionLast: {
    borderBottomWidth: 0,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.textWhite,
  },
  modalOptionTextRed: {
    color: Colors.error,
  },

  /* Menu modal */
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  menuContainer: {
    backgroundColor: Colors.cardSolid,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  menuItem: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.white05,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    color: Colors.textWhite,
    fontSize: 16,
  },
  menuItemTextActive: {
    color: Colors.gold,
    fontWeight: '700',
  },
  menuItemTextRed: {
    color: Colors.error,
    fontSize: 16,
  },
  menuItemTextGrey: {
    color: Colors.textGrey,
    fontSize: 16,
    textAlign: 'center',
  },
});
