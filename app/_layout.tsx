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
import { useEffect } from 'react';
import 'react-native-reanimated';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import { supabase } from '@/services/supabase';
import { configureGoogleSignIn } from '@/services/authService';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { MoodProvider } from '@/contexts/MoodContext';

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
    if (fontError) throw fontError;
  }, [fontError]);

  // Google Sign-In SDK konfigürasyonu (env'den client ID okunur)
  useEffect(() => {
    configureGoogleSignIn();
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

  // Font yüklemesi tamamlanınca splash'i kaldır
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return <RootLayoutNav />;
}

/**
 * Navigasyon ağacı.
 * entry.tsx onboarding ve kullanıcı türü kontrolünü yönetir.
 */
function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <LanguageProvider>
        <MoodProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
              <Stack.Screen name="gate" />
              <Stack.Screen name="entry" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="setup-profile" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="splash" />
              <Stack.Screen
                name="film/[id]"
                options={{ animation: 'slide_from_bottom' }}
              />
            </Stack>
          </ThemeProvider>
        </MoodProvider>
      </LanguageProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
