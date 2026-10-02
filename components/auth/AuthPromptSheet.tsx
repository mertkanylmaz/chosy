/**
 * AuthPromptSheet — K-13: "Save your cinema journey" + "Not now".
 *
 * Tetikleyici: ilk şampiyon reveal'ının hemen ardı (GauntletShell). Değer
 * karşılığı sorulur — değer ÖNCE verilir, giriş SONRA istenir.
 *
 * §7.1 yüzey listesi bunu "sheet · atlanabilir" olarak kilitler: full-screen
 * DEĞİL, ritüelin son anını kesmez, backdrop'a dokunmak kapatır.
 *
 * ── "Not now" da bayrağı yazar (CTO kararı, 22 Ağu 2026) ───────────────────
 * K-13 prompt'u "atlanabilir" tanımlıyor; her şampiyonda tekrar sormak
 * atlanabilirliği geri alırdı. Sheet ömür boyu EN FAZLA bir kez görünür.
 * Giriş yolu kapanmaz — profile → Sign In her zaman açıktır.
 *
 * Tek sağlayıcı UI'da: Apple (yalnız iOS). E-posta magic link (K-14) UI'dan
 * sökülü — MagicLinkForm + authService fonksiyonları geri açılabilir altyapı
 * olarak duruyor.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as AppleAuthentication from 'expo-apple-authentication';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { signInWithApple } from '@/services/authService';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';

interface AuthPromptSheetProps {
  visible: boolean;
  /**
   * Sheet kapandı. `completed` giriş yapıldıysa true, "Not now" ya da
   * backdrop ile kapatıldıysa false. İki durumda da `auth_prompt_seen`
   * yazılır — bayrağı çağıran taraf (GauntletShell) yazar.
   */
  onClose: (completed: boolean) => void;
}

export function AuthPromptSheet({ visible, onClose }: AuthPromptSheetProps) {
  const { t } = useLanguage();
  const [appleBusy, setAppleBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    posthogAnalytics.track('auth_prompt_viewed', { surface: 'champion_sheet' });
  }, [visible]);

  const handleApple = useCallback(async () => {
    if (appleBusy) return;
    void hapticLight();
    setErrorMsg(null);
    setAppleBusy(true);

    try {
      const result = await signInWithApple();

      if (result.success) {
        posthogAnalytics.track('auth_prompt_completed', {
          provider: 'apple',
          surface: 'champion_sheet',
        });
        onClose(true);
        return;
      }

      if (result.error === 'canceled') {
        // Kullanıcı Apple dialog'unu kapattı — sheet açık kalır, hata yok.
        return;
      }
      if (result.error === 'not_available') {
        setErrorMsg(t('auth.errorNotAvailable'));
        return;
      }
      if (result.error === 'network') {
        setErrorMsg(t('auth.errorNetwork'));
        return;
      }
      if (result.error === 'identity_already_exists') {
        // Apple kimliği başka hesapta — anonim oturum korundu. Çakışma
        // UX'i B-1 / Fix 1b'de; geçici olarak genel hata copy'si.
        setErrorMsg(t('auth.errorGeneral'));
        return;
      }
      setErrorMsg(t('auth.errorGeneral'));
    } catch (err) {
      logger.error('[AuthPromptSheet] Apple handler hatası:', err);
      setErrorMsg(t('auth.errorGeneral'));
    } finally {
      setAppleBusy(false);
    }
  }, [appleBusy, onClose, t]);

  const handleDismiss = useCallback(() => {
    void hapticLight();
    posthogAnalytics.track('auth_prompt_dismissed', { surface: 'champion_sheet' });
    onClose(false);
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleDismiss} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{t('authPrompt.title')}</Text>
            <Text style={styles.body}>{t('authPrompt.body')}</Text>

            {Platform.OS === 'ios' && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
                cornerRadius={Theme.borderRadius.lg}
                style={[styles.appleButton, appleBusy && styles.disabled]}
                onPress={() => void handleApple()}
              />
            )}

            {errorMsg !== null && <Text style={styles.errorText}>{errorMsg}</Text>}

            <TouchableOpacity
              style={styles.laterButton}
              onPress={handleDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.laterText}>{t('authPrompt.notNow')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white10,
    marginBottom: Theme.spacing.md,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: Theme.spacing.sm,
  },
  title: {
    ...Theme.typography.h1,
    color: Colors.textWhite,
    textAlign: 'center',
  },
  body: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Theme.spacing.sm,
  },
  appleButton: {
    width: '100%',
    height: 54,
  },
  disabled: {
    opacity: 0.5,
  },
  laterButton: {
    alignSelf: 'center',
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
    marginTop: Theme.spacing.xs,
  },
  laterText: {
    ...Theme.typography.h3,
    color: Colors.textTertiary,
  },
  errorText: {
    ...Theme.typography.caption,
    color: Colors.error,
    textAlign: 'center',
  },
});
