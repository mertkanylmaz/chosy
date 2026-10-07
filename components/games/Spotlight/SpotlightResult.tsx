/**
 * SpotlightResult — Spotlight sonuç ekranı (payoff).
 *
 * Ortak sonuç kartından ayrıldı: donmuş oyunlar onu kullanmaya devam eder.
 * Yukarıdan aşağı: kare (tam keskin) → film adı → yıl → durum (FOUND IT /
 * FLAWLESS / OUT OF CHANCES) → hak satırı → Where to Watch → Save for Later →
 * Share Spotlight (yalnız kazanılmış oyunda) → alt satır. Header (geri)
 * `GameShell`'dedir.
 *
 * Hak satırı ve etiket `resultState`'ten gelir (saf, harf verisi almaz).
 * Bu ekranda ödül/ilerleme çipi, sayaç, saat ve ikinci kart YOK. Paylaşım kartı
 * filmden türetilmiş hiçbir veri taşımaz (`SpotlightShareCard`).
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookmarkSimple, FilmReel, ShareNetwork } from 'phosphor-react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import {
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
  SPOTLIGHT_FOCUS_STEP,
} from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChampionActionButton } from '@/components/gauntlet/ChampionActionButton';
import { logger } from '@/utils/logger';
import {
  trackSpotlightSaveForLaterTapped,
  trackSpotlightShareTapped,
  trackSpotlightWhereToWatchTapped,
} from '@/utils/gameAnalytics';
import { SpotlightShareCard } from '@/components/ShareCards/SpotlightShareCard';
import { styles as shareStyles } from '@/components/ShareCards/styles';
import { useShareCapture } from '@/components/ShareCards/useShareCapture';
import type { RevealedFilm } from '@/types/game';

import { playSpotlightHaptic } from './playHaptic';
import { resultStyles as styles } from './resultStyles';
import type { ResultState } from './resultState';
import { SpotlightStill, type StillReveal } from './SpotlightStill';
import { saveRevealedFilm, SpotlightSaveError } from './saveFilm';
import type { createStyles } from './styles';
import { useScreenReaderEnabled } from './useScreenReaderEnabled';

/**
 * Kaydet durumları. `idle` "kayıtlı değil" iddiası DEĞİL, "bilinmiyor"dur:
 * watchlist üyeliği okunmaz (okuma yolu yok); yazma başarısı doğru kabul edilir.
 */
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/** Bu ölçeğin üstünde Save + Share dikey yığılır (Dynamic Type) */
const SIDE_BY_SIDE_MAX_FONT_SCALE = 1.3;

interface SpotlightResultProps {
  puzzleId: string;
  won: boolean;
  /** `resultState` çıktısı — `ok:false` ise hak satırı çizilmez */
  result: ResultState;
  /** Çözüm filmi; yoksa (sunucu vermedi) eylemler sunulmaz */
  film: RevealedFilm | null;
  /** Sonuç karesi (backdrop); yoksa kare çizilmez */
  stillUri: string | null;
  /** Bitiş anındaki bulanıklık — geçiş oradan başlar (SpotlightStill) */
  blurRadius: number;
  stillReveal: Exclude<StillReveal, 'none'>;
  /** Kare kutusunun stilleri — oyunla aynı kutu */
  stillStyles: ReturnType<typeof createStyles>;
  /** Sunucunun `puzzle_no`'su — paylaşım kartı başlığı; 0 / geçersiz → numara yok */
  puzzleNo: number;
  /** Başlık maskesinin kelime başına slot sayısı (`buildShareMask`) — harf içermez */
  shareMaskWords: readonly number[];
}

export function SpotlightResult({
  puzzleId,
  won,
  result,
  film,
  stillUri,
  blurRadius,
  stillReveal,
  stillStyles,
  puzzleNo,
  shareMaskWords,
}: SpotlightResultProps): React.JSX.Element {
  const { t } = useLanguage();
  const trackingProps = useMemo(() => ({ puzzle_id: puzzleId }), [puzzleId]);
  const { cardRef, share, isCapturing, isShareAvailable } = useShareCapture({
    cardType: 'spotlight_result',
    trackingProps,
  });
  const [shareFailed, setShareFailed] = useState(false);
  /** Senkron kilit — hızlı çift dokunuş ikinci capture'ı başlatmasın */
  const shareLockRef = useRef(false);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const screenReaderOn = useScreenReaderEnabled();
  const [saveState, setSaveState] = useState<SaveState>('idle');
  /** Senkron kilit — hızlı çift dokunuş ikinci yazmayı başlatmasın */
  const saveLockRef = useRef(false);

  const filmId = film?.film_id ?? null;

  const variant = result.ok ? result.variant : won ? 'found' : 'lost';
  const isLost = variant === 'lost';
  const statusKey =
    variant === 'flawless'
      ? 'games.spotlight.result_flawless'
      : variant === 'found'
        ? 'games.spotlight.result_found'
        : 'games.spotlight.result_out_of_chances';
  const statusText = t(statusKey);
  // Lost: hak satırı yerine "Here's the film."; ok:false: satır hiç çizilmez
  const detailText =
    result.ok && !isLost
      ? t('games.spotlight.result_chances_left', { left: result.chancesLeft, total: result.total })
      : null;
  const subText = isLost ? t('games.spotlight.result_lost_sub') : null;

  const statusLabel = [statusText, detailText ?? subText].filter(Boolean).join('. ');

  const statusEntering = useMemo(
    () =>
      FadeIn.duration(
        reduceMotion ? REDUCED_MOTION_DURATION.crossFade : SPOTLIGHT_FOCUS_STEP.duration,
      ).easing(EASE_OUT_QUART),
    [reduceMotion],
  );

  const announce = useCallback(
    (message: string) => {
      if (screenReaderOn) AccessibilityInfo.announceForAccessibility(message);
    },
    [screenReaderOn],
  );

  const handleWhereToWatch = useCallback(() => {
    if (!filmId) return;
    playSpotlightHaptic({ type: 'cta_press' });
    trackSpotlightWhereToWatchTapped(puzzleId);
    router.push(`/film/${filmId}`);
  }, [filmId, puzzleId, router]);

  const handleSave = useCallback(async () => {
    if (!film || !filmId || saveLockRef.current || saveState === 'saved') return;
    saveLockRef.current = true;
    playSpotlightHaptic({ type: 'cta_press' });
    trackSpotlightSaveForLaterTapped(puzzleId);
    setSaveState('saving');
    try {
      await saveRevealedFilm(film, filmId);
      setSaveState('saved');
      announce(t('games.spotlight.action_save_done'));
    } catch (err) {
      if (err instanceof SpotlightSaveError) {
        // Servisin sessizce atlayacağı durum — burada görünür kılınır
        logger.error('[spotlight] Kaydet yazilamadi: ' + err.code, err, {
          code: err.code,
          extra: { puzzle_id: puzzleId },
        });
      } else {
        // addToWatchlist hatayı kaynağında Sentry'ye yazdı — çift event yok
        logger.error('[spotlight] Kaydet hatasi', err, {
          code: 'SPOTLIGHT_SAVE_FAILED',
          skipBridge: true,
        });
      }
      setSaveState('error');
      announce(t('games.spotlight.action_save_error'));
    } finally {
      saveLockRef.current = false;
    }
  }, [film, filmId, puzzleId, saveState, announce, t]);

  // Paylaşım YALNIZ kazanılmış oyunda ve hak verisi geçerliyken; native modül yoksa buton yok
  const shareVariant = result.ok && result.variant !== 'lost' ? result.variant : null;
  const shareChancesLeft = result.ok ? result.chancesLeft : 0;
  const shareTotal = result.ok ? result.total : 0;
  const canShare = shareVariant !== null && isShareAvailable;

  const handleShare = useCallback(async () => {
    if (shareVariant === null || shareLockRef.current) return;
    shareLockRef.current = true;
    playSpotlightHaptic({ type: 'cta_press' });
    trackSpotlightShareTapped({
      puzzleId,
      chancesLeft: shareChancesLeft,
      variant: shareVariant,
    });
    setShareFailed(false);
    try {
      const ok = await share();
      if (!ok) {
        // Hook hata nedenini ayırmıyor (capture hatası / modül yok / cihaz yok) — görünür kıl
        logger.error('[spotlight] Paylasim basarisiz', new Error('SPOTLIGHT_SHARE_FAILED'), {
          code: 'SPOTLIGHT_SHARE_FAILED',
          extra: { puzzle_id: puzzleId },
        });
        setShareFailed(true);
        announce(t('games.spotlight.share_error'));
      }
    } finally {
      shareLockRef.current = false;
    }
  }, [shareVariant, shareChancesLeft, puzzleId, share, announce, t]);

  const saved = saveState === 'saved';
  const statusStyle =
    variant === 'flawless'
      ? styles.statusFlawless
      : variant === 'found'
        ? styles.statusFound
        : styles.statusLost;
  // Dynamic Type: büyük yazıda Save + Share yan yana sığmaz → dikey
  const { fontScale } = useWindowDimensions();
  const sideBySide = fontScale <= SIDE_BY_SIDE_MAX_FONT_SCALE;

  const saveButton = filmId ? (
    <ChampionActionButton
      label={
        saved ? t('games.spotlight.action_save_done') : t('games.spotlight.action_save_for_later')
      }
      icon={BookmarkSimple}
      variant="outline"
      onPress={handleSave}
      disabled={saveState === 'saving' || saved}
      busy={saveState === 'saving'}
      selected={saved}
    />
  ) : null;
  const shareButton = canShare ? (
    <ChampionActionButton
      label={t('games.spotlight.action_share')}
      icon={ShareNetwork}
      variant="outline"
      onPress={handleShare}
      disabled={isCapturing}
      busy={isCapturing}
    />
  ) : null;
  const saveErrorText =
    saveState === 'error' ? (
      <Text style={styles.saveError}>{t('games.spotlight.action_save_error')}</Text>
    ) : null;
  const shareErrorText = shareFailed ? (
    <Text style={styles.saveError}>{t('games.spotlight.share_error')}</Text>
  ) : null;

  return (
    <View style={styles.container}>
      {canShare && shareVariant !== null ? (
        // Ekran dışı — PNG capture için. Karta film verisi girmez (spoiler-safe)
        <View style={shareStyles.offscreen} pointerEvents="none" accessibilityElementsHidden>
          <SpotlightShareCard
            ref={cardRef}
            puzzleNo={puzzleNo}
            chancesLeft={shareChancesLeft}
            total={shareTotal}
            variant={shareVariant}
            maskWords={shareMaskWords}
          />
        </View>
      ) : null}

      {stillUri ? (
        <SpotlightStill
          uri={stillUri}
          blurRadius={blurRadius}
          reveal={stillReveal}
          styles={stillStyles}
        />
      ) : null}

      {film ? (
        <Text
          style={styles.title}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {film.title}
        </Text>
      ) : null}
      {film && film.year > 0 ? <Text style={styles.meta}>{String(film.year)}</Text> : null}

      <Animated.View
        entering={statusEntering}
        style={styles.status}
        accessible
        accessibilityRole="header"
        accessibilityLabel={statusLabel}
      >
        <Text style={statusStyle}>{statusText}</Text>
        {detailText ? <Text style={styles.statusDetail}>{detailText}</Text> : null}
        {subText ? <Text style={styles.statusSub}>{subText}</Text> : null}
      </Animated.View>

      {filmId || canShare ? (
        <View style={styles.actions}>
          {filmId ? (
            <ChampionActionButton
              label={t('games.spotlight.action_where_to_watch')}
              icon={FilmReel}
              variant="marquee"
              onPress={handleWhereToWatch}
            />
          ) : null}
          {sideBySide && saveButton && shareButton ? (
            <View style={styles.actionsRow}>
              <View style={styles.actionsRowItem}>{saveButton}</View>
              <View style={styles.actionsRowItem}>{shareButton}</View>
            </View>
          ) : (
            <>
              {saveButton}
              {shareButton}
            </>
          )}
          {saveErrorText}
          {shareErrorText}
        </View>
      ) : null}

      <Text style={styles.footer}>{t('games.spotlight.result_next_film')}</Text>
    </View>
  );
}
