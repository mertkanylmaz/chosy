/**
 * SpotlightResult — Spotlight sonuç ekranı (payoff).
 *
 * Ortak sonuç kartından ayrıldı: donmuş oyunlar onu kullanmaya devam eder.
 * Yukarıdan aşağı: kare (tam keskin) → film adı → yıl → durum (FOUND IT /
 * FLAWLESS / OUT OF CHANCES) → hak satırı → Where to Watch → Save for Later →
 * alt satır. Header (geri) `GameShell`'dedir.
 *
 * Hak satırı ve etiket `resultState`'ten gelir (saf, harf verisi almaz).
 * Bu ekranda ödül/ilerleme çipi, sayaç, saat, ikinci kart ve paylaşım YOK.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BookmarkSimple, FilmReel } from 'phosphor-react-native';
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
  trackSpotlightWhereToWatchTapped,
} from '@/utils/gameAnalytics';
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
}: SpotlightResultProps): React.JSX.Element {
  const { t } = useLanguage();
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

  const saved = saveState === 'saved';

  return (
    <View style={styles.container}>
      {stillUri ? (
        <SpotlightStill
          uri={stillUri}
          blurRadius={blurRadius}
          reveal={stillReveal}
          styles={stillStyles}
        />
      ) : null}

      {film ? <Text style={styles.filmTitle}>{film.title}</Text> : null}
      {film && film.year > 0 ? <Text style={styles.meta}>{String(film.year)}</Text> : null}

      <Animated.View
        entering={statusEntering}
        style={styles.status}
        accessible
        accessibilityRole="header"
        accessibilityLabel={statusLabel}
      >
        <Text style={isLost ? styles.statusLost : styles.statusWon}>{statusText}</Text>
        {detailText ? <Text style={styles.statusDetail}>{detailText}</Text> : null}
        {subText ? <Text style={styles.statusSub}>{subText}</Text> : null}
      </Animated.View>

      {filmId ? (
        <View style={styles.actions}>
          <ChampionActionButton
            label={t('games.spotlight.action_where_to_watch')}
            icon={FilmReel}
            variant="marquee"
            onPress={handleWhereToWatch}
          />
          <ChampionActionButton
            label={
              saved
                ? t('games.spotlight.action_save_done')
                : t('games.spotlight.action_save_for_later')
            }
            icon={BookmarkSimple}
            variant="outline"
            onPress={handleSave}
            disabled={saveState === 'saving' || saved}
            busy={saveState === 'saving'}
            selected={saved}
          />
          {saveState === 'error' ? (
            <Text style={styles.saveError}>{t('games.spotlight.action_save_error')}</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.footer}>{t('games.spotlight.result_next_film')}</Text>
    </View>
  );
}
