/**
 * CinemaIdentity — Profilin oyun kimligi bolumu (Festival Layer).
 *
 * Profil bugune kadar mood/watchlist odakliydi ve oyun sistemine hic bagli
 * degildi. Bu kart Cinema DNA'yi profile getirir: serif kimlik adi, rank ve
 * ilerlemesi, 6 boyutlu radar.
 *
 * Veri Hub ile ayni kaynaktan gelir (useCinemaDna) — ayri sorgu yok.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { useLanguage } from '@/contexts/LanguageContext';
import { useCinemaDna } from '@/hooks/useCinemaDna';

import { DnaRadar } from './DnaRadar';
import { styles } from './styles';

/** locales'te tanimli en yuksek rank — games.rank.* ile senkron */
const MAX_RANK_ID = 6;

/**
 * Kullanicinin sinema kimligi karti.
 *
 * Henuz oyun oynamamis kullanicida (DNA satiri yok) null doner — profilde
 * bos bir kart birakmaz.
 */
export function CinemaIdentity(): React.JSX.Element | null {
  const { t } = useLanguage();
  const { dna, progress, loading, error } = useCinemaDna();

  // Yukleniyor veya hic DNA yok → bolum hic gorunmez
  if (loading || (!dna && !error)) return null;

  if (error) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t('profile.cinemaIdentity')}</Text>
        <Text style={styles.emptyText}>{t('games.result.error_subtitle')}</Text>
      </View>
    );
  }

  if (!dna) return null;

  const rankId = Math.min(Math.max(dna.rank_id, 1), MAX_RANK_ID);

  let progressHint: string | null = null;
  if (progress?.isMaxRank) {
    progressHint = t('games.hub.rank_max');
  } else if (progress?.blockedBy === 'dailies') {
    progressHint = t('games.hub.rank_progress_dailies', { count: progress.dailiesNeeded });
  } else if (progress) {
    progressHint = t('games.hub.rank_progress_accuracy');
  }

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{t('profile.cinemaIdentity')}</Text>

      <View style={styles.identityRow}>
        <View style={styles.identityText}>
          {/* identity_title sunucudan gelir; yoksa rank adi basliga gecer */}
          <Text style={styles.identityTitle} numberOfLines={2}>
            {dna.identity_title ?? t(`games.rank.${rankId}`)}
          </Text>
          {dna.identity_title ? (
            <Text style={styles.rankName}>{t(`games.rank.${rankId}`)}</Text>
          ) : null}
        </View>

        <View style={styles.emblem}>
          <Text style={styles.emblemScore}>{Math.round(dna.cinema_score)}</Text>
          <Text style={styles.emblemLabel}>{t('games.hub.dna_emblem_label')}</Text>
        </View>
      </View>

      {/* Rank ilerlemesi — config okunamadiysa gosterilmez */}
      {progress && !progress.isMaxRank ? (
        <View style={styles.progressBlock}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.round(progress.ratio * 100)}%` }]}
            />
          </View>
          {progressHint ? <Text style={styles.progressHint}>{progressHint}</Text> : null}
        </View>
      ) : null}

      <DnaRadar dna={dna} />
    </View>
  );
}
