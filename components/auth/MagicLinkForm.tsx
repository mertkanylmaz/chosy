/**
 * MagicLinkForm — e-posta ile giriş (K-14 secondary sağlayıcı).
 *
 * TEK bileşen, İKİ yüzey: `app/auth.tsx` ve `components/auth/AuthPromptSheet`.
 * Kopyalanmaz — kopya iki yüzeyin zamanla ayrışması demektir.
 *
 * İki adım:
 *   1. 'email' → adres girilir, `sendMagicLink()` 6 haneli kod yollar
 *   2. 'code'  → kod girilir, `verifyMagicLinkCode()` oturumu kalıcılaştırır
 *
 * Anonim kullanıcıda mod `link`'tir: mevcut kimlik KORUNUR (bkz. authService
 * "Neden iki farklı Supabase çağrısı"). Adres başka bir hesaba aitse akış
 * dead-end'e düşmez, 'conflict' adımına geçer ve kararı kullanıcıya sorar —
 * o hesaba geçmek anonim geçmişi terk etmek demektir, sessizce yapılmaz.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  sendMagicLink,
  verifyMagicLinkCode,
  type MagicLinkMode,
} from '@/services/authService';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

/** Doğrulama kodu uzunluğu — Supabase OTP 6 hane üretir. */
const CODE_LENGTH = 6;

type Step = 'email' | 'code' | 'conflict';

interface MagicLinkFormProps {
  /** Doğrulama başarılı — çağıran yüzey routing/kapanıştan sorumludur. */
  onSuccess: () => void;
  /** Analitik ayrımı için çağıran yüzey ("auth_screen" | "auth_prompt") */
  surface: string;
}

export function MagicLinkForm({ onSuccess, surface }: MagicLinkFormProps) {
  const { t } = useLanguage();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<MagicLinkMode>('signin');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  /** Gönderim sonucunu ekrana çevirir — hata metni sessizce yutulmaz. */
  const handleSend = useCallback(
    async (forceSignIn: boolean) => {
      if (busy) return;
      void hapticLight();
      setErrorMsg(null);
      setBusy(true);

      const result = await sendMagicLink(email, forceSignIn);

      setBusy(false);
      if (result.success) {
        setMode(result.mode);
        setCode('');
        setStep('code');
        return;
      }

      switch (result.error) {
        case 'invalid_email':
          setErrorMsg(t('magicLink.errorInvalidEmail'));
          break;
        case 'already_registered':
          // Dead-end değil: kararı kullanıcıya taşı.
          setStep('conflict');
          break;
        case 'rate_limited':
          setErrorMsg(t('magicLink.errorRateLimited'));
          break;
        case 'network':
          setErrorMsg(t('auth.errorNetwork'));
          break;
        default:
          setErrorMsg(t('auth.errorGeneral'));
      }
    },
    [busy, email, t],
  );

  const handleVerify = useCallback(async () => {
    if (busy) return;
    void hapticLight();
    setErrorMsg(null);
    setBusy(true);

    const result = await verifyMagicLinkCode(email, code, mode);

    setBusy(false);
    if (result.success) {
      void hapticSuccess();
      onSuccess();
      return;
    }

    switch (result.error) {
      case 'invalid_code':
        setErrorMsg(t('magicLink.errorInvalidCode'));
        break;
      case 'expired':
        setErrorMsg(t('magicLink.errorExpired'));
        break;
      case 'network':
        setErrorMsg(t('auth.errorNetwork'));
        break;
      default:
        setErrorMsg(t('auth.errorGeneral'));
    }
  }, [busy, code, email, mode, onSuccess, t]);

  const backToEmail = useCallback(() => {
    void hapticLight();
    setErrorMsg(null);
    setCode('');
    setStep('email');
  }, []);

  // ── conflict: adres başka hesaba ait ──────────────────────────────────────
  if (step === 'conflict') {
    return (
      <View style={styles.root} testID={`magic-link-conflict-${surface}`}>
        <Text style={styles.conflictTitle}>{t('magicLink.conflictTitle')}</Text>
        <Text style={styles.conflictBody}>{t('magicLink.conflictBody')}</Text>

        <TouchableOpacity
          style={[styles.primaryButton, busy && styles.buttonDisabled]}
          onPress={() => void handleSend(true)}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('magicLink.conflictConfirm')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={backToEmail} activeOpacity={0.7}>
          <Text style={styles.linkText}>{t('magicLink.changeEmail')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── code: 6 haneli doğrulama ──────────────────────────────────────────────
  if (step === 'code') {
    return (
      <View style={styles.root} testID={`magic-link-code-${surface}`}>
        <Text style={styles.sentNote}>{t('magicLink.sentTo', { email })}</Text>

        <TextInput
          style={[styles.input, styles.codeInput]}
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          placeholder={t('magicLink.codePlaceholder')}
          placeholderTextColor={Colors.textTertiary}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          editable={!busy}
        />

        {errorMsg !== null && <Text style={styles.errorText}>{errorMsg}</Text>}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (busy || code.length < CODE_LENGTH) && styles.buttonDisabled,
          ]}
          onPress={() => void handleVerify()}
          disabled={busy || code.length < CODE_LENGTH}
          activeOpacity={0.8}
        >
          {busy ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <Text style={styles.primaryButtonText}>{t('magicLink.verify')}</Text>
          )}
        </TouchableOpacity>

        <View style={styles.secondaryRow}>
          <TouchableOpacity style={styles.linkButton} onPress={backToEmail} activeOpacity={0.7}>
            <Text style={styles.linkText}>{t('magicLink.changeEmail')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => void handleSend(mode === 'signin')}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Text style={[styles.linkText, busy && styles.buttonDisabled]}>
              {t('magicLink.resend')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── email: adres girişi ───────────────────────────────────────────────────
  return (
    <View style={styles.root} testID={`magic-link-email-${surface}`}>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={t('magicLink.emailPlaceholder')}
        placeholderTextColor={Colors.textTertiary}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!busy}
      />

      {errorMsg !== null && <Text style={styles.errorText}>{errorMsg}</Text>}

      <TouchableOpacity
        style={[styles.primaryButton, (busy || email.length === 0) && styles.buttonDisabled]}
        onPress={() => void handleSend(false)}
        disabled={busy || email.length === 0}
        activeOpacity={0.8}
      >
        {busy ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <Text style={styles.primaryButtonText}>{t('magicLink.sendCode')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    gap: Theme.spacing.sm,
  },
  input: {
    width: '100%',
    height: 54,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.white10,
    paddingHorizontal: Theme.spacing.md,
    color: Colors.textWhite,
    fontSize: 16,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 8,
    fontSize: 22,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.accentPrimary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    ...Theme.typography.h3,
    color: Colors.background,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  linkButton: {
    paddingVertical: Theme.spacing.xs,
  },
  linkText: {
    ...Theme.typography.caption,
    color: Colors.accentPrimary,
  },
  sentNote: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  conflictTitle: {
    ...Theme.typography.h3,
    color: Colors.textWhite,
    textAlign: 'center',
  },
  conflictBody: {
    ...Theme.typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  errorText: {
    ...Theme.typography.caption,
    color: Colors.error,
    textAlign: 'center',
  },
});
