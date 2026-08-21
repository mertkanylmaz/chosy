/**
 * ChampionReveal — şampiyon ekranı, kara boşluk sekansı. DESIGN_OS §7.3, §10.2.
 *
 * Canlı final seçiminde (`animateReveal`) 720ms'lik imza an — kısaltılmaz:
 *   BLACKOUT_SEQUENCE.blackout  (120ms KESME, tam karanlık — ink §2.2)
 *   BLACKOUT_SEQUENCE.pause     (400ms nefes, hiçbir şey yok)
 *   → poster opaklık ile belirir (Geçiş)
 *   BLACKOUT_SEQUENCE.titleDelay (200ms sonra başlık, Archivo Expanded —
 *                                 bu ekrandaki TEK kullanım, display-xl)
 *   BLACKOUT_SEQUENCE.metaDelay  (200ms sonra meta, Martian Mono)
 *
 * Reduce Motion (§7.5): geçişler REDUCED_MOTION_DURATION.crossFade (100ms),
 * kara boşluk SÜRELERİ aynen korunur — hareket değil zamanlama.
 *
 * Resume yolunda (`animateReveal: false`) sekans atlanır, doğrudan gösterilir.
 *
 * Şampiyon watchlist'e OTOMATİK YAZILMAZ (PRODUCT_OS §3.7) — `onDismiss`
 * yalnızca ekranı kapatır, hiçbir yazma eylemi tetiklemez.
 *
 * C.9b-2: "Sonraya bırak" eklendi (IA §2.3). §3.7 KORUNUYOR — yazma yalnızca
 * kullanıcının açık dokunuşuyla olur, ekranın açılması hiçbir şey yazmaz.
 * Yazan taraf SUNUCU (`submit-choice` action: 'save_for_later'); bu bileşen
 * `getAppUserId()` çağırmaz ve INSERT yapmaz. Kaydedilen satır İZLENDİ
 * değildir — `watched_at` NULL kalır.
 *
 * ⚠️ 14.08.2026 cihaz testinde bulundu: bu bileşende çıkış eylemi hiç
 * YOKTU — kullanıcı şampiyon ekranında sıkışıyordu (kök neden: plan
 * boşluğu, GauntletShell'in oyun içi olaylar tablosu completed_today→
 * champion dalına hiçbir eylem bağlamamıştı). `onDismiss` bu turda eklendi.
 *
 * C.5: "Paylaş" sessiz eylemi. Paylaşılan şey METİNDİR (§16 madde 12) —
 * ekran görüntüsü alınmaz, poster/still gönderilmez.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import * as Clipboard from 'expo-clipboard';
import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { QuietAction } from '@/components/gauntlet/QuietAction';
import { WatchProviders } from '@/components/gauntlet/WatchProviders';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BLACKOUT_SEQUENCE,
  DISSOLVE_DURATION,
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
} from '@/constants/design/motion';
import { posthogAnalytics } from '@/services/posthog';
import { saveChampionForLater } from '@/services/gauntletService';
import type { GauntletFilm } from '@/types/gauntlet';
import { buildGauntletShareText, type ShareRound } from '@/utils/gauntletShareText';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

/** "Kopyalandı" onayının ekranda kalma süresi. */
const COPIED_NOTICE_MS = 2400;

interface ChampionRevealProps {
  champion: GauntletFilm;
  /** true: canlı final geçişi (kara boşluk sekansı); false: resume, doğrudan göster */
  animateReveal: boolean;
  /** Ekranı kapatır — YAZMA eylemi DEĞİL (§3.7). Yoksa çıkış kontrolü gösterilmez. */
  onDismiss?: () => void;
  /**
   * `DailyGauntlet.date` (YYYY-MM-DD). Yoksa paylaşım eylemi GÖSTERİLMEZ —
   * tarihsiz braket metni üretmektense eylemi hiç sunmamak dürüst olandır.
   */
  date?: string;
  /**
   * Bu oturumda ölçülen tur zinciri. Boşsa metin yalnız şampiyon satırını
   * taşır (resume yolu — istemcide geçmiş yok, bkz. gauntletShareText).
   */
  rounds?: ShareRound[];
  /**
   * `DailyGauntlet.gauntletId`. Yoksa "Sonraya bırak" GÖSTERİLMEZ — sunucu
   * sahipliği bu kimlik üzerinden doğruluyor, onsuz çağrı yapılamaz. `date`
   * ile paylaşım eylemindeki davranışın aynısı.
   */
  gauntletId?: string;
}

/** "Sonraya bırak" eyleminin durumu — çift dokunuşa ve tekrar yazmaya karşı. */
type SaveState = 'idle' | 'saving' | 'saved';

export function ChampionReveal({
  champion,
  animateReveal,
  onDismiss,
  date,
  rounds,
  gauntletId,
}: ChampionRevealProps): React.JSX.Element {
  const { t, language } = useLanguage();
  const router = useRouter();
  const isReducedMotion = useReducedMotion();
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  /** Kısa ömürlü onay/hata metni — paylaşım ve kaydetme aynı satırı kullanır. */
  const showNotice = useCallback((message: string) => {
    if (!mountedRef.current) return;
    setShareNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => {
      if (mountedRef.current) setShareNotice(null);
    }, COPIED_NOTICE_MS);
  }, []);

  /**
   * "Sonraya bırak" — şampiyonu watchlist'e kaydeder.
   *
   * Yazma SUNUCUDA (`submit-choice` action: 'save_for_later'); burada kimlik
   * çözümlemesi ya da INSERT YOKTUR. `already_saved` hata değildir: kullanıcı
   * için sonuç aynıdır ("listende"), ayrı bir uyarı göstermek gereksiz gürültü
   * olurdu — ayrım yalnızca analytics'e gider.
   *
   * Hata sessizce yutulmaz: eylem `idle`'a döner (kullanıcı tekrar deneyebilir)
   * ve görünür bir mesaj basılır. Sentry raporu `gauntletService` katmanında
   * atılıyor, burada tekrarlanmaz — aynı hata iki kez düşmesin.
   */
  const handleSaveForLater = useCallback(async () => {
    if (!gauntletId || saveState !== 'idle') return;
    setSaveState('saving');
    void hapticLight();
    try {
      const result = await saveChampionForLater(gauntletId, champion.id);
      posthogAnalytics.track('save_for_later', {
        gauntlet_id: gauntletId,
        film_id: champion.id,
        status: result.status,
      });
      if (!mountedRef.current) return;
      setSaveState('saved');
      showNotice(t('gauntlet.saveForLater.done'));
    } catch {
      if (!mountedRef.current) return;
      setSaveState('idle');
      showNotice(t('gauntlet.saveForLater.error'));
    }
  }, [gauntletId, saveState, champion.id, showNotice, t]);

  /**
   * Panoya kopyalar. `expo-sharing` KULLANILMAZ: o API bir dosya URI'si ister
   * (`shareAsync(url)`), düz metni paylaşamaz — kullanmak için metni tekrar
   * görsele çevirmek gerekirdi ki bu §16 madde 12'nin "metin öncelikli"
   * kararına aykırı. Pano hem çevrimdışı hem her hedefe yapıştırılabilir.
   *
   * Hata sessizce yutulmaz: Sentry + kullanıcıya görünür mesaj (§15.2).
   */
  const handleShare = useCallback(async () => {
    if (!date) return;
    const text = buildGauntletShareText({
      championTitle: champion.title,
      championYear: champion.year,
      date,
      rounds: rounds ?? [],
      locale: language,
      t,
    });
    void hapticLight();
    try {
      await Clipboard.setStringAsync(text);
      showNotice(t('gauntlet.share.copied'));
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'ChampionReveal', flow: 'share' },
      });
      showNotice(t('gauntlet.share.copyError'));
    }
  }, [champion.title, champion.year, date, rounds, language, showNotice, t]);

  /**
   * Afişe dokunuş → mevcut film detay ekranı (`app/film/[id].tsx`). SALT
   * NAVİGASYON: §3.7 korunur, hiçbir şey yazılmaz. `champion.id` zaten
   * `films.id` (UUID) ve o ekran da `.eq('id', id)` ile aynı kolonu okur.
   */
  const handleOpenFilm = useCallback(() => {
    void hapticLight();
    router.push(`/film/${champion.id}`);
  }, [router, champion.id]);

  const posterOpacity = useSharedValue(animateReveal ? 0 : 1);
  const titleOpacity = useSharedValue(animateReveal ? 0 : 1);
  const metaOpacity = useSharedValue(animateReveal ? 0 : 1);

  useEffect(() => {
    if (!animateReveal) return;

    // Kara boşluk zamanlaması Reduce Motion'da DEĞİŞMEZ (§7.5) — yalnızca
    // belirme süreleri cross-fade'e iner.
    const fadeDuration = isReducedMotion
      ? REDUCED_MOTION_DURATION.crossFade
      : DISSOLVE_DURATION.newContender;
    const fade = { duration: fadeDuration, easing: EASE_OUT_QUART };

    const posterAt = BLACKOUT_SEQUENCE.blackout + BLACKOUT_SEQUENCE.pause;
    const titleAt = posterAt + BLACKOUT_SEQUENCE.titleDelay;
    const metaAt = titleAt + BLACKOUT_SEQUENCE.metaDelay;

    posterOpacity.value = withDelay(posterAt, withTiming(1, fade));
    titleOpacity.value = withDelay(titleAt, withTiming(1, fade));
    metaOpacity.value = withDelay(metaAt, withTiming(1, fade));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateReveal, isReducedMotion]);

  const posterStyle = useAnimatedStyle(() => ({ opacity: posterOpacity.value }));
  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }));
  const metaStyle = useAnimatedStyle(() => ({ opacity: metaOpacity.value }));

  return (
    <View
      style={styles.container}
      accessibilityLabel={t('gauntlet.championAccessibilityLabel', {
        title: champion.title,
        year: champion.year,
        runtime: champion.runtime,
      })}
    >
      <Animated.View style={[styles.posterWrapper, posterStyle]}>
        <TouchableOpacity
          style={styles.posterTouchable}
          onPress={handleOpenFilm}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('gauntlet.championOpenFilm', { title: champion.title })}
        >
          <Image
            source={{ uri: champion.posterUrl }}
            style={styles.poster}
            contentFit="cover"
          />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={titleStyle}>
        <Text style={styles.kicker}>{t('gauntlet.championTitle')}</Text>
        <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit>
          {champion.title}
        </Text>
      </Animated.View>

      <Animated.Text style={[styles.metaLine, metaStyle]} numberOfLines={1}>
        {t('gauntlet.posterMeta', { year: champion.year, runtime: champion.runtime })}
      </Animated.Text>

      {/* "Nerede izlenir" — meta ile aynı zamanlamada belirir (§10.2 sırası bozulmaz). */}
      <Animated.View style={metaStyle}>
        <WatchProviders filmId={champion.id} />
      </Animated.View>

      <Animated.View style={[styles.actionsWrapper, metaStyle]}>
        {shareNotice !== null && <Text style={styles.shareNotice}>{shareNotice}</Text>}
        <View style={styles.actionsRow}>
          {gauntletId !== undefined && (
            <>
              <QuietAction
                label={
                  saveState === 'saved'
                    ? t('gauntlet.saveForLater.saved')
                    : t('gauntlet.saveForLater.action')
                }
                onPress={() => void handleSaveForLater()}
                // 'saving' → çift yazma denemesi engellenir; 'saved' → eylem
                // tamamlandı, tekrar basılacak bir şey yok.
                disabled={saveState !== 'idle'}
              />
              {(date !== undefined || onDismiss) && (
                <Text style={styles.actionSeparator}>·</Text>
              )}
            </>
          )}
          {date !== undefined && (
            <>
              <QuietAction
                label={t('gauntlet.share.action')}
                onPress={() => void handleShare()}
              />
              {onDismiss && <Text style={styles.actionSeparator}>·</Text>}
            </>
          )}
          {onDismiss && <QuietAction label={t('gauntlet.close')} onPress={onDismiss} />}
        </View>
      </Animated.View>
    </View>
  );
}
