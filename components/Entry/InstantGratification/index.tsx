/**
 * InstantGratification — geri gelen kullanıcılar için kişiselleştirilmiş giriş (Varyasyon 2).
 * tonight_pick RPC'den film alır, poster arka plan üzerinde gösterir.
 * Film yoksa veya profil boşsa EmotionalHook'a fallback yapar.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTonightPick } from '@/services/profileService';
import { supabase } from '@/services/supabase';
import type { TonightPick } from '@/types/profile';

import EmotionalHook from '../EmotionalHook';
import styles from './styles';

/** TMDb poster URL öneki */
const TMDB_BASE = 'https://image.tmdb.org/t/p/w780';

/**
 * Geri gelen kullanıcılar için kişiselleştirilmiş giriş ekranı.
 * Film posteri tam ekran arka plan olarak kullanılır.
 */
export default function InstantGratification() {
  const router = useRouter();
  const { t } = useLanguage();
  const [pick, setPick] = useState<TonightPick | null>(null);
  const [loading, setLoading] = useState(true);

  /** Öneri sebebine göre AI açıklama metni döner */
  function getPickDescription(reason: TonightPick['reason']): string {
    switch (reason) {
      case 'preference_match': return t('entry.pickDescPreferenceMatch');
      case 'hidden_gem':       return t('entry.pickDescHiddenGem');
      case 'director_favorite':return t('entry.pickDescDirectorFav');
      case 'trending':         return t('entry.pickDescTrending');
      default:                 return t('entry.pickDescDefault');
    }
  }

  useEffect(() => {
    async function loadPick() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user) return;

        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('auth_id', authData.user.id)
          .single();

        if (!userRow) return;

        const result = await getTonightPick((userRow as { id: string }).id);
        setPick(result);
      } catch (err) {
        if (__DEV__) {
          console.error('[InstantGratification] tonight_pick yükleme hatası:', err);
        }
      } finally {
        setLoading(false);
      }
    }

    loadPick();
  }, []);

  if (loading) {
    return (
      <LinearGradient colors={[Colors.background, Colors.bgCard]} style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.gold} size="large" />
      </LinearGradient>
    );
  }

  // Film yoksa EmotionalHook'a fallback
  if (!pick) {
    return <EmotionalHook />;
  }

  const posterUri = pick.poster_url ? `${TMDB_BASE}${pick.poster_url}` : null;
  const matchPercent = Math.round(pick.similarity * 100);

  const content = (
    <>
      {/* Üst gradient overlay */}
      <LinearGradient
        colors={['rgba(10,14,39,0.85)', 'rgba(10,14,39,0.2)', 'transparent']}
        style={styles.topOverlay}
        pointerEvents="none"
      />
      {/* Alt gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(10,14,39,0.75)', 'rgba(10,14,39,0.97)']}
        style={styles.bottomOverlay}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Üst bar */}
        <View style={styles.topBar}>
          <Text style={styles.logo}>chosy.ai</Text>
          <TouchableOpacity
            onPress={() => router.replace('/(tabs)')}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>{t('entry.skip')}</Text>
          </TouchableOpacity>
        </View>

        {/* Film bilgisi */}
        <View style={styles.filmInfo}>
          <Text style={styles.matchLabel}>{t('entry.tonightsMoodMatch')}</Text>
          <Text style={styles.filmTitle}>{pick.title}</Text>
          <Text style={styles.matchScore}>{t('discover.matchScore', { score: matchPercent })}</Text>
          <Text style={styles.aiDescription}>{getPickDescription(pick.reason)}</Text>
        </View>

        {/* CTA butonları */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButtonTouch}
            onPress={() => { if (pick.film_id) router.push(`/film/${pick.film_id}`); }}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark]}
              style={styles.primaryButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.primaryButtonText}>{t('entry.startWatching')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace('/(tabs)')}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>{t('entry.seeMoreLikeThis')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );

  if (posterUri) {
    return (
      <ImageBackground
        source={{ uri: posterUri }}
        style={styles.container}
        resizeMode="cover"
      >
        {content}
      </ImageBackground>
    );
  }

  return (
    <LinearGradient colors={[Colors.background, Colors.bgCard, Colors.bgCard]} style={styles.container}>
      {content}
    </LinearGradient>
  );
}

declare const __DEV__: boolean;
