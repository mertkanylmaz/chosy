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
 *
 * TestFlight 2.1.0 (26 Eyl 2026): "Nerede izlenir" butonu ve sheet'i
 * kaldırıldı — logolar TMDB'nin toplu sayfasını açıyordu, sağlayıcıya
 * gitmiyordu. Yerine dokunulmaz logo satırı (`WatchProvidersRow`). Birincil
 * eylem artık HER durumda "Sonraya bırak".
 *
 * V-3 Tur G2 (C1–C8, kurucu referansı): tam genişlik poster hero (~%60,
 * `ink`'e geçiş — heroScrim.ts), serif başlık (`filmTitle`, V3-D1 — Archivo
 * display-xl bu ekrandan çıktı), en fazla 3 logo + "See all" (V3-D5) ve alt
 * alta üç eylem: Watch Now (düz `marquee`, V3-D2; TMDB `link` uygulama içi
 * tarayıcıda, V3-D3 — sağlayıcı/link yoksa render edilmez), Sonraya bırak,
 * Paylaş. Reveal sekansı, kaydetme ve paylaşım mantığı DEĞİŞMEDİ.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import * as Clipboard from 'expo-clipboard';
import * as Sentry from '@sentry/react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BookmarkSimple, FilmSlate, Play, ShareNetwork } from 'phosphor-react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { ChampionActionButton } from '@/components/gauntlet/ChampionActionButton';
import { QuietAction } from '@/components/gauntlet/QuietAction';
import { WatchProvidersRow } from '@/components/gauntlet/WatchProviders';
import { useWatchProviders } from '@/components/gauntlet/WatchProviders/useWatchProviders';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  BLACKOUT_SEQUENCE,
  DISSOLVE_DURATION,
  EASE_OUT_QUART,
  REDUCED_MOTION_DURATION,
} from '@/constants/design/motion';
import { color, size, space } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { posthogAnalytics } from '@/services/posthog';
import { saveChampionForLater } from '@/services/gauntletService';
import type { CycleMode } from '@/components/gauntlet/GauntletShell/cycleRules';
import type { GauntletFilm } from '@/types/gauntlet';
import { buildGauntletShareText, type ShareRound } from '@/utils/gauntletShareText';
import { upgradePosterUrl } from '@/utils/posterUrl';
import { hapticLight } from '@/utils/haptics';
import { orderProviders } from '@/utils/watchProviderList';

import {
  HERO_HEIGHT_RATIO,
  KICKER_TOP_GAP,
  SCRIM_STOPS,
  TITLE_OVERLAP,
  TOP_SCRIM_HEIGHT,
  TOP_SCRIM_STOPS,
} from './heroScrim';
import { styles } from './styles';

/**
 * C1 geçişi: renk SABİT `ink`, yalnız alfa değişir (heroScrim.ts). Tuple
 * tipi `expo-linear-gradient`'in "en az iki renk" imzası için.
 */
const SCRIM_COLORS = SCRIM_STOPS.map((s) => withAlpha(color.surface.base, s.alpha)) as [
  string,
  string,
  ...string[],
];
const SCRIM_LOCATIONS = SCRIM_STOPS.map((s) => s.at) as [number, number, ...number[]];

/** V-3 referans uyumu: etiketin arkasındaki üst geçiş — aynı ilke, ters yön. */
const TOP_SCRIM_COLORS = TOP_SCRIM_STOPS.map((s) =>
  withAlpha(color.surface.base, s.alpha),
) as [string, string, ...string[]];
const TOP_SCRIM_LOCATIONS = TOP_SCRIM_STOPS.map((s) => s.at) as [
  number,
  number,
  ...number[],
];

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

/**
 * Baslik kademesi esikleri (karakter) — C8. Olcum gerekcesi styles.ts'te.
 * Saf fonksiyon: ayni baslik her cihazda AYNI boyutta cizilir.
 */
const TITLE_TIER_MEDIUM = 25;
const TITLE_TIER_SMALL = 35;

function titleTierStyle(title: string): 'titleMedium' | 'titleSmall' | null {
  if (title.length > TITLE_TIER_SMALL) return 'titleSmall';
  if (title.length > TITLE_TIER_MEDIUM) return 'titleMedium';
  return null;
}

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
   * V-2 Tur C: E-21 önceki döngü şampiyonu "Bugünün filmi" DEĞİL — kullanıcının
   * ilk filmi. Yalnız etiketi değiştirir; davranış aynı.
   */
  cycle?: CycleMode;
  /**
   * V-3 referans uyumu: hero'nun tepesinde başka bir bildirim (K-42 bayat
   * göstergesi) varsa etiket oraya ÇIKMAZ, başlığın üstünde kalır — iki
   * metin aynı satıra binmesin. Yalnız yerleşimi değiştirir.
   */
  topNoticeVisible?: boolean;
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
  cycle = 'current',
  topNoticeVisible = false,
}: ChampionRevealProps): React.JSX.Element {
  const { t, language, region } = useLanguage();
  const router = useRouter();
  const isReducedMotion = useReducedMotion();
  /** C1: açıkken geçiş çizilmez — poster sert kenarla biter, altı düz `ink`. */
  const reduceTransparency = useReduceTransparency();
  const { height: windowHeight } = useWindowDimensions();
  const heroHeight = Math.round(windowHeight * HERO_HEIGHT_RATIO);
  const insets = useSafeAreaInsets();
  /**
   * V-3 referans uyumu: etiket hero'nun tepesinde. Reduce Transparency'de
   * geçiş çizilmez → poster üstünde kontrast garanti edilemez, etiket
   * başlığın üstünde (düz `ink`) kalır. Bayat göstergeyle de aynı kural.
   */
  const kickerOnHero = !reduceTransparency && !topNoticeVisible;
  const [shareNotice, setShareNotice] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  /** C2e: dort durum - loading / ok / empty / error. */
  const { state: providersState, providers, retry } = useWatchProviders(
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
  const handleOpenFilm = useCallback(() => {
    void hapticLight();
    router.push(`/film/${champion.id}`);
  }, [router, champion.id]);

  /**
   * V-3 Tur G2 (C6, V3-D3): Watch Now — TMDB'nin bölgeye özel `link`'i
   * uygulama içi tarayıcıda. Sağlayıcı yoksa ya da `link` yoksa buton HİÇ
   * render edilmez (devre dışı değil). Sayı `orderProviders` uzunluğudur —
   * logo satırındaki "See all" ile aynı tekilleştirilmiş kaynak.
   */
  const providerCount = useMemo(
    () => (providersState === 'ok' && providers ? orderProviders(providers).length : 0),
    [providersState, providers],
  );
  const watchLink = providersState === 'ok' ? providers?.link : undefined;
  const showWatchNow = watchLink !== undefined && watchLink !== '' && providerCount > 0;

  /** Tarayıcı açılamazsa sessiz geçilmez: Sentry + görünür mesaj (§15.2). */
  const handleWatchNow = useCallback(async () => {
    if (!watchLink) return;
    void hapticLight();
    posthogAnalytics.track('watch_now_tapped', {
      film_id: champion.id,
      cycle,
      region,
      provider_count: providerCount,
    });
    try {
      await WebBrowser.openBrowserAsync(watchLink);
    } catch (err) {
      Sentry.captureException(err, {
        tags: { component: 'ChampionReveal', flow: 'watch_now' },
        extra: { film_id: champion.id, region },
      });
      showNotice(t('gauntlet.watchNow.error'));
    }
  }, [watchLink, champion.id, cycle, region, providerCount, showNotice, t]);

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

  /**
   * V-3 Tur G2 (C1): orijinal URL de yuklenemezse (ya da URL hic yoksa)
   * duz `charcoal` + sessiz yer tutucu. Sessiz fallback DEGIL — iz birakir.
   * Reveal zamanlamasi degismez: kara bosluk 1.5s tavaniyla yine baslar.
   */
  const [posterFailed, setPosterFailed] = useState(champion.posterUrl === '');

  useEffect(() => {
    if (champion.posterUrl !== '') return;
    Sentry.addBreadcrumb({
      category: 'gauntlet.poster',
      message: 'champion posterUrl bos - yer tutucu gosterildi',
      level: 'warning',
      data: { film_id: champion.id },
    });
  }, [champion.id, champion.posterUrl]);

  /** Yukseltilmis URL yuklenemezse orijinaline dus - bos poster gosterme. */
  const handlePosterError = useCallback(() => {
    if (posterUri === champion.posterUrl) {
      Sentry.addBreadcrumb({
        category: 'gauntlet.poster',
        message: 'champion posteri yuklenemedi - yer tutucu gosterildi',
        level: 'warning',
        data: { film_id: champion.id },
      });
      setPosterFailed(true);
      return;
    }
    Sentry.addBreadcrumb({
      category: 'gauntlet.poster',
      message: 'w780 yuklenemedi - orijinal URLe dusuldu',
      level: 'warning',
      data: { film_id: champion.id },
    });
    setPosterUri(champion.posterUrl);
  }, [posterUri, champion.posterUrl, champion.id]);

  const tierStyle = titleTierStyle(champion.title);

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

  /** C2: önceki döngü şampiyonu "Bu akşamın filmi" DEĞİL, kullanıcının ilk filmi. */
  const isFirst = cycle === 'previous';
  const kickerText = t(isFirst ? 'gauntlet.championTitleFirst' : 'gauntlet.championTitle');

  return (
    <View
      style={styles.container}
      accessibilityLabel={t(
        isFirst ? 'gauntlet.championAccessibilityLabelFirst' : 'gauntlet.championAccessibilityLabel',
        { title: champion.title, year: champion.year, runtime: champion.runtime },
      )}
    >
      {/*
        C1 hero — ekranın ~%60'ı, `cover`. VoiceOver'dan GİZLİ: çerçevenin en
        üstünde olduğu için ilk okunurdu; sıra etiket → başlık → meta →
        platformlar → eylemler. Detaya geçiş VO'da başlığın `activate`'i.
      */}
      <Animated.View
        style={[styles.hero, { height: heroHeight }, posterStyle]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <TouchableOpacity
          style={styles.posterTouchable}
          onPress={handleOpenFilm}
          activeOpacity={0.85}
          accessible={false}
        >
          {posterFailed ? (
            <View style={styles.posterPlaceholder}>
              <FilmSlate size={size.touchTarget} color={color.text.secondary} weight="thin" />
            </View>
          ) : (
            <Image
              source={{ uri: posterUri }}
              style={styles.poster}
              contentFit="cover"
              onLoad={() => setPosterLoaded(true)}
              onError={handlePosterError}
            />
          )}
        </TouchableOpacity>
        {kickerOnHero && (
          <LinearGradient
            pointerEvents="none"
            style={[styles.topScrim, { height: TOP_SCRIM_HEIGHT }]}
            colors={TOP_SCRIM_COLORS}
            locations={TOP_SCRIM_LOCATIONS}
          />
        )}
        {!reduceTransparency && (
          <LinearGradient
            pointerEvents="none"
            style={styles.scrim}
            colors={SCRIM_COLORS}
            locations={SCRIM_LOCATIONS}
          />
        )}
      </Animated.View>

      {/* V-3 referans uyumu: etiket hero'nun tepesinde, güvenli alanın altında.
          Hero'nun kardeşi (içinde değil) — hero VoiceOver'dan gizli, etiket
          okunur ve sıra etiket → başlık olarak kalır. */}
      {kickerOnHero && (
        <Animated.View
          style={[styles.kickerOnHero, { top: insets.top + KICKER_TOP_GAP }, titleStyle]}
          pointerEvents="none"
        >
          <Text style={styles.kicker} accessibilityLabel={kickerText}>
            {kickerText.toLocaleUpperCase(language)}
          </Text>
        </Animated.View>
      )}

      {/* C3: blok geçişin üstüne biner (kontrast ölçümü heroScrim.ts). Reduce
          Transparency'de geçiş yok — blok posterin ALTINDA, düz ink üstünde. */}
      <View style={[styles.body, { marginTop: reduceTransparency ? space.lg : -TITLE_OVERLAP }]}>
        <Animated.View style={titleStyle}>
          {!kickerOnHero && (
            <Text style={[styles.kicker, styles.kickerInBody]} accessibilityLabel={kickerText}>
              {kickerText.toLocaleUpperCase(language)}
            </Text>
          )}
          {/* C8: deterministik kademe, runtime autoscale YOK. VoiceOver TAM
              basligi duyar — gorsel kisaltma bilgi eksiltmez (K-54). */}
          <Text
            style={[styles.title, tierStyle !== null && styles[tierStyle]]}
            numberOfLines={3}
            accessibilityRole="header"
            accessibilityLabel={champion.title}
            accessibilityHint={t('gauntlet.championOpenFilm', { title: champion.title })}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'activate') handleOpenFilm();
            }}
          >
            {champion.title}
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.metaLine, metaStyle]} numberOfLines={1}>
          {t('gauntlet.tileMeta', { year: champion.year, runtime: champion.runtime })}
        </Animated.Text>

        {/* Eylemler — meta ile aynı vuruşta belirir (§10.2 sırası bozulmaz). */}
        <Animated.View style={[styles.actionsWrapper, metaStyle]}>
          {/*
            "Nerede izlenir" — en fazla 3 logo + "See all" sheet'i (C5).
            Dört durumu `WatchProvidersRow` çizer; hata durumundaki
            "Tekrar dene" bloğun içinde, sessiz eylem olarak.
          */}
          <WatchProvidersRow
            state={providersState}
            providers={providers}
            onRetry={retry}
            filmId={champion.id}
          />

          {shareNotice !== null && <Text style={styles.shareNotice}>{shareNotice}</Text>}

          {/* C6 — tam genişlik, alt alta, ≥ 48pt. */}
          <View style={styles.actionsStack}>
            {showWatchNow && (
              <ChampionActionButton
                label={t('gauntlet.watchNow.action')}
                icon={Play}
                variant="marquee"
                onPress={() => void handleWatchNow()}
              />
            )}

            {/* "Sonraya bırak" — mantık aynı; Watch Now yokken dolgulu. */}
            {gauntletId !== undefined && (
              <ChampionActionButton
                label={
                  saveState === 'saved'
                    ? t('gauntlet.saveForLater.saved')
                    : t('gauntlet.saveForLater.action')
                }
                icon={BookmarkSimple}
                variant={showWatchNow ? 'outline' : 'filled'}
                onPress={() => void handleSaveForLater()}
                // 'saving' → çift yazma denemesi engellenir; 'saved' → eylem
                // tamamlandı, tekrar basılacak bir şey yok.
                disabled={saveState !== 'idle'}
                busy={saveState === 'saving'}
              />
            )}

            {date !== undefined && (
              <ChampionActionButton
                label={t('gauntlet.share.action')}
                icon={ShareNetwork}
                variant="outline"
                onPress={() => void handleShare()}
              />
            )}
          </View>

          {onDismiss && <QuietAction label={t('gauntlet.close')} onPress={onDismiss} />}
        </Animated.View>
      </View>
    </View>
  );
}
