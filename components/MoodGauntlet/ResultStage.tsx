/**
 * Sonuç: "Bu akşamın filmi". ChampionReveal KULLANILMAZ (sunucu sahipli günlük gauntletId /
 * tarihe bağlı) — yalnız hareket dili ödünç alınır: poster belirir → başlık → meta.
 *
 * Faz 2-3 hiyerarşi (yukarıdan aşağı):
 *   mood başlığı → poster + başlık + gerekçe + çipler (+ "Why this fits you" satırı)
 *   → birincil TEK CTA "Watch on {Provider}" (altında nerede-izlenir logoları)
 *   → ikincil TEK satır, tek stil: Kaydet (durum düğmede: "✓ Saved") · Fragman · Paylaş (ikon)
 *   → "Not quite right?": Lighter · More intense · Another four (üç çip)
 *   → "If not this one" yedekleri.
 */
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { BookmarkSimple, Play, ShareNetwork } from 'phosphor-react-native';
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

import { useWatchProviders } from '@/components/gauntlet/WatchProviders/useWatchProviders';
import { WatchProvidersRow } from '@/components/gauntlet/WatchProviders';
import { ProvidersSheet } from '@/components/gauntlet/WatchProviders/ProvidersSheet';
import {
  WatchOptionsAttribution,
  WatchOptionsCard,
  type WatchOptionsCardState,
} from '@/components/gauntlet/WatchProviders/WatchOptionsCard';
import { RegionPickerSheet } from '@/components/gauntlet/WatchProviders/RegionPickerSheet';
import { ChampionActionButton } from '@/components/gauntlet/ChampionActionButton';
import { watchRegionName } from '@/constants/watchRegions';
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
import { pickActionEvent, trailerClickedEvent, type MoodPickAction } from '@/utils/moodGauntletAnalytics';
import { formatRuntime, visibleInsight, type FilmDims, type PickPattern } from '@/utils/moodFilmFacts';
import { revealDelays } from '@/utils/resultReveal';
import { resultScrollKey, shouldScrollToTop } from '@/utils/resultScroll';
import { resultCtaMode } from '@/utils/moodResultCta';
import { resolveWatchTarget } from '@/utils/moodWatchTarget';
import { filmDetailHref } from '@/utils/filmDetailHref';
import { normalizePosterUrl } from '@/utils/posterUrl';
import { trailerReturn } from '@/utils/providerReturn';
import { trailerUrl } from '@/utils/trailerPick';

import { FilmChips } from './FilmChips';
import { styles } from './styles';
import { trackMoodEvent } from './useMoodGauntlet';
import { useProviderReturnTracking, useTrailerReturnTracking } from './useProviderReturn';
import { useTrailer } from './useTrailer';

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
  /** Dörtlü sayacı (trailer_clicked.set_index). */
  setIndex: number;
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
  setIndex,
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
  const { t, region, language } = useLanguage();
  const router = useRouter();
  const reduced = useReducedMotion();
  const providers = useWatchProviders(champion.id, region);
  useProviderReturnTracking();
  useTrailerReturnTracking();
  const trailerKey = useTrailer(champion.id, language);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [regionOpen, setRegionOpen] = useState(false);
  const [whereOpen, setWhereOpen] = useState(false);
  // Faz 2-6: yeni sonuç → en üst; film detayından dönüşte (aynı sonuç) konum korunur.
  const scrollRef = useRef<ScrollView>(null);
  const lastResultKey = useRef<string | null>(null);
  const resultKey = resultScrollKey(champion.id, setIndex);
  useEffect(() => {
    if (shouldScrollToTop(lastResultKey.current, resultKey)) scrollRef.current?.scrollTo({ y: 0, animated: false });
    lastResultKey.current = resultKey;
  }, [resultKey]);
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
  // Gerekçe, çipler, CTA ve altı: meta'dan sonra belirir. Yalnız opaklık — dokunuş hiç engellenmez.
  const detailsOpacity = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      const fade = { duration: REDUCED_MOTION_DURATION.crossFade };
      posterOpacity.value = withTiming(1, fade);
      titleOpacity.value = withTiming(1, fade);
      metaOpacity.value = withTiming(1, fade);
      detailsOpacity.value = withTiming(1, fade);
      return;
    }
    const delays = revealDelays(BLACKOUT_SEQUENCE.titleDelay, BLACKOUT_SEQUENCE.metaDelay, false);
    const fade = { duration: DISSOLVE_DURATION.newContender, easing: EASE_OUT_QUART };
    posterOpacity.value = 0;
    titleOpacity.value = 0;
    metaOpacity.value = 0;
    detailsOpacity.value = 0;
    posterScale.value = 1.04;
    posterOpacity.value = withTiming(1, fade);
    posterScale.value = withTiming(1, fade);
    titleOpacity.value = withDelay(delays.title, withTiming(1, fade));
    metaOpacity.value = withDelay(delays.meta, withTiming(1, fade));
    detailsOpacity.value = withDelay(delays.details, withTiming(1, fade));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion.id, reduced]);
  const posterStyle = useAnimatedStyle(() => ({
    opacity: posterOpacity.value,
    transform: [{ scale: posterScale.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaOpacity.value }));
  const detailsStyle = useAnimatedStyle(() => ({ opacity: detailsOpacity.value }));

  const track = useCallback((a: MoodPickAction) => trackMoodEvent(pickActionEvent(a)), []);
  const poster = normalizePosterUrl(champion.poster_url);
  const reason = reasonFor(reasons, champion.id);
  // Faz 2-8: göreli içgörü, şampiyonun aynı eksendeki mutlak çipiyle çelişirse gösterilmez.
  const insight = visibleInsight(pattern, dims);
  const year = champion.year ?? 0;
  const meta = [year > 0 ? String(year) : null, formatRuntime(champion.runtime)]
    .filter((x): x is string => x !== null)
    .join(' · ');

  const openFilm = useCallback(
    (id: string, row?: MatchRow) => {
      void hapticLight();
      // P1-6: başlık / yıl / poster eldeki kayıttan taşınır → film detayı iskeletsiz açılır.
      const r = row ?? (id === champion.id ? champion : undefined);
      router.push(
        filmDetailHref(id, r ? { title: r.title, year: r.year, posterUrl: normalizePosterUrl(r.poster_url) } : null) as never,
      );
    },
    [router, champion],
  );

  /** Sağlayıcı verisi yüklendiyse ilk sağlayıcı bilgisi (yalnız olay özellikleri için). */
  const target = useMemo(
    () =>
      resolveWatchTarget({
        providersReady: providers.state === 'ok',
        providers: providers.providers as Parameters<typeof resolveWatchTarget>[0]['providers'],
      }),
    [providers.state, providers.providers],
  );

  // Faz 2-6: mod bölge/sağlayıcı verisinden her render'da türetilir → bölge değişince CTA, satır ve
  // etiketler birlikte yeniden hesaplanır. Logo altı etiketler WatchProvidersRow'da kalır.
  const ctaMode = resultCtaMode(providers.state, target);
  const showCard = ctaMode === 'loading' || ctaMode === 'watch';

  /**
   * Where to watch (Faz 2-8): CTA dışarı gitmez — uygulama içi native sheet'i açar. Sağlayıcı satırları
   * yalnız allowlist'teki servisler için dışarı açılır (bkz. ProvidersSheet). `where_to_watch_opened`
   * sheet açılışında üretilir; `watch_now` eski huni için korunur.
   */
  const handleWatchNow = useCallback(() => {
    trackMoodEvent(
      pickActionEvent('watch_now', target.providerFound, {
        providerId: target.providerId,
        offerType: target.offerType,
      }),
    );
    void hapticLight();
    setWhereOpen(true);
  }, [target]);

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

  const handleTrailer = useCallback(async () => {
    if (trailerKey === null) return;
    trackMoodEvent(
      trailerClickedEvent({
        filmId: champion.id,
        setIndex,
        hasProviderCta: providers.state === 'ok',
        lang: language,
      }),
    );
    void hapticLight();
    trailerReturn.markOpened(Date.now());
    try {
      await Linking.openURL(trailerUrl(trailerKey));
    } catch (err) {
      logger.error('[moodGauntlet] fragman acilamadi', err, { code: 'MOOD_GAUNTLET_TRAILER_OPEN_FAILED' });
      if (mounted.current) setNotice(t('errors.openLink'));
    }
  }, [trailerKey, champion.id, setIndex, providers.state, language, t]);

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
    <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      {moodLabel !== null && moodLabel.length > 0 && (
        <Text style={styles.resultMood} numberOfLines={2} accessibilityRole="header">
          {moodLabel}
        </Text>
      )}
      <Text style={styles.kicker}>{t('moodGauntlet.resultKicker')}</Text>
      <Animated.View style={[styles.hero, posterStyle]}>
        {poster !== null && <Image source={{ uri: poster }} style={styles.heroImage} contentFit="cover" />}
      </Animated.View>
      <Animated.Text style={[styles.resultTitle, titleStyle]} numberOfLines={3} accessibilityRole="header">
        {champion.title}
      </Animated.Text>
      {meta.length > 0 && <Animated.Text style={[styles.resultMeta, metaStyle]}>{meta}</Animated.Text>}
      <Animated.View style={detailsStyle}>
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
        {/* A3: süre başlık altı meta satırında varsa çip olarak TEKRARLANMAZ. */}
        <FilmChips dims={dims} runtimeMinutes={formatRuntime(champion.runtime) !== null ? null : champion.runtime} centered />
      </View>
      {insight !== null && <Text style={styles.insight}>{t(INSIGHT_KEYS[insight])}</Text>}
      {notices.includes('max_runtime_dropped') && (
        <Text style={[styles.notice, styles.actions]}>{t('moodGauntlet.noticeRuntime')}</Text>
      )}

      <View style={styles.ctaBlock}>
        {/* Faz 2-10a: loading/ok/error -> TEK kart (sarı CTA, "WHERE TO WATCH" başlığı, "See all" yok). */}
        {showCard && (
          <WatchOptionsCard
            state={providers.state as WatchOptionsCardState}
            providers={providers.providers}
            onPress={handleWatchNow}
          />
        )}
        {ctaMode === 'unavailable' && (
          <>
            <Text style={styles.offerHint}>
              {t('moodGauntlet.notStreaming', { country: region !== null ? watchRegionName(region, language) : '' })}
              {' · '}
              <Text
                style={styles.changeLink}
                onPress={() => setRegionOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t('gauntlet.watchProviders.changeA11y')}
              >
                {t('gauntlet.watchProviders.change')}
              </Text>
            </Text>
            <ChampionActionButton
              label={saved ? t('moodGauntlet.savedShort') : t('gauntlet.saveForLater.action')}
              icon={BookmarkSimple}
              variant="filled"
              onPress={() => void handleSave()}
              disabled={saveState !== 'idle'}
              busy={saveState === 'saving'}
              selected={saved}
            />
          </>
        )}
        {ctaMode === 'hidden' && (
          <View style={styles.providersSlot}>
            <WatchProvidersRow
              state={providers.state}
              providers={providers.providers}
              onRetry={providers.retry}
              filmId={champion.id}
              surface="mood_result"
              sheetOpen={whereOpen}
              onSheetOpenChange={setWhereOpen}
              onSeeAll={() => track('where')}
              showOfferLabels
            />
          </View>
        )}
        {/* TEK ProvidersSheet örneği (where_to_watch_opened çift tetiklenmez); ülke seçici sheet'in İÇİNDE. */}
        {showCard && (
          <ProvidersSheet
            visible={whereOpen}
            onClose={() => setWhereOpen(false)}
            state={providers.state}
            providers={providers.providers}
            onRetry={providers.retry}
            filmId={champion.id}
            surface="mood_result"
            attribution={<WatchOptionsAttribution />}
          />
        )}
        <RegionPickerSheet visible={regionOpen} onClose={() => setRegionOpen(false)} />
      </View>

      <View style={styles.secondaryRow}>
        {ctaMode !== 'unavailable' && (
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
        )}
        {trailerKey !== null && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => void handleTrailer()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('moodGauntlet.trailer')}
          >
            <Play size={size.iconInline} color={color.text.primary} weight="fill" />
            <Text style={styles.saveBtnText} numberOfLines={1}>
              {t('moodGauntlet.trailer')}
            </Text>
          </TouchableOpacity>
        )}
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
                  onPress={() => openFilm(b.id, b)}
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
      </Animated.View>
    </ScrollView>
  );
}
