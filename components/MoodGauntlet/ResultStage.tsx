/**
 * Sonuç: "Bu akşamın filmi". ChampionReveal KULLANILMAZ (sunucu sahipli günlük gauntletId /
 * tarihe bağlı) — yalnız hareket dili ödünç alınır: poster belirir → başlık → meta.
 *
 * Faz 2-3 hiyerarşi (yukarıdan aşağı):
 *   mood başlığı → poster + başlık + gerekçe + çipler (+ "Why this fits you" satırı)
 *   → birincil TEK CTA "Watch on {Provider}" (altında nerede-izlenir logoları)
 *   → ikincil TEK satır: Kaydet (durum düğmede: "✓ Saved") + Paylaş (ikon)
 *   → "Not quite right?": Lighter · More intense · Another four (üç çip)
 *   → "If not this one" yedekleri.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BookmarkSimple, ShareNetwork } from 'phosphor-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Share, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import Animated, {
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

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
import { pickActionEvent, providerClickedEvent, type MoodPickAction, type WatchLinkKindProp } from '@/utils/moodGauntletAnalytics';
import { formatRuntime, type FilmDims, type PickPattern } from '@/utils/moodFilmFacts';
import { resolveWatchTarget } from '@/utils/moodWatchTarget';
import { normalizePosterUrl } from '@/utils/posterUrl';
import { providerReturn } from '@/utils/providerReturn';
import { offerLabelKind } from '@/utils/watchProviderList';

import { FilmChips } from './FilmChips';
import { styles } from './styles';
import { trackMoodEvent } from './useMoodGauntlet';
import { useProviderReturnTracking } from './useProviderReturn';

type SaveState = 'idle' | 'saving' | 'saved';

const INSIGHT_KEYS: Record<PickPattern, string> = {
  calmer_all: 'moodGauntlet.insight.calmerAll',
  calmer_two: 'moodGauntlet.insight.calmerTwo',
  intense_all: 'moodGauntlet.insight.intenseAll',
  intense_two: 'moodGauntlet.insight.intenseTwo',
  shorter_all: 'moodGauntlet.insight.shorterAll',
  shorter_two: 'moodGauntlet.insight.shorterTwo',
};

interface ResultStageProps {
  champion: MatchRow;
  backups: MatchRow[];
  /** film id → gerekçe (arkadan dolar; yoksa satır çizilmez). */
  reasons: Record<string, string>;
  /** Şampiyonun boyutları (çipler); gelmezse çip çizilmez. */
  dims: FilmDims | undefined;
  /** Seçimlerden türeyen deterministik desen; yoksa satır yok. */
  pattern: PickPattern | null;
  /** Hızlı mood adı ya da profile_name / kullanıcı metni. */
  moodLabel: string | null;
  notices: MoodNotice[];
  canLighter: boolean;
  canStronger: boolean;
  onAnotherFour: () => void;
  onIntensify: (direction: IntensityDirection) => void;
}

interface ChipProps {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}

function AdjustChip({ label, disabled = false, onPress }: ChipProps): React.JSX.Element {
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
      <Text style={styles.chipText} numberOfLines={2}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export function ResultStage({
  champion,
  backups,
  reasons,
  dims,
  pattern,
  moodLabel,
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
  useProviderReturnTracking();
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
  const meta = [year > 0 ? String(year) : null, formatRuntime(champion.runtime)]
    .filter((x): x is string => x !== null)
    .join(' · ');

  const openFilm = useCallback(
    (id: string) => {
      void hapticLight();
      router.push(`/film/${id}`);
    },
    [router],
  );

  /** Sağlayıcı verisi yüklendiyse hedef (düğme etiketi + bağlantı); aksi hâlde null. */
  const target = useMemo(
    () =>
      resolveWatchTarget({
        title: champion.title,
        region,
        providersReady: providers.state === 'ok',
        providers: providers.providers as Parameters<typeof resolveWatchTarget>[0]['providers'],
      }),
    [champion.title, region, providers.state, providers.providers],
  );

  // Film sayfasına derin bağlantımız yok → "Watch on" denmez: "Find on {Provider}" (TR: ek yok).
  const watchLabel =
    target.providerName === null
      ? t('moodGauntlet.watchNow')
      : t('moodGauntlet.findOn', { provider: target.providerName });
  /** CTA altında küçük teklif türü: Subscription / Free / Rent / Buy. */
  const offerHint =
    target.providerName !== null && target.offerType !== null
      ? t(`moodGauntlet.offerHint.${offerLabelKind(target.offerType)}`)
      : null;

  /**
   * Watch now: sağlayıcının resmî arama bağlantısı (universal link — uygulama yüklüyse açar);
   * tabloda yoksa JustWatch araması; hiç sağlayıcı yoksa film detay ekranı. Açılamazsa hata
   * kaydedilir ve kullanıcı detay ekranına düşer (sessiz geçiş yok).
   */
  const handleWatchNow = useCallback(async () => {
    const linkKind: WatchLinkKindProp = target.url === null || target.kind === 'none' ? 'detail' : target.kind;
    trackMoodEvent(
      pickActionEvent('watch_now', target.providerFound, {
        providerId: target.providerId,
        offerType: target.offerType,
        linkKind,
      }),
    );
    if (target.providerId !== null) {
      trackMoodEvent(
        providerClickedEvent({
          providerId: target.providerId,
          offerType: target.offerType,
          region,
          linkKind,
        }),
      );
    }
    if (target.url === null) {
      openFilm(champion.id);
      return;
    }
    void hapticLight();
    providerReturn.markOpened(Date.now());
    try {
      await Linking.openURL(target.url);
    } catch (err) {
      logger.error('[moodGauntlet] watch now baglantisi acilamadi', err, { code: 'MOOD_GAUNTLET_WATCH_OPEN_FAILED' });
      openFilm(champion.id);
    }
  }, [champion.id, target, region, openFilm]);

  /** MANUEL watchlist: yalnız bu dokunuşla yazılır (deste/swipe yolundaki otomatik yazım yok). */
  const handleSave = useCallback(async () => {
    if (saveState !== 'idle') return;
    setSaveState('saving');
    setNotice(null);
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

  const saved = saveState === 'saved';

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {moodLabel !== null && moodLabel.length > 0 && (
        <Text style={styles.resultMood} numberOfLines={2} accessibilityRole="header">
          {moodLabel}
        </Text>
      )}
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
      <View style={styles.resultChips}>
        <FilmChips dims={dims} runtimeMinutes={champion.runtime} centered />
      </View>
      {pattern !== null && <Text style={styles.insight}>{t(INSIGHT_KEYS[pattern])}</Text>}
      {notices.includes('max_runtime_dropped') && (
        <Text style={[styles.notice, styles.actions]}>{t('moodGauntlet.noticeRuntime')}</Text>
      )}

      <View style={styles.ctaBlock}>
        {/* kind='none': sağlayıcı var ama güvenilir adres yok → CTA gizli (tahmini URL üretilmez). */}
        {target.kind !== 'none' && (
          <PrimaryAction
            label={watchLabel}
            onPress={() => void handleWatchNow()}
            variant="gold"
            disabled={providers.state === 'loading'}
            busy={providers.state === 'loading'}
          />
        )}
        {target.kind !== 'none' && offerHint !== null && <Text style={styles.offerHint}>{offerHint}</Text>}
        <View style={styles.providersSlot}>
          <WatchProvidersRow
            state={providers.state}
            providers={providers.providers}
            onRetry={providers.retry}
            filmId={champion.id}
            onSeeAll={() => track('where')}
            showOfferLabels
          />
        </View>
      </View>

      <View style={styles.secondaryRow}>
        <TouchableOpacity
          style={styles.saveBtn}
          onPress={() => void handleSave()}
          disabled={saveState !== 'idle'}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={saved ? t('moodGauntlet.saved') : t('moodGauntlet.save')}
          accessibilityState={{ disabled: saveState !== 'idle', selected: saved }}
        >
          {!saved && <BookmarkSimple size={size.iconInline} color={color.text.primary} />}
          <Text style={styles.saveBtnText} numberOfLines={1}>
            {saved ? t('moodGauntlet.savedShort') : t('moodGauntlet.save')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={() => void handleShare()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('moodGauntlet.shareA11y')}
        >
          <ShareNetwork size={size.iconInline} color={color.text.primary} />
        </TouchableOpacity>
      </View>
      <View style={styles.noticeSlot}>
        {notice !== null && <Text style={styles.shareNotice}>{notice}</Text>}
      </View>

      <Text style={styles.adjustTitle}>{t('moodGauntlet.adjustTitle')}</Text>
      <View style={styles.chipRow}>
        <AdjustChip label={t('moodGauntlet.lighter')} disabled={!canLighter} onPress={() => onIntensify('lighter')} />
        <AdjustChip label={t('moodGauntlet.stronger')} disabled={!canStronger} onPress={() => onIntensify('stronger')} />
        <AdjustChip label={t('moodGauntlet.anotherFour')} onPress={onAnotherFour} />
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
    </ScrollView>
  );
}
