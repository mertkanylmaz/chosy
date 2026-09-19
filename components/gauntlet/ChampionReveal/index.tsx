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

import { PrimaryAction } from '@/components/gauntlet/PrimaryAction';
import { QuietAction } from '@/components/gauntlet/QuietAction';
import { WatchProvidersSheet } from '@/components/gauntlet/WatchProviders';
import { useWatchProviders } from '@/components/gauntlet/WatchProviders/useWatchProviders';
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
import { upgradePosterUrl } from '@/utils/posterUrl';
import { hapticLight } from '@/utils/haptics';

import { styles } from './styles';

/** "Kopyalandı" onayının ekranda kalma süresi. */
const COPIED_NOTICE_MS = 2400;

/**
 * C5: sampiyon posteri hazir degilse KARA BOSLUK ne kadar uzatilabilir.
 *
 * §7.3'un 520ms'i (blackout + pause) normal durumda yeterli. Yavas agda
 * poster o ana yetismezse dizi yine de baslarsa poster ORTADA ani belirir
 * ve imza an bozulur. Bu yuzden siyah beklenir - ama sinirsiz degil:
 * 1.5s'te dizi zorla baslar ve poster w500'e duser.
 */
const POSTER_WAIT_CAP_MS = 1500;

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
  /**
   * Where to Watch sheet'i acilip kapandiginda haber verir. GauntletShell
   * auth/bildirim istemini bu sirada TETIKLEMEZ, kapaninca kuyruktan acar
   * (C2 kabul kriteri) - iki sheet ust uste binmez.
   */
  onSheetVisibilityChange?: (open: boolean) => void;
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
  onSheetVisibilityChange,
}: ChampionRevealProps): React.JSX.Element {
  const { t, language, region } = useLanguage();
  const router = useRouter();
  const isReducedMotion = useReducedMotion();
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [sheetOpen, setSheetOpen] = useState(false);
  /** C2e: dort durum - loading / ok / empty / error. */
  const { state: providersState, providers, link, retry } = useWatchProviders(
    champion.id,
    region,
  );
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
  const openSheet = useCallback(() => {
    void hapticLight();
    setSheetOpen(true);
    onSheetVisibilityChange?.(true);
  }, [onSheetVisibilityChange]);

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    onSheetVisibilityChange?.(false);
  }, [onSheetVisibilityChange]);

  const handleOpenFilm = useCallback(() => {
    void hapticLight();
    router.push(`/film/${champion.id}`);
  }, [router, champion.id]);

  /**
   * C7: Champion posteri w780. Sunucu w500 veriyor (gauntletCore), bu ekran
   * ekranin %58'ini kapliyor ve 3x'te >=720px gerekiyor. Yukseltme saf bir
   * yardimciyla yapiliyor; desen eslesmezse URL OLDUGU GIBI kalir.
   */
  const upgrade = upgradePosterUrl(champion.posterUrl);
  const [posterUri, setPosterUri] = useState(upgrade.url);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [waitCapReached, setWaitCapReached] = useState(false);
  const revealStartedAtRef = useRef(Date.now());
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Yukseltme yapilamadiysa sessiz gecilmez: desen tanindiysa zaten
   * yukseltilmistir, taninmadiysa sunucudaki URL bicimi degismis demektir
   * ve bunun izi kalmali (K-44). Kullaniciya yansimaz - poster yine gosterilir.
   */
  useEffect(() => {
    if (upgrade.upgraded) return;
    Sentry.addBreadcrumb({
      category: 'gauntlet.poster',
      message: 'champion posteri w780e yukseltilemedi',
      level: 'info',
      data: { film_id: champion.id, reason: upgrade.reason },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [champion.id, upgrade.upgraded, upgrade.reason]);

  /** C5: 1.5s tavani. Poster yetismezse diziyi baslat ve w500'e dus. */
  useEffect(() => {
    if (!animateReveal) return;
    capTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      setWaitCapReached(true);
      setPosterLoaded((loaded) => {
        if (!loaded) {
          setPosterUri(champion.posterUrl);
          Sentry.addBreadcrumb({
            category: 'gauntlet.poster',
            message: 'w780 1.5s icinde yuklenmedi - w500e dusuldu',
            level: 'warning',
            data: { film_id: champion.id },
          });
        }
        return loaded;
      });
    }, POSTER_WAIT_CAP_MS);
    return () => {
      if (capTimerRef.current) clearTimeout(capTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateReveal, champion.id]);

  /** Yukseltilmis URL yuklenemezse orijinaline dus - bos poster gosterme. */
  const handlePosterError = useCallback(() => {
    if (posterUri === champion.posterUrl) return;
    Sentry.addBreadcrumb({
      category: 'gauntlet.poster',
      message: 'w780 yuklenemedi - orijinal URLe dusuldu',
      level: 'warning',
      data: { film_id: champion.id },
    });
    setPosterUri(champion.posterUrl);
  }, [posterUri, champion.posterUrl, champion.id]);

  const posterOpacity = useSharedValue(animateReveal ? 0 : 1);
  const titleOpacity = useSharedValue(animateReveal ? 0 : 1);
  const metaOpacity = useSharedValue(animateReveal ? 0 : 1);

  useEffect(() => {
    if (!animateReveal) return;
    // C5: poster hazir degilse SIYAH BEKLE. Tavan asilirsa yine baslar.
    if (!posterLoaded && !waitCapReached) return;

    // Kara boşluk zamanlaması Reduce Motion'da DEĞİŞMEZ (§7.5) — yalnızca
    // belirme süreleri cross-fade'e iner.
    const fadeDuration = isReducedMotion
      ? REDUCED_MOTION_DURATION.crossFade
      : DISSOLVE_DURATION.newContender;
    const fade = { duration: fadeDuration, easing: EASE_OUT_QUART };

    // §7.3'un 520ms'i mount anindan sayilir. Poster gec geldiyse gecen sure
    // dusulur ki dizi TOPLAMDA uzamasin - kara bosluk zaten siyah gecti.
    const elapsed = Date.now() - revealStartedAtRef.current;
    const posterAt = Math.max(
      0,
      BLACKOUT_SEQUENCE.blackout + BLACKOUT_SEQUENCE.pause - elapsed,
    );
    const titleAt = posterAt + BLACKOUT_SEQUENCE.titleDelay;
    const metaAt = titleAt + BLACKOUT_SEQUENCE.metaDelay;

    posterOpacity.value = withDelay(posterAt, withTiming(1, fade));
    titleOpacity.value = withDelay(titleAt, withTiming(1, fade));
    metaOpacity.value = withDelay(metaAt, withTiming(1, fade));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animateReveal, isReducedMotion, posterLoaded, waitCapReached]);

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
            source={{ uri: posterUri }}
            style={styles.poster}
            contentFit="cover"
            onLoad={() => setPosterLoaded(true)}
            onError={handlePosterError}
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

      {/* Eylemler — meta ile aynı vuruşta belirir (§10.2 sırası bozulmaz). */}
      <Animated.View style={[styles.actionsWrapper, metaStyle]}>
        {shareNotice !== null && <Text style={styles.shareNotice}>{shareNotice}</Text>}

        {/*
          BİRİNCİL EYLEM — L-3: "Nerede izlenir". C2e'nin dört durumu:

          loading → buton yerinde, sönük. Pop-in YOK; birincil eylemi sonradan
                    belirtmek düzeni en pahalı yerde zıplatır.
          ok      → sheet açar.
          empty   → istek BAŞARILI ama bölgede sağlayıcı yok. Dürüst tek satır
                    + "Sonraya bırak" birincil eyleme YÜKSELİR: kullanıcıya
                    yapacak bir şey kalmalı.
          error   → boştan AYRI. Gerçek mesaj + yeniden dene. "Sonraya bırak"
                    YÜKSELMEZ — geçici bir arıza kalıcı bir hiyerarşi
                    değişikliğine yol açmamalı.
        */}
        {providersState === 'empty' && (
          <Text style={styles.stateLine}>{t('gauntlet.watchProviders.empty')}</Text>
        )}
        {providersState === 'error' && (
          <Text style={styles.stateLine}>{t('gauntlet.watchProviders.error')}</Text>
        )}

        {providersState === 'empty' && gauntletId !== undefined ? (
          <PrimaryAction
            label={
              saveState === 'saved'
                ? t('gauntlet.saveForLater.saved')
                : t('gauntlet.saveForLater.action')
            }
            onPress={() => void handleSaveForLater()}
            disabled={saveState !== 'idle'}
            busy={saveState === 'saving'}
          />
        ) : providersState === 'error' ? (
          <PrimaryAction label={t('gauntlet.retry')} onPress={retry} />
        ) : (
          <PrimaryAction
            label={t('gauntlet.watchProviders.action')}
            onPress={openSheet}
            disabled={providersState === 'loading'}
            busy={providersState === 'loading'}
          />
        )}

        {/* İKİNCİL EYLEMLER — sessiz metin bağlantıları (L-2). */}
        <View style={styles.actionsRow}>
          {gauntletId !== undefined && providersState !== 'empty' && (
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

      <WatchProvidersSheet
        visible={sheetOpen}
        onClose={closeSheet}
        filmId={champion.id}
        providers={providers}
        link={link}
      />
    </View>
  );
}
