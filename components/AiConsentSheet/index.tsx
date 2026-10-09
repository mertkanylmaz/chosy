/**
 * AiConsentSheet — R-1: third-party AI (Anthropic/Claude) rıza sheet'i.
 *
 * Just-in-time: LLM'e kullanıcı verisi götüren ilk eylemden ÖNCE açılır
 * (`services/aiConsent.ensureAiConsent`). Servis React'e bağlı olmadığı için
 * sheet bir host bileşeniyle köprülenir: `AiConsentHost` kök layout'a bir kez
 * monte edilir, servise `show()` kaydeder.
 *
 * ── İki eşit ağırlıkta buton ────────────────────────────────────────────────
 * "Kabul" ve "Şimdi değil" aynı boyut, aynı çerçeve, aynı metin stili. Hiçbiri
 * accent dolgusu almaz — rıza, görsel ağırlıkla yönlendirilmez. Backdrop ve
 * geri tuşu "Şimdi değil" ile aynı sonucu verir.
 *
 * ── Yazma hatası ────────────────────────────────────────────────────────────
 * "Kabul" yazımı başarısızsa sheet AÇIK kalır, kısa hata gösterilir, yeniden
 * denenebilir. Rıza yazılmadan çağıran taraf `true` almaz.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  recordAiConsent,
  recordAiConsentDeclined,
  registerAiConsentHost,
  trackAiConsentGranted,
  type AiConsentSurface,
} from '@/services/aiConsent';
import { hapticLight } from '@/utils/haptics';

interface AiConsentSheetProps {
  visible: boolean;
  busy: boolean;
  errorMsg: string | null;
  onAccept: () => void;
  onDecline: () => void;
}

export function AiConsentSheet({ visible, busy, errorMsg, onAccept, onDecline }: AiConsentSheetProps) {
  const { t } = useLanguage();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDecline}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onDecline} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{t('aiConsent.title')}</Text>
            <Text style={styles.intro}>{t('aiConsent.intro')}</Text>

            <View style={styles.rows}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('aiConsent.sentLabel')}</Text>
                <Text style={styles.rowText}>{t('aiConsent.sentText')}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('aiConsent.purposeLabel')}</Text>
                <Text style={styles.rowText}>{t('aiConsent.purposeText')}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('aiConsent.notSentLabel')}</Text>
                <Text style={styles.rowText}>{t('aiConsent.notSentText')}</Text>
              </View>
            </View>

            {errorMsg !== null && <Text style={styles.errorText}>{errorMsg}</Text>}

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.button, busy && styles.disabled]}
                onPress={onAccept}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{t('aiConsent.accept')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, busy && styles.disabled]}
                onPress={onDecline}
                disabled={busy}
                activeOpacity={0.7}
                accessibilityRole="button"
              >
                <Text style={styles.buttonText}>{t('aiConsent.decline')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Kök layout'a bir kez monte edilir. Servisin `ensureAiConsent` çağrısını
 * sheet'e çevirir; sonuç `show()` Promise'ine döner.
 */
export function AiConsentHost() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const surfaceRef = useRef<AiConsentSurface>('mood_search');
  const resolveRef = useRef<((granted: boolean) => void) | null>(null);

  const finish = useCallback((granted: boolean) => {
    setVisible(false);
    setBusy(false);
    setErrorMsg(null);
    const resolve = resolveRef.current;
    resolveRef.current = null;
    resolve?.(granted);
  }, []);

  useEffect(() => {
    registerAiConsentHost({
      show: (surface) =>
        new Promise<boolean>((resolve) => {
          surfaceRef.current = surface;
          resolveRef.current = resolve;
          setErrorMsg(null);
          setVisible(true);
        }),
    });
    return () => {
      registerAiConsentHost(null);
      // Host sökülürken bekleyen çağrı askıda kalmasın: ret sayılır.
      resolveRef.current?.(false);
      resolveRef.current = null;
    };
  }, []);

  const handleAccept = useCallback(async () => {
    if (busy) return;
    void hapticLight();
    setBusy(true);
    setErrorMsg(null);
    const result = await recordAiConsent();
    if (result.ok) {
      trackAiConsentGranted(surfaceRef.current);
      finish(true);
      return;
    }
    // Hata servis içinde Sentry'ye yazıldı; sheet açık kalır, tekrar denenebilir.
    setBusy(false);
    setErrorMsg(t('aiConsent.saveError'));
  }, [busy, finish, t]);

  const handleDecline = useCallback(() => {
    if (busy) return;
    void hapticLight();
    recordAiConsentDeclined(surfaceRef.current);
    finish(false);
  }, [busy, finish]);

  return (
    <AiConsentSheet
      visible={visible}
      busy={busy}
      errorMsg={errorMsg}
      onAccept={() => void handleAccept()}
      onDecline={handleDecline}
    />
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
  intro: {
    ...Theme.typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Theme.spacing.xs,
  },
  rows: {
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.sm,
  },
  row: {
    gap: 2,
  },
  rowLabel: {
    ...Theme.typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },
  rowText: {
    ...Theme.typography.body,
    color: Colors.textWhite,
    lineHeight: 22,
  },
  errorText: {
    ...Theme.typography.caption,
    color: Colors.error,
    textAlign: 'center',
  },
  buttons: {
    gap: Theme.spacing.sm,
    marginTop: Theme.spacing.xs,
  },
  button: {
    width: '100%',
    height: 54,
    borderRadius: Theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    ...Theme.typography.h3,
    color: Colors.textWhite,
  },
  disabled: {
    opacity: 0.5,
  },
});
