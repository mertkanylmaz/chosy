/**
 * Onboarding — tek ekran, 3 kart.
 *
 * K-11: slideshow DEGIL. Uc kart tek ekranda birden gorunur, tek CTA ile
 * gecilir. Kullanici hicbir seyi "gecmez" — hepsini bir bakista gorup
 * dogrudan oynamaya baslar.
 *
 * K-12: auth YOK. Anonim oturum _layout.tsx'te acilir, gate buraya
 * dogrudan yonlendirir.
 *
 * R-12: archetype_id / preferences_vector'e YAZAN yol burada yok.
 * Quiz (TasteCalibration), cold-start swipe (TasteSwipe) ve
 * ArchetypeReveal fazlari R-A-1'de akistan cikarildi; bilesenler
 * components/Onboarding/ altinda duruyor (kod silinmez kurali).
 *
 * K-15: push izni istegi buradan kaldirildi — champion sonrasina
 * tasinacak (R-A-2).
 *
 * Akis:
 *   3 kart → CTA → markOnboardingComplete() → /(tabs)
 */
import React, { useCallback, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticSuccess } from '@/utils/haptics';

import { Colors } from '@/constants/Colors';
import { logger } from '@/utils/logger';
import { posthogAnalytics } from '@/services/posthog';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/services/supabase';
import { getAppUserId } from '@/services/watchlist';

// ── Sabitler ─────────────────────────────────────────────────────────────────

/**
 * Kullanıcıya özgü onboarding key üretir.
 * gate.tsx ile aynı format — KRITIK: `chosy_onboarded_${userId}`
 */
async function getOnboardingKey(): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) return `chosy_onboarded_${user.id}`;
  } catch {
    // fallback: global key (auth yoksa, nadir durum)
  }
  return 'chosy_onboarded';
}

/** Tek bir onboarding karti — ikon + baslik + aciklama */
interface OnboardingCard {
  titleKey: string;
  descKey: string;
  icon: 'film-outline' | 'git-compare-outline' | 'tv-outline';
}

/**
 * Uc kart, gauntlet ritualini anlatir: 4 film → 3 tur → 1 sampiyon.
 * Mood arama ve arketip quiz'i v4.0'da emekli — kopya da onu yansitir.
 */
const CARDS: OnboardingCard[] = [
  {
    titleKey: 'onboarding.card1Title',
    descKey: 'onboarding.card1Desc',
    icon: 'film-outline',
  },
  {
    titleKey: 'onboarding.card2Title',
    descKey: 'onboarding.card2Desc',
    icon: 'git-compare-outline',
  },
  {
    titleKey: 'onboarding.card3Title',
    descKey: 'onboarding.card3Desc',
    icon: 'tv-outline',
  },
];

// ── Ekran ────────────────────────────────────────────────────────────────────

/**
 * Onboarding ana bileseni — tek ekran, 3 kart, tek CTA.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { t } = useLanguage();

  // ── PostHog: onboarding_started (mount) ───────────────────────────────────
  useEffect(() => {
    posthogAnalytics.track('onboarding_started');
  }, []);

  /**
   * AsyncStorage + DB'ye onboarding bitisini yazar.
   * gate.tsx her iki kaynagi da okur (AsyncStorage cache, DB source of truth).
   */
  const markOnboardingComplete = useCallback(async () => {
    try {
      const key = await getOnboardingKey();
      await AsyncStorage.setItem(key, '1');
    } catch {
      logger.warn('[Onboarding] AsyncStorage write failed.');
    }

    // DB source of truth — reinstall sonrasi da korunur
    try {
      const appUserId = await getAppUserId();
      if (appUserId) {
        await supabase
          .from('users')
          .update({ onboarding_completed_at: new Date().toISOString() })
          .eq('id', appUserId);
      }
    } catch {
      logger.warn('[Onboarding] DB onboarding_completed_at write failed.');
    }
  }, []);

  /** CTA — onboarding'i tamamla ve ana ekrana (gauntlet) git */
  const handleStart = useCallback(async () => {
    void hapticSuccess();
    posthogAnalytics.track('onboarding_completed');
    await markOnboardingComplete();
    router.replace('/(tabs)' as never);
  }, [router, markOnboardingComplete]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Text style={styles.heading}>{t('onboarding.welcomeTitle')}</Text>

          {CARDS.map((card) => (
            <View key={card.titleKey} style={styles.card}>
              <View style={styles.cardIconWrap}>
                <Ionicons name={card.icon} size={26} color={Colors.accentPrimary} />
              </View>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>{t(card.titleKey)}</Text>
                <Text style={styles.cardDesc}>{t(card.descKey)}</Text>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Tek CTA — Skip yok (R-A-1 karari) */}
        <View style={styles.buttonWrap}>
          <TouchableOpacity
            onPress={() => void handleStart()}
            activeOpacity={0.85}
            style={styles.button}
          >
            <LinearGradient
              colors={[Colors.accentPrimary, Colors.accentHover]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>{t('common.getStarted')}</Text>
              <Ionicons name="arrow-forward" size={18} color={Colors.textOnAccent} />
            </LinearGradient>
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

// ── Stiller ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safe: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 16,
  },

  heading: {
    color: Colors.textWhite,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: 0.2,
    marginBottom: 16,
  },

  // ── Kart ──
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    padding: 20,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(234,219,198,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    color: Colors.textWhite,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  cardDesc: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },

  // ── CTA ──
  buttonWrap: {
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  button: {
    borderRadius: 14,
    overflow: 'hidden',
    height: 56,
    shadowColor: Colors.accentPrimary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: Colors.textOnAccent,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
