/**
 * WatchlistSection — Profile icinde gomulen tam ozellikli watchlist.
 *
 * watchlist-detail.tsx'ten tasinmistir:
 *   - 2-sutunlu grid + grouped (by mood) gorunumleri
 *   - Arama, siralama, izlendi filtreleme
 *   - Roulette CTA, uzun basma menu, toplu silme
 *
 * Stack-screen ozellikleri KALDIRILDI:
 *   - SafeAreaView, Stack.Screen options, StatusBar, LinearGradient bg
 *   - Back button (Profile zaten kendi header'ina sahip)
 *   - RefreshControl (Profile'in ScrollView'u yonetiyor)
 *
 * Nested scroll cozumu:
 *   - FlatList yerine map() + View (grid mode) — VirtualizedList warning yok
 *   - Grouped ScrollView yerine View (scrollEnabled gereksiz)
 *   - Film sayisi makul (<100) oldugu icin performans kabul edilebilir
 */
import React, { useCallback, useImperativeHandle, useMemo, useState, forwardRef } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';

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
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticSelection, hapticWarning } from '@/utils/haptics';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import WatchlistCard from '@/components/Watchlist/WatchlistCard';
import SessionAccordion from '@/components/Watchlist/SessionAccordion';
import FilmSeridi from '@/components/FilmReelAnimation';

import { styles, CARD_WIDTH, POSTER_HEIGHT } from './styles';

// ─── Tipler ───────────────────────────────────────────────────────────────────

type SortKey = 'recently_added' | 'highest_match' | 'title' | 'year';
type ViewMode = 'list' | 'grouped';
type WatchFilter = 'unwatched' | 'watched';

interface LongPressTarget {
  filmId: string;
  filmTitle: string;
}

/** Disaridan refresh tetiklemek icin ref handle */
export interface WatchlistSectionRef {
  refresh: () => Promise<void>;
}

// ─── WatchlistSection ──────────────────────────────────────────────────────

/**
 * Tam ozellikli watchlist section — Profile ScrollView icinde gomulu.
 * forwardRef ile disaridan refresh tetiklenebilir.
 */
const WatchlistSection = forwardRef<WatchlistSectionRef>(function WatchlistSection(_props, ref) {
  const { t } = useLanguage();
  const router = useRouter();

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
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadErrorType, setLoadErrorType] = useState<import('@/utils/errorHelpers').ErrorType>('unknown');

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

  /** Disaridan cagrilabilir refresh — Profile pull-to-refresh icin */
  const refresh = useCallback(async () => {
    await loadWatchlist();
    if (viewMode === 'grouped') {
      await loadGroups();
    }
  }, [loadWatchlist, loadGroups, viewMode]);

  // ref ile disariya ac
  useImperativeHandle(ref, () => ({ refresh }), [refresh]);

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
    }, [loadWatchlist]),
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
    <View style={styles.container}>
      {/* Section header — ikonlar (search, roulette, menu) */}
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeaderLeft}>
          {items.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{items.length}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerIcons}>
          {/* Roulette — header kisayol ikonu */}
          {items.length >= 3 && (
            <TouchableOpacity
              style={styles.iconBtn}
              activeOpacity={0.7}
              onPress={() => {
                hapticSelection();
                router.push('/roulette' as import('expo-router').Href);
              }}
            >
              <Ionicons name="dice-outline" size={20} color={Colors.gold} />
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
              size={20}
              color={Colors.textWhite}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => setMenuVisible(true)}
          >
            <Ionicons name="reorder-three-outline" size={22} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </View>

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
              <Text style={styles.clearSearch}>{'\u2715'}</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Chip Satiri: Gorunum toggle + (list modunda) siralama */}
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

      {/* ── Roulette CTA (>=3 film varsa) ── */}
      {!initialLoading && !loadError && items.length >= 3 && (
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
        <View style={styles.emptyContainer}>
          <EmptyState
            illustration={<FilmSeridi />}
            title={t('watchlist.emptyTitle')}
            subtitle={t('watchlist.emptySubtitle')}
            actionLabel={t('watchlist.discoverButton')}
            onAction={() => router.push('/(tabs)')}
          />
        </View>
      ) : viewMode === 'grouped' ? (
        /* Grouped view — ScrollView kaldırıldı, Profile ScrollView yönetiyor */
        <View style={styles.groupedContainer}>
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
        </View>
      ) : (
        /* Grid view — FlatList yerine map() + View (nested scroll sorunu yok) */
        <View style={styles.gridContainer}>
          {displayedItems.map((item, index) => (
            <WatchlistCard
              key={item.film.id}
              item={item}
              itemIndex={index}
              onLongPress={handleCardLongPress}
            />
          ))}
        </View>
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
              <Text style={styles.modalOptionText}>{t('watchlist.watched')} {'\u2713'}</Text>
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
    </View>
  );
});

export default WatchlistSection;
