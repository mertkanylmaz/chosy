/**
 * SpotlightBonusCard — "Bugünün bonusu" (C.9b-UI C4, IA §2.6; S-2; Home-B1.2 B+).
 *
 * IA kararı §2.6: *"Spotlight sadece şampiyon ekranının altında 'bugünün
 * bonusu' kartı olarak yaşar. Kalıcı, geri dönülebilir bir erişim noktası
 * yok."* Ayrı hub YOK — Discover kalktığı için Cinema Games section'ı da
 * gitti; tek giriş burası.
 *
 * K-62 (5 Eki 2026): Spotlight ritüelin İKİNCİ YARISI — ~~dessert~~ değil.
 * Kart yine dörtlünün ÇIKIŞINDA durur, gauntlet bitmeden açılmaz; bekleyiş
 * ekranındaki kilitli kare (`SpotlightTeaser`) yalnız duyurur, giriş değildir.
 * Paywall kapısı yok.
 *
 * ── B+ Cinematic Spotlight (5 Kas 2026, kurucu kararı) ──────────────────────
 * Bugünün karesi (`backdrop_url`) kartın TAMAMINI kaplar. Oynanabilir/devam/
 * loading'de oyunun başladığı bulanıklıkta (`SPOTLIGHT_MAX_BLUR`) ve hafif
 * karartılmış; bulundu/haklar bitti'de AYNI kare NET — kartın kendisi ilerlemeyi
 * anlatır. Geçiş animasyonu yok (dönüşte yeniden mount). Kart ikinci bir Hero
 * DEĞİL: tüm durumlarda 72pt, 16pt hiza, gölge/cam yok. Soldan sağa koyu
 * katman metni okunur tutar (`cardScrim.ts`; kontrast testte ölçülür). Kare
 * `backdrop_url`'den gelir ve paylaşım görseli DEĞİLDİR (Spotlight kuralı 5
 * yalnız paylaşımı yasaklar). Durum → içerik eşlemesi saf modülde
 * (`cardPresentation.ts`); bu dosya yalnız çizer. Bitmiş oyun yeniden
 * oynatılmaz — dokunuş sonuç ekranını açar (sunucu kapalı tutar, K-22).
 *
 * Giriş: `entry === 'reveal'` ise opaklıkla belirir (`BONUS_CARD_ENTRY`,
 * K-19 Geçiş). Resume'da ve Reduce Motion'da anında. Giriş GECİKMESİ
 * GauntletShell'de: kart sarmalayıcısı o ana kadar mount edilmez ki
 * champion ask'inin dwell sayacı görünmeyen kartta başlamasın.
 *
 * P-1c E: durum (`useSpotlightCardState`) GauntletShell'de okunur ve `data`
 * olarak gelir — Shell bugün bulmaca yoksa (`unavailable`) kartı hiç mount
 * etmez. Kart yine de `unavailable`'da `null` döner (savunma).
 *
 * ── Tek hedef ───────────────────────────────────────────────────────────────
 * Kartın tamamı tek dokunma alanıdır. PLAY/CONTINUE hapı ve chevron dairesi
 * YALNIZ görseldir (ayrı hedef değil). İkinci bir eylem (kapat, gizle, "daha
 * fazla oyun") YOK — ikinci hedef bu yüzeyi bir hub'a çevirmeye başlar.
 *
 * ── Renk ────────────────────────────────────────────────────────────────────
 * Altın (`color.reward.primary`): oynanabilir/devamda yalnız hap; bulunduda
 * yalnız ✓ FOUND IT; haklar bittide altın YOK. Oyun temasından (`GAME_THEMES`)
 * ayrıldı (07.10.2026).
 *
 * ── Analytics (S-2) ─────────────────────────────────────────────────────────
 * `spotlight_card_viewed` — kart mount edilip durum çözülünce, mount başına
 *   bir kez. "Viewport'ta" demek DEĞİL: küçük ekranda kart fold altında
 *   mount olabilir — `window_height` bu ayrım için.
 * `spotlight_card_pressed` — dokunuş. Oyun tarafı kendi event'lerini
 *   (`game_daily_opened` / `game_daily_completed`, `game_id: 'spotlight'`)
 *   değişmeden atar; funnel bunlarla kurulur.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CaretRight, Check } from 'phosphor-react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SPOTLIGHT_MAX_BLUR } from '@/components/games/Spotlight/constants';
import { BONUS_CARD_ENTRY, EASE_OUT_QUART } from '@/constants/design/motion';
import { color, size } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';
import { SPOTLIGHT_IMAGE_SIZE, tmdbSizedUrl } from '@/utils/tmdbSizedUrl';

import {
  sentenceCase,
  shouldTrackViewed,
  spotlightCardPresentation,
  spotlightStateLabel,
  type Segment,
  type SpotlightCardData,
  type SpotlightStateLabel,
} from './cardPresentation';
import { FRAME_DIM_ALPHA, FRAME_FOCUS_TOP, SCRIM_X_STOPS } from './cardScrim';
import { styles } from './styles';

/** Soldan sağa koyu katman: kart rengi (opak renk, alfa = karışım oranı). */
const SCRIM_COLORS = SCRIM_X_STOPS.map((s) => withAlpha(color.surface.raised, s.alpha)) as [
  string,
  string,
  ...string[],
];
const SCRIM_LOCATIONS = SCRIM_X_STOPS.map((s) => s.at) as [number, number, ...number[]];
const SCRIM_START = { x: 0, y: 0.5 } as const;
const SCRIM_END = { x: 1, y: 0.5 } as const;
/** Bulanık durumdaki hafif karartma (kart rengi). */
const DIM_COLOR = withAlpha(color.surface.raised, FRAME_DIM_ALPHA);

interface SpotlightBonusCardProps {
  /** Oyun kimliği — analytics `game_id` (kural 8: zorunlu). */
  gameType: 'spotlight';
  /** Bugünkü Spotlight durumu — GauntletShell `useSpotlightCardState` ile okur. */
  data: SpotlightCardData;
  /** 'reveal' → canlı finalden sonra opaklıkla girer; 'resume' → anında. */
  entry: 'reveal' | 'resume';
  /** Aktif gauntlet'in cycle tarihi — oyun ekranına rota parametresi olarak geçer. */
  cycleDate: string;
  /** Navigasyondan hemen önce — champion ask'inin Spotlight dönüşü tetiği. */
  onPress?: () => void;
  /** Hata kartına dokunuş: yalnız yeniden okuma (oyuna gitmez). */
  onRetry?: () => void;
}

/** Analytics etiketi: durum okunamadıysa ya da yükleniyorsa `unknown`. */
type CardStateLabel = SpotlightStateLabel;

export function SpotlightBonusCard({
  gameType,
  data,
  entry,
  cycleDate,
  onPress,
  onRetry,
}: SpotlightBonusCardProps): React.JSX.Element | null {
  const { t, language } = useLanguage();
  const router = useRouter();
  const isReducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  const stateLabel: CardStateLabel = spotlightStateLabel(data);
  const presentation = spotlightCardPresentation(data);

  // ── Giriş geçişi ─────────────────────────────────────────────────────────
  const animateEntry = entry === 'reveal' && !isReducedMotion;
  const opacity = useSharedValue(animateEntry ? 0 : 1);
  useEffect(() => {
    if (!animateEntry) return;
    opacity.value = withTiming(1, { duration: BONUS_CARD_ENTRY.duration, easing: EASE_OUT_QUART });
    // Yalnız mount'ta — giriş bir kez oynar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entryStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  // ── spotlight_card_viewed — durum çözülünce; durum DEĞİŞİRSE yeni etiketle tekrar ──
  // (oyundan dönüşte not_started → solved gibi). Aynı etiket tekrar atılmaz (`shouldTrackViewed`).
  const lastViewedRef = useRef<SpotlightStateLabel | null>(null);
  useEffect(() => {
    if (!shouldTrackViewed(lastViewedRef.current, data)) return;
    lastViewedRef.current = stateLabel;
    posthogAnalytics.track('spotlight_card_viewed', {
      game_id: gameType,
      state: stateLabel,
      resumed: entry === 'resume',
      window_height: Math.round(windowHeight),
    });
    // `data` tüm durum değişimlerini kapsar; etiket aynıysa `shouldTrackViewed` false döner.
  }, [data, stateLabel, entry, gameType, windowHeight]);

  const target = presentation.target;
  const handlePress = useCallback(() => {
    if (target === null) return; // loading: pasif
    void hapticLight();
    if (target === 'retry') {
      // Yalnız yeniden okuma — oyuna gitmez, `spotlight_card_pressed` (oynama niyeti) atılmaz.
      onRetry?.();
      return;
    }
    posthogAnalytics.track('spotlight_card_pressed', { game_id: gameType, state: stateLabel });
    onPress?.();
    // 'game' ve 'result' aynı rota: oyun ekranı tamamlanmış bulmacada sonuç ekranını açar (K-22).
    router.push({ pathname: '/games/spotlight', params: { date: cycleDate } });
  }, [target, router, onPress, onRetry, gameType, stateLabel, cycleDate]);

  // ── Metin (içerik kararı `cardPresentation.ts`'te; burada yalnız t() çözülür) ──
  const resolve = (segments: Segment[]): string =>
    segments
      .map((seg) => {
        if (seg.literal !== undefined) return seg.literal;
        const raw = t(seg.key, seg.count !== undefined ? { count: seg.count } : undefined);
        return seg.sentence ? sentenceCase(raw, language) : raw;
      })
      .join(' · ');
  const eyebrowRaw = t(presentation.eyebrow.key);
  const eyebrow = eyebrowRaw.toLocaleUpperCase(language);
  const mainText = resolve(presentation.main);
  const secondaryText = presentation.secondary !== null ? resolve(presentation.secondary) : null;
  const verb =
    presentation.cta === null
      ? null
      : t(presentation.cta === 'play' ? 'gauntlet.bonus.play' : 'gauntlet.bonus.continue').toLocaleUpperCase(language);

  // ── Görsel: tam kart kare. Yüklenemezse koyu düz zemin + metin (sessiz değil: Sentry). ──
  const backdropUrl =
    data.status === 'ready' ? data.backdropUrl : data.status === 'loading' ? (data.backdropUrl ?? '') : '';
  const frameUri =
    presentation.image !== 'none' && backdropUrl !== ''
      ? tmdbSizedUrl(backdropUrl, SPOTLIGHT_IMAGE_SIZE.bonusCard)
      : '';
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const showFrame = frameUri !== '' && failedUri !== frameUri;
  const handleFrameError = useCallback(() => {
    setFailedUri(frameUri);
    Sentry.captureMessage('spotlight kartı: kare yüklenemedi — koyu zemin gösterildi', {
      level: 'warning',
      tags: { component: 'SpotlightBonusCard', state: stateLabel },
    });
  }, [frameUri, stateLabel]);

  // ── Erişilebilirlik etiketi: bitmişte film adı dahil ("Found it, Minari. A new film tomorrow.") ──
  const isDone = presentation.kind === 'solved' || presentation.kind === 'failed';
  const accessibilityLabel = isDone
    ? `${sentenceCase(eyebrowRaw, language)}, ${mainText}. ${secondaryText ?? ''}.`
    : [eyebrow, mainText, secondaryText, verb].filter((p) => p !== null && p !== '').join('. ');

  // P-1c E: bugün bulmaca yok — kart yok (Shell zaten mount etmez; savunma).
  if (presentation.kind === 'hidden') return null;

  const goldEyebrow = presentation.gold === 'eyebrow';

  return (
    <Animated.View style={entryStyle}>
      <TouchableOpacity
        style={[styles.card, styles.cardTall]}
        onPress={handlePress}
        disabled={target === null}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: target === null }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={presentation.hintKey !== null ? t(presentation.hintKey) : undefined}
      >
        {/* Bugünün karesi kartı kaplar. Bulanık durumda MAX_BLUR + hafif karartma; bitmişte NET.
            Üstüne soldan sağa koyu katman (metin okunur). VoiceOver'dan gizli. */}
        {showFrame && (
          <>
            <Image
              source={{ uri: frameUri }}
              style={styles.frameImage}
              contentFit="cover"
              contentPosition={{ top: FRAME_FOCUS_TOP }}
              blurRadius={presentation.blur ? SPOTLIGHT_MAX_BLUR : 0}
              onError={handleFrameError}
              accessible={false}
            />
            {presentation.blur && (
              <View
                style={[styles.layer, { backgroundColor: DIM_COLOR }]}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
            )}
            <LinearGradient
              style={styles.layer}
              pointerEvents="none"
              colors={SCRIM_COLORS}
              locations={SCRIM_LOCATIONS}
              start={SCRIM_START}
              end={SCRIM_END}
            />
          </>
        )}
        <View style={styles.textBlock}>
          <View style={styles.eyebrowRow}>
            {presentation.eyebrow.check && (
              <Check size={size.iconInline} color={color.reward.primary} weight="bold" />
            )}
            <Text style={[styles.kicker, goldEyebrow && styles.kickerGold]}>{eyebrow}</Text>
          </View>
          {mainText !== '' && (
            <Text style={styles.main} numberOfLines={isDone ? 1 : 2}>
              {mainText}
            </Text>
          )}
          {secondaryText !== null ? (
            <Text style={styles.secondary} numberOfLines={2}>
              {secondaryText}
            </Text>
          ) : presentation.kind === 'loading' ? (
            <View style={styles.skeletonLine} accessibilityElementsHidden importantForAccessibility="no" />
          ) : null}
        </View>
        {/* Altın YALNIZ PLAY / CONTINUE hapında (ayrı dokunma hedefi DEĞİL — kartın tamamı hedef). */}
        {verb !== null && (
          <View style={[styles.pill, styles.trailing]}>
            <Text style={styles.verb}>{verb}</Text>
          </View>
        )}
        {presentation.chevron && (
          <View style={[styles.chevronCircle, styles.trailing]}>
            <CaretRight size={size.iconInline} color={color.text.primary} weight="bold" />
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
