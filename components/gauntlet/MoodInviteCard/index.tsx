/**
 * MoodInviteCard — Pro Mode daveti (MONEY-1C). Satır içi kart, MODAL DEĞİL.
 *
 * Yüzeyler: `champion_card` (şampiyon ekranı, Spotlight kartının altında) ve
 * `spotlight_card` (Spotlight sonucu). Sahibi bayrağı (`mood_offer_enabled`) ve
 * sığma kuralını çağıran denetler; bu bileşen KİTLEYİ kendisi denetler
 * (`moodInviteAccess`): premium/trial hiç görmez, yükleniyor/hata → gizli.
 *
 * Dokunuş `/pro-mode`'a gider — kapı orada karar verir (hak varsa arama, bittiyse teklif).
 * Gauntlet ritüeline ve ask kurallarına dokunmaz.
 */
import React, { useCallback, useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useLanguage } from '@/contexts/LanguageContext';
import { useProModeAccess } from '@/hooks/useProModeAccess';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';
import { createInviteShownTracker, moodInviteAccess, type MoodInviteSurface } from '@/utils/moodInvite';

import { styles } from './styles';

/** Oturum boyu yuzey basina bir `mood_invite_shown` (remount'ta tekrarlanmaz). */
const inviteShown = createInviteShownTracker();

interface MoodInviteCardProps {
  surface: MoodInviteSurface;
}

export function MoodInviteCard({ surface }: MoodInviteCardProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const router = useRouter();
  const { loading, error, reason } = useProModeAccess();
  const access = moodInviteAccess({ loading, error, reason });

  /** `mood_invite_shown` oturumda yüzey başına bir kez (kitle belli olunca). */
  useEffect(() => {
    if (access === null || !inviteShown.claim(surface)) return;
    posthogAnalytics.track('mood_invite_shown', { surface, access });
  }, [access, surface]);

  const handlePress = useCallback(() => {
    if (access === null) return;
    void hapticLight();
    posthogAnalytics.track('mood_invite_tapped', { surface, access });
    // `entry`: hangi davetten gelindi — pro-mode olaylarında kaynak ayrımı.
    router.push({ pathname: '/pro-mode', params: { entry: surface } });
  }, [access, surface, router]);

  if (access === null) return null;

  return (
    <View style={styles.slot}>
      <TouchableOpacity
        style={styles.card}
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={t('moodOffer.inviteTitle')}
      >
        <View style={styles.textBlock}>
          <Text style={styles.kicker}>{t('proMode.title')}</Text>
          <Text style={styles.title}>{t('moodOffer.inviteTitle')}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  );
}
