/**
 * Watchlist ekranı — design-reference/04-watchlist.png piksel uyumu.
 * 2-sütunlu film grid, filtre chip'leri, arama, menü, uzun basma modal menüsü.
 * Mikro etkileşimler: giriş/çıkış animasyonları, long press wobble, pull-to-refresh.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
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
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { hapticMedium } from '@/utils/haptics';
import { hapticSelection, hapticWarning } from '@/utils/haptics';

import Animated, {
  FadeInDown,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  useReducedMotion,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Film } from '@/types/film';
import { clearWatchlist, getWatchlist, removeFromWatchlist, WatchlistItem } from '@/services/watchlist';
import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';
import SkeletonLoader from '@/components/SkeletonLoader';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';

// ─── Sabitler ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_H_PAD = 20;
const GRID_COL_GAP = 12;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_H_PAD * 2 - GRID_COL_GAP) / 2;
const POSTER_HEIGHT = CARD_WIDTH * 1.5;
type SortKey = 'recently_added' | 'highest_match' | 'title' | 'year';

interface LongPressTarget {
  filmId: string;
  filmTitle: string;
}

/** ISO tarih → "Oct 12, 2023" */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── WatchlistCard ────────────────────────────────────────────────────────────

interface WatchlistCardProps {
  item: WatchlistItem;
  itemIndex: number;
  onLongPress: (filmId: string, filmTitle: string) => void;
}

/**
 * Tek film kartı.
 * Giriş: FadeInDown animasyonu (stagger ile).
 * Çıkış: FadeOut (Reanimated exiting prop).
 * Long press: wobble + haptic.
 */
const WatchlistCard = React.memo(function WatchlistCard({
  item,
  itemIndex,
  onLongPress,
}: WatchlistCardProps) {
  const { film } = item;
  const router = useRouter();
  const isReducedMotion = useReducedMotion();
  const rotation = useSharedValue(0);
  const staggerStyle = useStaggeredEntry(itemIndex, { delay: 60, baseDelay: 0 });

  const handlePress = useCallback(() => {
    if (!film?.id) return;
    router.push(`/film/${film.id}` as never);
  }, [router, film.id]);

  const handleLongPress = useCallback(() => {
    onLongPress(film.id, film.title);
    hapticMedium();

    if (!isReducedMotion) {
      rotation.value = withSequence(
        withTiming(-4, { duration: 55 }),
        withRepeat(
          withSequence(
            withTiming(4, { duration: 55 }),
            withTiming(-4, { duration: 55 }),
          ),
          3,
          false,
        ),
        withTiming(0, { duration: 55 }),
      );
    }
  }, [onLongPress, film.id, film.title, isReducedMotion, rotation]);

  const wobbleStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const genre = film.moodTags[0] ?? null;
  const meta = genre ? `${film.year} · ${genre}` : String(film.year);
  const posterUri = film.posterUrl
    ? film.posterUrl.startsWith('http')
      ? film.posterUrl
      : `https://image.tmdb.org/t/p/w500${film.posterUrl}`
    : undefined;

  return (
    <Animated.View
      exiting={isReducedMotion ? undefined : FadeOut.duration(250)}
      style={[isReducedMotion ? undefined : staggerStyle, wobbleStyle, styles.card]}
    >
      <TouchableOpacity
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.85}
        delayLongPress={400}
      >
        {/* Poster */}
        {posterUri ? (
          <Image
            source={{ uri: posterUri }}
            style={styles.poster}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
          />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]}>
            <Ionicons name="film-outline" size={32} color={Colors.textGrey} />
          </View>
        )}
        {/* İsim */}
        <Text style={styles.cardTitle} numberOfLines={1}>
          {film.title}
        </Text>
        {/* Yıl · Tür */}
        <Text style={styles.cardMeta} numberOfLines={1}>
          {meta}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
});

// ─── Bileşen ──────────────────────────────────────────────────────────────────

/**
 * Kullanıcının kaydettiği filmleri 2-sütunlu grid'de listeler.
 */
export default function WatchlistScreen() {
  const { t } = useLanguage();
  const router = useRouter();

  const headerAnimStyle = useStaggeredEntry(0);
  const chipsAnimStyle = useStaggeredEntry(1);

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('recently_added');
  const [menuTarget, setMenuTarget] = useState<LongPressTarget | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadErrorType, setLoadErrorType] = useState<import('@/utils/errorHelpers').ErrorType>('unknown');

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

  useFocusEffect(
    useCallback(() => {
      loadWatchlist();
    }, [loadWatchlist]),
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadWatchlist();
    setIsRefreshing(false);
  }, [loadWatchlist]);

  const displayedItems = useMemo((): WatchlistItem[] => {
    const filtered =
      searchQuery.length > 0
        ? items.filter((item) =>
            item.film.title.toLowerCase().includes(searchQuery.toLowerCase()),
          )
        : items;

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
  }, [items, sortKey, searchQuery]);

  const handleRemove = useCallback(async (filmId: string) => {
    setMenuTarget(null);
    hapticWarning();
    // Optimistik: kaldır, hata olursa geri ekle
    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.film.id !== filmId));
    try {
      await removeFromWatchlist(filmId);
    } catch (err) {
      if (__DEV__) {
        console.error('[Watchlist] remove error:', err);
      }
      // Rollback — önceki listeyi geri yükle
      setItems(snapshot);
      Alert.alert(t('errors.generic'), t('errors.watchlistRemove'));
    }
  }, [items, t]);

  const handleClearAll = useCallback(() => {
    setMenuVisible(false);
    Alert.alert(
      'Clear Watchlist',
      'Are you sure you want to remove all saved movies?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const snapshot = items;
            setItems([]);
            try {
              await clearWatchlist();
            } catch (err) {
              if (__DEV__) {
                console.error('[Watchlist] clear error:', err);
              }
              setItems(snapshot);
              Alert.alert(t('errors.generic'), t('errors.watchlistClear'));
            }
          },
        },
      ],
    );
  }, []);

  const handleCardLongPress = useCallback(
    (filmId: string, filmTitle: string) => {
      setMenuTarget({ filmId, filmTitle });
    },
    [],
  );

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.background, Colors.backgroundGradient]}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />

      {/* Header — başlık + ikonlar */}
      <Animated.View style={headerAnimStyle}>
      <View style={styles.header}>
        <Text style={styles.title}>Watchlist</Text>
        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => {
              setSearchVisible((v) => !v);
              if (searchVisible) setSearchQuery('');
            }}>
            <Ionicons
              name={searchVisible ? 'close-outline' : 'search-outline'}
              size={22}
              color={Colors.textWhite}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            activeOpacity={0.7}
            onPress={() => setMenuVisible(true)}>
            <Ionicons name="reorder-three-outline" size={24} color={Colors.textWhite} />
          </TouchableOpacity>
        </View>
      </View>
      </Animated.View>

      {/* Arama Çubuğu */}
      {searchVisible && (
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search your watchlist..."
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

      {/* Filtre Chip'leri */}
      <Animated.View style={chipsAnimStyle}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsContent}>
          {(['recently_added', 'highest_match'] as SortKey[]).map((key) => {
            const active = sortKey === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                onPress={() => { hapticSelection(); setSortKey(key); }}
                activeOpacity={0.8}>
                <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                  {key === 'recently_added' ? 'Recently added' : 'Highest mood match'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {/* İçerik */}
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
          lumiMood="searching"
          title="No films saved yet"
          subtitle="Swipe right on films you love to save them here"
          actionLabel="Discover Films"
          onAction={() => router.push('/(tabs)/mood')}
        />
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
          removeClippedSubviews={true}
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

      {/* Uzun Basma Modal Menüsü */}
      <Modal
        visible={menuTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuTarget(null)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuTarget(null)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalFilmTitle} numberOfLines={1}>
              {menuTarget?.filmTitle}
            </Text>
            <TouchableOpacity style={styles.modalOption} activeOpacity={0.7}>
              <Text style={styles.modalOptionText}>Watched ✓</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalOption} activeOpacity={0.7}>
              <Text style={styles.modalOptionText}>Add to List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, styles.modalOptionLast]}
              activeOpacity={0.7}
              onPress={() => menuTarget && handleRemove(menuTarget.filmId)}>
              <Text style={[styles.modalOptionText, styles.modalOptionTextRed]}>
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ☰ Menü Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setSortKey('title');
                setMenuVisible(false);
              }}>
              <Text style={[styles.menuItemText, sortKey === 'title' && styles.menuItemTextActive]}>
                Sort by Title
              </Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setSortKey('year');
                setMenuVisible(false);
              }}>
              <Text style={[styles.menuItemText, sortKey === 'year' && styles.menuItemTextActive]}>
                Sort by Year
              </Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={handleClearAll}>
              <Text style={styles.menuItemTextRed}>Clear All</Text>
            </Pressable>
            <Pressable
              style={[styles.menuItem, styles.menuItemLast]}
              onPress={() => setMenuVisible(false)}>
              <Text style={styles.menuItemTextGrey}>Cancel</Text>
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
    paddingBottom: 90,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 4,
    paddingHorizontal: 20,
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

  /* Başlık */
  title: {
    fontSize: 32,
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
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
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
  },
  chip: {
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: Colors.gold,
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
    color: Colors.background,
  },
  chipTextInactive: {
    color: Colors.textGrey,
  },

  /* FlatList */
  list: {
    flex: 1,
    marginTop: 20,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  columnWrapper: {
    gap: GRID_COL_GAP,
    marginBottom: 20,
  },

  /* Film Kartı */
  card: {
    flex: 1,
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 14,
    backgroundColor: Colors.cardSolid,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: 10,
    lineHeight: 19,
  },
  cardMeta: {
    fontSize: 12,
    color: Colors.textGrey,
    marginTop: 3,
    lineHeight: 16,
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

  /* Boş durum */
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textWhite,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textGrey,
  },
  retryBtn: {
    marginTop: 12,
    backgroundColor: Colors.gold,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: '700',
  },

  /* Uzun basma modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
    paddingBottom: 110,
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
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalOption: {
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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

  /* ☰ Menü modal */
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
    borderBottomColor: 'rgba(255,255,255,0.06)',
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
