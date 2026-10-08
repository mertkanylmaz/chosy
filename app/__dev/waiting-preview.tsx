/**
 * Bekleme ekranı önizleme route'u — YALNIZ __DEV__.
 *
 * `before_18` gerçek kabukta geliştirmede görünmez (`isUnlockedNow()` __DEV__'de
 * hep true), bu yüzden `WaitingView` burada sabit verilerle çizilir. Kapıya,
 * nabza, state machine'e ya da üretim route'larına DOKUNMAZ; DB'ye YAZMAZ.
 *
 * Production build'de `Redirect href="/"` (eski dev-gauntlet deseni).
 * Açmak için: `chosy://__dev/waiting-preview` (ya da `router.push`).
 *
 * Fixture: gerçek bir `films` satırı (SELECT ile alındı, 8 Eki 2026) —
 * "Before Sunrise" (1995). Teaser karesi aynı filmin `backdrop_url`'ü; canlıda
 * bu bugünün Spotlight karesidir (dev'de yalnız görsel taşıyıcı).
 *
 * ⚠️ Teaser gerçek bileşendir: `spotlight_teaser_viewed` günlük işaretini bu
 * cihazın AsyncStorage'ına yazar ve PostHog anahtarı varsa event gönderir.
 * Son şampiyon afişine dokunmak da gerçek `/film/<id>` rotasına gider.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SpotlightTeaser } from '@/components/gauntlet/SpotlightTeaser';
import { UnlockCountdown } from '@/components/gauntlet/UnlockCountdown';
import {
  WaitingChampionCard,
  WaitingCurtain,
} from '@/components/gauntlet/WaitingChampion';
import { WaitingView } from '@/components/gauntlet/WaitingView';
import { formatUnlockTime } from '@/components/gauntlet/GauntletShell/unlockClock';
import { color, radius, size, space, type } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import type { LastChampion } from '@/services/gauntletService';

const FIXTURE_CHAMPION: LastChampion = {
  filmId: 'c9b7863a-f79d-4f81-8021-eeac01364d9c',
  posterUrl: 'https://image.tmdb.org/t/p/w342/kf1Jb1c2JAOqjuzA3H4oDM263uB.jpg',
  title: 'Before Sunrise',
};

const FIXTURE_BACKDROP =
  'https://image.tmdb.org/t/p/original/qA2TyqPldTtoTVY3LKrNIG5g6bH.jpg';

/** Native tab bar payının yerini tutar (dev'de bar yok); önizleme kontrolleri buraya oturur. */
const SIMULATED_TAB_BAR = 49;

/** Sayaç hedefi: açılışta +2 sa 49 dk — "sabit gelecek tarih", mount'ta bir kez. */
const FIXTURE_COUNTDOWN_MS = (2 * 60 + 49) * 60 * 1000;

function noop(): void {
  // Önizlemede 18:00 geçişi yok — nabız bağlı değil.
}

function Preview(): React.JSX.Element {
  const { language, t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [withChampion, setWithChampion] = useState(false);
  const [withTeaser, setWithTeaser] = useState(true);
  const [withCta, setWithCta] = useState(false);
  const target = useMemo(() => new Date(Date.now() + FIXTURE_COUNTDOWN_MS), []);

  return (
    <View style={styles.root}>
      {withChampion && FIXTURE_CHAMPION.posterUrl ? (
        <WaitingCurtain posterUrl={FIXTURE_CHAMPION.posterUrl} />
      ) : null}
      <View
        style={[
          styles.inset,
          { paddingTop: insets.top, paddingBottom: SIMULATED_TAB_BAR + insets.bottom },
        ]}
      >
        <WaitingView
          unlockTimeLabel={formatUnlockTime(language)}
          countdown={<UnlockCountdown variant="inline" target={target} onElapsed={noop} />}
          notify={
            withCta
              ? {
                  label: t('gauntlet.waitingNotifyCta', { time: formatUnlockTime(language) }),
                  onPress: noop,
                }
              : undefined
          }
          teaser={withTeaser && <SpotlightTeaser backdropUrl={FIXTURE_BACKDROP} />}
          championSection={withChampion && <WaitingChampionCard champion={FIXTURE_CHAMPION} />}
        />
      </View>
      <View style={[styles.controls, { paddingBottom: insets.bottom }]}>
        <Chip label="(a) / (b)" active={withChampion} onPress={() => setWithChampion((v) => !v)} />
        <Chip label="teaser" active={withTeaser} onPress={() => setWithTeaser((v) => !v)} />
        <Chip label="CTA" active={withCta} onPress={() => setWithCta((v) => !v)} />
      </View>
    </View>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}): React.JSX.Element {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

export default function WaitingPreviewRoute(): React.JSX.Element {
  if (!__DEV__) return <Redirect href="/" />;
  return <Preview />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: color.surface.base,
  },
  inset: {
    flex: 1,
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: SIMULATED_TAB_BAR,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: color.surface.raised,
    borderTopWidth: size.hairline,
    borderTopColor: color.surface.border,
  },
  chip: {
    minHeight: size.touchTarget - space.sm,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: size.hairline,
    borderColor: color.surface.border,
  },
  chipActive: {
    backgroundColor: color.accent.fill,
    borderColor: color.accent.edgeStrong,
  },
  chipText: {
    ...type.caption,
    color: color.text.primary,
  },
});
