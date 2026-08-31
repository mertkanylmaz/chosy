import '@/utils/cryptoPolyfill';   // WebCrypto polyfill — ilk satır, sırası kritik
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { useEffect, useRef } from 'react';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_400Regular_Italic,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_700Bold_Italic,
  PlayfairDisplay_900Black,
} from '@expo-google-fonts/playfair-display';
import {
  MartianMono_400Regular,
  MartianMono_600SemiBold,
} from '@expo-google-fonts/martian-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, AppStateStatus } from 'react-native';

import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import { useRouter } from 'expo-router';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/services/supabase';
import { remoteConfig } from '@/services/remoteConfig';
import { tasteSignals } from '@/services/tasteSignalService';
import { configureGoogleSignIn } from '@/services/authService';
import { initializePurchases } from '@/services/purchaseService';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MoodProvider } from '@/contexts/MoodContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';
import { processOfflineQueue } from '@/services/offlineQueue';
import { ensureAppUser } from '@/services/auth-utils';
import { syncWatchedFilms } from '@/services/watchSync';
import {
  savePushTokenToServer,
  clearBadge,
  getDeepLinkFromNotification,
  type NotificationData,
} from '@/services/pushNotifications';
import SentryErrorBoundary from '@/components/ErrorBoundary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authIdSuffix,
  persistAuthIdSuffix,
  reconcileColdStartIdentity,
} from '@/utils/identityReset';

// ── Sentry initialization ───────────────────────────────────────────────────
// Expo Router kendi entry'sini yonetir — Sentry.wrap() yerine Sentry.init()
// kullaniyoruz. Navigation integration Expo Router ile otomatik calisir.
// ── Release health (E-04) ───────────────────────────────────────────────────
// EAS source map upload'ı bu release/dist ile eşleşmezse stack trace'ler
// üründeki sürüme bağlanamaz — Sentry'de "unminified" ham JS görünür.
// `release` sürüm + slug taşır (EAS source map hook'unun bindiği anahtar),
// `dist` native build numarasıdır (aynı version içindeki farklı build'leri
// ayırt eder — appVersionSource: remote + autoIncrement ile her build farklı).
const appVersion = Constants.expoConfig?.version ?? 'unknown';
const appSlug = Constants.expoConfig?.slug ?? 'chosy-ai';
const sentryRelease = `${appSlug}@${appVersion}`;
const sentryDist = Constants.nativeBuildVersion ?? undefined;

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableAutoSessionTracking: true,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enableNative: true,
  release: sentryRelease,
  dist: sentryDist,
  // Production'da debug kapali — verbose log istemiyoruz
  debug: __DEV__,
  // Hassas veri filtreleme
  beforeSend(event) {
    // Development'ta Sentry'e gonderme (DSN bos ise zaten gondermez)
    if (__DEV__ && !process.env.EXPO_PUBLIC_SENTRY_DSN) {
      return null;
    }
    return event;
  },
});

// ── PostHog initialization ───────────────────────────────────────────────────
posthogAnalytics.init();

// Geliştirme ortamında reduced motion strict uyarısını kapat
if (__DEV__) {
  configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });
}

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'gate',
};

// Splash ekranın font yüklemesi bitmeden kapanmasını engelle
SplashScreen.preventAutoHideAsync();

/**
 * Oturum bootstrap'ı: `public.users` satırının varlığını garanti eder.
 *
 * Başarısızlık SESSİZ GEÇMEZ. Geçici ağ hatalarını kurtarmak için bir kez
 * yeniden denenir; ikinci deneme de başarısızsa Sentry'ye `fatal` yazılır —
 * çünkü o kimlik kotaya, analitiğe ve ödeme sistemine hiç giremez ve
 * `parse-mood` ona 403 döner (C.0c kalem 3).
 *
 * Kullanıcı akışı bloklanmaz: hata ekranı göstermek yeni bir UI pattern'i ve
 * ayrı bir mimari karar olurdu. Kullanıcı tarafındaki görünürlük 403 yolundan
 * geliyor; buradaki iş, arızanın BİZE görünür olmasını sağlamak.
 */
async function bootstrapAppUser(): Promise<void> {
  const first = await ensureAppUser();
  if (first.ok) return;

  // NO_SESSION yeniden denemeye değmez — oturum yoksa `SIGNED_IN` zaten
  // tutarsızdır ve ikinci deneme aynı sonucu verir.
  if (first.reason === 'NO_SESSION') {
    Sentry.captureMessage('bootstrapAppUser: SIGNED_IN olayında oturum yok', {
      level: 'error',
      tags: { function: 'bootstrapAppUser', error_code: 'APP_USER_CREATE_FAILED' },
    });
    return;
  }

  await new Promise<void>((resolve) => setTimeout(resolve, 1500));

  const second = await ensureAppUser();
  if (second.ok) {
    logger.warn('[layout] ensureAppUser ilk denemede başarısız, ikincide düzeldi');
    return;
  }

  logger.error('[layout] ensureAppUser iki denemede de başarısız:', second.reason, { skipBridge: true });
  Sentry.captureMessage(
    'bootstrapAppUser: public.users satırı iki denemede de oluşturulamadı — kimlik sisteme giremiyor',
    {
      level: 'fatal',
      tags: { function: 'bootstrapAppUser', error_code: 'APP_USER_CREATE_FAILED' },
      extra: { reason: second.reason },
    },
  );
}

/**
 * Root layout — font yükleme ve onboarding durumu kontrolünü yönetir.
 * Her ikisi hazır olana kadar splash ekran açık kalır.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    PlayfairDisplay_400Regular,
    PlayfairDisplay_400Regular_Italic,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_700Bold_Italic,
    PlayfairDisplay_900Black,
    // "Karanlık Salon" — DESIGN_OS §3.1, §3.3. Archivo Expanded'ın statik
    // Expanded kesiti @expo-google-fonts/archivo'da yok (yalnızca Roman
    // genişlik) — resmi variable font'tan (wdth=125, STAT tablosunda
    // "Expanded" olarak etiketli) fonttools ile üretildi.
    ArchivoExpanded_600SemiBold: require('../assets/fonts/ArchivoExpanded-SemiBold.ttf'),
    ArchivoExpanded_700Bold: require('../assets/fonts/ArchivoExpanded-Bold.ttf'),
    MartianMono_400Regular,
    MartianMono_600SemiBold,
  });

  useEffect(() => {
    // Production'da font hatası uygulamayı crash etmemeli — log + devam et.
    // Font yüklenemese bile uygulama sistem fontuyla çalışmaya devam eder.
    if (fontError) {
      logger.warn('[layout] Font yükleme hatası (graceful devam):', fontError);
    }
  }, [fontError]);

  // ── Remote config hydration ──────────────────────────────────────────
  // Supabase'den app_config çekip flag'leri belleğe yükler.
  // Fire-and-forget: splash'i bloklamaz, hata durumunda cache/default'a düşer.
  useEffect(() => {
    remoteConfig.hydrate().catch((err) => {
      logger.warn('[layout] remoteConfig hydrate hatası (graceful devam):', err);
    });
  }, []);

  // ── EAS Update: explicit check + fetch + reload ─────────────────────
  // Otomatik kontrol (checkAutomatically: ON_LOAD) yeterli olmadigi icin
  // JS tarafinda da kontrol ediyoruz. Belt-and-suspenders.
  useEffect(() => {
    async function checkForOTAUpdate(): Promise<void> {
      try {
        // Development client'ta expo-updates calismaz
        if (__DEV__) return;

        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          logger.log('[layout] OTA update bulundu, indiriliyor...');
          posthogAnalytics.track('ota_update_found');

          const result = await Updates.fetchUpdateAsync();
          if (result.isNew) {
            logger.log('[layout] OTA update indirildi, sonraki acilista uygulanacak');
            posthogAnalytics.track('ota_update_fetched');
            // Sessiz reload — kullanici aktif kullaniyorsa rahatsiz etme,
            // sonraki cold start'ta otomatik uygulanir.
            // Opsiyonel: hemen reload etmek icin Updates.reloadAsync();
          }
        }
      } catch (err) {
        // expo-updates development'ta veya Expo Go'da hata verir — sessiz devam
        logger.warn('[layout] OTA update check hatasi:', err);
      }
    }

    checkForOTAUpdate();
  }, []);

  // ── Taste signals offline queue flush ─────────────────────────────────
  // Network kesintilerinde AsyncStorage'a düşen sinyaller burada Supabase'e
  // gönderilir. Sprint 2 TASK 2.1.
  useEffect(() => {
    tasteSignals.flushOfflineQueue().catch((err) => {
      logger.warn('[layout] tasteSignals flush hatası (graceful devam):', err);
    });
  }, []);

  // ── PostHog: app_launched event ───────────────────────────────────────────
  useEffect(() => {
    posthogAnalytics.track('app_launched');
  }, []);

  // ── PostHog: background/inactive geçişinde bekleyen event'leri gönder ─────
  // flushAt/flushInterval eşiklerine ulaşmadan kapatılan oturumlarda
  // (ör. cold-start testi: event at → hemen kapat) kuyruktaki event'ler
  // olmadan uygulama arka plana düşerse kaybolabilir.
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        posthogAnalytics.flush().catch((err) => {
          logger.warn('[layout] PostHog flush hatası (graceful devam):', err);
        });
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, []);

  // Google Sign-In SDK konfigürasyonu (env'den client ID okunur)
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  // RevenueCat SDK başlatma — auth hazır olduktan sonra user ID ile configure
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id;
      initializePurchases(userId ?? undefined).catch((err) => {
        logger.warn('[layout] RevenueCat başlatma hatası (graceful devam):', err);
      });
    }).catch((err) => {
      logger.error('[layout] Auth session alınamadı (RC başlatılmadı):', err);
    });
  }, []);

  // Offline queue — app acilisinda bekleyen islemleri sync et
  useEffect(() => {
    processOfflineQueue().catch((err) => {
      logger.warn('[layout] Offline queue isleme hatasi:', err);
    });
  }, []);

  // Anonim oturum — oturum yoksa signInAnonymously() ile aç
  // Auth state listener ile oturum expire olduğunda otomatik recovery
  useEffect(() => {
    // ── E-08: kimlik sıfırlamasının görünürlüğü ────────────────────────────
    // Anonim kimlik kaybolduğunda kullanıcı tüm geçmişini kaybeder ama
    // uygulama "çalışıyor" görünür. Bu blok KURTARMA yapmaz — yalnızca olayın
    // Sentry ve PostHog'a yansımasını sağlar. Son bilinen auth id burada
    // tutulur ki SIGNED_OUT recovery'de eski kimliğin var olup olmadığı
    // raporlanabilsin; PostHog'a yalnızca son 8 karakter gider (authIdSuffix).
    let lastKnownAuthId: string | null = null;

    // ── Cold-start sıfırlama tespiti ───────────────────────────────────────
    // `lastKnownAuthId` yalnızca BU koşum içinde yaşar: uygulama kapalıyken
    // kaybolan kimliği göremez. AsyncStorage temizlenmesi veya cold start'ta
    // oturumun geri yüklenememesi hiç `SIGNED_OUT` yayınlamaz — o yol
    // yukarıdaki dalların kör noktasıdır. Kalıcı iz `utils/identityReset`
    // içinde, Supabase'in auth token anahtarından AYRI bir anahtarda tutulur.
    //
    // Tek giriş noktası: çözülmüş bir oturum id'si gördüğümüz her yer burayı
    // çağırır. İlk çağrı uzlaştırır (oku → raporla → yaz), sonrakiler yalnızca
    // izi tazeler — tazeleme olmadan kullanıcının KASITLI kimlik değişimi
    // (Apple/Google ile giriş) bir sonraki açılışta sıfırlama sanılırdı.
    //
    // Yazmalar tek zincirde serileşir: bir tazeleme uzlaştırmadan önce
    // koşarsa referans değer ezilir ve sıfırlama sonsuza dek görünmez olur.
    let coldStartChecked = false;
    let identityChain: Promise<unknown> = Promise.resolve();

    const noteResolvedIdentity = (authId: string): void => {
      const task: () => Promise<void> = coldStartChecked
        ? () => persistAuthIdSuffix(AsyncStorage, authId)
        : async () => {
            await reconcileColdStartIdentity(AsyncStorage, authId, (previousSuffix, currentSuffix) => {
              // Kimlik cold start'ta değişmiş: kullanıcı watchlist'ini,
              // gauntlet geçmişini ve DNA'sını kaybetti — ama hiçbir
              // SIGNED_OUT yayınlanmadı, açılış temiz kurulum gibi göründü.
              posthogAnalytics.track('identity_reset_detected', {
                had_previous_session: true,
                previous_auth_id_suffix: previousSuffix,
                new_auth_id_suffix: currentSuffix,
                trigger: 'cold_start',
              });
            });
          };

      coldStartChecked = true;

      identityChain = identityChain.then(task).catch((err) => {
        // Depo okunamadı/yazılamadı: ÖLÇÜM körleşir ama kullanıcı akışı
        // etkilenmez — bu yüzden warning, fatal değil.
        Sentry.captureException(err, {
          level: 'warning',
          tags: { flow: 'identity_reset_visibility' },
        });
      });
    };

    // İlk açılış: oturum yoksa anonim oluştur
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // ⚠️ `signInAnonymously()` API hatasında REDDETMEZ, `{ error }` ile
        // resolve eder. Eski `.catch()` yalnızca ağ istisnasını görüyordu;
        // 4xx/5xx yanıtlar sessizce düşüyordu. `throw` ikisini de tek yola
        // sokar — akış davranışı değişmez, yalnızca görünürlük eklenir.
        supabase.auth.signInAnonymously().then(({ error }) => {
          if (error) throw error;
        }).catch((err) => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.error('[auth] signInAnonymously başarısız');
          }
          Sentry.captureException(err, {
            level: 'fatal',
            tags: { flow: 'anonymous_session_recovery' },
          });
        });
      }
    }).catch((err) => {
      // getSession reddederse anonim oturum HİÇ açılmaz: kullanıcı kimliksiz
      // kalır ve bu dal daha önce hiçbir iz bırakmıyordu.
      Sentry.captureException(err, {
        level: 'fatal',
        tags: { flow: 'anonymous_session_recovery' },
      });
    });

    // watchSync: chosy_watched_films → watchlist.watched_at kurtarma senkronu.
    // Yalnızca INITIAL_SESSION'da, tek seferlik (bu effect bir kez kurulur).
    let hasSyncedWatchedFilms = false;

    // Auth state değişiklik dinleyicisi
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Kimlik sıfırlaması tespiti için son bilinen auth id'yi taze tut.
        // SIGNED_OUT'ta `session` zaten null gelir, bu yüzden okuma değil
        // YAZMA burada olmalı (SIGNED_OUT dalı bir öncekini okur).
        if (session?.user?.id) {
          lastKnownAuthId = session.user.id;

          // Cold start uzlaştırması buradan tetiklenir: INITIAL_SESSION
          // (oturum geri yüklendi) ya da anonim oturumun açılmasıyla gelen
          // SIGNED_IN — hangisi önce çözülürse. İkisi de "oturum kuruldu"
          // anıdır ve `noteResolvedIdentity` yalnızca ilkinde uzlaştırır.
          noteResolvedIdentity(session.user.id);
        }

        // `public.users` satırını GARANTİ et — oturum bootstrap'ı.
        // Anonim/kayıtlı ayrımı YOK: her oturum satır alır. Bu çağrı 10 Ağu
        // 2026'da UI katmanından (app/(tabs)/index.tsx useFocusEffect) buraya
        // taşındı; orada 87 kimlik 3,5 ay boyunca satırsız kalmıştı.
        //
        // ⚠️ INITIAL_SESSION şart. Oturum AsyncStorage'dan geri yüklendiğinde
        // Supabase `SIGNED_IN` DEĞİL `INITIAL_SESSION` yayınlar. Yalnızca
        // `SIGNED_IN` dinlenirse mevcut 87 satırsız kimlik bu düzeltmeden hiç
        // faydalanamaz — onlar zaten oturum sahibi. Bu dal sayesinde kimlik
        // uygulamayı bir kez daha açtığında satır kendiliğinden oluşur.
        //
        // `session?.user` guard'ı çağrı noktasında: INITIAL_SESSION oturum
        // YOKKEN de (session: null) yayınlanır; o dalda ensureAppUser
        // NO_SESSION dönüp gereksiz Sentry error üretirdi.
        //
        // Her açılışta çalışması sorunsuz: ensureAppUser idempotent upsert,
        // tek `onConflict` isteği.
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          const bootstrapPromise = bootstrapAppUser();
          void bootstrapPromise;

          // AsyncStorage'daki izlenmiş filmleri sunucuya taşı — bootstrap
          // (public.users satırı garanti) tamamlandıktan sonra, arka planda.
          if (event === 'INITIAL_SESSION' && !hasSyncedWatchedFilms) {
            hasSyncedWatchedFilms = true;
            void bootstrapPromise.then(() =>
              syncWatchedFilms().catch((err) => {
                logger.error('[layout] syncWatchedFilms beklenmedik hata:', err);
              }),
            );
          }
        }

        if (event === 'TOKEN_REFRESHED') {
          // Token yenilendi — offline queue'daki bekleyen islemleri sync et
          // Kuyruk işlenemezse kullanıcı eylemi kaybolur ama akış durmaz:
          // warning seviyesi, sonraki token yenilemesinde yeniden denenir.
          processOfflineQueue().catch((err) => {
            Sentry.captureException(err, {
              level: 'warning',
              tags: { flow: 'offline_queue_token_refresh' },
            });
          });

          // Token yenilemesi başarısız olursa yeniden anonim oturum aç
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              // `{ error }` resolve'u için: bkz. ilk açılış dalındaki not.
              supabase.auth.signInAnonymously().then(({ error }) => {
                if (error) throw error;
              }).catch((err) => {
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.error('[auth] Session recovery başarısız');
                }
                Sentry.captureException(err, {
                  level: 'fatal',
                  tags: { flow: 'anonymous_session_recovery' },
                });
              });
            }
          }).catch((err) => {
            Sentry.captureException(err, {
              level: 'fatal',
              tags: { flow: 'anonymous_session_recovery' },
            });
          });
        }

        // SIGNED_OUT: yalnızca oturum tamamen yoksa anonim oluştur.
        // Sosyal auth geçişi sırasında (Apple/Google linkIdentity)
        // auth.tsx'teki kullanıcı akışı kendi oturumunu yönetir.
        if (event === 'SIGNED_OUT') {
          // Recovery'ye girerken bilinen ESKİ kimlik. Aşağıdaki başarı dalı
          // yeni kimliği yazmadan önce burada dondurulur.
          const previousAuthId = lastKnownAuthId;

          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              supabase.auth.signInAnonymously().then(({ data, error }) => {
                if (error) throw error;

                // Yeni anonim kimlik açıldı — yani kullanıcı sessizce
                // sıfırlandı: watchlist, gauntlet geçmişi ve DNA'sı artık
                // erişilemez durumda. Kurtarma YOK (ayrı mimari karar);
                // buradaki iş olayın ölçülebilir olması.
                const newAuthId = data.session?.user?.id ?? null;
                lastKnownAuthId = newAuthId ?? lastKnownAuthId;

                posthogAnalytics.track('identity_reset_detected', {
                  had_previous_session: previousAuthId !== null,
                  previous_auth_id_suffix: authIdSuffix(previousAuthId),
                  new_auth_id_suffix: authIdSuffix(newAuthId),
                  trigger: 'signed_out_recovery',
                });
              }).catch((err) => {
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.error('[auth] signInAnonymously (SIGNED_OUT recovery) başarısız');
                }
                Sentry.captureException(err, {
                  level: 'fatal',
                  tags: { flow: 'anonymous_session_recovery' },
                });
              });
            }
          }).catch((err) => {
            Sentry.captureException(err, {
              level: 'fatal',
              tags: { flow: 'anonymous_session_recovery' },
            });
          });
        }
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // ── Push Notifications setup ─────────────────────────────────────────────
  useEffect(() => {
    // Refresh push token on every launch (token can rotate)
    // Non-critical — will retry next launch. Yine de sessiz kalmaz: token
    // kalıcı olarak yazılamıyorsa kullanıcı bildirim almayı tamamen keser.
    savePushTokenToServer().catch((err) => {
      Sentry.captureException(err, {
        level: 'warning',
        tags: { flow: 'push_token_save' },
      });
    });

    // Clear badge on app launch
    clearBadge().catch((err) => {
      Sentry.captureException(err, {
        level: 'warning',
        tags: { flow: 'push_clear_badge' },
      });
    });

    // K-15 (R-A-2): oturum-sayacı tetikleyicisi KALDIRILDI. Bildirim izni
    // artık uygulama açılışında değil, ilk şampiyondan sonra bağlam içinde
    // isteniyor — `NotificationPromptSheet`, GauntletShell'den açılır.
    // Burada yalnızca mevcut token'ın tazelenmesi kalır (izin zaten
    // verilmişse); izin İSTEĞİ bu dosyadan çıkmıştır.
  }, []);

  // Font yüklemesi tamamlanınca (veya hata olunca) splash'i kaldır.
  // fontError durumunda da devam etmeli — sistem fontu ile çalışır.
  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SentryErrorBoundary>
      <RootLayoutNav />
    </SentryErrorBoundary>
  );
}

/**
 * Navigasyon ağacı.
 * entry.tsx onboarding ve kullanıcı türü kontrolünü yönetir.
 */
function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const notificationResponseListener = useRef<Notifications.EventSubscription | null>(null);

  // ── Deep link from push notification tap ────────────────────────────────
  useEffect(() => {
    notificationResponseListener.current =
      Notifications.addNotificationResponseReceivedListener((response: Notifications.NotificationResponse) => {
        const data = response.notification.request.content.data as NotificationData | undefined;
        const route = getDeepLinkFromNotification(data);
        if (route) {
          // Small delay to ensure navigation is ready
          setTimeout(() => {
            try {
              router.push(route as never);
            } catch (err) {
              logger.warn('[push] Deep link navigation failed:', err);
            }
          }, 500);
        }
      });

    return () => {
      if (notificationResponseListener.current) {
        notificationResponseListener.current.remove();
      }
    };
  }, [router]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <LanguageProvider>
        <MoodProvider>
          <SubscriptionProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="gate" />
              <Stack.Screen name="entry" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
              {/* E-05 köprü ekranı: tek seferlik, kaydırarak atlanamaz. */}
              <Stack.Screen name="relaunch-intro" options={{ gestureEnabled: false }} />
              <Stack.Screen name="auth" />
              <Stack.Screen name="setup-profile" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="discover"
                options={{ animation: 'slide_from_right', headerShown: false }}
              />
              <Stack.Screen
                name="watchlist-detail"
                options={{ animation: 'slide_from_right', headerShown: false }}
              />
              <Stack.Screen
                name="film/[id]"
                options={{ animation: 'slide_from_bottom' }}
              />
              <Stack.Screen
                name="games"
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="roulette"
                options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
              />
              <Stack.Screen
                name="paywall"
                options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
              />
              <Stack.Screen
                name="lifetime"
                options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
              />
              <Stack.Screen
                name="referral"
                options={{ animation: 'slide_from_right' }}
              />
            </Stack>
          </ThemeProvider>
          </SubscriptionProvider>
        </MoodProvider>
      </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
