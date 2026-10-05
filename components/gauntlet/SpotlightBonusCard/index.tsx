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
 * Görsel: bugünün karesi `SPOTLIGHT_MAX_BLUR`'da — oyunun başladığı görüntü.
 * Kare `backdrop_url`'den gelir ve paylaşım görseli DEĞİLDİR (Spotlight
 * kuralı 5 yalnız paylaşımı yasaklar). Üç durum (`cardState.ts`):
 * Play / Continue / Solved|Failed özeti. Bitmiş oyun yeniden oynatılmaz —
 * dokunuş sonuç ekranını açar (sunucu kapalı tutar, K-22).
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
 * Mor (`#8B5CF6`) YALNIZ bu kartta, karenin kenarında. Karanlık Salon
 * paletine sızmaz; değer `GAME_THEMES.spotlight.accent`'ten okunur.
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
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { SPOTLIGHT_MAX_BLUR } from '@/components/games/Spotlight/constants';
import { BONUS_CARD_ENTRY, EASE_OUT_QUART } from '@/constants/design/motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';

import { isSpotlightPlayable, type SpotlightCardState } from './cardState';
import { styles } from './styles';
import type { SpotlightCardData } from './useSpotlightCardState';

interface SpotlightBonusCardProps {
  /** Oyun kimliği — analytics `game_id` (kural 8: zorunlu). */
  gameType: 'spotlight';
  /** Bugünkü Spotlight durumu — GauntletShell `useSpotlightCardState` ile okur. */
  data: SpotlightCardData;
  /** 'reveal' → canlı finalden sonra opaklıkla girer; 'resume' → anında. */
  entry: 'reveal' | 'resume';
  /** Navigasyondan hemen önce — champion ask'inin Spotlight dönüşü tetiği. */
  onPress?: () => void;
}

/** Analytics etiketi: durum okunamadıysa ya da yükleniyorsa `unknown`. */
type CardStateLabel = SpotlightCardState | 'unknown';

export function SpotlightBonusCard({
  gameType,
  data,
  entry,
  onPress,
}: SpotlightBonusCardProps): React.JSX.Element | null {
  const { t, language } = useLanguage();
  const router = useRouter();
  const isReducedMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  const stateLabel: CardStateLabel = data.status === 'ready' ? data.state : 'unknown';

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

  const handlePress = useCallback(() => {
    void hapticLight();
    posthogAnalytics.track('spotlight_card_pressed', { game_id: gameType, state: stateLabel });
    onPress?.();
    router.push('/games/spotlight');
  }, [router, onPress, gameType, stateLabel]);

  // ── Metin ────────────────────────────────────────────────────────────────
  const kicker = `${t('gauntlet.bonus.label').toLocaleUpperCase(language)} · ${t('gauntlet.bonus.title')}`;
  let subtitle: string;
  let verb: string | null = null;
  if (data.status !== 'ready') {
    subtitle = t('gauntlet.bonus.subtitleNeutral');
  } else if (data.state === 'not_started') {
    subtitle = t('gauntlet.bonus.subtitle', { count: data.maxAttempts });
    verb = t('gauntlet.bonus.play');
  } else if (data.state === 'in_progress') {
    subtitle = t('gauntlet.bonus.continueHint');
    verb = t('gauntlet.bonus.continue');
  } else {
    subtitle = t(data.state === 'solved' ? 'gauntlet.bonus.solvedHint' : 'gauntlet.bonus.failedHint');
  }
  const showVerb = verb !== null && data.status === 'ready' && isSpotlightPlayable(data.state);
  const backdropUrl = data.status === 'ready' ? data.backdropUrl : '';

  // P-1c E: bugün bulmaca yok — kart yok (Shell zaten mount etmez; savunma).
  if (data.status === 'unavailable') return null;

  return (
    <Animated.View style={entryStyle}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`${kicker}. ${subtitle}${showVerb ? `. ${verb}` : ''}`}
        accessibilityHint={t('gauntlet.bonus.a11yHint')}
      >
        {/* Bugünün karesi, oyunun başladığı bulanıklıkta. Mor kenar kartın
            tek renkli öğesi — metin değil kenar. */}
        <View style={styles.frame}>
          {backdropUrl !== '' && (
            <Image
              source={{ uri: backdropUrl }}
              style={styles.frameImage}
              contentFit="cover"
              blurRadius={SPOTLIGHT_MAX_BLUR}
              accessible={false}
            />
          )}
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.kicker} numberOfLines={1}>
            {kicker}
          </Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        {showVerb && <Text style={styles.verb}>{verb?.toLocaleUpperCase(language)}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}
