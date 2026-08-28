/**
 * DailyPickSection — Home Header'daki gunluk film onerisi bolumu.
 *
 * Mevcut DailyMatchCard'i sararak Home ekranina ozgu baslik ve layout ekler:
 *  - "TODAY'S PICK" ust baslik (section label)
 *  - Daha kisa aspect ratio (2.5:4) — scroll alanini korumak icin
 *  - FadeInDown.delay(300) stagger animasyonu
 *
 * Veri oncelik sirasi:
 *   1. getDailyMatchByPreferences — users.preferences_vector (calibration/retake gunceller)
 *   2. getDailyMatch(lastProfile) — son mood session fallback
 *   Her ikisi de AsyncStorage cache (gunluk) kullanir.
 *
 * Profile yoksa DailyMatchCard'in kendi EmptyCard'i gosterilir.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { supabase } from '@/services/supabase';
import { getDailyMatch, getDailyMatchByPreferences } from '@/services/dailyMatch';
import { getLastParsedProfile } from '@/services/profileService';
import { computeArchetype } from '@/services/archetypeEngine';
import * as watchlist from '@/services/watchlist';
import DailyMatchCard from '@/components/Profile/DailyMatchCard';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/utils/logger';

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
        .select('id, archetype_id')
        .eq('auth_id', authUser.id)
        .single();

      if (!userRow) {
        setLoading(false);
        return;
      }

      const row = userRow as { id: string; archetype_id: number | null };
      const userId: string = row.id;

      // Arketip ID'sini DB'den oku (retake sonrasi her zaman guncel)
      setArchetypeId(row.archetype_id);

      // Watchlist'ten gorulmus film ID'lerini al (servis auth'u dahili alir).
      // Yuklenemezse bolum cokmez, sadece "gorulmus" filtresi bos kalir —
      // en kotu ihtimalle zaten listede olan bir film onerilir.
      // Servis katmani hatayi Sentry'ye yazdi; burada tekrar yazmiyoruz.
      let seenIds: string[] = [];
      try {
        const watchlistItems = await watchlist.getWatchlist();
        seenIds = watchlistItems.map((w) => w.film.id);
      } catch (err) {
        logger.warn('[DailyPickSection] watchlist yuklenemedi, seen filtresi bos:', err);
      }

      // ── Oncelik 1: preferences_vector (calibration/retake her zaman gunceller) ──
      const prefFilm = await getDailyMatchByPreferences(userId, seenIds);
      if (prefFilm) {
        logger.log('[DailyPickSection] preferences_vector ile oneri:', prefFilm.title);
        setFilm(prefFilm);
        return;
      }

      // ── Oncelik 2: Son mood session profili (fallback) ──
      const tasteProfile = await getLastParsedProfile(userId);
      if (tasteProfile) {
        const dailyFilm = await getDailyMatch(userId, tasteProfile, seenIds);
        if (dailyFilm) {
          logger.log('[DailyPickSection] session profili ile oneri:', dailyFilm.title);
        }
        setFilm(dailyFilm);
        // Arketip hesaplamasi — sadece session fallback'inda gerekli
        if (!row.archetype_id) {
          setArchetypeId(computeArchetype(tasteProfile));
        }
        return;
      }

      // Her iki kaynak da bos — DailyMatchCard EmptyCard gosterir
      logger.log('[DailyPickSection] preferences_vector ve session profili yok');
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
