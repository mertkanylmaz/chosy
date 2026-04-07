/**
 * DailyPickSection — Home Header'daki gunluk film onerisi bolumu.
 *
 * Mevcut DailyMatchCard'i sararak Home ekranina ozgu baslik ve layout ekler:
 *  - "TODAY'S PICK" ust baslik (section label)
 *  - Daha kisa aspect ratio (2.5:4) — scroll alanini korumak icin
 *  - FadeInDown.delay(300) stagger animasyonu
 *
 * Veri: getDailyMatch() via AsyncStorage cache (gunluk).
 * Profile yoksa DailyMatchCard'in kendi EmptyCard'i gosterilir.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { supabase } from '@/services/supabase';
import { getDailyMatch } from '@/services/dailyMatch';
import { getLastParsedProfile } from '@/services/profileService';
import { computeArchetype } from '@/services/archetypeEngine';
import * as watchlist from '@/services/watchlist';
import DailyMatchCard from '@/components/Profile/DailyMatchCard';
import { useLanguage } from '@/contexts/LanguageContext';

import type { Film } from '@/types/film';

import { styles } from './styles';

// ─── Bilesen ──────────────────────────────────────────────────────────────────

/**
 * Home Header icin gunluk film onerisi wrapper'i.
 * Kendi async yukleme state'ini yonetir; hata durumunda DailyMatchCard EmptyCard gosterir.
 */
export default function DailyPickSection() {
  const { t } = useLanguage();

  const [film, setFilm] = useState<Film | null>(null);
  const [archetypeId, setArchetypeId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  /** Kullanici icin gunluk filmi ve arketip ID'sini yukler */
  const loadDailyPick = useCallback(async () => {
    try {
      // Auth kullanici -> users tablosu
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (!authUser) {
        setLoading(false);
        return;
      }

      const { data: userRow } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', authUser.id)
        .single();

      if (!userRow) {
        setLoading(false);
        return;
      }

      const userId: string = (userRow as { id: string }).id;

      // Son parsed profil ve arketip
      const tasteProfile = await getLastParsedProfile(userId);
      const archId = computeArchetype(tasteProfile);
      setArchetypeId(archId);

      if (!tasteProfile) {
        setLoading(false);
        return;
      }

      // Watchlist'ten gorulmus film ID'lerini al (servis auth'u dahili alir)
      const watchlistItems = await watchlist.getWatchlist();
      const seenIds = watchlistItems.map((w) => w.film.id);

      // Gunluk oneriyi getir (cache'li)
      const dailyFilm = await getDailyMatch(userId, tasteProfile, seenIds);
      setFilm(dailyFilm);
    } catch {
      // Hata sessizce gec — DailyMatchCard EmptyCard gosterir
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDailyPick();
  }, [loadDailyPick]);

  return (
    <Animated.View
      entering={FadeInDown.delay(300).duration(400).springify()}
      style={styles.container}
    >
      {/* Section baslik */}
      <View style={styles.sectionHeader}>
        <Animated.Text style={styles.sectionLabel}>
          {t('home.dailyPick')}
        </Animated.Text>
      </View>

      {/* DailyMatchCard — 2.5:4 aspect ratio override icin wrapper */}
      <View style={styles.cardWrapper}>
        <DailyMatchCard
          film={film}
          loading={loading}
          archetypeId={archetypeId}
        />
      </View>
    </Animated.View>
  );
}
