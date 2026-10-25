/**
 * Mood search ekrani — duygu giris akisi + AI Processing → dogrudan film destesi.
 *
 * ⚠️ C.9b (19.08.2026): Bu dosya `app/(tabs)/index.tsx`'ten BURAYA TASINDI.
 * Home route'u artik gunluk gauntlet ritueline ait (GauntletShell). Kod
 * SILINMEDI — bible K-02'nin "Discover kod korunur, silinmez" prensibiyle
 * ayni sekilde saklaniyor; C.9c bunu Profile altina baglayacak. Su an hicbir
 * route bu bileseni mount ETMIYOR.
 *
 * Tasima sirasinda mood search MANTIGINA dokunulmadi. Tek cikarma:
 * gecici `__DEV__` "🎬 Gauntlet Test" floating butonu (artik gauntlet
 * Home'un kendisi, test kapisina gerek yok).
 *
 * Asagidaki aciklama tasima oncesi haliyle korunmustur:
 *
 * Home sekmesi — duygu giris akisi + AI Processing + Mood Profile Result.
 *
 * UX Redesign v3 — Tab restructure:
 *   Home tab artik tam MoodScreen iceriyor (eskiden ayri Discover tab'daydı).
 *   Duplicate mood input kaldirildi — tek giris noktasi burasi.
 *
 * Asamalar:
 *   input      — Ekran basligi + Era/Quality chip filtreleri + metin girisi
 *                + Quick Moods + sabit alt "Find Movies" butonu
 *   processing — AIProcessingOverlay (modal overlay)
 *   (sonuc)    — PRO-0 F0-3: profil/paylasim ekrani yok; arama bitince dogrudan
 *                 discover destesine gecilir (dosyalar duruyor, rota yok)
 *
 * UX Kararlari:
 *   - Logo hero kaldirildi → sade baslik + subtitle
 *   - "Find Movies" butonu sabit alt bar (klavye ile yukselir)
 *   - Quick Mood secimi → haptik + buton flash animasyon
 *   - "Any" chip varsayilan secili ve listeye ilk siraya alindi
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';

import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';

import AIProcessingOverlay from '@/components/AIProcessingOverlay';
import QuotaExhausted from '@/components/QuotaExhausted';
import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { useMoodOfferEnabled } from '@/hooks/useMoodOfferEnabled';
import { useFreeVisibleCount } from '@/hooks/useFreeVisibleCount';
import { useProModeAccess } from '@/hooks/useProModeAccess';
import MoodCardGrid, { MOOD_CARDS } from '@/components/Home/MoodCardGrid';
import FilterBottomSheet from '@/components/Home/FilterBottomSheet';
import { Colors } from '@/constants/Colors';
import { color } from '@/constants/design/semantic';
import { withAlpha } from '@/constants/gameThemes';
import { i18n } from '@/constants/i18n';
import { Theme } from '@/constants/theme';
// DISCOVER_GAMES import removed — games section only in Discover tab
import { useScalePress } from '@/hooks/useScalePress';
import { hapticLight, hapticSelection } from '@/utils/haptics';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMood } from '@/contexts/MoodContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  setPendingSearchId,
  setSearchKeywords,
  setPendingMoodText,
  setSearchModeState,
  setSearchAnalyticsContext,
  setDeckResumed,
  setLastFullPrompt,
} from '@/services/moodSearchState';
import { seedPreload, startPreload } from '@/services/recommendationPreload';
import { loadTodayDeck } from '@/services/todayDeckStore';
import TodaySearchCard from '@/components/Home/TodaySearchCard';
import { hasFreeSearchLeft } from '@/utils/searchQuota';
import { isSameSearchText, localDateKey, type TodayDeckSnapshot } from '@/utils/todayDeck';
import { getMoodHistory } from '@/services/profileService';
import * as ExpoCrypto from 'expo-crypto';
import { parseMood } from '@/services/tasteParser';
import { hasAiConsent, recordAiConsent } from '@/services/aiConsent';
import { saveSession } from '@/services/watchlist';
import { readAppUserId } from '@/services/auth-utils';
import { FilmFilters, TasteProfile } from '@/types';
import type { MoodHistoryItem } from '@/types/profile';
import { type ErrorType, toUserError } from '@/utils/errorHelpers';
import { minRatingThreshold, yearRangeToEra } from '@/utils/filmFilters';
import { isMoodInputSubmittable, moodErrorMessageKey } from '@/utils/moodSearchInput';
import { isOfferEligible } from '@/utils/moodOfferTiming';
import { hidesBeyondFree } from '@/utils/moodLock';
import {
  classifyMoodSearchError,
  createSearchAttempts,
  nextActivationStep,
} from '@/utils/moodSearchRetry';
import { getFreeVisibleCount } from '@/services/appConfigFlags';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';

// ─── Tipler ───────────────────────────────────────────────────────────────────

/** Overlay asamalari */
type Phase = 'input' | 'processing';

/** Pipeline ilerleme sinyali — AIProcessingOverlay'e aktarilir */
type PipelineStage = 'parsing' | 'done';

/** Year chip secenegi ID'si */
type YearChipId = 'pre1990' | '1990s' | '2000s' | '2010s' | '2020s' | '';

/** Rating chip secenegi ID'si */
type RatingChipId = '7' | '8' | 'top250' | '';

/** Minimum AI processing gosterme suresi (ms) */
const MIN_PROCESSING_MS = 1500;

// ─── Filter chip type aliases (used by FilterBottomSheet + handleFindMovies) ─


/**
 * Kayitli metni (kart basligi veya tam prompt, EN ya da TR) hizli mood kartina esler.
 * Eslesme yoksa null: metin serbest yazimdir, etiket zaten prompt'tur.
 */
function findMoodCard(text: string) {
  const stored = text.trim().toLocaleLowerCase();
  return MOOD_CARDS.find((c) =>
    (['en', 'tr'] as const).some(
      (locale) =>
        i18n.t(c.titleKey, { locale }).toLocaleLowerCase() === stored ||
        i18n.t(c.searchQuery, { locale }).toLocaleLowerCase() === stored,
    ),
  ) ?? null;
}

// ─── Ana ekran ────────────────────────────────────────────────────────────────

/**
 * Home sekmesi — mood search + AI processing + profil sonucu.
 * Onboarding'den gelen `onboarding` param'i ile ucretsiz ilk arama desteklenir.
 */
export default function MoodSearchScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  /** Onboarding akisi: ArchetypeReveal'den gelen param — mood → discover → paywall zinciri */
  const { onboarding, entry } = useLocalSearchParams<{ onboarding?: string; entry?: string }>();
  const isOnboarding = onboarding === '1';
  const {
    setMoodResult, setCurrentSessionId, setLastMoodText, setLastSearchId,
    setSearchMode,
  } = useMood();
  const { checkQuota, consumeQuota } = useSubscription();
  /** Grandfathered kohort istemci kota duvarina tabi degil — bkz. useProModeAccess */
  const { quotaExempt, allowed: proEntitled, loading: proAccessLoading, searchQuota, refreshSearchQuota } = useProModeAccess({ withQuota: true });
  /** MONEY-1C: acikken arama hakki SADECE sunucuda sayilir (istemci AsyncStorage sayaci atlanir) */
  const offerEnabled = useMoodOfferEnabled();
  const freeVisibleCount = useFreeVisibleCount();
  const { triggerPaywall, paywallProps } = useContextualPaywall();

  const [phase, setPhase] = useState<Phase>('input');
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('parsing');
  /** Metin giris state'i */
  const [moodText, setMoodText] = useState('');
  /** Secili yil filtresi */
  const [yearChip, setYearChip] = useState<YearChipId>('');
  /** Secili IMDb filtresi */
  const [ratingChip, setRatingChip] = useState<RatingChipId>('');
  /** Hata durumu — inline hata mesaji gostermek icin */
  const [moodError, setMoodError] = useState<{ type: ErrorType; message: string } | null>(null);
  /** Kota doldu overlay gorunurlugu */
  const [showQuotaExhausted, setShowQuotaExhausted] = useState(false);
  /**
   * AI rizasi (R-1). `null`: henuz okunmadi. `false` → inline aciklama + tek CTA
   * (Enable and find) gosterilir; sheet bu ekranda ACILMAZ.
   */
  const [consented, setConsented] = useState<boolean | null>(null);
  /** `ai_consent_shown` mount basina bir kez */
  const inlineShownTracked = useRef(false);
  /** Onay bloğu şu an görünüyor mu (`consented === false`) — blur cleanup'ı okur */
  const consentBlockVisible = useRef(false);
  /** Kullanıcı bu mount'ta "Enable and find"a bastı mı */
  const enableTapped = useRef(false);
  /** `ai_consent_dismissed` mount başına en fazla bir kez */
  const dismissedTracked = useRef(false);
  /** Son kota sonucu — QuotaExhausted overlay'ine aktarilir */
  const [lastQuotaResult, setLastQuotaResult] = useState<import('@/constants/subscriptionPlans').QuotaStatus | null>(null);
  /** TextInput focus durumu — glow efekti icin */
  const [isFocused, setIsFocused] = useState(false);

  /** Son mood aramalari — discover tab content section */
  const [recentSearches, setRecentSearches] = useState<MoodHistoryItem[]>([]);
  /** Bugunku deste anlik goruntusu (yalniz cihazda; bayrak acikken okunur). */
  const [todayDeck, setTodayDeck] = useState<TodayDeckSnapshot | null>(null);

  /**
   * Hizli mood karti / Recent'ten gelen aramada ekranda ETIKET gorunur ("Rainy Night"),
   * LLM'e TAM prompt gider. Kullanici metni duzenlerse etiket eslesmez, override devre disi kalir.
   */
  const promptOverride = useRef<{ label: string; prompt: string } | null>(null);
  const promptFor = useCallback((label: string): string => {
    const o = promptOverride.current;
    return o && o.label === label ? o.prompt : label;
  }, []);
  /** MONEY-1C: ayni metinle bitmemis denemeler ayni client_search_id'yi tasir (sunucu hakki bir kez dusurur). */
  const attempts = useRef(createSearchAttempts(() => ExpoCrypto.randomUUID()));
  /** Hak duvarinda kalan arama (metin): satin alma sonrasi AYNI kimlikle otomatik yeniden calisir. */
  const pendingActivation = useRef<string | null>(null);
  /** Satin alma sonrasi "Pro etkinlestiriliyor" dongusu calisiyor mu (cift calismayi onler). */
  const activationRunning = useRef(false);
  const prevEntitled = useRef(proEntitled);
  // Ekran acildiginda kota bilgisini yenile
  useEffect(() => {
    checkQuota();
  }, [checkQuota]);

  // ── Tab focus'ta recent searches yukle ──────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      (async () => {
        // Kimlik OLUŞTURULMAZ, yalnızca okunur. Satır açma işi oturum
        // bootstrap'ına ait (`app/_layout.tsx` → SIGNED_IN → ensureAppUser).
        // Eski hâli burada `getAppUserId()` çağırıp INSERT deniyordu ve
        // hatayı boş `catch` ile yutuyordu — 87 kimliğin 3,5 ay boyunca
        // satırsız kalması bu sessizlik yüzünden görülemedi.
        const userId = await readAppUserId();
        if (!userId) return;

        try {
          const history = await getMoodHistory(userId);
          setRecentSearches(history.slice(0, 3));
        } catch (err) {
          logger.error('[HomeScreen] recent searches yüklenemedi:', err);
        }
      })();
    }, []),
  );

  // MONEY-1C: kalan hak her odakta sunucudan tazelenir (arama sonrasi donuste "ucretsiz arama" ipucu kapanir).
  useFocusEffect(
    useCallback(() => {
      refreshSearchQuota();
    }, [refreshSearchQuota]),
  );

  // MONEY-1C P0: bugunku deste kurtarma — her odakta cihazdan okunur (bayrak kapaliysa hic okunmaz).
  useFocusEffect(
    useCallback(() => {
      if (!offerEnabled || isOnboarding) {
        setTodayDeck(null);
        return;
      }
      let active = true;
      void (async () => {
        const ownerId = await readAppUserId();
        if (!ownerId) return;
        const snapshot = await loadTodayDeck(ownerId);
        if (active) setTodayDeck(snapshot);
      })();
      return () => {
        active = false;
      };
    }, [offerEnabled, isOnboarding]),
  );

  // Rıza durumu her odakta okunur: Ayarlar'dan açılıp/kapatılıp dönüldüğünde güncel kalır.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      hasAiConsent()
        .then((granted) => {
          if (active) setConsented(granted);
        })
        .catch((err: unknown) => {
          Sentry.captureException(err, { tags: { component: 'MoodSearchScreen', flow: 'consent_read' } });
        });
      return () => {
        active = false;
      };
    }, []),
  );

  consentBlockVisible.current = consented === false;

  // Onay bloğu görünürken Enable'a basmadan ekrandan çıkış (blur/unmount) = vazgeçme.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (!consentBlockVisible.current || enableTapped.current || dismissedTracked.current) return;
        dismissedTracked.current = true;
        posthogAnalytics.track('ai_consent_dismissed', { surface: 'mood_search', variant: 'inline' });
      };
    }, []),
  );

  // Inline açıklama ilk kez render edildiğinde (mount başına bir kez).
  useEffect(() => {
    if (consented !== false || inlineShownTracked.current) return;
    inlineShownTracked.current = true;
    posthogAnalytics.track('ai_consent_shown', { surface: 'mood_search', variant: 'inline' });
  }, [consented]);

  const { animatedStyle: btnAnimStyle, onPressIn: btnPressIn, onPressOut: btnPressOut } = useScalePress(0.95);

  /**
   * Mood Card / Quick Mood secildiginde "Find Movies" butonunu kisa sure parlatir + scale pulse.
   * Reanimated SharedValue — dependency array'e gerek yok (stable ref gibi davranir).
   */
  const findBtnFlash = useSharedValue(1);
  const findBtnScale = useSharedValue(1);
  const findBtnFlashStyle = useAnimatedStyle(() => ({
    opacity: findBtnFlash.value,
    transform: [{ scale: findBtnScale.value }],
  }));

  // CTA shimmer'ı V-1 Tur 7'de kaldırıldı — DESIGN_OS §7.4 "parıltı/shimmer
  // yasak" (CTO onaylı).

  /**
   * Kota duvarı: contextual paywall, gösterilmezse QuotaExhausted. Normal arama
   * yolu, ön kota kontrolü AYNI handler'ı kullanır.
   */
  const showQuotaWall = useCallback(async () => {
    const shown = await triggerPaywall({ type: 'quota_exhausted', quota: 'search' });
    if (!shown) {
      setShowQuotaExhausted(true);
    }
  }, [triggerPaywall]);

  /**
   * Arama sonrası ortak adım: store'ları yaz → preload başlat → doğrudan desteye geç.
   * (PRO-0 F0-3: araya profil/paylaşım ekranı girmez; eski "Browse Movies" adımları burada.)
   */
  const applySearchResult = useCallback(
    async (params: {
      /** LLM'e giden tam prompt */
      trimmed: string;
      /** Ekranda ve oturum kaydında gorunen metin (serbest yazimda trimmed ile ayni) */
      label: string;
      filters: FilmFilters;
      profile: TasteProfile;
      searchId: string | null;
      searchKeywords: string[];
      /** Kilitli destede ucretsiz sinirin otesindeki posterler indirilmez (yoksa hepsi). */
      prefetchLimit?: number;
      /** Analitik cekirdegi icin aramanin giris yuzeyi (kullanici metni degil). */
      entryPoint: string;
      /** "Ara"ya basma ani (epoch ms) — mood_deck_started.ms_since_submit */
      submittedAt: number;
    }) => {
      const { trimmed, label, filters, profile, searchId, searchKeywords, prefetchLimit, entryPoint, submittedAt } = params;

      if (filters.yearRange !== null) {
        profile.era_preference = yearRangeToEra(filters.yearRange);
      }

      // Mod preload'dan ÖNCE yazılır: recommendations.ts aynı modu module-level okur.
      setSearchModeState('ai');
      setSearchMode('ai');
      // AI yolu rizayla gelir (parseMood son kapiyi tutar): analitik cekirdegi consent=true.
      setSearchAnalyticsContext({ entryPoint, consent: true, submittedAt });

      // Sprint 1 v4.0: searchId'yi MoodContext'e kaydet — recommendations.ts kullanacak
      setLastSearchId(searchId);
      // Module-level store — React state/ref/effect race condition bypass
      setPendingSearchId(searchId);
      // Tematik keyword'ler — match_films_v3 keyword overlap boost icin
      setSearchKeywords(searchKeywords);
      // Orijinal mood metni — yalnız LLM re-ranker icin
      setPendingMoodText(trimmed);
      // "Filtreleri kaldir" ve rerank her zaman tam prompt'u kullanir; etiket yalniz gosterim icin.
      setLastFullPrompt(trimmed);

      // Recommendations preload — animasyonu beklemeden hemen baslat
      // searchId zaten setPendingSearchId ile set edildi, startPreload consume edecek
      // 350ms erken baslatma: kullanici profili okurken pipeline daha fazla sure kazanir
      startPreload(profile, filters, trimmed, prefetchLimit);

      // LastSessionCard / bugunku deste icin gorunen metin; profil + filtre desteye taşınır.
      setLastMoodText(label);
      setMoodResult(profile, filters);
      // Desteye gonder — kota bilgisini yenile (badge guncellensin)
      checkQuota();
      if (isOnboarding) {
        // Onboarding akisi: 5 film limit + App Store review + paywall zinciri
        router.push({ pathname: '/discover', params: { onboarding: '1' } } as never);
      } else {
        router.push('/discover');
      }

      // Session'i arka planda kaydet — hata akisini engellemez. Etiket kaydedilir (Recent okunur kalir).
      readAppUserId().then((userId) => {
        if (userId) {
          saveSession(userId, label, profile).then((sessionId) => {
            setCurrentSessionId(sessionId);
          });
        }
      });

      // Deste ekrani uste binince arama ekrani girdi asamasina doner (geri donuste overlay kalmasin).
      await new Promise<void>((resolve) => setTimeout(resolve, 350));
      setPhase('input');
    },
    [setSearchMode, setLastSearchId, setCurrentSessionId, setLastMoodText, setMoodResult, checkQuota, isOnboarding, router],
  );

  /** AI yolu: parse-mood + (varsa) rerank. Hata çağırana fırlatılır. */
  const runAiSearch = useCallback(
    async (trimmed: string, label: string, filters: FilmFilters, freeSearch: boolean, submittedAt: number) => {
      // Bayrak acikken (idempotency) kimlik gonderilir; kapaliyken eski govde.
      const attempt = offerEnabled ? attempts.current.idFor(trimmed) : null;
      const [parseResult] = await Promise.all([
        parseMood(trimmed, attempt ? { clientSearchId: attempt.id, isRetry: attempt.isRetry } : undefined),
        new Promise<void>((resolve) => setTimeout(resolve, MIN_PROCESSING_MS)),
      ]);

      const { profile, searchId, searchKeywords, quota } = parseResult;

      // MONEY-1C: ucretsiz hakla yapilan arama basarili — `remaining` sunucudan
      // (null = bilinmiyor). Kapaliyken / yetkili kullanicida olay yok.
      if (freeSearch) {
        posthogAnalytics.track('mood_search_free_completed', {
          entry_point: entry ?? 'direct',
          search_id: searchId,
          remaining: quota.kind === 'available' ? quota.remaining : quota.kind === 'exhausted' ? 0 : null,
        });
      }

      // parseMood bitti — overlay'e sinyal gönder
      setPipelineStage('done');

      // Yetkisiz kullanicida (yetki okunurken dahil) gizli poster indirilmez.
      const prefetchLimit = hidesBeyondFree({ offerEnabled, isOnboarding, entitled: proEntitled })
        ? await getFreeVisibleCount()
        : undefined;

      await applySearchResult({
        trimmed, label, filters, profile, searchId, searchKeywords, prefetchLimit,
        entryPoint: entry ?? 'direct', submittedAt,
      });
      // Arama basariyla bitti: kimlik birakilir, sonraki arama yeni kimlik alir.
      attempts.current.succeeded();
    },
    [applySearchResult, entry, offerEnabled, isOnboarding, proEntitled],
  );

  /**
   * Inline rıza (sheet YOK): `recordAiConsent()` yazar. Başarısızsa Sentry'ye servis
   * içinde yazılır, kullanıcıya hata gösterilir ve `false` döner — çağıran AI çağrısı
   * YAPMAZ (onay kaydedilmeden veri gönderilmez).
   */
  const grantInlineConsent = useCallback(async (): Promise<boolean> => {
    if (await hasAiConsent()) {
      setConsented(true);
      return true;
    }
    const result = await recordAiConsent();
    if (!result.ok) {
      Alert.alert(t('aiConsent.saveError'));
      return false;
    }
    posthogAnalytics.track('ai_consent_granted', { surface: 'mood_search', variant: 'inline' });
    setConsented(true);
    return true;
  }, [t]);

  /**
   * Arama gövdesi: kota kontrolu → arama → profile result.
   *
   * B+C hibrit paywall stratejisi:
   *   - Kota varsa: normal akış
   *   - Kota dolmussa: QuotaExhausted overlay (free → paywall, paid → bekleme mesaji)
   *
   * Çağıran rıza aldığını varsayar (parseMood ayrıca `hasAiConsent` ile son kapıyı tutar).
   */
  const runSearch = useCallback(async (
    opts?: { activation?: boolean; label?: string; prompt?: string },
  ): Promise<string | null> => {
    // Kart/Recent aramasi etiket + tam prompt'u ACIKCA verir (state henuz guncellenmemis olabilir).
    const label = (opts?.label ?? moodText).trim();
    const trimmed = (opts?.prompt ?? promptFor(label)).trim();
    // Sunucuyla ayni 2 karakter siniri (bayraktan bagimsiz; sunucu 1 karakteri 400'ler).
    if (!isMoodInputSubmittable(trimmed) || phase === 'processing') return null;

    const submittedAt = Date.now();
    // CTA hafif haptik — DESIGN_OS §8 `impactLight` (V-1 Tur 7; önce Medium).
    hapticLight();
    Keyboard.dismiss();
    // MONEY-1C: ucretsiz hak yoluyla baslayan arama (bayrak acik, yetkisiz, onboarding disi).
    // Erisim OKUNURKEN `allowed` false gorunur; o anda karar verilmez (premium/legacy
    // kullanici ucretsiz arama olarak sayilmasin) — olay atilmaz, huni kirlenmez.
    const freeSearch = isOfferEligible({
      offerEnabled,
      isOnboarding,
      accessLoading: proAccessLoading,
      entitled: proEntitled,
    });

    // Mod HER aramanın başında açıkça yazılır (önceki aramadan kalan değer
    // recommendations.ts'teki search_id_missing bastırmasını etkilemesin).
    setSearchModeState('ai');
    setSearchMode('ai');

    // ── Kota kontrolu — RPC atomic consume ──────────────────────────────
    // Onboarding'de kota tuketme (ilk arama bedava).
    // `quotaExempt`: grandfathered kohort (legacy_mood_access) istemci
    // duvarina tabi degil — CTO karari 24 Eyl 2026.
    // MONEY-1C: `mood_offer_enabled` aciksa istemci sayaci (AsyncStorage) HIC
    // tuketilmez — tek dogruluk kaynagi parse-mood (429 QUOTA_EXCEEDED).
    if (!isOnboarding && !quotaExempt && !offerEnabled) {
      const quotaResult = await consumeQuota('search');
      setLastQuotaResult(quotaResult);
      if (!quotaResult.allowed) {
        posthogAnalytics.track('quota_exhausted', { quota_type: 'search' });
        // Contextual paywall dene — gosterilmezse fallback QuotaExhausted
        await showQuotaWall();
        return null;
      }
    }

    const yearRange = yearChip ? (yearChip as FilmFilters['yearRange']) : null;
    let minRating: FilmFilters['minRating'] = null;
    if (ratingChip === '7') minRating = 7;
    else if (ratingChip === '8') minRating = 8;
    else if (ratingChip === 'top250') minRating = 'top250';

    const filters: FilmFilters = { yearRange, minRating, regions: [], directors: [] };

    posthogAnalytics.track('mood_searched', {
      mood_text_length: trimmed.length,
      filter_min_rating: minRatingThreshold(minRating),
      filter_era: yearRange,
    });

    // `mood_search_free_started` RIZA dogrulandiktan SONRA: rizayi taze okuyoruz (cagirani
    // ne varsayiyoruz ne de rizanin arada geri cekilmedigini). Riza yoksa olay atilmaz;
    // parseMood'un son kapisi AI_CONSENT_REQUIRED'i zaten yonetir.
    if (freeSearch && (await hasAiConsent())) {
      posthogAnalytics.track('mood_search_free_started', {
        entry_point: entry ?? 'direct',
        mood_text_length: trimmed.length,
      });
    }

    try {
      setMoodError(null);

      setPipelineStage('parsing');
      setPhase('processing');
      await runAiSearch(trimmed, label, filters, freeSearch, submittedAt);
      pendingActivation.current = null;
      return null;
    } catch (err) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.log('[HomeScreen] arama hatasi:', err instanceof Error ? err.message : err);
      }

      const errorCode = err instanceof Error && 'code' in err ? (err as { code: string }).code : 'unknown';

      // Rıza arama sirasinda geri cekildi (R-1) — hata degil, kullanici tercihi.
      // Inline secenekler yeniden gorunur.
      if (errorCode === 'AI_CONSENT_REQUIRED') {
        setConsented(false);
        setPhase('input');
        return null;
      }

      // Satin alma sonrasi etkinlesme penceresi: hak duvari / hiz siniri / IN_PROGRESS geldiyse
      // (sunucu tier'i henuz gormedi) sessizce bekle — hata/paywall gosterme, cagiran dongu AYNI
      // kimlikle yeniden dener (`nextActivationStep`).
      if (opts?.activation && nextActivationStep(errorCode, 1).kind !== 'proceed') {
        setPhase('input');
        return errorCode;
      }

      posthogAnalytics.track('mood_search_failed', {
        error: err instanceof Error ? err.message : 'unknown',
        error_code: errorCode,
        mood_length: trimmed.length,
      });

      const userError = toUserError(err, 'mood');
      // APP_USER_MISSING metni Edge'den cevrilmemis gelir — t() ile degistir.
      // MONEY-1C (bayrak acik): 503 kota servisi / 400 gecersiz girdi icin cevrilmis metin.
      // 503'te paywall YOK ve hak harcanmadi — kullanici sadece tekrar dener.
      const offerMessageKey = moodErrorMessageKey(errorCode, offerEnabled);
      const message = errorCode === 'APP_USER_MISSING'
        ? t('errors.accountSetupIncomplete')
        : offerMessageKey
          ? t(offerMessageKey)
          : userError.message;
      setMoodError({ type: userError.type, message });
      setPhase('input');

      // Paywall YALNIZ gunluk kota kodunda (429 QUOTA_EXCEEDED). Hiz siniri / IN_PROGRESS /
      // servis hatalari hata mesaji gosterir, paywall acmaz.
      if (classifyMoodSearchError(errorCode) === 'paywall') {
        if (offerEnabled) {
          pendingActivation.current = trimmed;
          // MONEY-1C: gunun hakki bittikten sonra ikinci deneme → Pro teklifi
          // ("Unlimited with Pro"). Teklif acilamazsa (premium, orchestrator) eski duvar.
          const shown = await triggerPaywall({ type: 'mood_offer', entry: 'quota_exhausted' });
          if (!shown) await showQuotaWall();
        } else {
          await showQuotaWall();
        }
      }
      return errorCode;
    }
  }, [moodText, yearChip, ratingChip, phase, t, consumeQuota, isOnboarding, quotaExempt, proEntitled, proAccessLoading, entry, offerEnabled, triggerPaywall, showQuotaWall, applySearchResult, runAiSearch, setSearchMode, promptFor]);

  /** Her render'da guncel `runSearch` — etkinlesme dongusu eski kapanisi kullanmasin. */
  const runSearchRef = useRef(runSearch);
  runSearchRef.current = runSearch;

  /**
   * Satin alma sonrasi bekleyen arama (MONEY-1C g): hak duvarinda kalan arama, yetki
   * false → true gecince AYNI client_search_id ile otomatik yeniden calisir. Sunucu tier'i
   * webhook/sync gecikmesiyle gec gorebilir: duvar kodu gelirse ~30 sn boyunca 3 sn arayla
   * "Pro etkinlestiriliyor" mesajiyla yeniden denenir; paywall YENIDEN acilmaz.
   */
  useEffect(() => {
    const became = !prevEntitled.current && proEntitled;
    prevEntitled.current = proEntitled;
    if (!became || !offerEnabled || activationRunning.current) return;
    const pending = pendingActivation.current;
    if (!pending || pending !== promptFor(moodText.trim())) return;

    activationRunning.current = true;
    void (async () => {
      try {
        for (let attempt = 1; ; attempt++) {
          setMoodError({ type: 'server', message: t('moodOffer.activating') });
          const code = await runSearchRef.current({ activation: true });
          const step = nextActivationStep(code, attempt);
          if (step.kind === 'retry') {
            await new Promise<void>((resolve) => setTimeout(resolve, step.waitMs));
            continue;
          }
          if (step.kind === 'give_up') {
            posthogAnalytics.track('mood_activation_timeout', { attempts: attempt });
            setMoodError({ type: 'server', message: t('moodOffer.activatingTimeout') });
          }
          break;
        }
      } finally {
        pendingActivation.current = null;
        activationRunning.current = false;
      }
    })();
  }, [proEntitled, offerEnabled, moodText, t, promptFor]);

  /**
   * "Find Movies" / klavye oku / onSubmitEditing. Rıza yoksa HİÇBİR ŞEY yapmaz:
   * kullanıcı inline CTA ile bilinçli onay verir.
   * Rıza burada taze okunur; okunamazsa hasAiConsent fail-closed `false` döner.
   */
  const handleFindMovies = useCallback(async () => {
    if (!(await hasAiConsent())) {
      setConsented(false);
      return;
    }
    setConsented(true);
    await runSearch();
  }, [runSearch]);

  /** Birincil inline buton: önce rıza yazılır, başarılıysa AI arama. */
  const handleEnableAndFind = useCallback(async () => {
    if (!isMoodInputSubmittable(moodText) || phase === 'processing') return;
    enableTapped.current = true;
    if (!(await grantInlineConsent())) return;
    await runSearch();
  }, [moodText, phase, offerEnabled, grantInlineConsent, runSearch]);

  /**
   * Etiket + tam prompt ile aramayi dogrudan baslatir (hizli mood karti, Recent).
   * Riza yoksa arama BASLAMAZ: metin yazilir, inline riza blogu acilir ve
   * "Enable and find" ayni etiket/prompt ciftiyle devam eder (`promptOverride`).
   */
  const startPicked = useCallback(async (label: string, prompt: string) => {
    promptOverride.current = { label, prompt };
    setMoodText(label);
    if (!(await hasAiConsent())) {
      setConsented(false);
      return;
    }
    setConsented(true);
    await runSearchRef.current({ label, prompt });
  }, []);

  /**
   * Mood card secildiginde — haptik + buton flash + dogrudan arama.
   * MoodCardGrid'den gelen text tam (yerellestirilmis) prompt; ekranda kart basligi gorunur.
   */
  const handleMoodCardSelect = useCallback(
    (text: string, cardId: string) => {
      hapticSelection();
      posthogAnalytics.track('mood_card_tapped', { mood_card_id: cardId });
      const card = MOOD_CARDS.find((c) => c.id === cardId);
      void startPicked(card ? t(card.titleKey) : text, text);
      // Opacity: dim → spring geri
      findBtnFlash.value = withSequence(
        withTiming(0.6, { duration: 80 }),
        withSpring(1, { damping: 10, stiffness: 220 }),
      );
      // Scale: hafif buyu → geri — "Buraya bas!" mesaji
      findBtnScale.value = withSequence(
        withSpring(1.04, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 12, stiffness: 200 }),
      );
    },
    // findBtnFlash + findBtnScale stable SharedValue ref — ESLint uyarisi beklenmez
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, startPicked],
  );

  /**
   * Bugunku desteyi cihazdaki anlik goruntuden acar: parse-mood / match_films / rerank CAGRISI YOK.
   * Profil + filtre MoodContext'e, film listesi preload olarak yerlestirilir; siralama korunur.
   */
  const openTodayDeck = useCallback(() => {
    if (!todayDeck) return;
    hapticLight();
    posthogAnalytics.track('mood_today_deck_reopened', {
      search_id: todayDeck.searchId,
      deck_size: todayDeck.films.length,
    });
    setSearchModeState('ai');
    setSearchMode('ai');
    // Kurtarilan deste yeni arama degil: discover `mood_deck_resumed` atar (`mood_deck_started` degil).
    setSearchAnalyticsContext({ entryPoint: 'today_deck', consent: true });
    setDeckResumed(true);
    setLastSearchId(todayDeck.searchId);
    setLastMoodText(todayDeck.moodText);
    // Snapshot yalniz etiketi tutar: tam prompt etiketten cozulur (kart ise prompt, serbest metinde etiket).
    const savedCard = findMoodCard(todayDeck.moodText);
    setLastFullPrompt(savedCard ? t(savedCard.searchQuery) : todayDeck.moodText);
    setMoodResult(todayDeck.profile, todayDeck.filters);
    seedPreload(todayDeck.films);
    router.push('/discover');
  }, [todayDeck, setSearchMode, setLastSearchId, setLastMoodText, setMoodResult, router, t]);

  /**
   * Recent search tap: bugunku aramaysa mevcut desteyi ac, degilse aramayi baslat.
   * Eski kayitlar tam (robotik) prompt olabilir: iki dilin kart baslik/prompt'lariyla
   * eslestirilir; kart ise etiket + tam prompt, degilse metin ikisi icin de kullanilir.
   */
  const handleRecentTap = useCallback((item: MoodHistoryItem) => {
    hapticLight();
    const card = findMoodCard(item.mood_text);
    const label = card ? t(card.titleKey) : item.mood_text;
    const prompt = card ? t(card.searchQuery) : item.mood_text;
    // Bugunku arama: yeni arama baslatma, mevcut desteyi ac.
    if (
      todayDeck &&
      localDateKey(new Date(item.created_at)) === todayDeck.localDate &&
      (isSameSearchText(todayDeck, item.mood_text) || isSameSearchText(todayDeck, label))
    ) {
      openTodayDeck();
      return;
    }
    posthogAnalytics.track('discover_recent_search_tapped', { mood_text_length: item.mood_text.length });
    void startPicked(label, prompt);
  }, [todayDeck, openTodayDeck, startPicked, t]);

  const canSubmit = isMoodInputSubmittable(moodText) && phase !== 'processing';
  /** MONEY-1C: ucretsiz yol beklentisi — yalniz teklif akisi acik ve kullanici yetkisizken. */
  const showFreeHint =
    consented !== false &&
    isOfferEligible({
      offerEnabled,
      isOnboarding,
      accessLoading: proAccessLoading,
      entitled: proEntitled,
    }) &&
    hasFreeSearchLeft(searchQuota);

  // ── Input asamasi ──────────────────────────────────────────────────────────
  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.background} />
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >

          {/* ── Onboarding: ucretsiz arama banner ────────────────── */}
          {isOnboarding && (
            <View style={styles.onboardingBanner}>
              <Ionicons name="sparkles" size={13} color={Colors.accentPrimary} />
              <View style={styles.onboardingBannerText}>
                <Text style={styles.onboardingBannerTitle}>{t('mood.onboardingFreeSearch')}</Text>
                <Text style={styles.onboardingBannerHint}>{t('mood.onboardingFreeHint')}</Text>
              </View>
            </View>
          )}

          {/* ── Compact Search Bar (sticky top) ─────────────────── */}
          <View style={styles.compactSearchBar}>
            <Ionicons name="search" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.compactInput}
              value={moodText}
              onChangeText={setMoodText}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={t('mood.discoverSearchPlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              returnKeyType="search"
              onSubmitEditing={() => handleFindMovies()}
              blurOnSubmit
            />
            <Animated.View style={findBtnFlashStyle}>
              <TouchableOpacity
                style={[styles.compactSubmitBtn, !canSubmit && styles.compactSubmitBtnDisabled]}
                onPress={handleFindMovies}
                disabled={!canSubmit}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={canSubmit ? Colors.textOnAccent : Colors.textTertiary}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* ── Hata mesaji — search bar altinda ─────────────────── */}
          {moodError != null && (
            <View style={styles.errorBanner}>
              <Ionicons
                name={
                  moodError.type === 'network' ? 'cloud-offline-outline' :
                  moodError.type === 'quota' ? 'lock-closed-outline' :
                  'warning-outline'
                }
                size={18}
                color={Colors.error}
              />
              <Text style={styles.errorBannerText}>{moodError.message}</Text>
              <TouchableOpacity onPress={() => setMoodError(null)} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color={Colors.textGrey} />
              </TouchableOpacity>
            </View>
          )}

          {/* ── Scrollable content ──────────────────────────────── */}
          <ScrollView
            style={styles.discoverScroll}
            contentContainerStyle={styles.discoverScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            {/* ── Filter trigger (bottom sheet) — above mood cards ── */}
            <FilterBottomSheet
              yearChip={yearChip}
              ratingChip={ratingChip}
              onYearChange={setYearChip}
              onRatingChange={setRatingChip}
            />

            {/* ── Mood Card Bento Grid ───────────────────────────── */}
            <MoodCardGrid
              activeMoodText={moodText}
              onSelect={handleMoodCardSelect}
            />

            {/* ── Bugunku arama (MONEY-1C P0, bayrak arkasinda) ───── */}
            {todayDeck && (
              <TodaySearchCard
                moodText={todayDeck.moodText}
                count={todayDeck.films.length}
                onPress={openTodayDeck}
              />
            )}

            {/* ── Son Aramalar (conditional) ─────────────────────── */}
            {recentSearches.length > 0 && (
              <View style={styles.discoverSection}>
                <Text style={styles.discoverSectionTitle}>{t('mood.discoverRecentTitle')}</Text>
                {recentSearches.map((item) => (
                  <TouchableOpacity
                    key={item.session_id}
                    style={styles.recentItem}
                    onPress={() => handleRecentTap(item)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="time-outline" size={16} color={Colors.textSecondary} />
                    <Text style={styles.recentItemText} numberOfLines={1}>{item.mood_text}</Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Games section removed — only shown in Discover tab */}

          </ScrollView>

          {/* ── Sabit Alt Bar: Find Movies butonu ─────────────────── */}
          <View style={styles.bottomBar}>
            {/* Rıza yok (R-1, inline): tek satır açıklama + tek CTA. Sheet açılmaz;
                reddet butonu yok, çıkış sistem geri hareketi (ai_consent_dismissed). */}
            {consented === false && (
              <Text style={styles.inlineConsentBody}>{t('aiConsent.inlineBody')}</Text>
            )}
            {showFreeHint && (
              <Text style={styles.freeHint}>{t('moodOffer.freeSearchHint', { count: freeVisibleCount })}</Text>
            )}
            <Animated.View style={[btnAnimStyle, findBtnFlashStyle]}>
              <TouchableOpacity
                style={[styles.findButton, !canSubmit && styles.findButtonDisabled]}
                onPressIn={btnPressIn}
                onPressOut={btnPressOut}
                onPress={consented === false ? handleEnableAndFind : handleFindMovies}
                disabled={!canSubmit}
                activeOpacity={1}
              >
                <Ionicons
                  name="sparkles"
                  size={18}
                  color={canSubmit ? color.surface.base : withAlpha(color.text.primary, 0.7)}
                />
                <View style={styles.findButtonContent}>
                  <Text style={[styles.findButtonText, !canSubmit && styles.findButtonTextDisabled]}>
                    {consented === false ? t('aiConsent.inlineEnableAndFind') : t('mood.findMovies')}
                  </Text>
                  {/* İkinci satır tek yuva (V-1 Tur 7): disabled → yardımcı metin,
                      enabled → kalan hak. */}
                  {!canSubmit && (
                    <Text style={styles.findButtonHint}>{t('mood.findMoviesHint')}</Text>
                  )}
                  {/* 30 Eyl 2026 kurucu kararı: "N left today" kalan hak satırı
                      KALDIRILDI (butona basınca yanıp sönüyordu). Kota mantığı
                      aynı — yalnız gösterge yok; tükenişte QuotaExhausted açılır. */}
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>

      <AIProcessingOverlay
        visible={phase === 'processing'}
        pipelineStage={pipelineStage}
        onRetry={() => {
          setPhase('input');
          setPipelineStage('parsing');
        }}
        t={t}
      />

      {/* ── Kota Doldu Overlay (fallback) ────────────────────────── */}
      <QuotaExhausted
        visible={showQuotaExhausted}
        onClose={() => setShowQuotaExhausted(false)}
        quotaStatus={lastQuotaResult}
        onUpgrade={() => triggerPaywall({ type: 'quota_exhausted', quota: 'search' })}
      />

      {/* ── Contextual Paywall (orchestrator-driven) ─────────── */}
      <ContextualPaywall {...paywallProps} />
    </>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },

  // ─── Onboarding Banner ──────────────────────────────────────────────────────

  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: Colors.accentPrimary + '18',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Colors.accentPrimary + '35',
  },
  onboardingBannerText: {
    flex: 1,
    gap: 1,
  },
  onboardingBannerTitle: {
    color: Colors.accentPrimary,
    fontSize: Theme.typography.caption.fontSize,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  onboardingBannerHint: {
    color: Colors.textSecondary,
    fontSize: Theme.typography.micro.fontSize,
    lineHeight: Theme.typography.micro.lineHeight,
  },

  // ─── Compact Search Bar ─────────────────────────────────────────────────────

  compactSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 4,
    height: 48,
    backgroundColor: Colors.bgElevated,
    borderRadius: 24,
    paddingHorizontal: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  compactInput: {
    flex: 1,
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textWhite,
    height: 48,
    padding: 0,
  },
  compactSubmitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  compactSubmitBtnDisabled: {
    backgroundColor: Colors.bgSubtle,
  },

  // ─── Discover Scroll Content ────────────────────────────────────────────────

  discoverScroll: {
    flex: 1,
  },
  discoverScrollContent: {
    paddingBottom: 180, // tab bar (83) + bottom bar (~90)
    gap: 20,
    paddingTop: 8,
  },
  discoverSection: {
    gap: 10,
    paddingHorizontal: 20,
  },
  discoverSectionTitle: {
    fontSize: Theme.typography.h3.fontSize,
    lineHeight: Theme.typography.h3.lineHeight,
    fontWeight: '700',
    color: Colors.textWhite,
    letterSpacing: -0.2,
  },

  // (Filter chips moved to FilterBottomSheet component)

  // ─── Recent Searches ────────────────────────────────────────────────────────

  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recentItemText: {
    flex: 1,
    fontSize: Theme.typography.body.fontSize,
    color: Colors.textWhite,
    fontWeight: '500',
  },

  // ─── Sabit Alt Bar ─────────────────────────────────────────────────────────

  bottomBar: {
    paddingHorizontal: 20,
    paddingBottom: 90,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.white10,
    backgroundColor: Colors.background,
    gap: 10,
  },

  // ─── Hata banner ──────────────────────────────────────────────────────────

  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  inlineConsentBody: {
    color: Colors.textSecondary,
    fontSize: Theme.typography.caption.fontSize,
    lineHeight: Theme.typography.caption.lineHeight,
    textAlign: 'center',
  },
  freeHint: {
    color: Colors.textSecondary,
    fontSize: Theme.typography.caption.fontSize,
    lineHeight: Theme.typography.caption.lineHeight,
    textAlign: 'center',
  },
  errorBannerText: {
    flex: 1,
    color: Colors.textWhite,
    fontSize: Theme.typography.caption.fontSize,
    lineHeight: Theme.typography.caption.lineHeight,
  },

  // ─── Find Movies butonu ─────────────────────────────────────────────────────

  // V-1 Tur 7: enabled `bone` dolgu + `ink` metin, disabled `graphite` zemin.
  // Gradient, `marquee`, accentPrimary glow ve shimmer YOK (DESIGN_OS §7.4).
  findButton: {
    backgroundColor: color.text.primary,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    overflow: 'hidden',
  },
  findButtonDisabled: {
    backgroundColor: color.surface.border,
  },
  findButtonText: {
    color: color.surface.base,
    fontSize: Theme.typography.h3.fontSize,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  /** graphite üzerinde bone@70% — 7.0:1 */
  findButtonTextDisabled: {
    color: withAlpha(color.text.primary, 0.7),
  },
  findButtonContent: {
    alignItems: 'center',
    gap: 1,
  },
  /** 11pt — §2.7: smoke değil bone@70% (graphite üzerinde 7.0:1) */
  findButtonHint: {
    color: withAlpha(color.text.primary, 0.7),
    fontSize: Theme.typography.micro.fontSize,
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  // (Quick Moods grid moved to MoodCardGrid component)
});
