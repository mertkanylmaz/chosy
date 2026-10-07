/**
 * SpotlightTeaser — bekleyiş ekranında (before_18) bugünün kilitli karesi.
 * P-5, K-62: Spotlight ritüelin ikinci yarısıdır; bekleyişte varlığı
 * duyurulur, açılışı dörtlünün (champion) arkasında kalır.
 *
 * DOKUNULAMAZ: Pressable YOK, dokunma geri bildirimi YOK, rota YOK. K-05
 * değişmez — Spotlight'ın tek giriş noktası hâlâ champion ekranındaki bonus
 * kartı; bu yüzey bir hub ya da ikinci giriş DEĞİL.
 *
 * Görünürlük kararı GauntletShell'de (`teaserRules.isTeaserVisible`); bu
 * bileşen yalnız çizildiğinde mount edilir.
 *
 * A11y: VoiceOver metni tek öğe olarak okur, rol YOK (eylem yok). Kare ve
 * kilit dekoratif. Hareket YOK — Reduce Motion açık da kapalı da aynı.
 *
 * Analytics: `spotlight_teaser_viewed` yerel günde bir kez (AsyncStorage
 * `chosy_spotlight_teaser_viewed_day`). Mount = ekranda çizildi; before_18
 * kaydırması kısa ekranda teaser'ı fold altında bırakabilir —
 * `window_height` bu ayrım için.
 */
import React, { useEffect } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { Lock } from 'phosphor-react-native';

import { SPOTLIGHT_MAX_BLUR } from '@/components/games/Spotlight/constants';
import { color } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import { localDayKey } from '@/utils/askDecision';
import { SPOTLIGHT_IMAGE_SIZE, tmdbSizedUrl } from '@/utils/tmdbSizedUrl';

import { LOCK_ICON_SIZE, styles } from './styles';
import { shouldTrackTeaserView } from './teaserRules';

const TEASER_VIEWED_DAY_KEY = 'chosy_spotlight_teaser_viewed_day';

async function trackTeaserViewedOncePerDay(windowHeight: number): Promise<void> {
  const today = localDayKey(new Date());
  const storedDay = await AsyncStorage.getItem(TEASER_VIEWED_DAY_KEY);
  if (!shouldTrackTeaserView(storedDay, today)) return;
  posthogAnalytics.track('spotlight_teaser_viewed', {
    game_id: 'spotlight',
    window_height: Math.round(windowHeight),
  });
  await AsyncStorage.setItem(TEASER_VIEWED_DAY_KEY, today);
}

interface SpotlightTeaserProps {
  /** Bugünün karesi — `SPOTLIGHT_MAX_BLUR`'da, oyunun başladığı görüntü. */
  backdropUrl: string;
}

export function SpotlightTeaser({ backdropUrl }: SpotlightTeaserProps): React.JSX.Element {
  const { t } = useLanguage();
  const { height: windowHeight } = useWindowDimensions();
  const text = t('gauntlet.spotlightTeaser');

  useEffect(() => {
    trackTeaserViewedOncePerDay(windowHeight).catch((err: unknown) => {
      // Depolama okunamadı/yazılamadı: event bugün atılmamış ya da tekrar
      // atılabilir. Ekran etkilenmez; iz Sentry'de.
      Sentry.captureException(err, {
        level: 'warning',
        tags: { component: 'SpotlightTeaser', flow: 'teaser_viewed' },
      });
    });
    // Yalnız mount'ta — günde-bir-kez kuralı depolamada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root} accessible accessibilityLabel={text}>
      <View
        style={styles.frame}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Image
          source={{ uri: tmdbSizedUrl(backdropUrl, SPOTLIGHT_IMAGE_SIZE.teaser) }}
          style={styles.frameImage}
          contentFit="cover"
          blurRadius={SPOTLIGHT_MAX_BLUR}
          accessible={false}
        />
        <View style={styles.frameDim} />
        <Lock size={LOCK_ICON_SIZE} color={color.text.primary} weight="regular" />
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}
