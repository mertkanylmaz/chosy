/**
 * MoodEntryCard — şampiyon ekranında Mood Gauntlet girişi (Pro Mode Faz 2-2). Satır içi, MODAL DEĞİL.
 *
 * Yer: Spotlight kartı ile geri sayım satırı arası. Bayrak (`mood_gauntlet_enabled`) ve sığma
 * kuralı (`moodEntryFits`) ÇAĞIRANDA denetlenir; bu bileşen yetkiyi kendisi okur:
 * yükleniyor / okuma hatası → gizli (belirsizlikte giriş gösterilmez).
 *
 * Dokunuş: Pro/legacy → `/pro-mode`; ücretsiz → mevcut hard paywall (orkestratör,
 * `profile_upgrade` + kaynak `mood_gauntlet_entry`). Paywall açılmazsa sessiz bırakılmaz (Sentry).
 * Gauntlet ritüeline ve ask kurallarına dokunmaz.
 */
import React, { useCallback, useEffect } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import * as Sentry from '@sentry/react-native';
import { useRouter } from 'expo-router';

import ContextualPaywall from '@/components/paywalls/ContextualPaywall';
import { useContextualPaywall } from '@/components/paywalls/useContextualPaywall';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProModeAccess } from '@/hooks/useProModeAccess';
import { posthogAnalytics } from '@/services/posthog';
import { hapticLight } from '@/utils/haptics';
import {
  createEntryViewedTracker,
  formatEntryTime,
  MOOD_GAUNTLET_ENTRY_SOURCE,
  moodEntryTapTarget,
} from '@/utils/moodEntry';

import { styles } from './styles';

/** Oturum boyu TEK `pro_entry_viewed` (yüzeyden bağımsız; remount'ta tekrarlanmaz). */
export const entryViewed = createEntryViewedTracker();

interface MoodEntryCardProps {
  /** Sonraki dörtlü saati — mevcut geri sayım hedefi (`countdownTarget`). */
  nextFourAt: Date;
}

export function MoodEntryCard({ nextFourAt }: MoodEntryCardProps): React.JSX.Element | null {
  const { t } = useLanguage();
  const router = useRouter();
  const { allowed, loading, error } = useProModeAccess();
  const { triggerPaywall, paywallProps } = useContextualPaywall();
  const visible = !loading && !error;

  useEffect(() => {
    if (!visible || !entryViewed.claim('champion')) return;
    posthogAnalytics.track('pro_entry_viewed', { surface: 'champion' });
  }, [visible]);

  const handlePress = useCallback(async () => {
    if (!visible) return;
    void hapticLight();
    posthogAnalytics.track('pro_entry_tapped', { surface: 'champion', is_pro: allowed });
    if (moodEntryTapTarget(allowed) === 'pro_mode') {
      router.push({ pathname: '/pro-mode', params: { entry: 'champion' } });
      return;
    }
    const shown = await triggerPaywall({ type: 'profile_upgrade', entry: MOOD_GAUNTLET_ENTRY_SOURCE });
    if (!shown) {
      Sentry.captureMessage('[MoodEntryCard] mood_gauntlet_entry paywall acilmadi', {
        level: 'warning',
        tags: { screen: 'home', flow: 'mood_gauntlet_entry' },
      });
    }
  }, [visible, allowed, router, triggerPaywall]);

  if (!visible) return null;

  const time = formatEntryTime(nextFourAt);
  const title = t('moodEntry.title', { time });

  return (
    <View style={styles.slot}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => void handlePress()}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={styles.textBlock}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{t('moodEntry.subtitle')}</Text>
        </View>
        <View style={styles.badgePill}>
          <Text style={styles.badge} numberOfLines={1}>{t('moodEntry.badge')}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
      <ContextualPaywall {...paywallProps} />
    </View>
  );
}
