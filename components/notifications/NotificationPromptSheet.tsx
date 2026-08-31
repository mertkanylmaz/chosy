/**
 * NotificationPromptSheet — K-15: "Want your four ready every evening?"
 *
 * Bağlam içinde sorulur: bir şampiyon görüldükten SONRA, ritüelin ne olduğu
 * anlaşılmışken. İlk açılışta izin istenmez (K-15) — o tetikleyici R-A-1'de,
 * `_layout.tsx`'teki oturum-sayacı tetikleyicisi R-A-2'de kaldırıldı.
 *
 * ── Neden yumuşak sheet, neden doğrudan OS diyaloğu değil ──────────────────
 * iOS izin diyaloğu TEK ATIŞLIKTIR: reddedilirse uygulama bir daha soramaz,
 * kullanıcı Ayarlar'a gitmek zorunda kalır. Yumuşak sheet, OS diyaloğunu
 * yalnızca kullanıcı zaten "evet" dedikten sonra açar.
 *
 * Auth prompt ile ASLA aynı oturumda art arda gösterilmez (CTO kararı,
 * 22 Ağu 2026) — sıralamayı GauntletShell yönetir.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { posthogAnalytics } from '@/services/posthog';
import {
  markNotificationPermissionAsked,
  registerForPushNotifications,
} from '@/services/pushNotifications';
import { hapticLight } from '@/utils/haptics';

interface NotificationPromptSheetProps {
  visible: boolean;
  /** Sheet kapandı — `granted` OS izni verildiyse true. */
  onClose: (granted: boolean) => void;
}

export function NotificationPromptSheet({ visible, onClose }: NotificationPromptSheetProps) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    posthogAnalytics.track('notification_prompt_viewed', { surface: 'champion_sheet' });
  }, [visible]);

  const handleEnable = useCallback(async () => {
    if (busy) return;
    void hapticLight();
    setBusy(true);

    // OS diyaloğunu açar; kabulde token'ı sunucuya yazar.
    const granted = await registerForPushNotifications();

    // Kabul de ret de "sorduk" sayılır — sheet bir daha gösterilmez.
    await markNotificationPermissionAsked();

    posthogAnalytics.track('notification_prompt_answered', {
      surface: 'champion_sheet',
      granted,
    });

    setBusy(false);
    onClose(granted);
  }, [busy, onClose]);

  const handleDismiss = useCallback(async () => {
    if (busy) return;
    void hapticLight();
    await markNotificationPermissionAsked();
    posthogAnalytics.track('notification_prompt_dismissed', { surface: 'champion_sheet' });
    onClose(false);
  }, [busy, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => void handleDismiss()}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => void handleDismiss()}
        />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.iconWrap}>
            <Ionicons name="moon-outline" size={30} color={Colors.accentPrimary} />
          </View>

          <Text style={styles.title}>{t('notificationPrompt.title')}</Text>
          <Text style={styles.body}>{t('notificationPrompt.body')}</Text>

          <TouchableOpacity
            style={[styles.primaryButton, busy && styles.disabled]}
            onPress={() => void handleEnable()}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator color={Colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>{t('notificationPrompt.enable')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterButton}
            onPress={() => void handleDismiss()}
            disabled={busy}
            activeOpacity={0.7}
          >
            <Text style={styles.laterText}>{t('notificationPrompt.notNow')}</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white10,
    marginBottom: Theme.spacing.sm,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
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
  disabled: {
    opacity: 0.5,
  },
  laterButton: {
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.lg,
  },
  laterText: {
    ...Theme.typography.h3,
    color: Colors.textTertiary,
  },
});
