/**
 * Archive — kaçırılan günler (K-46, R-C Parça 2b).
 *
 * `get-archive-status` ne döndürüyorsa onu gösterir. Bu ekran HİÇBİR ŞEY
 * TÜRETMEZ: kaçırılan gün sayısı, pencere sınırı ve uygunluk kararı sunucuda
 * hesaplanır (bkz. supabase/functions/get-archive-status). İstemcide tarih
 * aritmetiği yapmak, iki istemci sürümünün iki farklı sayı üretmesi demekti.
 *
 * ── Bu ekranda gauntlet OYNANMAZ ────────────────────────────────────────────
 * Yalnızca görüntüleme. `submit-choice` bugünün gauntlet'ine kilitlidir ve o
 * sözleşme bu turda açılmıyor. Gösterilen dörtlü, o günün `scope='global'`
 * seçkisidir — gerçek ama KİŞİSELLEŞTİRİLMEMİŞ içerik. Kopya bunu dürüstçe
 * söyler ("o gün herkese gösterilen seçki"); "senin için seçilenler" demek
 * var olmayan bir özelliği satmak olurdu (R-16 ile aynı gerekçe).
 *
 * ── Hata ve boşluk dalları ──────────────────────────────────────────────────
 * Yükleme hatası boş liste olarak GÖSTERİLMEZ (Kural 1): açık hata + retry.
 * Pencere dışı geçmiş sessizce gizlenmez, `too_old` bölümüyle açıkça kapanır
 * (K-43 tonu). Global seçkisi bulunamayan gün `unavailable` olarak görünür.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { getArchiveStatus, type ArchiveDay, type ArchiveStatus } from '@/services/gauntletService';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';

/** Gün başlığı — cihaz yereline göre biçimlenir, sunucudan gelen anahtar UTC. */
function formatDay(dateKey: string, locale: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return d.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

export default function Archive() {
  const { t, language } = useLanguage();
  const [status, setStatus] = useState<ArchiveStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await getArchiveStatus();
      setStatus(result);
      posthogAnalytics.track('archive_viewed', {
        missed_count: result.missedCount,
        completed_count: result.completedCount,
        eligible: result.archiveEligible,
      });
    } catch {
      // Servis katmanı Sentry'ye zaten yazdı — burada tekrar loglanmaz,
      // ekran yalnız kullanıcıya görünür hata dalını kurar.
      setStatus(null);
      setLoadError(t('archive.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClose = useCallback(() => {
    void hapticLight();
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, []);

  const missedDays = (status?.days ?? []).filter((d) => d.status === 'missed');
  const tooOld = (status?.days ?? []).find((d) => d.status === 'too_old');

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('archive.title')}</Text>
          <Text style={styles.subtitle}>{t('archive.subtitle')}</Text>
        </View>
        <TouchableOpacity
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t('archive.close')}
          hitSlop={12}
        >
          <Text style={styles.close}>{t('archive.close')}</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.gold} />
          <Text style={styles.centeredText}>{t('archive.loading')}</Text>
        </View>
      )}

      {!loading && loadError !== null && (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retry}
            onPress={() => void load()}
            accessibilityRole="button"
          >
            <Text style={styles.retryText}>{t('archive.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {!loading && loadError === null && (
        <ScrollView contentContainerStyle={styles.list}>
          {missedDays.length === 0 && (
            <Text style={styles.empty}>{t('archive.empty')}</Text>
          )}

          {missedDays.map((day) => (
            <DayCard key={day.date} day={day} locale={language} t={t} />
          ))}

          {tooOld !== undefined && (
            <View style={styles.tooOldBlock}>
              <Text style={styles.tooOldTitle}>{t('archive.tooOldTitle')}</Text>
              <Text style={styles.tooOldText}>
                {t('archive.tooOld', { date: formatDay(tooOld.date, language) })}
              </Text>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Gün kartı ───────────────────────────────────────────────────────────────

interface DayCardProps {
  day: ArchiveDay;
  locale: string;
  t: (key: string, options?: Record<string, unknown>) => string;
}

function DayCard({ day, locale, t }: DayCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDay(day.date, locale)}</Text>
        <Text style={styles.cardBadge}>{t('archive.dayMissed')}</Text>
      </View>

      {day.unavailable === true ? (
        <Text style={styles.unavailable}>{t('archive.unavailable')}</Text>
      ) : (
        <>
          <Text style={styles.selectionLabel}>{t('archive.selectionLabel')}</Text>
          <View style={styles.posterRow}>
            {(day.globalFilms ?? []).map((film) => (
              <View key={film.id} style={styles.posterCell}>
                <Image
                  source={{ uri: film.posterUrl }}
                  style={styles.poster}
                  contentFit="cover"
                  accessibilityLabel={film.title}
                />
                <Text style={styles.posterTitle} numberOfLines={2}>
                  {film.title}
                </Text>
                <Text style={styles.posterMeta} numberOfLines={1}>
                  {t('archive.filmMeta', { year: film.year, runtime: film.runtime })}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.lg,
    paddingTop: Theme.spacing.md,
    paddingBottom: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  headerText: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  title: {
    ...Theme.typography.h1,
    fontSize: 26,
    color: Colors.textWhite,
  },
  subtitle: {
    ...Theme.typography.body,
    color: Colors.textGrey,
  },
  close: {
    ...Theme.typography.body,
    color: Colors.gold,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.xl,
  },
  centeredText: {
    ...Theme.typography.body,
    color: Colors.textGrey,
  },
  errorText: {
    ...Theme.typography.body,
    color: Colors.textWhite,
    textAlign: 'center',
  },
  retry: {
    paddingHorizontal: Theme.spacing.lg,
    paddingVertical: Theme.spacing.sm,
    borderRadius: Theme.borderRadius.md,
    borderWidth: 1,
    borderColor: Colors.goldHairline,
  },
  retryText: {
    ...Theme.typography.body,
    color: Colors.gold,
  },
  list: {
    paddingHorizontal: Theme.spacing.lg,
    paddingBottom: 83,
    gap: Theme.spacing.lg,
  },
  empty: {
    ...Theme.typography.body,
    color: Colors.textGrey,
    textAlign: 'center',
    paddingVertical: Theme.spacing.xl,
  },
  card: {
    backgroundColor: Colors.cardSolid,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Theme.spacing.sm,
  },
  cardDate: {
    ...Theme.typography.h3,
    color: Colors.textWhite,
    flexShrink: 1,
  },
  cardBadge: {
    ...Theme.typography.caption,
    color: Colors.textLightGrey,
  },
  selectionLabel: {
    ...Theme.typography.caption,
    color: Colors.textGrey,
  },
  posterRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  posterCell: {
    flex: 1,
    gap: Theme.spacing.xs,
  },
  poster: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderRadius: Theme.borderRadius.md,
    backgroundColor: Colors.bgElevated,
  },
  posterTitle: {
    ...Theme.typography.caption,
    color: Colors.textWhite,
  },
  posterMeta: {
    ...Theme.typography.caption,
    color: Colors.textLightGrey,
  },
  unavailable: {
    ...Theme.typography.body,
    color: Colors.textGrey,
  },
  tooOldBlock: {
    gap: Theme.spacing.xs,
    paddingTop: Theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
  },
  tooOldTitle: {
    ...Theme.typography.h3,
    color: Colors.textGrey,
  },
  tooOldText: {
    ...Theme.typography.body,
    color: Colors.textLightGrey,
  },
});
