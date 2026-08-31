/**
 * Relaunch Intro — E-05 "Chosy değişti" köprü ekranı (§6).
 *
 * Yalnızca RELAUNCH ÖNCESİ açılmış hesaplara, ömür boyu BİR KEZ gösterilir.
 * Kohort koşulu gate.tsx'te: `legacy_mood_access = true` (migration 090,
 * kesme anı 2026-08-17 15:30+00) ve `has_seen_relaunch_intro = false`
 * (migration 103). Relaunch sonrası açılan hesaplar bu ekranı hiç görmez.
 *
 * ── Neden full-screen, neden sheet değil (CTO kararı, 22 Ağu 2026) ─────────
 * Bu atlanabilir bir promosyon değil, alışkanlık kırılmasına karşı kasıtlı
 * bir "dur ve fark et" anı. Sheet, Home'un üstüne binen ve refleksle
 * kapatılan bir katmandır — tam olarak önlemeye çalıştığımız "hiç okumadan
 * geçti" senaryosunu kolaylaştırırdı. Geçişler sheet değil, route'tur.
 * §7.1'in 11 yüzey listesinde YER ALMAMASI da bunu doğrular: kalıcı bir UI
 * durumu değil, sürüme özel bir geçiş.
 *
 * Onboarding DEĞİLDİR: yeniden tanıştırmadır. Üç satır, tek CTA, geri yok,
 * atlama yok.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import { markUserFlag } from '@/services/userFlags';
import { hapticLight } from '@/utils/haptics';

export default function RelaunchIntro() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    posthogAnalytics.track('relaunch_intro_viewed');
  }, []);

  /**
   * CTA — bayrağı yazar, sonra Home'a geçer.
   *
   * Yazma BEKLENİR: erken navigasyon, yazma başarısız olduğunda kullanıcının
   * ekranı ikinci kez görmesi demektir. Yazma yine de başarısız olursa akış
   * ENGELLENMEZ (hata `markUserFlag` içinde Sentry'ye yazılmıştır) —
   * kullanıcı bir açıklama ekranına kilitlenmez.
   */
  const handleContinue = useCallback(async () => {
    if (busy) return;
    void hapticLight();
    setBusy(true);

    const written = await markUserFlag('has_seen_relaunch_intro');
    posthogAnalytics.track('relaunch_intro_completed', { flag_written: written });

    router.replace('/(tabs)');
  }, [busy]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.line1}>{t('relaunchIntro.line1')}</Text>
        <Text style={styles.line2}>{t('relaunchIntro.line2')}</Text>
        <Text style={styles.line3}>{t('relaunchIntro.line3')}</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.cta, busy && styles.ctaDisabled]}
          onPress={() => void handleContinue()}
          disabled={busy}
          activeOpacity={0.85}
        >
          <Text style={styles.ctaText}>{t('relaunchIntro.cta')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Theme.spacing.xl,
    gap: Theme.spacing.lg,
  },
  line1: {
    ...Theme.typography.h1,
    fontSize: 30,
    color: Colors.textWhite,
    lineHeight: 38,
  },
  line2: {
    ...Theme.typography.body,
    fontSize: 18,
    color: Colors.textSecondary,
    lineHeight: 27,
  },
  line3: {
    ...Theme.typography.body,
    fontSize: 18,
    color: Colors.gold,
    lineHeight: 27,
  },
  footer: {
    paddingHorizontal: Theme.spacing.xl,
    paddingBottom: Theme.spacing.xl,
  },
  cta: {
    width: '100%',
    height: 54,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    ...Theme.typography.h3,
    color: Colors.background,
  },
});
