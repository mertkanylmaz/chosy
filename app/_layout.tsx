import '@/utils/cryptoPolyfill';   // WebCrypto polyfill — ilk satır, sırası kritik
import * as Sentry from '@sentry/react-native';
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
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
import {
  savePushTokenToServer,
  shouldAskForPermission,
  registerForPushNotifications,
  clearBadge,
  getDeepLinkFromNotification,
  type NotificationData,
} from '@/services/pushNotifications';
import SentryErrorBoundary from '@/components/ErrorBoundary';

// ── Sentry initialization ───────────────────────────────────────────────────
// Expo Router kendi entry'sini yonetir — Sentry.wrap() yerine Sentry.init()
// kullaniyoruz. Navigation integration Expo Router ile otomatik calisir.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableAutoSessionTracking: true,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  enableNative: true,
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

  logger.error('[layout] ensureAppUser iki denemede de başarısız:', second.reason);
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
  });

  useEffect(() => {
    // Production'da font hatası uygulamayı crash etmemeli — log + devam et.
    // Font yüklenemese bile uygulama sistem fontuyla çalışmaya devam eder.
    if (fontError) {
      logger.error('[layout] Font yükleme hatası (graceful devam):', fontError);
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

  // Google Sign-In SDK konfigürasyonu (env'den client ID okunur)
  useEffect(() => {
    configureGoogleSignIn();
  }, []);

  // RevenueCat SDK başlatma — auth hazır olduktan sonra user ID ile configure
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const userId = session?.user?.id;
      initializePurchases(userId ?? undefined).catch((err) => {
        logger.error('[layout] RevenueCat başlatma hatası (graceful devam):', err);
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
    // İlk açılış: oturum yoksa anonim oluştur
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        supabase.auth.signInAnonymously().catch(() => {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.error('[auth] signInAnonymously başarısız');
          }
        });
      }
    });

    // Auth state değişiklik dinleyicisi
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
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
          void bootstrapAppUser();
        }

        if (event === 'TOKEN_REFRESHED') {
          // Token yenilendi — offline queue'daki bekleyen islemleri sync et
          processOfflineQueue().catch(() => {});

          // Token yenilemesi başarısız olursa yeniden anonim oturum aç
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              supabase.auth.signInAnonymously().catch(() => {
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.error('[auth] Session recovery başarısız');
                }
              });
            }
          });
        }

        // SIGNED_OUT: yalnızca oturum tamamen yoksa anonim oluştur.
        // Sosyal auth geçişi sırasında (Apple/Google linkIdentity)
        // auth.tsx'teki kullanıcı akışı kendi oturumunu yönetir.
        if (event === 'SIGNED_OUT') {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              supabase.auth.signInAnonymously().catch(() => {
                if (__DEV__) {
                  // eslint-disable-next-line no-console
                  console.error('[auth] signInAnonymously (SIGNED_OUT recovery) başarısız');
                }
              });
            }
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
    savePushTokenToServer().catch(() => {
      // Non-critical — will retry next launch
    });

    // Clear badge on app launch
    clearBadge().catch(() => {});

    // Check if we should prompt for permission (2nd session)
    shouldAskForPermission().then((shouldAsk) => {
      if (shouldAsk) {
        registerForPushNotifications().catch((err) => {
          logger.warn('[layout] Push registration failed:', err);
        });
      }
    }).catch(() => {});
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
              <Stack.Screen name="auth" />
              <Stack.Screen name="setup-profile" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="splash" />
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
