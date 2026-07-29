/**
 * HubHero — Games Hub'in ust bandi (Festival Layer).
 *
 * Selamlama eyebrow → serif rank adi → rank ilerlemesi · sagda DNA amblemi.
 * Altta gunun ozeti: kac oyun oynandi, streak, freeze.
 *
 * Not: urunde "Level/XP" diye bir veri YOK. Mockup'taki level satiri yerine
 * gercek rank ilerlemesi gosteriliyor (cinema_dna + app_config.dna_config).
 */
import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Fire, Snowflake } from 'phosphor-react-native';

import { Colors } from '@/constants/Colors';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CinemaDna, RankProgressInfo } from '@/hooks/useCinemaDna';

import { styles } from './styles';

interface HubHeroProps {
  /** null ise henuz oyun oynanmamis — notr karsilama gosterilir */
  dna: CinemaDna | null;
  /** null ise rank config okunamadi — ilerleme cubugu gizlenir */
  progress: RankProgressInfo | null;
  /** Kullanicinin adi — null ise isimsiz selamlama */
  displayName: string | null;
  /** Bugun oynanan oyun sayisi */
  playedCount: number;
  /** Toplam acik oyun sayisi */
  totalGames: number;
  /** En uzun aktif streak */
  streak: number;
  /** Kalan streak freeze hakki */
  freezes: number;
}

/** locales'te tanimli en yuksek rank — games.rank.* ile senkron tutulur */
const MAX_RANK_ID = 6;

/** Saate gore selamlama anahtarini secer */
function greetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 6) return 'home.greetingNight';
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

/**
 * Games Hub'in kimlik bandi. DNA verisi yoksa da render edilir —
 * yeni kullanici bos bir ekran yerine selamlama gorur.
 */
export function HubHero({
  dna,
  progress,
  displayName,
  playedCount,
  totalGames,
  streak,
  freezes,
}: HubHeroProps): React.JSX.Element {
  const { t } = useLanguage();

  const greeting = displayName
    ? `${t(greetingKey())}, ${displayName}`
    : t(greetingKey());

  // Sunucu yeni bir rank eklerse cevirisi olmayan anahtar ekranda ham string
  // olarak gorunur — araligi kirparak bunu engelliyoruz.
  const rankId = Math.min(Math.max(dna?.rank_id ?? 1, 1), MAX_RANK_ID);
  const rankName = t(`games.rank.${rankId}`);

  /** Ilerleme ipucu — kullaniciyi baglayan kosulu soyler */
  let progressHint: string | null = null;
  if (progress?.isMaxRank) {
    progressHint = t('games.hub.rank_max');
  } else if (progress?.blockedBy === 'dailies') {
    progressHint = t('games.hub.rank_progress_dailies', {
      count: progress.dailiesNeeded,
    });
  } else if (progress) {
    progressHint = t('games.hub.rank_progress_accuracy');
  }

  return (
    <Animated.View entering={FadeInUp.duration(300)} style={styles.container}>
      <View style={styles.textBlock}>
        <Text style={styles.greeting} numberOfLines={1}>
          {greeting}
        </Text>
        <Text style={styles.rankName} numberOfLines={1} accessibilityRole="header">
          {rankName}
        </Text>
        {dna?.identity_title ? (
          <Text style={styles.identityTitle} numberOfLines={1}>
            {dna.identity_title}
          </Text>
        ) : null}

        {/* Rank ilerlemesi — config okunamadiysa hic gosterilmez */}
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

        {/* Gunun ozeti */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Text style={styles.metaText}>
              {playedCount}/{totalGames} {t('games.hub.played')}
            </Text>
          </View>
          {streak > 0 ? (
            <View style={styles.metaItem}>
              <Fire size={13} weight="duotone" color={Colors.gold} />
              <Text style={styles.metaText}>{streak}</Text>
            </View>
          ) : null}
          {freezes > 0 ? (
            <View style={styles.metaItem}>
              <Snowflake size={13} weight="duotone" color={Colors.textSecondary} />
              <Text style={styles.metaText}>{freezes}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* DNA amblemi — festival rozeti */}
      {dna ? (
        <View style={styles.emblem} accessibilityRole="image" accessibilityLabel={rankName}>
          <Text style={styles.emblemScore}>{Math.round(dna.cinema_score)}</Text>
          <Text style={styles.emblemLabel}>{t('games.hub.dna_emblem_label')}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}
