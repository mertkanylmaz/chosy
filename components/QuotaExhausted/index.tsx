/**
 * QuotaExhausted — kota dolduğunda gösterilen overlay.
 *
 * Mood ekranında "Find Movies" basıldığında kota yoksa
 * bu overlay açılır. "Upgrade" butonu paywall'a yönlendirir.
 *
 * B+C hibrit stratejisi:
 *   - Free kullanıcı: "Bugünkü ücretsiz hakkını kullandın"
 *   - Paid kullanıcı (günlük/haftalık limit): "Limit doldu, yarın/haftaya gel"
 */

import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import type { QuotaCheckResult } from '@/services/quotaEngine';
import type { SubscriptionStatus } from '@/constants/subscriptionPlans';

// ─── Props ───────────────────────────────────────────────────────────────────

interface QuotaExhaustedProps {
  /** Overlay görünür mü? */
  visible: boolean;
  /** Kapatma callback'i */
  onClose: () => void;
  /** Kota bilgisi */
  quota: QuotaCheckResult | null;
  /** Kullanıcı abonelik durumu */
  subscriptionStatus: SubscriptionStatus;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Kota dolduğunda modal overlay gösterir.
 * Free → "Abone ol", Paid → "Yarın/haftaya tekrar gel".
 */
export default function QuotaExhausted({
  visible,
  onClose,
  quota,
  subscriptionStatus,
}: QuotaExhaustedProps) {
  const router = useRouter();
  const { t } = useLanguage();

  const isFree = subscriptionStatus === 'free' || subscriptionStatus === 'expired';

  /** Paywall'a yönlendir */
  function handleUpgrade(): void {
    onClose();
    router.push('/paywall');
  }

  // Mesaj seçimi
  const message = isFree
    ? t('quota.exhaustedFree')
    : quota?.resetAt
      ? t('quota.exhaustedDaily')
      : t('quota.exhaustedWeekly');

  // Reset zamanı formatla
  const resetText = quota?.resetAt
    ? t('quota.waitUntil', {
        time: quota.resetAt.toLocaleDateString(undefined, {
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      })
    : '';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* İkon */}
          <View style={styles.iconCircle}>
            <Ionicons name="hourglass-outline" size={32} color={Colors.accentPrimary} />
          </View>

          {/* Başlık */}
          <Text style={styles.title}>{t('quota.exhaustedTitle')}</Text>

          {/* Açıklama */}
          <Text style={styles.message}>{message}</Text>

          {/* Reset zamanı */}
          {!isFree && resetText !== '' && (
            <Text style={styles.resetText}>{resetText}</Text>
          )}

          {/* CTA: Free → Upgrade, Paid → Kapat */}
          {isFree ? (
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade} activeOpacity={0.8}>
              <LinearGradient
                colors={[Colors.accentPrimary, Colors.accentHover]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.upgradeGradient}
              >
                <Ionicons name="diamond" size={18} color={Colors.textOnAccent} />
                <Text style={styles.upgradeText}>{t('quota.upgradeButton')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.closeText}>{t('common.continue')}</Text>
            </TouchableOpacity>
          )}

          {/* Free ise ek "Kapat" link */}
          {isFree && (
            <TouchableOpacity style={styles.dismissLink} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.dismissText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Stiller ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Theme.borderRadius.xl,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.white10,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentPrimary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  resetText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 20,
  },
  upgradeButton: {
    width: '100%',
    borderRadius: Theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: 8,
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
  },
  upgradeText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },
  closeButton: {
    width: '100%',
    height: 48,
    borderRadius: Theme.borderRadius.lg,
    backgroundColor: Colors.bgElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  dismissLink: {
    paddingVertical: 12,
  },
  dismissText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
});
