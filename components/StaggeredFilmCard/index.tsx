/**
 * Basit film kartı — useStaggeredEntry ile kademeli giriş animasyonu.
 * FlatList renderItem içinde index prop'u ile kullanılır.
 */
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import Animated from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Film } from '@/types/film';
import { Colors } from '@/constants/Colors';
import { useStaggeredEntry } from '@/hooks/useStaggeredEntry';

interface StaggeredFilmCardProps {
  item: Film;
  index: number;
}

/**
 * Film posterini, başlığını ve meta bilgisini useStaggeredEntry animasyonuyla gösterir.
 */
export function StaggeredFilmCard({ item, index }: StaggeredFilmCardProps) {
  const router = useRouter();
  const animStyle = useStaggeredEntry(index, { delay: 60 });

  const posterUri = item.posterUrl
    ? item.posterUrl.startsWith('http')
      ? item.posterUrl
      : `https://image.tmdb.org/t/p/w500${item.posterUrl}`
    : undefined;

  return (
    <Animated.View style={[animStyle, styles.card]}>
      <TouchableOpacity
        onPress={() => router.push(`/film/${item.id}` as never)}
        activeOpacity={0.85}
      >
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
        <Text style={styles.title} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {item.year}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: 12,
    backgroundColor: Colors.cardSolid,
  },
  posterPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textWhite,
    marginTop: 8,
  },
  meta: {
    fontSize: 12,
    color: Colors.textGrey,
    marginTop: 4,
  },
});
