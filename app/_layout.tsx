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
import { useRouter } from 'expo-router';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/services/supabase';
import { configureGoogleSignIn } from '@/services/authService';
import { initializePurchases } from '@/services/purchaseService';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MoodProvider } from '@/contexts/MoodContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';
import { processOfflineQueue } from '@/services/offlineQueue';
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
      (event) => {
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
