/**
 * Sonuç: "Bu akşamın filmi". ChampionReveal KULLANILMAZ (sunucu sahipli günlük gauntletId /
 * tarihe bağlı) — yalnız hareket dili ödünç alınır: poster belirir → başlık → meta, aynı
 * `BLACKOUT_SEQUENCE` gecikmeleri (kara boşluk YOK, kısa reveal). Watch now altın birincil;
 * Sonraya bırak (MANUEL watchlist) ve Paylaş (mood'a özel metin) ikincil; 3 yedek;
 * Başka bir dörtlü; Daha hafif / Daha yoğun belirgin çipler.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Lightning, Wind } from 'phosphor-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { OutlineAction } from '@/components/gauntlet/OutlineAction';
import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { useWatchProviders } from '@/components/gauntlet/WatchProviders/useWatchProviders';
import { WatchProvidersRow } from '@/components/gauntlet/WatchProviders';
import { color, size } from '@/constants/design/semantic';
import {
  BLACKOUT_SEQUENCE,
  DISSOLVE_DURATION,
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
} from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { reasonFor, type IntensityDirection, type MatchRow, type MoodNotice } from '@/services/moodGauntlet';
import { addToWatchlist } from '@/services/watchlist';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';
import { pickActionEvent, type MoodPickAction } from '@/utils/moodGauntletAnalytics';
import { resolveWatchTarget } from '@/utils/moodWatchTarget';
import { normalizePosterUrl } from '@/utils/posterUrl';

import { styles } from './styles';
import { trackMoodEvent } from './useMoodGauntlet';

type SaveState = 'idle' | 'saving' | 'saved';

interface ResultStageProps {
  champion: MatchRow;
  backups: MatchRow[];
  /** film id → gerekçe (arkadan dolar; yoksa satır çizilmez). */
  reasons: Record<string, string>;
  notices: MoodNotice[];
  canLighter: boolean;
  canStronger: boolean;
  onAnotherFour: () => void;
  onIntensify: (direction: IntensityDirection) => void;
}

interface ChipProps {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

function IntensityChip({ label, disabled, onPress, children }: ChipProps): React.JSX.Element {
  return (
    <TouchableOpacity
      style={[styles.chip, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
    >
      {children}
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ResultStage({
  champion,
  backups,
  reasons,
  notices,
  canLighter,
  canStronger,
  onAnotherFour,
  onIntensify,
}: ResultStageProps): React.JSX.Element {
  const { t, region } = useLanguage();
  const router = useRouter();
  const reduced = useReducedMotion();
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

  // Reveal: poster belirir (hafif ölçek oturması) → başlık → meta. Reduce Motion: kısa çapraz geçiş.
  const posterOpacity = useSharedValue(0);
  const posterScale = useSharedValue(reduced ? 1 : 1.04);
  const titleOpacity = useSharedValue(0);
  const metaOpacity = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      const fade = { duration: REDUCED_MOTION_DURATION.crossFade };
      posterOpacity.value = withTiming(1, fade);
      titleOpacity.value = withTiming(1, fade);
      metaOpacity.value = withTiming(1, fade);
      return;
    }
    const fade = { duration: DISSOLVE_DURATION.newContender, easing: EASE_OUT_QUART };
    posterOpacity.value = 0;
    titleOpacity.value = 0;
    metaOpacity.value = 0;
    posterScale.value = 1.04;
    posterOpacity.value = withTiming(1, fade);
    posterScale.value = withTiming(1, fade);
    titleOpacity.value = withDelay(BLACKOUT_SEQUENCE.titleDelay, withTiming(1, fade));
    metaOpacity.value = withDelay(BLACKOUT_SEQUENCE.titleDelay + BLACKOUT_SEQUENCE.metaDelay, withTiming(1, fade));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion.id, reduced]);
  const posterStyle = useAnimatedStyle(() => ({
    opacity: posterOpacity.value,
    transform: [{ scale: posterScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaOpacity.value }));

  const track = useCallback((a: MoodPickAction) => trackMoodEvent(pickActionEvent(a)), []);
  const poster = normalizePosterUrl(champion.poster_url);
  const reason = reasonFor(reasons, champion.id);
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

  /**
   * Watch now: bölgedeki sağlayıcı bağlantısı (yoksa JustWatch araması) uygulama içi tarayıcıda;
   * hiç sağlayıcı yoksa film detay ekranı. Olay provider_found taşır. Tarayıcı açılamazsa hata
   * kaydedilir ve kullanıcı detay ekranına düşer (sessiz geçiş yok).
   */
  const handleWatchNow = useCallback(async () => {
    const target = resolveWatchTarget({
      filmId: champion.id,
      title: champion.title,
      region,
      providersReady: providers.state === 'ok',
      providers: providers.providers as Parameters<typeof resolveWatchTarget>[0]['providers'],
    });
    trackMoodEvent(pickActionEvent('watch_now', target.providerFound));
    if (target.url === null) {
      openFilm(champion.id);
      return;
    }
    void hapticLight();
    try {
      await WebBrowser.openBrowserAsync(target.url);
    } catch (err) {
      logger.error('[moodGauntlet] watch now baglantisi acilamadi', err, { code: 'MOOD_GAUNTLET_WATCH_OPEN_FAILED' });
      openFilm(champion.id);
    }
  }, [champion.id, champion.title, region, providers.state, providers.providers, openFilm]);

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
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <Text style={styles.kicker}>{t('moodGauntlet.resultKicker')}</Text>
      <Animated.View style={[styles.hero, posterStyle]}>
        {poster !== null && <Image source={{ uri: poster }} style={styles.heroImage} contentFit="cover" />}
      </Animated.View>
      <Animated.Text style={[styles.resultTitle, titleStyle]} accessibilityRole="header">
        {champion.title}
      </Animated.Text>
      {meta.length > 0 && <Animated.Text style={[styles.resultMeta, metaStyle]}>{meta}</Animated.Text>}
      {reason !== null && (
        <Animated.Text
          key={reason}
          style={styles.resultReason}
          entering={reduced ? undefined : FadeIn.duration(DISSOLVE_DURATION.newContender)}
        >
          {reason}
        </Animated.Text>
      )}
      {notices.includes('max_runtime_dropped') && (
        <Text style={[styles.notice, styles.actions]}>{t('moodGauntlet.noticeRuntime')}</Text>
      )}

      <View style={styles.actions}>
        <View style={styles.providersSlot}>
          <WatchProvidersRow
            state={providers.state}
            providers={providers.providers}
            onRetry={providers.retry}
            filmId={champion.id}
            onSeeAll={() => track('where')}
          />
        </View>
        <PrimaryAction
          label={t('moodGauntlet.watchNow')}
          onPress={() => void handleWatchNow()}
          variant="gold"
          disabled={providers.state === 'loading'}
          busy={providers.state === 'loading'}
        />
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

      <Text style={styles.adjustTitle}>{t('moodGauntlet.adjustTitle')}</Text>
      <View style={styles.chipRow}>
        <IntensityChip label={t('moodGauntlet.lighter')} disabled={!canLighter} onPress={() => onIntensify('lighter')}>
          <Wind size={size.iconInline} color={color.text.primary} />
        </IntensityChip>
        <IntensityChip label={t('moodGauntlet.stronger')} disabled={!canStronger} onPress={() => onIntensify('stronger')}>
          <Lightning size={size.iconInline} color={color.text.primary} />
        </IntensityChip>
      </View>

      {backups.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('moodGauntlet.backupsTitle')}</Text>
          <View style={styles.backupRow}>
            {backups.map((b) => {
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
      </View>
    </ScrollView>
  );
}
