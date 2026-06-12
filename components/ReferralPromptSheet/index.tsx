/**
 * ReferralPromptSheet — One-time dismissible bottom sheet shown after onboarding.
 *
 * Shows after push permission prompt. Dismiss → never shown again.
 * AsyncStorage key: 'referral_prompt_shown'
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Colors } from '@/constants/Colors';
import { Theme } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';
import { getReferralStats } from '@/services/referralService';
import { getAppUserId } from '@/services/watchlist';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'referral_prompt_shown';

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Controls visibility of the one-time referral prompt.
 * Returns { visible, show, dismiss }.
 * Call `show()` after onboarding+push flow completes.
 */
export function useReferralPrompt() {
  const [visible, setVisible] = useState(false);

  /** Check if prompt was already shown, if not show it */
  const show = useCallback(async () => {
    try {
      const alreadyShown = await AsyncStorage.getItem(STORAGE_KEY);
      if (alreadyShown === 'true') return;
      setVisible(true);
    } catch {
      // Silently fail — don't block flow
    }
  }, []);

  const dismiss = useCallback(async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Non-critical
    }
  }, []);

  return { visible, show, dismiss };
}

// ─── Component ────────────────────────────────────────────────────────────────

interface ReferralPromptSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

/**
 * Bottom sheet modal — "Invite a friend, both get +5 searches".
 */
export default function ReferralPromptSheet({ visible, onDismiss }: ReferralPromptSheetProps) {
  const { t } = useLanguage();
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // Load invite code on mount
  useEffect(() => {
    if (!visible) return;

    posthogAnalytics.track('referral_prompt_shown', {});

    async function loadCode() {
      try {
        const userId = await getAppUserId();
        if (!userId) return;
        const stats = await getReferralStats(userId);
        if (stats?.inviteCode) {
          setInviteCode(stats.inviteCode);
        }
      } catch (err) {
        logger.error('[ReferralPrompt] Load invite code error:', err);
      }
    }
    loadCode();
  }, [visible]);

  const handleShare = useCallback(async () => {
    if (!inviteCode || sharing) return;
    hapticLight();
    setSharing(true);

    posthogAnalytics.track('referral_share_tapped', {
      invite_code: inviteCode,
      source: 'onboarding_prompt',
    });

    try {
      const shareMessage = t('referral.promptShareMessage', { code: inviteCode });
      const shareUrl = `https://chosy.vercel.app?ref=${inviteCode}`;

      await Share.share(
        Platform.OS === 'ios'
          ? { message: shareMessage, url: shareUrl }
          : { message: `${shareMessage}\n${shareUrl}` },
      );
    } catch (err) {
      logger.error('[ReferralPrompt] Share error:', err);
    } finally {
      setSharing(false);
      onDismiss();
    }
  }, [inviteCode, sharing, onDismiss, t]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={sheetStyles.overlay}>
        <TouchableOpacity
          style={sheetStyles.backdrop}
          activeOpacity={1}
          onPress={onDismiss}
        />
        <View style={sheetStyles.sheet}>
          {/* Drag indicator */}
          <View style={sheetStyles.handle} />

          {/* Icon */}
          <View style={sheetStyles.iconWrap}>
            <Ionicons name="gift" size={32} color={Colors.accentPrimary} />
          </View>

          {/* Title */}
          <Text style={sheetStyles.title}>{t('referral.promptTitle')}</Text>

          {/* Body */}
          <Text style={sheetStyles.body}>{t('referral.promptBody')}</Text>

          {/* Share button */}
          <TouchableOpacity
            style={sheetStyles.shareBtn}
            onPress={handleShare}
            activeOpacity={0.8}
            disabled={!inviteCode || sharing}
          >
            <Ionicons name="share-outline" size={18} color={Colors.textOnAccent} />
            <Text style={sheetStyles.shareBtnText}>
              {sharing ? t('share.sharing') : t('referral.promptShareButton')}
            </Text>
          </TouchableOpacity>

          {/* Maybe later */}
          <TouchableOpacity
            style={sheetStyles.laterBtn}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={sheetStyles.laterText}>{t('referral.promptLater')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const sheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.white10,
    marginBottom: 24,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textWhite,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: Colors.textGrey,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    maxWidth: 300,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accentPrimary,
    borderRadius: Theme.borderRadius.md,
    height: 48,
    width: '100%',
    marginBottom: 12,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textOnAccent,
  },
  laterBtn: {
    paddingVertical: 12,
  },
  laterText: {
    fontSize: 14,
    color: Colors.textGrey,
    fontWeight: '500',
  },
});
