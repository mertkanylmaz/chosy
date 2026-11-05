/**
 * SpotlightBonusCard — "Bugünün bonusu" (C.9b-UI C4, IA §2.6; S-2).
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
 * ── S-2 (3 Eki 2026) ────────────────────────────────────────────────────────
 * Görsel: bugünün karesi `SPOTLIGHT_MAX_BLUR`'da — oyunun başladığı görüntü; YALNIZ
 * oynanacak / devam eden durumda (Home-B1: bitmişte görsel yok, kart ≈56pt).
 * Kare `backdrop_url`'den gelir ve paylaşım görseli DEĞİLDİR (Spotlight
 * kuralı 5 yalnız paylaşımı yasaklar). Durum → içerik eşlemesi saf modülde
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
 * Kartın tamamı tek dokunma alanıdır. İkinci bir eylem (kapat, gizle, "daha
 * fazla oyun") YOK — ikinci hedef bu yüzeyi bir hub'a çevirmeye başlar.
 *
 * ── Renk ────────────────────────────────────────────────────────────────────
 * Kart NÖTR: karenin kenarı graphite hairline. Oyun temasından (`GAME_THEMES`)
 * ayrıldı (07.10.2026) — şampiyon ekranı Spotlight'ın oynanış rengini taşımaz.
 *
 * ── Analytics (S-2) ─────────────────────────────────────────────────────────
 * `spotlight_card_viewed` — kart mount edilip durum çözülünce, mount başına
 *   bir kez. "Viewport'ta" demek DEĞİL: küçük ekranda kart fold altında
 *   mount olabilir — `window_height` bu ayrım için.
 * `spotlight_card_pressed` — dokunuş. Oyun tarafı kendi event'lerini
 *   (`game_daily_opened` / `game_daily_completed`, `game_id: 'spotlight'`)
 *   değişmeden atar; funnel bunlarla kurulur.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CaretRight } from 'phosphor-react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SPOTLIGHT_MAX_BLUR } from '@/components/games/Spotlight/constants';
import { BONUS_CARD_ENTRY, EASE_OUT_QUART } from '@/constants/design/motion';
import { color, size } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';
import { SPOTLIGHT_IMAGE_SIZE, tmdbSizedUrl } from '@/utils/tmdbSizedUrl';

import {
  sentenceCase,
  spotlightCardPresentation,
  spotlightStateLabel,
  type Segment,
  type SpotlightCardData,
  type SpotlightStateLabel,
} from './cardPresentation';
import { styles } from './styles';

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

  // ── spotlight_card_viewed — durum çözülünce, mount başına bir kez ─────────
  const viewedTrackedRef = useRef(false);
  useEffect(() => {
    if (viewedTrackedRef.current || data.status === 'loading' || data.status === 'unavailable') return;
    viewedTrackedRef.current = true;
    posthogAnalytics.track('spotlight_card_viewed', {
      game_id: gameType,
      state: stateLabel,
      resumed: entry === 'resume',
      window_height: Math.round(windowHeight),
    });
  }, [data.status, stateLabel, entry, gameType, windowHeight]);

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
        const raw = t(seg.key, seg.count !== undefined ? { count: seg.count } : undefined);
        return seg.sentence ? sentenceCase(raw, language) : raw;
      })
      .join(' · ');
  const eyebrow = [
    t('gauntlet.bonus.label').toLocaleUpperCase(language),
    ...(presentation.eyebrowDone ? [t('gauntlet.bonus.doneEyebrow').toLocaleUpperCase(language)] : []),
  ].join(' · ');
  const mainText = resolve(presentation.main);
  const secondaryText = presentation.secondary !== null ? resolve(presentation.secondary) : null;
  const verb =
    presentation.cta === null
      ? null
      : t(presentation.cta === 'play' ? 'gauntlet.bonus.play' : 'gauntlet.bonus.continue').toLocaleUpperCase(language);
  const backdropUrl =
    data.status === 'ready' ? data.backdropUrl : data.status === 'loading' ? (data.backdropUrl ?? '') : '';
  // Loading yenilemesinde aynı günün karesi kalır (titreme yok); bitmişte görsel YOK.
  const showFrame = presentation.image !== 'none';

  // P-1c E: bugün bulmaca yok — kart yok (Shell zaten mount etmez; savunma).
  if (presentation.kind === 'hidden') return null;

  return (
    <Animated.View style={entryStyle}>
      <TouchableOpacity
        style={[styles.card, presentation.height === 'compact' ? styles.cardCompact : styles.cardTall]}
        onPress={handlePress}
        disabled={target === null}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityState={{ disabled: target === null }}
        accessibilityLabel={[eyebrow, mainText, secondaryText, verb].filter((p) => p !== null).join('. ')}
        accessibilityHint={presentation.hintKey !== null ? t(presentation.hintKey) : undefined}
      >
        {/* Bugünün karesi, oyunun başladığı bulanıklıkta — yalnız oynanacak/devam eden durumda
            (ve loading yenilemesinde). Kenar nötr hairline. VoiceOver'dan gizli. */}
        {showFrame && (
          <View style={styles.frame}>
            {backdropUrl !== '' && (
              <Image
                source={{ uri: tmdbSizedUrl(backdropUrl, SPOTLIGHT_IMAGE_SIZE.bonusCard) }}
                style={styles.frameImage}
                contentFit="cover"
                blurRadius={SPOTLIGHT_MAX_BLUR}
                accessible={false}
              />
            )}
          </View>
        )}
        <View style={styles.textBlock}>
          <Text style={styles.kicker}>{eyebrow}</Text>
          <Text style={styles.main} numberOfLines={2}>
            {mainText}
          </Text>
          {secondaryText !== null ? (
            <Text style={styles.secondary} numberOfLines={2}>
              {secondaryText}
            </Text>
          ) : presentation.kind === 'loading' ? (
            <View style={styles.skeletonLine} accessibilityElementsHidden importantForAccessibility="no" />
          ) : null}
        </View>
        {/* Altın YALNIZ PLAY / CONTINUE metninde. */}
        {verb !== null && (
          <Text style={[styles.verb, presentation.gold && styles.verbGold]}>{verb}</Text>
        )}
        {presentation.chevron && (
          <CaretRight size={size.iconInline} color={color.text.secondary} weight="bold" />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
