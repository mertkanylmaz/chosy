/**
 * WaitingChampion — bekleyiş ekranında (before_18) kullanıcının son
 * şampiyonu: tam ekran bulanık perde + sayacın altında afiş ve film adı.
 *
 * V1-D7'nin revizyonu (kurucu kararı, 30 Eyl 2026): ekran yalnız metin +
 * sayaçken fazla boştu. Seçenekler (AskUserQuestion): veri `getLastChampion`,
 * içerik "hafif perde", tarih filtresi yok (son şampiyon, dün oynanmamış
 * olsa da). K-46 korunur — arşive/Pro Mode'a/keşfe rota yok. 3 Eki 2026
 * kurucu kararı: YALNIZ afiş dokunulabilir → film detayı (E-24 değişikliği).
 *
 * Ağ: before_18'de `generate-gauntlet` ÇAĞRILMAZ (§3.6 aynen). Burada tek
 * okuma `daily_gauntlets` RLS tablo okumasıdır (Profil'in kullandığı yol).
 *
 * Sessiz değil: sorgu hatası servis katmanında Sentry'ye yazılır; kimlik
 * okunamazsa `readAppUserId` loglar. İki durumda da perde ve kart çizilmez —
 * sayaç her koşulda görünür, ritüelin asıl işi bozulmaz.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';

import * as Sentry from '@sentry/react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import { isWaitingCompact } from '@/components/gauntlet/WaitingView/styles';
import { color } from '@/constants/design/semantic';
import { useLanguage } from '@/contexts/LanguageContext';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { readAppUserId } from '@/services/auth-utils';
import { getLastChampion, type LastChampion } from '@/services/gauntletService';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';

import { CURTAIN_BLUR, CURTAIN_FADE_TOP, styles } from './styles';

/**
 * `active` true olduğunda son şampiyonu okur. Her before_18 girişinde
 * yeniden okunur — gece yarısı sıfırlamasından sonra yeni bitmiş final de
 * görünür. `identityEpoch` değişince de (kabuk açıkken kimlik değişti)
 * önceki kullanıcının kartı hemen temizlenir ve yeniden okunur.
 * Okuma bitene kadar / hata / şampiyon yok → `null`.
 */
export function useLastChampion(active: boolean, identityEpoch: number): LastChampion | null {
  const [champion, setChampion] = useState<LastChampion | null>(null);

  useEffect(() => {
    // Başka kullanıcının şampiyonu yeni kimliğin ekranında bir an bile kalmasın.
    setChampion(null);
    if (!active) return;
    let alive = true;
    (async () => {
      const userId = await readAppUserId();
      if (!userId) {
        Sentry.addBreadcrumb({
          category: 'gauntlet.waiting',
          level: 'warning',
          message: 'WaitingChampion: public user id yok — son şampiyon okunmadı',
        });
        return;
      }
      const result = await getLastChampion(userId);
      if (alive) setChampion(result);
    })().catch((err: unknown) => {
      // getLastChampion hatası servis katmanında zaten capture edildi;
      // buraya yalnız beklenmeyen hatalar düşer.
      Sentry.captureException(err, {
        tags: { component: 'WaitingChampion', flow: 'useLastChampion' },
      });
    });
    return () => {
      alive = false;
    };
  }, [active, identityEpoch]);

  return champion;
}

/** Tam ekran perde — dekoratif, erişilebilirlik ağacına girmez, dokunuş yutmaz. */
export function WaitingCurtain({ posterUrl }: { posterUrl: string }): React.JSX.Element {
  const reduceTransparency = useReduceTransparency();
  return (
    <View
      style={styles.curtain}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {reduceTransparency ? (
        <View style={styles.curtainFlat} />
      ) : (
        <ExpoImage
          source={{ uri: posterUrl }}
          style={styles.curtainImage}
          blurRadius={CURTAIN_BLUR}
          contentFit="cover"
        />
      )}
      <View style={styles.curtainDim} />
      <LinearGradient
        colors={[CURTAIN_FADE_TOP, color.surface.base]}
        locations={[0.55, 1]}
        style={styles.curtainFade}
      />
    </View>
  );
}

/** Sayacın altında son şampiyon — afiş, "Son seçimin", film adı (serif). */
export function WaitingChampionCard({ champion }: { champion: LastChampion }): React.JSX.Element {
  const { t } = useLanguage();
  const router = useRouter();
  // W1: kısa ekranda poster küçülür (WaitingView ile aynı eşik).
  const { height: windowHeight } = useWindowDimensions();
  const compact = isWaitingCompact(windowHeight);

  /**
   * Kurucu kararı (3 Eki 2026, E-24 değişikliği): YALNIZ afiş film detayına
   * gider. SALT NAVİGASYON — hiçbir şey yazılmaz. `filmId` zaten `films.id`
   * (UUID); `app/film/[id].tsx` `.eq('id', id)` ile aynı kolonu okur.
   */
  const handleOpenFilm = useCallback(() => {
    void hapticLight();
    posthogAnalytics.track('champion_poster_tapped', { screen: 'waiting' });
    router.push(`/film/${champion.filmId}`);
  }, [router, champion.filmId]);

  const posterStyle = [styles.poster, compact && styles.posterCompact];

  return (
    <View style={styles.card}>
      <Pressable
        onPress={handleOpenFilm}
        accessibilityRole="button"
        accessibilityLabel={t('gauntlet.waitingChampionOpen', { title: champion.title })}
      >
        {champion.posterUrl ? (
          <ExpoImage source={{ uri: champion.posterUrl }} style={posterStyle} contentFit="cover" />
        ) : (
          <View style={posterStyle} />
        )}
      </Pressable>
      <View style={styles.texts}>
        <Text style={styles.label}>{t('profile.lastPickLabel')}</Text>
        <Text style={styles.title}>{champion.title}</Text>
      </View>
    </View>
  );
}
