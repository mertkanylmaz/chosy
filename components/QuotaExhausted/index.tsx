/**
 * QuotaExhausted — kota doldugunda gosterilen overlay.
 *
 * Mood ekraninda "Find Movies" basildiginda kota yoksa
 * bu overlay acilir. "Upgrade" butonu paywall'a yonlendirir.
 *
 * V2: QuotaStatus (RPC) tipine gecis — tier alani sayesinde
 * subscriptionStatus prop'u kaldirildi.
 *
 * Strateji:
 *   - Free: "Arama hakkini kullandin" + Upgrade CTA
 *   - Paid: "Gunluk limit doldu" + reset zamani + Kapat
 */

import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import type { QuotaStatus } from '@/constants/subscriptionPlans';

// ─── Props ───────────────────────────────────────────────────────────────────

interface QuotaExhaustedProps {
  /** Overlay gorunur mu? */
  visible: boolean;
  /** Kapatma callback'i */
  onClose: () => void;
  /** RPC'den donen kota bilgisi (null = henuz yuklenmedi) */
  quotaStatus: QuotaStatus | null;
  /** Upgrade butonuna basildiginda cagirilacak callback — parent triggerPaywall cagirir */
  onUpgrade?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Kota doldugunda modal overlay gosterir.
 * Free → "Abone ol", Paid → "Yarin tekrar gel".
 */
export default function QuotaExhausted({
  visible,
  onClose,
  quotaStatus,
  onUpgrade,
}: QuotaExhaustedProps) {
  const { t } = useLanguage();

  const isFree = !quotaStatus || quotaStatus.tier === 'free';

  /** Contextual paywall'i trigger et */
  function handleUpgrade(): void {
    onClose();
    onUpgrade?.();
  }

  // Mesaj secimi
  const message = isFree
    ? t('quota.exhaustedFree')
    : t('quota.exhaustedDaily');

  // Kalan/limit bilgisi
  const limitInfo = quotaStatus
    ? t('quota.limitInfo', { used: quotaStatus.used, limit: quotaStatus.limit })
    : '';

  // Reset zamani formatla
  const resetText = quotaStatus?.resetAt
    ? t('quota.waitUntil', {
        time: quotaStatus.resetAt.toLocaleDateString(undefined, {
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
          {/* Ikon */}
          <View style={styles.iconCircle}>
            <Ionicons name="hourglass-outline" size={32} color={Colors.accentPrimary} />
          </View>

          {/* Baslik */}
          <Text style={styles.title}>{t('quota.exhaustedTitle')}</Text>

          {/* Aciklama */}
          <Text style={styles.message}>{message}</Text>

          {/* Limit bilgisi — paid kullanicilara gosterilir */}
          {!isFree && limitInfo !== '' && (
            <Text style={styles.limitInfo}>{limitInfo}</Text>
          )}

          {/* Reset zamani */}
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
  /** Kullanim/limit bilgisi — "3/3 used" */
  limitInfo: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 4,
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
