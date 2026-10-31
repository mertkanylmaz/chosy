/**
 * Sonuç: "Bu akşamın filmi". ChampionReveal KULLANILMAZ (sunucu sahipli günlük gauntletId /
 * tarihe bağlı). Burada: Watch now, Nerede izlenir, Sonraya bırak (MANUEL watchlist),
 * paylaşım (mood'a özel metin), 3 yedek, Başka bir dörtlü, Daha hafif / Daha yoğun.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { QuietAction } from '@/components/gauntlet/QuietAction';
import { useWatchProviders } from '@/components/gauntlet/WatchProviders/useWatchProviders';
import { WatchProvidersRow } from '@/components/gauntlet/WatchProviders';
import { useLanguage } from '@/contexts/LanguageContext';
import { reasonFor, type MatchRow, type MoodNotice, type MoodSet } from '@/services/moodGauntlet';
import { addToWatchlist } from '@/services/watchlist';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { pickActionEvent, type MoodPickAction } from '@/utils/moodGauntletAnalytics';
import { normalizePosterUrl } from '@/utils/posterUrl';

import { styles } from './styles';
import { trackMoodEvent, type MoodStage } from './useMoodGauntlet';

type SaveState = 'idle' | 'saving' | 'saved';

interface ResultStageProps {
  champion: MatchRow;
  set: MoodSet;
  notices: MoodNotice[];
  onAnotherFour: () => void;
  onIntensify: (direction: 'lighter' | 'stronger') => void;
}

export function ResultStage({ champion, set, notices, onAnotherFour, onIntensify }: ResultStageProps): React.JSX.Element {
  const { t, region } = useLanguage();
  const router = useRouter();
  const providers = useWatchProviders(champion.id, region);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const track = useCallback((a: MoodPickAction) => trackMoodEvent(pickActionEvent(a)), []);
  const poster = normalizePosterUrl(champion.poster_url);
  const reason = reasonFor(set.reasons, champion.id);
  const year = champion.year ?? 0;
  const meta = [year > 0 ? String(year) : null, champion.runtime ? `${champion.runtime} min` : null]
    .filter((x): x is string => x !== null)
    .join(' · ');

  const openFilm = useCallback(
    (id: string) => {
      void hapticLight();
      router.push(`/film/${id}`);
    },
    [router],
  );

  const handleWatchNow = useCallback(() => {
    track('watch_now');
    openFilm(champion.id);
  }, [champion.id, openFilm, track]);

  /** MANUEL watchlist: yalnız bu dokunuşla yazılır (deste/swipe yolundaki otomatik yazım yok). */
  const handleSave = useCallback(async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    void hapticLight();
    track('later');
    try {
      await addToWatchlist({
        id: champion.id,
        title: champion.title,
        year,
        posterUrl: poster ?? '',
        matchScore: 0,
        moodTags: [],
        whyThisFilm: reason ?? '',
      });
      if (!mounted.current) return;
      setSaveState('saved');
      setNotice(t('moodGauntlet.saved'));
    } catch (err) {
      logger.error('[moodGauntlet] watchlist kaydi basarisiz', err, { code: 'MOOD_GAUNTLET_SAVE_FAILED' });
      if (!mounted.current) return;
      setSaveState('idle');
      setNotice(t('moodGauntlet.saveError'));
    }
  }, [saveState, champion, year, poster, reason, t, track]);

  const handleShare = useCallback(async () => {
    track('share');
    void hapticLight();
    const message =
      year > 0
        ? t('moodGauntlet.shareText', { title: champion.title, year })
        : t('moodGauntlet.shareTextNoYear', { title: champion.title });
    try {
      await Share.share({ message });
    } catch (err) {
      logger.error('[moodGauntlet] paylasim basarisiz', err, { code: 'MOOD_GAUNTLET_SHARE_FAILED' });
      if (mounted.current) setNotice(t('moodGauntlet.shareError'));
    }
  }, [champion.title, year, t, track]);

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.kicker}>{t('moodGauntlet.resultKicker')}</Text>
      <View style={styles.hero}>
        {poster !== null && <Image source={{ uri: poster }} style={styles.heroImage} contentFit="cover" />}
      </View>
      <Text style={styles.resultTitle} accessibilityRole="header">
        {champion.title}
      </Text>
      {meta.length > 0 && <Text style={styles.resultMeta}>{meta}</Text>}
      {reason !== null && <Text style={styles.resultReason}>{reason}</Text>}
      {notices.includes('max_runtime_dropped') && (
        <Text style={styles.notice}>{t('moodGauntlet.noticeRuntime')}</Text>
      )}

      <View style={styles.actions}>
        <WatchProvidersRow
          state={providers.state}
          providers={providers.providers}
          onRetry={providers.retry}
          filmId={champion.id}
          onSeeAll={() => track('where')}
        />
        <PrimaryAction label={t('moodGauntlet.watchNow')} onPress={handleWatchNow} />
        <View style={styles.actionRow}>
          <OutlineAction
            label={saveState === 'saved' ? t('moodGauntlet.saved') : t('moodGauntlet.saveForLater')}
            onPress={() => void handleSave()}
            disabled={saveState !== 'idle'}
          />
          <OutlineAction label={t('moodGauntlet.share')} onPress={() => void handleShare()} />
        </View>
        {notice !== null && <Text style={styles.shareNotice}>{notice}</Text>}
      </View>

      {set.backups.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('moodGauntlet.backupsTitle')}</Text>
          <View style={styles.backupRow}>
            {set.backups.map((b) => {
              const uri = normalizePosterUrl(b.poster_url);
              return (
                <TouchableOpacity
                  key={b.id}
                  style={styles.backupItem}
                  onPress={() => openFilm(b.id)}
                  accessibilityRole="button"
                  accessibilityLabel={b.title}
                >
                  <View style={styles.backupPoster}>
                    {uri !== null && <Image source={{ uri }} style={styles.heroImage} contentFit="cover" />}
                  </View>
                  <Text style={styles.backupTitle} numberOfLines={2}>
                    {b.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.actions}>
        <OutlineAction label={t('moodGauntlet.anotherFour')} onPress={onAnotherFour} />
        <View style={styles.actionRow}>
          <QuietAction label={t('moodGauntlet.lighter')} onPress={() => onIntensify('lighter')} />
          <QuietAction label={t('moodGauntlet.stronger')} onPress={() => onIntensify('stronger')} />
        </View>
      </View>
    </ScrollView>
  );
}

export type { MoodStage };
